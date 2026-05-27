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
 * 生成宿主支持信息。
 * @param {object} options 宿主支持参数。
 * @returns {object} 宿主支持展示模型。
 */
function hostSupport(options) {
  return {
    host: options.host,
    supported: options.supported,
    status: options.supported ? '已支持' : '未检测到',
    install: options.install,
    version: options.version,
    updateAction: options.updateAction ?? null,
    updateHint: options.updateHint,
    updateAvailable: Boolean(options.updateAvailable)
  };
}

/**
 * 生成技能说明项。
 * @param {string} name 技能或命令名称。
 * @param {string} purpose 中文用途说明。
 * @param {string[]} workflows 使用该能力的工作流列表。
 * @returns {object} 技能说明模型。
 */
function skillItem(name, purpose, workflows = []) {
  return { name, purpose, workflows };
}

/**
 * 检测本机工作流增强工具能力。
 * @returns {Promise<{summary: object, tools: object[]}>} 工具能力状态。
 */
export async function detectCapabilities() {
  const openspecVersion = await getOpenSpecVersionInfo();
  const codexGstackRoot = path.join(os.homedir(), '.gstack/repos/gstack');
  const codexGstackSkillRoot = path.join(os.homedir(), '.codex/skills/gstack');
  const claudeGstackRoot = path.join(os.homedir(), '.claude/skills/gstack');
  const codexGstack = await pathExists(codexGstackSkillRoot);
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
  const updateCount = [
    openspecVersion.updateAvailable,
    codexGstackVersion.updateAvailable,
    claudeGstackVersion.updateAvailable
  ].filter(Boolean).length;

  return {
    summary: {
      totalTools: 3,
      readyTools: [
        Boolean(openspecVersion.current),
        codexGstack || claudeGstack,
        codexSuperpowers || claudeSuperpowers
      ].filter(Boolean).length,
      updateCount,
      overviewText: 'OpenSpec 负责把需求变成可追踪的 proposal/design/tasks；GStack 负责工程、安全、设计和代码审查；Superpowers 负责 TDD、debug、计划和完成前验证等方法论。'
    },
    tools: [
      {
        id: 'openspec',
        title: 'OpenSpec',
        subtitle: '需求、设计、任务和归档的变更管理工具',
        purpose: 'OpenSpec 像一份工作流账本：每次重要变更都要留下为什么做、怎么做、做到哪一步。',
        design: 'agentic-workflow 通过 openspec change schema 生成 proposal/design/spec/tasks，并用 status/validate/archive 管理状态。',
        version: {
          current: openspecVersion.current || '未安装',
          latest: openspecVersion.latest || '未获取',
          updateAvailable: openspecVersion.updateAvailable,
          updateAction: 'update-openspec',
          updateHint: '使用 npm 更新全局 @fission-ai/openspec'
        },
        aiSupport: [
          hostSupport({
            host: 'Codex App',
            supported: Boolean(openspecVersion.current),
            install: '全局 openspec CLI',
            version: openspecVersion.current || '未安装',
            updateAction: 'update-openspec',
            updateAvailable: openspecVersion.updateAvailable,
            updateHint: 'Codex 调用本机 openspec 命令执行 propose/apply/archive。'
          }),
          hostSupport({
            host: 'Claude CLI',
            supported: Boolean(openspecVersion.current),
            install: '全局 openspec CLI',
            version: openspecVersion.current || '未安装',
            updateAction: 'update-openspec',
            updateAvailable: openspecVersion.updateAvailable,
            updateHint: 'Claude CLI 同样依赖本机 openspec 命令。'
          })
        ],
        officialSkills: [
          skillItem('openspec-propose', '创建 proposal、design、spec 和 tasks。'),
          skillItem('openspec-apply-change', '按 tasks 执行实现并保持 OpenSpec 状态同步。'),
          skillItem('openspec-archive-change', '把已完成 change 归档并同步正式 spec。'),
          skillItem('openspec-explore', '在进入正式 proposal 前探索需求和边界。')
        ],
        workflowSkills: [
          skillItem('openspec-propose', '小需求和完整通道的提案入口。', ['/wf-small', '/wf-complex']),
          skillItem('openspec-apply-change', '确认方案后执行实现。', ['/wf-small', '/wf-complex']),
          skillItem('openspec-archive-change', '完成后归档变更。', ['/wf-small', '/wf-complex']),
          skillItem('openspec-explore', '复杂需求先探索再定方案。', ['/wf-complex'])
        ],
        unusedSkills: []
      },
      {
        id: 'gstack',
        title: 'GStack',
        subtitle: '工程审查、设计审查、安全审查和代码审查工具集',
        purpose: 'GStack 是审查搭档：在开工前检查架构风险，完成后检查代码质量。',
        design: 'agentic-workflow 通过 host command mapping 把通用审查动作映射到 Codex App 与 Claude CLI 的不同命令。',
        version: {
          current: codexGstackVersion.current || claudeGstackVersion.current || '未安装',
          latest: codexGstackVersion.latest || claudeGstackVersion.latest || '未获取',
          updateAvailable: codexGstackVersion.updateAvailable || claudeGstackVersion.updateAvailable,
          updateHint: 'Codex 与 Claude 的安装目录不同，更新动作需要按宿主分别执行。'
        },
        aiSupport: [
          hostSupport({
            host: 'Codex App',
            supported: codexGstack,
            install: codexGstack ? '~/.codex/skills/gstack' : '未检测到 Codex GStack skills',
            version: codexGstackVersion.current || '未安装',
            updateAction: 'update-codex-gstack',
            updateAvailable: codexGstackVersion.updateAvailable,
            updateHint: '通过 ~/.gstack/repos/gstack 拉取后执行 setup --host codex。'
          }),
          hostSupport({
            host: 'Claude CLI',
            supported: claudeGstack,
            install: claudeGstack ? '~/.claude/skills/gstack 或 ~/.gstack/repos/gstack' : '未检测到 Claude/GStack 安装',
            version: claudeGstackVersion.current || '未安装',
            updateAction: 'update-claude-gstack',
            updateAvailable: claudeGstackVersion.updateAvailable,
            updateHint: '通过 Claude 侧安装目录拉取后执行 setup。'
          })
        ],
        officialSkills: [
          skillItem('/plan-eng-review', '工程方案审查，关注架构、数据流、边界和测试。'),
          skillItem('/plan-design-review', '设计方案审查，关注 UI 信息架构和体验一致性。'),
          skillItem('/cso', '安全审查，关注凭证、权限、配置和高风险操作。'),
          skillItem('/review', '实现后的代码审查，关注缺陷、回归和测试缺口。'),
          skillItem('/qa', '浏览器或产品层面的系统化验证。')
        ],
        workflowSkills: [
          skillItem('/gstack-plan-eng-review', 'Codex App 中的工程 gate。', ['/wf-small', '/wf-complex', '/wf-plan']),
          skillItem('/gstack-plan-design-review', 'Codex App 中的 UI/设计 gate。', ['/wf-complex']),
          skillItem('/gstack-cso', 'Codex App 中的安全 gate。', ['按规则条件触发']),
          skillItem('/gstack-review', 'Codex App 中的代码审查。', ['/wf-small', '/wf-complex']),
          skillItem('/plan-eng-review', 'Claude CLI 中的工程 gate。', ['/wf-small', '/wf-complex', '/wf-plan']),
          skillItem('/review', 'Claude CLI 中的代码审查。', ['/wf-small', '/wf-complex'])
        ],
        unusedSkills: [
          skillItem('/qa', '官方可用，但当前 `/wf-*` 默认没有强制绑定。'),
          skillItem('/benchmark', '官方可用，适合性能回归场景，当前工作流未默认使用。')
        ]
      },
      {
        id: 'superpowers',
        title: 'Superpowers',
        subtitle: '计划、TDD、debug 和完成前验证的方法论技能',
        purpose: 'Superpowers 不是业务插件，它是一组让 AI 做事更稳的方法：先想清楚、再测试、遇到问题系统排查、完成前验证。',
        design: 'agentic-workflow 在不同 `/wf-*` 中声明 required 或 conditional skills，执行者需要先加载对应 skill 文档再继续。',
        version: {
          current: codexSuperpowersVersion || '需在宿主插件中查看',
          latest: '由宿主插件市场检查',
          updateAvailable: false,
          updateHint: 'Superpowers 通常由 Codex 或 Claude 的插件系统管理，不伪装成统一一键更新。'
        },
        aiSupport: [
          hostSupport({
            host: 'Codex App',
            supported: codexSuperpowers,
            install: codexSuperpowers ? '~/.codex/plugins/cache/openai-curated/superpowers' : '未检测到 Codex Superpowers 插件',
            version: codexSuperpowersVersion || '未安装',
            updateHint: '在 Codex 插件面板中更新 Superpowers。'
          }),
          hostSupport({
            host: 'Claude CLI',
            supported: claudeSuperpowers,
            install: claudeSuperpowers ? 'Claude 插件或共享 skill 来源' : '未检测到 Claude Superpowers 安装',
            version: codexSuperpowersVersion || '需在 Claude 插件中查看',
            updateHint: '使用 Claude 插件市场或 /plugin install superpowers@claude-plugins-official 更新。'
          })
        ],
        officialSkills: [
          skillItem('superpowers:brainstorming', '创意和方案发散前先澄清目标。'),
          skillItem('superpowers:writing-plans', '把复杂实现拆成可执行计划。'),
          skillItem('superpowers:executing-plans', '按计划逐项执行并保持状态同步。'),
          skillItem('superpowers:systematic-debugging', '遇到 bug 时按证据链定位根因。'),
          skillItem('superpowers:test-driven-development', '用测试先约束行为再实现。'),
          skillItem('superpowers:verification-before-completion', '完成前验证，避免没跑测试就声称完成。')
        ],
        workflowSkills: [
          skillItem('superpowers:verification-before-completion', '完成前条件 skill。', ['/wf-small', '/wf-complex', '/wf-debug']),
          skillItem('superpowers:systematic-debugging', 'debug 场景必备方法。', ['/wf-debug']),
          skillItem('superpowers:test-driven-development', '测试驱动开发场景。', ['/wf-debug']),
          skillItem('superpowers:brainstorming', '复杂需求探索阶段。', ['/wf-complex']),
          skillItem('superpowers:writing-plans', '复杂需求落执行计划。', ['/wf-complex'])
        ],
        unusedSkills: [
          skillItem('superpowers:subagent-driven-development', '官方可用，适合多代理并行开发，当前工作流未默认启用。'),
          skillItem('superpowers:using-git-worktrees', '官方可用，适合隔离分支开发，当前工作流未默认启用。')
        ]
      }
    ]
  };
}
