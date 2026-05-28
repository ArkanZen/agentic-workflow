import path from 'node:path';
import fs from 'node:fs/promises';
import { runFile } from './exec.js';
import { WORKFLOW_ROOT } from './paths.js';
import { parseConfigMarkers } from './parse.js';

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

// 安装脚本可能维护的核心文件，用于 Dashboard 预览写入影响。
const INSTALL_MANAGED_FILES = [
  'openspec/config.yaml',
  'AGENTS.md',
  '.agentic-workflow/manifest.json',
  '.codex/skills/wf-*',
  '.claude/commands/wf-*'
];

// .gitignore 受控块标记，重复执行时会替换该块。
const GITIGNORE_BLOCK_START = '# agentic-workflow docs:start';
const GITIGNORE_BLOCK_END = '# agentic-workflow docs:end';

/**
 * 安全读取文本文件。
 * @param {string} filePath 文件路径。
 * @returns {Promise<string>} 文件内容。
 */
async function readText(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

/**
 * 安全读取 JSON 文件。
 * @param {string} filePath 文件路径。
 * @returns {Promise<object>} JSON 内容。
 */
async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * 判断文件是否存在。
 * @param {string} filePath 文件路径。
 * @returns {Promise<boolean>} 存在时返回 true。
 */
async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() || stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * 根据本地项目信号推荐工作流档位。
 * @param {string} projectPath 目标项目路径。
 * @returns {Promise<{recommendedTier: string, candidates: object[], reasons: string[]}>} 推荐结果。
 */
async function recommendTier(projectPath) {
  const scores = new Map([...ALLOWED_TIERS].map((tier) => [tier, 0]));
  const reasons = [];
  const requirements = await readText(path.join(projectPath, 'requirements.txt'));
  const packageJson = await readJson(path.join(projectPath, 'package.json'));
  const readme = `${await readText(path.join(projectPath, 'README.md'))}\n${await readText(path.join(projectPath, 'README'))}`.toLowerCase();
  const hasPyproject = await fileExists(path.join(projectPath, 'pyproject.toml'));
  const hasNotebooks = await fileExists(path.join(projectPath, 'notebooks'));
  const hasBackendFile = await fileExists(path.join(projectPath, 'pom.xml'))
    || await fileExists(path.join(projectPath, 'go.mod'))
    || await fileExists(path.join(projectPath, 'Cargo.toml'));
  const deps = Object.keys({ ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) });
  const hasFrontendDep = deps.some((dep) => ['react', 'vue', 'next'].includes(dep));
  const hasBackendDep = deps.some((dep) => ['express', 'nest', '@nestjs/core', 'koa'].includes(dep));

  if (requirements.match(/pandas|sqlalchemy|pymysql|openpyxl/i)) {
    scores.set('python-data', scores.get('python-data') + 5);
    reasons.push('requirements.txt 命中 pandas/sqlalchemy/pymysql/openpyxl');
  }
  if (hasFrontendDep && hasBackendDep) {
    scores.set('fullstack', scores.get('fullstack') + 5);
    reasons.push('package.json 同时包含前端和后端依赖');
  }
  if (readme.match(/prototype|poc|demo|vibe/)) {
    scores.set('vibe', scores.get('vibe') + 3);
    reasons.push('README 命中 prototype/poc/demo/vibe');
  }
  if (hasPyproject && hasNotebooks) {
    scores.set('python-data', scores.get('python-data') + 3);
    reasons.push('pyproject.toml 与 notebooks/ 同时存在');
  }
  if (hasFrontendDep && !hasBackendDep) {
    scores.set('frontend', scores.get('frontend') + 3);
    reasons.push('package.json 包含前端依赖且没有常见后端依赖');
  }
  if (hasBackendFile) {
    scores.set('backend', scores.get('backend') + 3);
    reasons.push('检测到 pom.xml/go.mod/Cargo.toml');
  }
  if (scores.get('vibe') === 0) {
    scores.set('vibe', 1);
    reasons.push('vibe 作为低摩擦兜底候选');
  }

  const candidates = [...scores.entries()]
    .map(([tier, score]) => ({
      tier,
      score,
      confidence: score >= 5 ? 85 : score >= 3 ? 60 : score >= 1 ? 40 : 0
    }))
    .filter((item) => item.confidence > 0)
    .sort((left, right) => right.confidence - left.confidence);

  return {
    recommendedTier: candidates[0]?.tier ?? 'vibe',
    candidates,
    reasons
  };
}

/**
 * 检测目标项目的工作流安装状态，供 Dashboard 安装向导使用。
 * @param {string} projectPath 目标项目路径。
 * @returns {Promise<object>} 检测结果。
 */
export async function detectWorkflowInstall(projectPath) {
  const stat = await fs.stat(projectPath).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error('目标项目目录不存在');
  }
  const configPath = path.join(projectPath, 'openspec/config.yaml');
  const manifestPath = path.join(projectPath, '.agentic-workflow/manifest.json');
  const configContent = await readText(configPath);
  const manifest = await readJson(manifestPath);
  const markers = configContent ? parseConfigMarkers(configContent) : { tier: null, version: null };
  const repoVersion = (await readText(path.join(WORKFLOW_ROOT, 'VERSION'))).trim();
  const installed = Boolean(configContent || Object.keys(manifest).length > 0);
  const knownVersion = Boolean(markers.version || manifest.workflowVersion);
  const installedVersion = manifest.workflowVersion ?? markers.version ?? '';
  const currentTier = manifest.tier ?? markers.tier ?? '';
  const tierRecommendation = await recommendTier(projectPath);
  let recommendedAction = 'install';
  let status = '未安装';
  let reason = '未检测到 openspec/config.yaml';

  if (installed && !knownVersion) {
    recommendedAction = 'upgrade';
    status = '版本未知';
    reason = '检测到 OpenSpec 配置，但缺少 agentic-workflow 版本标记';
  } else if (installed && installedVersion && repoVersion && installedVersion !== repoVersion) {
    recommendedAction = 'upgrade';
    status = '有新版本';
    reason = `当前版本 ${installedVersion}，仓库版本 ${repoVersion}`;
  } else if (installed) {
    recommendedAction = 'switch-tier';
    status = '已安装';
    reason = '当前版本已同步，可按需切换档位或只查看状态';
  }

  return {
    status,
    recommendedAction,
    reason,
    currentTier: currentTier || 'unknown',
    currentVersion: installedVersion || 'unknown',
    repoVersion: repoVersion || 'unknown',
    recommendedTier: currentTier || tierRecommendation.recommendedTier,
    candidates: tierRecommendation.candidates,
    reasons: tierRecommendation.reasons,
    writableActions: ['install', 'switch-tier', 'upgrade'],
    files: INSTALL_MANAGED_FILES
  };
}

/**
 * 判断受控文件是否已经存在，通配目录按目录存在判断。
 * @param {string} projectPath 项目路径。
 * @param {string} relativePath 相对路径。
 * @returns {Promise<{path: string, status: string}>} 文件状态。
 */
async function describeManagedFile(projectPath, relativePath) {
  const probePath = relativePath.includes('*')
    ? relativePath.replace(/\/[^/]*\*.*$/, '')
    : relativePath;
  const exists = await fileExists(path.join(projectPath, probePath));
  return {
    path: relativePath,
    status: exists ? '将更新已有内容' : '将新增'
  };
}

/**
 * 构建维护动作的人类可读预览。
 * @param {{action: string, projectPath: string, tier?: string}} input 动作输入。
 * @returns {Promise<object>} 预览详情。
 */
export async function buildWorkflowActionPreview(input) {
  const action = buildWorkflowAction(input);
  const command = [action.command, ...action.args].join(' ');
  const detection = await detectWorkflowInstall(input.projectPath).catch(() => null);

  if (input.action === 'ignore-workflow-docs') {
    return {
      summary: action.summary,
      command,
      details: {
        actionLabel: '写入 .gitignore 忽略块',
        tier: detection?.currentTier ?? '不适用',
        hosts: [],
        preserveOpenSpec: true,
        files: [{ path: '.gitignore', status: '将新增或替换 agentic-workflow 受控块' }],
        notes: [
          '只维护 .gitignore 中的 agentic-workflow docs 受控块',
          '重复执行会替换同一受控块，不会追加重复内容'
        ]
      }
    };
  }

  const files = await Promise.all(INSTALL_MANAGED_FILES.map((file) => describeManagedFile(input.projectPath, file)));
  const actionLabels = {
    install: '安装工作流',
    upgrade: '升级受控模板',
    'switch-tier': '切换 workflow tier'
  };

  return {
    summary: action.summary,
    command,
    details: {
      actionLabel: actionLabels[input.action] ?? input.action,
      tier: input.tier,
      currentTier: detection?.currentTier ?? 'unknown',
      currentVersion: detection?.currentVersion ?? 'unknown',
      repoVersion: detection?.repoVersion ?? 'unknown',
      hosts: ['Codex App', 'Claude CLI'],
      preserveOpenSpec: true,
      files,
      notes: [
        '会通过 install.sh 的白名单参数执行，不接受任意 shell 命令',
        '已有 OpenSpec changes/specs 不会被安装脚本删除',
        input.action === 'switch-tier' ? '切档主要替换 openspec/config.yaml，并保留工作流命令文件' : '模板文件会按当前仓库版本渲染'
      ]
    }
  };
}

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

  if (input.action === 'install') {
    if (!ALLOWED_TIERS.has(tier)) {
      throw new Error('安装动作需要有效档位');
    }
    return {
      command: 'bash',
      args: [installScript, '--type', tier, '--target', input.projectPath, '--no-interactive'],
      cwd: WORKFLOW_ROOT,
      summary: `为 ${input.projectPath} 安装 ${tier} 工作流`
    };
  }

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
