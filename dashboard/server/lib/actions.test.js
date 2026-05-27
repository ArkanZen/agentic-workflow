import { describe, expect, it } from 'vitest';
import { buildWorkflowAction, buildWorkflowGitignoreContent } from './actions.js';

describe('workflow actions', () => {
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

  it('构造工具更新动作', () => {
    const openspec = buildWorkflowAction({
      action: 'update-openspec',
      projectPath: '/tmp/project'
    });
    const codexGstack = buildWorkflowAction({
      action: 'update-codex-gstack',
      projectPath: '/tmp/project'
    });

    expect(openspec.args).toEqual(['install', '-g', '@fission-ai/openspec@latest']);
    expect(codexGstack.summary).toContain('Codex App');
  });

  it('幂等写入工作流文档忽略块', () => {
    const first = buildWorkflowGitignoreContent('node_modules/\n');
    const second = buildWorkflowGitignoreContent(first);

    expect(first).toBe(second);
    expect(first).toContain('# agentic-workflow docs:start');
    expect(first).toContain('openspec/changes/');
  });
});
