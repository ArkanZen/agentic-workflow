import fs from 'node:fs/promises';
import path from 'node:path';
import { detectCapabilities } from './capabilities.js';
import { directoryExists, normalizeScanRoots } from './paths.js';
import { parseConfigMarkers } from './parse.js';
import { readOpenSpecStats } from './openspec.js';

// 扫描深度上限，避免误扫大型目录造成卡顿。
const MAX_SCAN_DEPTH = 4;

// 默认忽略目录，减少 node_modules 和 Git 数据的扫描成本。
const IGNORED_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage']);

/**
 * 安全读取文本文件。
 * @param {string} filePath 文件路径。
 * @returns {Promise<string | null>} 文件内容；读取失败时返回 null。
 */
async function readText(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * 安全读取 JSON 文件。
 * @param {string} filePath 文件路径。
 * @returns {Promise<object | null>} JSON 对象；读取或解析失败时返回 null。
 */
async function readJson(filePath) {
  const content = await readText(filePath);
  if (!content) {
    return null;
  }
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * 判断目录是否包含 agentic-workflow 安装信号。
 * @param {string} directory 待检查目录。
 * @returns {Promise<boolean>} 包含 manifest 或配置标记时返回 true。
 */
async function hasWorkflowSignal(directory) {
  const manifestPath = path.join(directory, '.agentic-workflow/manifest.json');
  const configPath = path.join(directory, 'openspec/config.yaml');
  const manifest = await readText(manifestPath);
  if (manifest) {
    return true;
  }
  const config = await readText(configPath);
  return Boolean(config?.includes('agentic-workflow-version'));
}

/**
 * 递归扫描目录，收集包含工作流信号的项目目录。
 * @param {string} root 扫描根目录。
 * @param {number} depth 当前递归深度。
 * @param {Set<string>} projects 项目路径集合。
 * @returns {Promise<void>}
 */
async function scanDirectory(root, depth, projects) {
  if (depth > MAX_SCAN_DEPTH || !(await directoryExists(root))) {
    return;
  }
  if (await hasWorkflowSignal(root)) {
    projects.add(root);
    return;
  }

  let entries = [];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(entries
    .filter((entry) => entry.isDirectory() && !IGNORED_DIRS.has(entry.name))
    .map((entry) => scanDirectory(path.join(root, entry.name), depth + 1, projects)));
}

/**
 * 从 manifest 和 config 生成项目展示模型。
 * @param {string} projectPath 项目路径。
 * @param {Record<string, {available: boolean, detail: string}>} capabilities 本机工具能力。
 * @returns {Promise<object>} 项目摘要。
 */
async function buildProjectSummary(projectPath, capabilities) {
  const manifestPath = path.join(projectPath, '.agentic-workflow/manifest.json');
  const configPath = path.join(projectPath, 'openspec/config.yaml');
  const manifest = await readJson(manifestPath);
  const configContent = await readText(configPath);
  const markers = configContent ? parseConfigMarkers(configContent) : { tier: null, version: null };
  const openspec = await readOpenSpecStats(projectPath);

  return {
    id: Buffer.from(projectPath).toString('base64url'),
    name: path.basename(projectPath),
    path: projectPath,
    installed: Boolean(manifest),
    partial: !manifest && Boolean(markers.version),
    tier: manifest?.tier ?? markers.tier ?? 'unknown',
    workflowVersion: manifest?.workflowVersion ?? markers.version ?? 'unknown',
    hosts: manifest?.hosts ?? { claude: false, codex: false },
    sourceRepo: manifest?.sourceRepo ?? '',
    workflowPath: manifest?.workflowPath ?? null,
    manifest,
    config: markers,
    capabilities,
    openspec,
    doctor: null
  };
}

/**
 * 扫描本地工作流项目。
 * @param {string[]} roots 扫描根目录。
 * @returns {Promise<{roots: string[], projects: object[]}>} 扫描结果。
 */
export async function discoverProjects(roots) {
  const normalizedRoots = normalizeScanRoots(roots);
  const projects = new Set();

  await Promise.all(normalizedRoots.map((root) => scanDirectory(root, 0, projects)));

  const capabilities = await detectCapabilities();
  const summaries = await Promise.all([...projects].sort().map((projectPath) => buildProjectSummary(projectPath, capabilities)));

  return {
    roots: normalizedRoots,
    projects: summaries
  };
}
