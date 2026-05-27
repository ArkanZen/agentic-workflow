import path from 'node:path';
import fs from 'node:fs/promises';
import { runFile } from './exec.js';
import { WORKFLOW_ROOT } from './paths.js';

// 支持的工作流档位，防止 API 接收任意参数。
const ALLOWED_TIERS = new Set(['backend', 'python-data', 'frontend', 'fullstack', 'vibe']);

// 写入目标项目 .gitignore 的工作流文档忽略项。
export const WORKFLOW_GITIGNORE_ENTRIES = [
  '.agents/',
  '.claude/',
  '.codex/',
  '.superpowers/',
  'docs/',
  'openspec/specs/',
  'openspec/changes/'
];

// .gitignore 受控块标记，重复执行时会替换该块。
const GITIGNORE_BLOCK_START = '# agentic-workflow docs:start';
const GITIGNORE_BLOCK_END = '# agentic-workflow docs:end';

/**
 * 生成带工作流文档忽略块的 .gitignore 内容。
 * @param {string} existingContent 现有 .gitignore 内容。
 * @returns {string} 更新后的 .gitignore 内容。
 */
export function buildWorkflowGitignoreContent(existingContent) {
  const block = [
    GITIGNORE_BLOCK_START,
    '# 工作流文档与宿主配置，由 agentic-workflow Dashboard 管理',
    ...WORKFLOW_GITIGNORE_ENTRIES,
    GITIGNORE_BLOCK_END
  ].join('\n');
  const normalized = existingContent.trimEnd();
  const blockPattern = new RegExp(`${GITIGNORE_BLOCK_START}[\\s\\S]*?${GITIGNORE_BLOCK_END}`, 'm');

  if (blockPattern.test(existingContent)) {
    return `${existingContent.replace(blockPattern, block).trimEnd()}\n`;
  }

  return `${normalized ? `${normalized}\n\n` : ''}${block}\n`;
}

/**
 * 将工作流文档忽略块写入目标项目 .gitignore。
 * @param {string} projectPath 目标项目路径。
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>} 写入结果。
 */
async function writeWorkflowGitignore(projectPath) {
  const gitignorePath = path.join(projectPath, '.gitignore');
  let existingContent = '';
  try {
    existingContent = await fs.readFile(gitignorePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  const nextContent = buildWorkflowGitignoreContent(existingContent);
  await fs.writeFile(gitignorePath, nextContent);

  return {
    stdout: `已更新 ${gitignorePath}\n忽略项：\n${WORKFLOW_GITIGNORE_ENTRIES.map((entry) => `- ${entry}`).join('\n')}\n`,
    stderr: '',
    exitCode: 0
  };
}

/**
 * 构造受控维护命令参数。
 * @param {{action: string, projectPath: string, tier?: string}} input 动作输入。
 * @returns {{command: string, args: string[], cwd: string, summary: string}} 可执行命令描述。
 * @throws {Error} 当动作或档位不被允许时抛出。
 */
export function buildWorkflowAction(input) {
  const installScript = path.join(WORKFLOW_ROOT, 'install.sh');
  const tier = input.tier;

  if (input.action === 'upgrade') {
    if (!ALLOWED_TIERS.has(tier)) {
      throw new Error('升级动作需要有效档位');
    }
    return {
      command: 'bash',
      args: [installScript, '--type', tier, '--target', input.projectPath, '--no-interactive', '--upgrade'],
      cwd: WORKFLOW_ROOT,
      summary: `升级 ${input.projectPath} 的 ${tier} 工作流模板`
    };
  }

  if (input.action === 'switch-tier') {
    if (!ALLOWED_TIERS.has(tier)) {
      throw new Error('切换档位需要有效档位');
    }
    return {
      command: 'bash',
      args: [installScript, '--type', tier, '--target', input.projectPath, '--no-interactive', '--switch'],
      cwd: WORKFLOW_ROOT,
      summary: `切换 ${input.projectPath} 到 ${tier} 档位`
    };
  }

  if (input.action === 'ignore-workflow-docs') {
    return {
      kind: 'gitignore',
      command: 'update-gitignore',
      args: [path.join(input.projectPath, '.gitignore')],
      cwd: input.projectPath,
      summary: `将 agentic-workflow 文档与宿主配置加入 ${input.projectPath}/.gitignore`
    };
  }

  if (input.action === 'update-openspec') {
    return {
      command: 'npm',
      args: ['install', '-g', '@fission-ai/openspec@latest'],
      cwd: WORKFLOW_ROOT,
      summary: '更新 OpenSpec CLI 到 npm 最新版本'
    };
  }

  if (input.action === 'update-codex-gstack') {
    const gstackRoot = path.join(process.env.HOME, '.gstack/repos/gstack');
    return {
      command: 'bash',
      args: ['-lc', `git -C "${gstackRoot}" pull --ff-only && cd "${gstackRoot}" && ./setup --host codex`],
      cwd: WORKFLOW_ROOT,
      summary: '更新 Codex App 侧 GStack 并重新执行 setup --host codex'
    };
  }

  if (input.action === 'update-claude-gstack') {
    const gstackRoot = path.join(process.env.HOME, '.claude/skills/gstack');
    return {
      command: 'bash',
      args: ['-lc', `git -C "${gstackRoot}" pull --ff-only && cd "${gstackRoot}" && ./setup`],
      cwd: WORKFLOW_ROOT,
      summary: '更新 Claude CLI 侧 GStack 并重新执行 setup'
    };
  }

  throw new Error('不支持的维护动作');
}

/**
 * 执行受控维护动作。
 * @param {{action: string, projectPath: string, tier?: string}} input 动作输入。
 * @returns {Promise<{summary: string, stdout: string, stderr: string, exitCode: number}>} 执行结果。
 */
export async function runWorkflowAction(input) {
  const action = buildWorkflowAction(input);
  if (action.kind === 'gitignore') {
    const result = await writeWorkflowGitignore(input.projectPath);
    return {
      summary: action.summary,
      ...result
    };
  }

  const result = await runFile(action.command, action.args, {
    cwd: action.cwd,
    timeout: 60000
  });

  return {
    summary: action.summary,
    ...result
  };
}
