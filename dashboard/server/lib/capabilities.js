import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runFile } from './exec.js';

/**
 * 判断文件系统路径是否存在。
 * @param {string} targetPath 待检查路径。
 * @returns {Promise<boolean>} 路径存在时返回 true。
 */
async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 读取文本文件，读取失败时返回空字符串。
 * @param {string} filePath 文件路径。
 * @returns {Promise<string>} 文件文本内容。
 */
async function readText(filePath) {
  try {
    return (await fs.readFile(filePath, 'utf8')).trim();
  } catch {
    return '';
  }
}

/**
 * 读取 JSON 文件，读取失败时返回空对象。
 * @param {string} filePath 文件路径。
 * @returns {Promise<object>} JSON 对象。
 */
async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * 比较两个语义化版本号。
 * @param {string} current 当前版本。
 * @param {string} latest 最新版本。
 * @returns {boolean} 当前版本落后时返回 true。
 */
function isVersionBehind(current, latest) {
  if (!current || !latest || current === latest) {
    return false;
  }
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);
  const length = Math.max(currentParts.length, latestParts.length);
  for (let index = 0; index < length; index += 1) {
    const currentValue = currentParts[index] || 0;
    const latestValue = latestParts[index] || 0;
    if (currentValue < latestValue) {
      return true;
    }
    if (currentValue > latestValue) {
      return false;
    }
  }
  return false;
}

/**
 * 查询 OpenSpec CLI 的当前版本和 npm 最新版本。
 * @returns {Promise<{current: string, latest: string, updateAvailable: boolean}>} 版本信息。
 */
async function getOpenSpecVersionInfo() {
  const current = await runFile('openspec', ['--version'], { timeout: 5000 });
  const latest = await runFile('npm', ['view', '@fission-ai/openspec', 'version'], { timeout: 8000 });
  const currentVersion = current.exitCode === 0 ? current.stdout.trim() : '';
  const latestVersion = latest.exitCode === 0 ? latest.stdout.trim() : '';
  return {
    current: currentVersion,
    latest: latestVersion,
    updateAvailable: isVersionBehind(currentVersion, latestVersion)
  };
}

/**
 * 查询 GStack 安装版本和更新检测结果。
 * @param {string} root GStack 安装目录。
 * @returns {Promise<{current: string, latest: string, updateAvailable: boolean}>} 版本信息。
 */
async function getGStackVersionInfo(root) {
  const current = await readText(path.join(root, 'VERSION'));
  const updateCheck = await runFile(path.join(root, 'bin/gstack-update-check'), [], { timeout: 8000 });
  const match = updateCheck.stdout.match(/UPGRADE_AVAILABLE\s+([^\s]+)\s+([^\s]+)/);
  return {
    current,
    latest: match?.[2] ?? current,
    updateAvailable: Boolean(match)
  };
}

/**
 * 查询 Codex Superpowers 插件版本。
 * @param {string} root 插件根目录。
 * @returns {Promise<string>} 当前版本。
 */
async function getCodexSuperpowersVersion(root) {
  const entries = await fs.readdir(root).catch(() => []);
  const pluginDir = entries[0] ? path.join(root, entries[0]) : '';
  const plugin = pluginDir ? await readJson(path.join(pluginDir, '.codex-plugin/plugin.json')) : {};
  return plugin.version ?? '';
}

/**
 * 检测本机工作流增强工具能力。
 * @returns {Promise<{groups: Array<{id: string, title: string, capabilities: object[]}>}>} 工具能力状态。
 */
export async function detectCapabilities() {
  const openspecVersion = await getOpenSpecVersionInfo();
  const codexGstackRoot = path.join(os.homedir(), '.gstack/repos/gstack');
  const claudeGstackRoot = path.join(os.homedir(), '.claude/skills/gstack');
  const codexGstack = await pathExists(path.join(os.homedir(), '.codex/skills/gstack'));
  const claudeGstack = await pathExists(claudeGstackRoot) || await pathExists(codexGstackRoot);
  const codexGstackVersion = codexGstack ? await getGStackVersionInfo(codexGstackRoot) : { current: '', latest: '', updateAvailable: false };
  const claudeGstackVersion = await pathExists(claudeGstackRoot)
    ? await getGStackVersionInfo(claudeGstackRoot)
    : codexGstackVersion;
  const superpowersRoot = path.join(os.homedir(), '.codex/plugins/cache/openai-curated/superpowers');
  const codexSuperpowers = await pathExists(superpowersRoot);
  const codexSuperpowersVersion = codexSuperpowers ? await getCodexSuperpowersVersion(superpowersRoot) : '';
  const claudeSuperpowers = await pathExists(path.join(os.homedir(), '.claude/skills/superpowers'))
    || await pathExists(path.join(os.homedir(), '.claude/plugins/superpowers'))
    || codexSuperpowers;
  const totalCapabilities = 5;
  const availableCapabilities = [
    Boolean(openspecVersion.current),
    codexGstack,
    codexSuperpowers,
    claudeGstack,
    claudeSuperpowers
  ].filter(Boolean).length;
  const updateCount = [
    openspecVersion.updateAvailable,
    codexGstackVersion.updateAvailable,
    claudeGstackVersion.updateAvailable
  ].filter(Boolean).length;

  return {
    summary: {
      availableCapabilities,
      totalCapabilities,
      updateCount,
      beginnerText: 'OpenSpec 负责记录需求和任务，GStack 负责审查质量，Superpowers 负责复杂任务的方法论。下面按 AI 工具分组展示安装、版本、更新方式和工作流定义。'
    },
    groups: [
      {
        id: 'shared',
        title: 'Shared',
        subtitle: '跨 Codex App 与 Claude CLI 共享的基础能力',
        capabilities: [
          {
            id: 'openspec',
            title: 'OpenSpec CLI',
            subtitle: '变更管理与 proposal/design/tasks/archive 状态机',
            available: Boolean(openspecVersion.current),
            status: openspecVersion.current ? '可用' : '缺失',
            detail: openspecVersion.current ? '全局 CLI 命令' : '未检测到 openspec 命令',
            version: {
              current: openspecVersion.current || '未安装',
              latest: openspecVersion.latest || '未获取',
              updateAvailable: openspecVersion.updateAvailable,
              updateMode: 'command',
              updateAction: 'update-openspec',
              updateHint: '使用 npm 更新全局 @fission-ai/openspec'
            },
            definedInWorkflow: true,
            definedItems: ['openspec-propose', 'openspec-apply-change', 'openspec-archive-change', 'openspec-explore']
          }
        ]
      },
      {
        id: 'codex',
        title: 'Codex App',
        subtitle: 'Codex App 侧可加载的 skills 与插件',
        capabilities: [
          {
            id: 'codex-gstack',
            title: 'GStack',
            subtitle: '工程审查、安全审查和代码审查',
            available: codexGstack,
            status: codexGstack ? '可用' : '缺失',
            detail: codexGstack ? '~/.codex/skills/gstack' : '未检测到 Codex GStack skills',
            version: {
              current: codexGstackVersion.current || '未安装',
              latest: codexGstackVersion.latest || '未获取',
              updateAvailable: codexGstackVersion.updateAvailable,
              updateMode: 'command',
              updateAction: 'update-codex-gstack',
              updateHint: 'Codex 侧 GStack 通过 ~/.gstack/repos/gstack 更新后重新 setup --host codex'
            },
            definedInWorkflow: true,
            definedItems: ['/gstack-plan-eng-review', '/gstack-plan-design-review', '/gstack-cso', '/gstack-review']
          },
          {
            id: 'codex-superpowers',
            title: 'Superpowers',
            subtitle: 'TDD、debug、verification 等方法论 skill',
            available: codexSuperpowers,
            status: codexSuperpowers ? '可用' : '缺失',
            detail: codexSuperpowers ? '~/.codex/plugins/cache/openai-curated/superpowers' : '未检测到 Codex Superpowers 插件',
            version: {
              current: codexSuperpowersVersion || '未安装',
              latest: '由 Codex 插件市场检查',
              updateAvailable: false,
              updateMode: 'manual',
              updateHint: '打开 Codex 插件面板，在 Coding 分类中更新 Superpowers'
            },
            definedInWorkflow: true,
            definedItems: [
              'superpowers:brainstorming',
              'superpowers:writing-plans',
              'superpowers:systematic-debugging',
              'superpowers:test-driven-development',
              'superpowers:verification-before-completion'
            ]
          }
        ]
      },
      {
        id: 'claude',
        title: 'Claude CLI',
        subtitle: 'Claude CLI 侧命令与 skill 支持',
        capabilities: [
          {
            id: 'claude-gstack',
            title: 'GStack',
            subtitle: 'Claude CLI 侧工程审查、安全审查和代码审查',
            available: claudeGstack,
            status: claudeGstack ? '可用' : '缺失',
            detail: claudeGstack ? '~/.claude/skills/gstack 或 ~/.gstack/repos/gstack' : '未检测到 Claude/GStack 安装',
            version: {
              current: claudeGstackVersion.current || '未安装',
              latest: claudeGstackVersion.latest || '未获取',
              updateAvailable: claudeGstackVersion.updateAvailable,
              updateMode: 'command',
              updateAction: 'update-claude-gstack',
              updateHint: 'Claude CLI 侧 GStack 通过 ~/.claude/skills/gstack 更新后重新 setup'
            },
            definedInWorkflow: true,
            definedItems: ['/plan-eng-review', '/plan-design-review', '/cso', '/review']
          },
          {
            id: 'claude-superpowers',
            title: 'Superpowers',
            subtitle: 'Claude CLI 侧 Superpowers 方法论支持',
            available: claudeSuperpowers,
            status: claudeSuperpowers ? '可用' : '缺失',
            detail: claudeSuperpowers ? '检测到 Superpowers 可用来源' : '未检测到 Claude Superpowers 安装',
            version: {
              current: codexSuperpowersVersion || '需在 Claude 插件中查看',
              latest: '由 Claude 插件市场检查',
              updateAvailable: false,
              updateMode: 'manual',
              updateHint: 'Claude CLI 使用 /plugin install superpowers@claude-plugins-official 或插件市场更新'
            },
            definedInWorkflow: true,
            definedItems: [
              'wf-debug: superpowers:systematic-debugging',
              'wf-debug: superpowers:test-driven-development',
              'wf-complex: superpowers:brainstorming',
              'wf-complex: superpowers:writing-plans',
              'wf-complex: superpowers:verification-before-completion'
            ]
          }
        ]
      }
    ]
  };
}
