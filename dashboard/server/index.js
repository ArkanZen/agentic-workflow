import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SCAN_ROOTS, isInsideScanRoots, normalizePath, normalizeScanRoots } from './lib/paths.js';
import { discoverProjects } from './lib/scanner.js';
import { runDoctor } from './lib/doctor.js';
import { buildWorkflowActionPreview, detectWorkflowInstall, runWorkflowAction } from './lib/actions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 本地 API 端口，固定使用回环地址降低误暴露概率。
const PORT = Number(process.env.DASHBOARD_PORT ?? 4317);
// 前端构建产物目录，用于生产模式静态服务。
const DIST_DIR = path.resolve(__dirname, '../dist');

const app = express();
app.use(express.json({ limit: '1mb' }));

/**
 * 从请求中解析扫描根目录。
 * @param {import('express').Request} request Express 请求对象。
 * @returns {string[]} 规范化扫描根目录。
 */
function rootsFromRequest(request) {
  const raw = request.query.roots;
  if (!raw) {
    return normalizeScanRoots(DEFAULT_SCAN_ROOTS);
  }
  const roots = Array.isArray(raw) ? raw : String(raw).split(',');
  return normalizeScanRoots(roots);
}

/**
 * 校验项目路径是否位于当前扫描边界内。
 * @param {string} projectPath 项目路径。
 * @param {string[]} scanRoots 扫描根目录。
 * @returns {string} 规范化后的项目路径。
 * @throws {Error} 当路径越界时抛出。
 */
function assertProjectInScanRoots(projectPath, scanRoots) {
  const normalizedProject = normalizePath(projectPath);
  if (!isInsideScanRoots(normalizedProject, scanRoots)) {
    throw new Error('项目路径不在扫描根目录内');
  }
  return normalizedProject;
}

app.get('/api/scan-roots', (_request, response) => {
  response.json({ roots: normalizeScanRoots(DEFAULT_SCAN_ROOTS) });
});

app.get('/api/projects', async (request, response) => {
  try {
    const roots = rootsFromRequest(request);
    response.json(await discoverProjects(roots));
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.post('/api/doctor', async (request, response) => {
  try {
    const roots = normalizeScanRoots(request.body.roots ?? DEFAULT_SCAN_ROOTS);
    const projectPath = assertProjectInScanRoots(request.body.projectPath, roots);
    response.json(await runDoctor(projectPath));
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post('/api/install/detect', async (request, response) => {
  try {
    const roots = normalizeScanRoots(request.body.roots ?? DEFAULT_SCAN_ROOTS);
    const projectPath = assertProjectInScanRoots(request.body.projectPath, roots);
    response.json(await detectWorkflowInstall(projectPath));
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post('/api/actions/preview', async (request, response) => {
  try {
    const roots = normalizeScanRoots(request.body.roots ?? DEFAULT_SCAN_ROOTS);
    const projectPath = assertProjectInScanRoots(request.body.projectPath, roots);
    const preview = await buildWorkflowActionPreview({
      action: request.body.action,
      projectPath,
      tier: request.body.tier
    });
    response.json(preview);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post('/api/actions/run', async (request, response) => {
  try {
    const roots = normalizeScanRoots(request.body.roots ?? DEFAULT_SCAN_ROOTS);
    const projectPath = assertProjectInScanRoots(request.body.projectPath, roots);
    response.json(await runWorkflowAction({
      action: request.body.action,
      projectPath,
      tier: request.body.tier
    }));
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.use(express.static(DIST_DIR));
app.get('/{*splat}', (_request, response) => {
  response.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`agentic-workflow dashboard API listening on http://127.0.0.1:${PORT}`);
});
