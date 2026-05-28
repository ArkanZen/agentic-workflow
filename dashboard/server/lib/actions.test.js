import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildWorkflowAction, buildWorkflowActionPreview, buildWorkflowGitignoreContent, detectWorkflowInstall } from './actions.js';

let tempRoot;

/**
 * 创建临时项目目录。
 * @returns {Promise<string>} 临时项目路径。
 */
async function createTempProject() {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-action-'));
  return tempRoot;
}

afterEach(async () => {
  if (tempRoot) {
    await fs.rm(tempRoot, { recursive: true, force: true });
    tempRoot = null;
  }
});

describe('workflow actions', () => {
  it('构造安装命令并保留白名单参数', () => {
    const action = buildWorkflowAction({
      action: 'install',
      projectPath: '/tmp/project',
      tier: 'vibe'
    });

    expect(action.command).toBe('bash');
    expect(action.args).toContain('--no-interactive');
    expect(action.args).toContain('--target');
    expect(action.args).toContain('/tmp/project');
    expect(action.args).not.toContain('--upgrade');
    expect(action.args).not.toContain('--switch');
  });

  it('构造升级命令并保留白名单参数', () => {
    const action = buildWorkflowAction({
      action: 'upgrade',
      projectPath: '/tmp/project',
      tier: 'frontend'
    });

    expect(action.command).toBe('bash');
    expect(action.args).toContain('--upgrade');
    expect(action.args).toContain('--no-interactive');
    expect(action.args).toContain('/tmp/project');
  });

  it('拒绝未知动作', () => {
    expect(() => buildWorkflowAction({
      action: 'rm-rf',
      projectPath: '/tmp/project',
      tier: 'frontend'
    })).toThrow('不支持的维护动作');
  });

  it('拒绝未知档位', () => {
    expect(() => buildWorkflowAction({
      action: 'switch-tier',
      projectPath: '/tmp/project',
      tier: 'danger'
    })).toThrow('切换档位需要有效档位');
  });

  it('构造工作流文档 gitignore 动作', () => {
    const action = buildWorkflowAction({
      action: 'ignore-workflow-docs',
      projectPath: '/tmp/project'
    });

    expect(action.kind).toBe('gitignore');
    expect(action.args).toContain('/tmp/project/.gitignore');
  });

  it('拒绝工具更新动作', () => {
    expect(() => buildWorkflowAction({
      action: 'update-openspec',
      projectPath: '/tmp/project'
    })).toThrow('不支持的维护动作');
  });

  it('幂等写入工作流文档忽略块', () => {
    const first = buildWorkflowGitignoreContent('node_modules/\n');
    const second = buildWorkflowGitignoreContent(first);

    expect(first).toBe(second);
    expect(first).toContain('# agentic-workflow docs:start');
    expect(first).toContain('openspec/changes/');
  });

  it('检测未安装项目并推荐候选档位', async () => {
    const project = await createTempProject();
    await fs.writeFile(path.join(project, 'package.json'), JSON.stringify({
      dependencies: {
        react: '19.0.0'
      }
    }));

    const result = await detectWorkflowInstall(project);

    expect(result.status).toBe('未安装');
    expect(result.recommendedAction).toBe('install');
    expect(result.recommendedTier).toBe('frontend');
    expect(result.candidates.map((candidate) => candidate.tier)).toContain('frontend');
  });

  it('生成安装动作的可读预览详情', async () => {
    const project = await createTempProject();
    await fs.writeFile(path.join(project, 'package.json'), JSON.stringify({
      dependencies: {
        react: '19.0.0'
      }
    }));

    const preview = await buildWorkflowActionPreview({
      action: 'install',
      projectPath: project,
      tier: 'frontend'
    });

    expect(preview.command).toContain('--no-interactive');
    expect(preview.details.actionLabel).toBe('安装工作流');
    expect(preview.details.files.map((file) => file.path)).toContain('openspec/config.yaml');
    expect(preview.details.preserveOpenSpec).toBe(true);
  });
});
