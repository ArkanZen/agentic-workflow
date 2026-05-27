import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverProjects } from './scanner.js';

let tempRoot;

/**
 * 创建临时测试目录。
 * @returns {Promise<string>} 临时目录路径。
 */
async function createTempRoot() {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-dashboard-'));
  return tempRoot;
}

/**
 * 写入 JSON 文件并自动创建父目录。
 * @param {string} filePath 文件路径。
 * @param {object} value JSON 内容。
 * @returns {Promise<void>}
 */
async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2));
}

afterEach(async () => {
  if (tempRoot) {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

describe('discoverProjects', () => {
  it('发现 manifest 安装项目和 config 部分配置项目', async () => {
    const root = await createTempRoot();
    const installed = path.join(root, 'installed-app');
    const partial = path.join(root, 'partial-app');

    await writeJson(path.join(installed, '.agentic-workflow/manifest.json'), {
      workflowVersion: '1.0.0',
      tier: 'backend',
      hosts: { claude: true, codex: true },
      sourceRepo: 'https://github.com/example/workflow'
    });
    await fs.mkdir(path.join(partial, 'openspec'), { recursive: true });
    await fs.writeFile(path.join(partial, 'openspec/config.yaml'), [
      '# agentic-workflow-tier: vibe',
      '# agentic-workflow-version: 1.0.1'
    ].join('\n'));

    const result = await discoverProjects([root]);
    const names = result.projects.map((project) => project.name).sort();

    expect(names).toEqual(['installed-app', 'partial-app']);
    expect(result.projects.find((project) => project.name === 'installed-app').installed).toBe(true);
    expect(result.projects.find((project) => project.name === 'partial-app').partial).toBe(true);
  });
});
