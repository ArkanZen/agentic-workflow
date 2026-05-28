import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runFile } from './exec.js';
import { WORKFLOW_ROOT } from './paths.js';

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
 * 归一化说明文本，避免多行 frontmatter 在页面里显示成松散空白。
 * @param {string} value 原始说明。
 * @returns {string} 归一化后的说明。
 */
function normalizeDescription(value) {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * 解析 SKILL.md 顶部 frontmatter 中的名称和说明。
 * @param {string} content SKILL.md 文件内容。
 * @returns {{name: string, description: string}} 技能元数据。
 */
function parseSkillMetadata(content) {
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
  const metadata = frontmatter?.[1] ?? '';
  const name = metadata.match(/^name:\s*(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
  const lines = metadata.split('\n');
  const descriptionIndex = lines.findIndex((line) => line.startsWith('description:'));
  const descriptionLine = descriptionIndex >= 0 ? lines[descriptionIndex] : '';
  let description = '';
  if (descriptionLine.match(/^description:\s*\|/)) {
    const descriptionLines = [];
    for (const line of lines.slice(descriptionIndex + 1)) {
      if (line.trim() && !line.match(/^\s/)) {
        break;
      }
      descriptionLines.push(line.trim());
    }
    description = descriptionLines.join(' ');
  } else {
    description = descriptionLine.match(/^description:\s*(.+)$/)?.[1]?.trim() ?? '';
  }

  return {
    name,
    description: normalizeDescription(description.replace(/^['"]|['"]$/g, ''))
  };
}

/**
 * 读取目录下所有 SKILL.md 文件。
 * @param {string} root 技能根目录。
 * @returns {Promise<Array<{directory: string, filePath: string, name: string, description: string}>>} 技能元数据列表。
 */
async function readSkillDirectory(root) {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const skills = await Promise.all(entries
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => {
      const filePath = path.join(root, entry.name, 'SKILL.md');
      const content = await readText(filePath);
      const metadata = parseSkillMetadata(content);
      return {
        directory: entry.name,
        filePath,
        name: metadata.name || entry.name.replace(/^gstack-/, ''),
        description: metadata.description
      };
    }));

  return skills
    .filter((skill) => skill.name)
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * 查找 Superpowers 插件的技能目录。
 * @param {string} root 插件缓存根目录。
 * @returns {Promise<string>} 技能目录，未找到时返回空字符串。
 */
async function findSuperpowersSkillRoot(root) {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const skillRoot = path.join(root, entry.name, 'skills');
    if (await pathExists(skillRoot)) {
      return skillRoot;
    }
  }
  return '';
}

/**
 * 按 GStack 技能名称推断展示分类。
 * @param {string} name 技能名称。
 * @returns {string} 中文分类。
 */
function categorizeGStackSkill(name) {
  if (name.startsWith('design-')) return '设计体验';
  if (name.includes('design-review')) return '设计体验';
  if (name.includes('devex')) return '开发体验';
  if (name.startsWith('plan-')) return '方案审查';
  if (['qa', 'qa-only', 'browse', 'benchmark', 'benchmark-models', 'canary'].includes(name)) return '验证与监控';
  if (['ship', 'land-and-deploy', 'setup-deploy'].includes(name)) return '发布部署';
  if (name.startsWith('document-') || ['make-pdf'].includes(name)) return '文档';
  if (name.startsWith('ios-')) return 'iOS';
  if (['careful', 'guard', 'cso', 'freeze', 'unfreeze'].includes(name)) return '安全与边界';
  if (name.startsWith('context-') || ['learn', 'sync-gbrain', 'setup-gbrain'].includes(name)) return '上下文与记忆';
  if (['review', 'health', 'investigate', 'retro'].includes(name)) return '代码质量';
  if (['scrape', 'pair-agent', 'open-gstack-browser'].includes(name)) return '浏览器协作';
  if (name.startsWith('setup-') || ['gstack', 'gstack-upgrade', 'claude'].includes(name)) return '安装配置';
  return '通用能力';
}

/**
 * 生成 GStack 技能的中文用途说明。
 * @param {string} name 技能名称。
 * @returns {string} 中文用途说明。
 */
function describeGStackSkill(name) {
  const descriptions = {
    autoplan: '自动串联 CEO、设计、工程和开发体验审查，适合对方案做完整复盘。',
    benchmark: '用浏览器自动化做性能回归检测，帮助发现页面速度和交互性能退化。',
    'benchmark-models': '用同一任务横向比较多个模型执行 GStack 技能的表现。',
    browse: '启动受控浏览器做网页验证、交互测试和站点巡检。',
    canary: '发布后持续观察线上页面，捕捉 console error、接口异常和明显回归。',
    careful: '在可能破坏文件或状态的操作前加保护提示，降低误操作风险。',
    claude: '让非 Claude 宿主调用 Claude Code CLI，适合跨宿主协同。',
    'context-restore': '恢复之前保存的工作上下文，适合中断后继续任务。',
    'context-save': '保存当前分支、决策和进度，方便后续恢复。',
    cso: '以安全负责人视角检查权限、凭证、配置和高风险操作。',
    'design-consultation': '做产品设计咨询，先理解目标和用户，再给出体验建议。',
    'design-html': '把设计方案收束成可运行的高质量 HTML 视觉稿。',
    'design-review': '用设计审查视角发现布局、层级、间距和一致性问题。',
    'design-shotgun': '并行生成多个设计方向，适合早期探索不同视觉方案。',
    'devex-review': '审查开发者体验，关注安装、运行、调试和贡献路径是否顺畅。',
    'document-generate': '从代码和功能现状生成缺失文档。',
    'document-release': '交付后更新发布说明、使用文档和相关工程文档。',
    freeze: '限制本轮编辑范围，避免改到不该碰的目录。',
    gstack: 'GStack 主入口技能，说明框架定位、路由和可用能力。',
    'gstack-upgrade': '检查并升级 GStack 本体到最新版本。',
    guard: '启用更完整的安全保护，覆盖破坏性命令和目录边界。',
    health: '汇总项目质量状态，包装现有测试、类型检查和 lint 工具。',
    investigate: '系统化排查 bug，先收集证据和根因，再决定修复方式。',
    'ios-clean': '移除 iOS DebugBridge 相关调试接入和 DEBUG 代码。',
    'ios-design-review': '在真实设备上审查 iOS SwiftUI 应用的视觉体验。',
    'ios-fix': '根据 iOS QA 发现的问题自动定位并修复。',
    'ios-qa': '连接真实 iPhone 做 SwiftUI 应用 QA。',
    'ios-sync': '同步 iOS debug bridge 到最新上游版本。',
    'land-and-deploy': '合并 PR、等待 CI，并按配置完成部署。',
    'landing-report': '查看 workspace-aware ship 队列和落地状态。',
    learn: '管理项目经验记录，支持搜索、回顾和清理。',
    'make-pdf': '把 Markdown 文档生成高质量 PDF。',
    'office-hours': '以 YC office hours 风格追问创业、产品或执行问题。',
    'open-gstack-browser': '打开 GStack Browser，让 AI 控制 Chromium 做验证。',
    'pair-agent': '把远程 AI agent 接入当前浏览器协作。',
    'plan-ceo-review': '用 CEO/创始人视角审查计划，关注价值、取舍和目标。',
    'plan-design-review': '审查方案中的 UI/UX 信息架构和设计风险。',
    'plan-devex-review': '在开工前审查开发者体验和工程接入成本。',
    'plan-eng-review': '在实现前审查架构、数据流、边界、测试和性能。',
    'plan-tune': '根据用户偏好调节计划阶段的问题敏感度。',
    qa: '对 Web 应用做系统化 QA，并在发现问题后修复。',
    'qa-only': '只做 QA 报告，不修改代码。',
    retro: '分析近期提交记录，生成工程复盘。',
    review: '交付前做代码审查，优先发现 bug、回归和测试缺口。',
    scrape: '从网页提取结构化信息，适合调研和资料收集。',
    'setup-browser-cookies': '把真实 Chromium cookies 导入 GStack Browser。',
    'setup-deploy': '配置 land-and-deploy 所需的部署参数。',
    'setup-gbrain': '安装并配置 gbrain，让项目代码进入可搜索知识库。',
    ship: '完整交付工作流，检测 merge base、运行测试、提交并推送。',
    skillify: '把最近成功的 scrape 流程沉淀成可复用 skill。',
    'sync-gbrain': '同步当前仓库代码到 gbrain，并刷新 agent 搜索指引。',
    unfreeze: '解除 freeze 设置，恢复正常编辑范围。'
  };
  return descriptions[name] ?? `${name} 属于 ${categorizeGStackSkill(name)}，可按项目需要接入到工作流。`;
}

/**
 * 生成 Superpowers 技能的中文用途说明。
 * @param {string} name 技能名称。
 * @returns {string} 中文用途说明。
 */
function describeSuperpowersSkill(name) {
  const descriptions = {
    brainstorming: '在创意或方案阶段先澄清目标、约束和可能路径，避免过早写代码。',
    'dispatching-parallel-agents': '把多个独立任务分派给并行 agent，提高复杂任务吞吐。',
    'executing-plans': '按既定计划逐项执行，并持续维护任务状态。',
    'finishing-a-development-branch': '完成开发分支前做收尾检查，确保测试、状态和交付说明齐备。',
    'receiving-code-review': '收到代码审查反馈后，先理解问题再有序修复。',
    'requesting-code-review': '完成较大实现后主动请求审查，暴露潜在缺陷。',
    'subagent-driven-development': '用子代理拆分实现、验证和复核，适合多模块任务。',
    'systematic-debugging': '遇到 bug 时按证据链定位根因，避免凭猜测修复。',
    'test-driven-development': '先写失败测试，再实现最小代码，通过后重构。',
    'using-git-worktrees': '用 git worktree 隔离开发环境，减少分支和文件状态冲突。',
    'using-superpowers': 'Superpowers 的入口技能，说明如何发现和使用其他技能。',
    'verification-before-completion': '完成前强制验证，避免未测试就声称完成。',
    'writing-plans': '把多步骤任务写成可执行计划，明确文件、测试和验收路径。',
    'writing-skills': '创建或修改技能时的编写规范，确保技能可复用、可触发。'
  };
  return descriptions[name] ?? `${name} 属于 ${categorizeSuperpowersSkill(name)}，用于增强 AI 执行过程的稳定性。`;
}

/**
 * 按 Superpowers 技能名称推断展示分类。
 * @param {string} name 技能名称。
 * @returns {string} 中文分类。
 */
function categorizeSuperpowersSkill(name) {
  if (['brainstorming', 'writing-plans', 'executing-plans'].includes(name)) return '计划执行';
  if (name.includes('code-review')) return '代码审查';
  if (name.includes('debugging')) return '问题排查';
  if (name.includes('test-driven')) return '测试驱动';
  if (name.includes('git-worktrees')) return '分支隔离';
  if (name.includes('subagent')) return '多代理协作';
  if (name.includes('verification')) return '完成验证';
  if (name.includes('writing-skills') || name.includes('using-superpowers')) return '技能体系';
  return '通用能力';
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
    updateAvailable: Boolean(options.updateAvailable)
  };
}

/**
 * 生成带分类和来源的技能说明项。
 * @param {string} name 技能或命令名称。
 * @param {string} purpose 中文用途说明。
 * @param {string[]} workflows 使用该能力的工作流列表。
 * @param {string} category 技能分类。
 * @param {string} source 技能来源。
 * @param {string} officialText 官方原始说明。
 * @param {boolean} available 当前本机是否可用。
 * @returns {object} 技能说明模型。
 */
function manualItem(name, purpose, workflows = [], category = '通用能力', source = '', officialText = '', available = false) {
  return { name, purpose, workflows, category, source, officialText, available };
}

/**
 * 从官方 GStack 技能目录生成技能手册。
 * @param {string} root GStack 仓库根目录。
 * @returns {Promise<object[]>} 技能手册。
 */
async function buildGStackManual(root) {
  const skillRoot = path.join(root, '.agents/skills');
  const skills = await readSkillDirectory(skillRoot);
  if (skills.length === 0) {
    return [
      manualItem('/plan-eng-review', '工程方案审查，关注架构、数据流、边界和测试。', [], '方案审查', '内置兜底清单'),
      manualItem('/plan-design-review', '设计方案审查，关注 UI 信息架构和体验一致性。', [], '设计体验', '内置兜底清单'),
      manualItem('/cso', '安全审查，关注凭证、权限、配置和高风险操作。', [], '安全与边界', '内置兜底清单'),
      manualItem('/review', '实现后的代码审查，关注缺陷、回归和测试缺口。', [], '代码质量', '内置兜底清单'),
      manualItem('/qa', '浏览器或产品层面的系统化验证。', [], '验证与监控', '内置兜底清单')
    ];
  }

  return skills.map((skill) => manualItem(
    `/${skill.name}`,
    describeGStackSkill(skill.name),
    [],
    categorizeGStackSkill(skill.name),
    `${skill.directory}/SKILL.md`,
    skill.description,
    Boolean(skill.filePath)
  ));
}

/**
 * 从官方 Superpowers 插件目录生成技能手册。
 * @param {string} root Superpowers 插件缓存根目录。
 * @returns {Promise<object[]>} 技能手册。
 */
async function buildSuperpowersManual(root) {
  const skillRoot = await findSuperpowersSkillRoot(root);
  const skills = skillRoot ? await readSkillDirectory(skillRoot) : [];
  if (skills.length === 0) {
    return [
      manualItem('superpowers:brainstorming', '创意和方案发散前先澄清目标。', [], '计划执行', '内置兜底清单'),
      manualItem('superpowers:writing-plans', '把复杂实现拆成可执行计划。', [], '计划执行', '内置兜底清单'),
      manualItem('superpowers:executing-plans', '按计划逐项执行并保持状态同步。', [], '计划执行', '内置兜底清单'),
      manualItem('superpowers:systematic-debugging', '遇到 bug 时按证据链定位根因。', [], '问题排查', '内置兜底清单'),
      manualItem('superpowers:test-driven-development', '用测试先约束行为再实现。', [], '测试驱动', '内置兜底清单'),
      manualItem('superpowers:verification-before-completion', '完成前验证，避免没跑测试就声称完成。', [], '完成验证', '内置兜底清单')
    ];
  }

  return skills.map((skill) => manualItem(
    `superpowers:${skill.name}`,
    describeSuperpowersSkill(skill.name),
    [],
    categorizeSuperpowersSkill(skill.name),
    `${skill.directory}/SKILL.md`,
    skill.description,
    Boolean(skill.filePath)
  ));
}

const OPENSPEC_MANUAL = [
  manualItem('openspec init', '初始化项目里的 OpenSpec 目录结构，并配置 AI 工具集成。', [], '项目初始化', 'OpenSpec CLI'),
  manualItem('openspec update', '刷新 AI instructions、skills 和 commands，让本地工作流文件跟随当前 CLI 版本。', [], '项目初始化', 'OpenSpec CLI'),
  manualItem('openspec list', '查看当前 changes 或正式 specs，适合快速了解项目规格状态。', [], '浏览读取', 'OpenSpec CLI'),
  manualItem('openspec show', '查看某个 change 或 spec 的详细内容，支持结构化输出供 agent 读取。', [], '浏览读取', 'OpenSpec CLI'),
  manualItem('openspec validate', '校验 change 或 spec 是否满足 schema 和差异格式要求。', [], '校验', 'OpenSpec CLI'),
  manualItem('openspec status', '查看 artifact 进度，帮助判断 proposal、design、tasks 是否齐备。', [], '流程状态', 'OpenSpec CLI'),
  manualItem('openspec instructions', '根据当前 change 状态生成下一步执行指令。', [], '流程状态', 'OpenSpec CLI'),
  manualItem('openspec templates', '定位官方模板路径，适合生成或检查 proposal/design/tasks。', [], '模板与结构', 'OpenSpec CLI'),
  manualItem('openspec schemas', '查看可用 schema，用于理解当前 OpenSpec 工作流结构。', [], '模板与结构', 'OpenSpec CLI'),
  manualItem('openspec archive', '完成变更后归档 change，并同步正式 spec。', [], '生命周期', 'OpenSpec CLI'),
  manualItem('openspec workspace setup', '配置跨仓库或多目录 workspace，用于多项目规格协作。', [], 'Workspace', 'OpenSpec CLI'),
  manualItem('openspec workspace doctor', '检查 workspace 链接和状态，适合排查多项目协作问题。', [], 'Workspace', 'OpenSpec CLI'),
  manualItem('openspec-propose', 'AI 侧提案技能：创建 proposal、design、spec 和 tasks。', [], 'AI 技能', 'agentic-workflow OpenSpec skill'),
  manualItem('openspec-apply-change', 'AI 侧执行技能：按 tasks 实现代码并保持 OpenSpec 状态同步。', [], 'AI 技能', 'agentic-workflow OpenSpec skill'),
  manualItem('openspec-archive-change', 'AI 侧归档技能：把已完成 change 归档并同步正式 spec。', [], 'AI 技能', 'agentic-workflow OpenSpec skill'),
  manualItem('openspec-explore', 'AI 侧探索技能：进入正式 proposal 前澄清需求、风险和边界。', [], 'AI 技能', 'agentic-workflow OpenSpec skill')
];

/**
 * 按当前环境给 OpenSpec CLI 和本地 AI skills 标记可用性。
 * @param {object[]} manual 手册条目。
 * @param {boolean} cliAvailable OpenSpec CLI 是否可用。
 * @returns {Promise<object[]>} 带可用性标记的手册条目。
 */
async function markOpenSpecAvailability(manual, cliAvailable) {
  return Promise.all(manual.map(async (item) => {
    if (item.name.startsWith('openspec ')) {
      return { ...item, available: cliAvailable };
    }
    const skillPath = path.join(WORKFLOW_ROOT, '.codex/skills', item.name, 'SKILL.md');
    return { ...item, available: await pathExists(skillPath) };
  }));
}

/**
 * 根据工作流已绑定技能过滤未使用的官方技能。
 * @param {object[]} officialSkills 官方技能列表。
 * @param {object[]} workflowSkills 工作流技能列表。
 * @returns {object[]} 未绑定到当前工作流的技能列表。
 */
function unusedManualItems(officialSkills, workflowSkills) {
  const usedNames = new Set(workflowSkills.map((skill) => skill.name.replace(/^\/gstack-/, '/')));
  return officialSkills
    .filter((skill) => !usedNames.has(skill.name))
    .map((skill) => ({
      ...skill,
      purpose: `${skill.purpose} 当前工作流未默认绑定，可按项目需要扩展。`
    }));
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
  const gstackOfficialSkills = await buildGStackManual(codexGstackRoot);
  const superpowersOfficialSkills = await buildSuperpowersManual(superpowersRoot);
  const openspecOfficialSkills = await markOpenSpecAvailability(OPENSPEC_MANUAL, Boolean(openspecVersion.current));
  const openspecWorkflowSkills = [
    manualItem('openspec-propose', '小需求和完整通道的提案入口。', ['/wf-small', '/wf-complex'], 'AI 技能', 'agentic-workflow OpenSpec skill'),
    manualItem('openspec-apply-change', '确认方案后执行实现。', ['/wf-small', '/wf-complex'], 'AI 技能', 'agentic-workflow OpenSpec skill'),
    manualItem('openspec-archive-change', '完成后归档变更。', ['/wf-small', '/wf-complex'], 'AI 技能', 'agentic-workflow OpenSpec skill'),
    manualItem('openspec-explore', '复杂需求先探索再定方案。', ['/wf-complex'], 'AI 技能', 'agentic-workflow OpenSpec skill')
  ];
  const gstackWorkflowSkills = [
    manualItem('/gstack-plan-eng-review', 'Codex App 中的工程 gate。', ['/wf-small', '/wf-complex', '/wf-plan'], '方案审查', 'agentic-workflow host command mapping'),
    manualItem('/gstack-plan-design-review', 'Codex App 中的 UI/设计 gate。', ['/wf-complex'], '设计体验', 'agentic-workflow host command mapping'),
    manualItem('/gstack-cso', 'Codex App 中的安全 gate。', ['按规则条件触发'], '安全与边界', 'agentic-workflow host command mapping'),
    manualItem('/gstack-review', 'Codex App 中的代码审查。', ['/wf-small', '/wf-complex'], '代码质量', 'agentic-workflow host command mapping'),
    manualItem('/plan-eng-review', 'Claude CLI 中的工程 gate。', ['/wf-small', '/wf-complex', '/wf-plan'], '方案审查', 'agentic-workflow host command mapping'),
    manualItem('/review', 'Claude CLI 中的代码审查。', ['/wf-small', '/wf-complex'], '代码质量', 'agentic-workflow host command mapping')
  ];
  const superpowersWorkflowSkills = [
    manualItem('superpowers:verification-before-completion', '完成前条件 skill。', ['/wf-small', '/wf-complex', '/wf-debug'], '完成验证', 'agentic-workflow required_skills'),
    manualItem('superpowers:systematic-debugging', 'debug 场景必备方法。', ['/wf-debug'], '问题排查', 'agentic-workflow required_skills'),
    manualItem('superpowers:test-driven-development', '测试驱动开发场景。', ['/wf-debug'], '测试驱动', 'agentic-workflow required_skills'),
    manualItem('superpowers:brainstorming', '复杂需求探索阶段。', ['/wf-complex'], '计划执行', 'agentic-workflow required_skills'),
    manualItem('superpowers:writing-plans', '复杂需求落执行计划。', ['/wf-complex'], '计划执行', 'agentic-workflow required_skills')
  ];
  const outdatedCount = [
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
      outdatedCount,
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
          updateAvailable: openspecVersion.updateAvailable
        },
        aiSupport: [
          hostSupport({
            host: 'Codex App',
            supported: Boolean(openspecVersion.current),
            install: '全局 openspec CLI',
            version: openspecVersion.current || '未安装',
            updateAvailable: openspecVersion.updateAvailable
          }),
          hostSupport({
            host: 'Claude CLI',
            supported: Boolean(openspecVersion.current),
            install: '全局 openspec CLI',
            version: openspecVersion.current || '未安装',
            updateAvailable: openspecVersion.updateAvailable
          })
        ],
        officialSkills: openspecOfficialSkills,
        workflowSkills: openspecWorkflowSkills,
        unusedSkills: unusedManualItems(openspecOfficialSkills, openspecWorkflowSkills)
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
          updateAvailable: codexGstackVersion.updateAvailable || claudeGstackVersion.updateAvailable
        },
        aiSupport: [
          hostSupport({
            host: 'Codex App',
            supported: codexGstack,
            install: codexGstack ? '~/.codex/skills/gstack' : '未检测到 Codex GStack skills',
            version: codexGstackVersion.current || '未安装',
            updateAvailable: codexGstackVersion.updateAvailable
          }),
          hostSupport({
            host: 'Claude CLI',
            supported: claudeGstack,
            install: claudeGstack ? '~/.claude/skills/gstack 或 ~/.gstack/repos/gstack' : '未检测到 Claude/GStack 安装',
            version: claudeGstackVersion.current || '未安装',
            updateAvailable: claudeGstackVersion.updateAvailable
          })
        ],
        officialSkills: gstackOfficialSkills,
        workflowSkills: gstackWorkflowSkills,
        unusedSkills: unusedManualItems(gstackOfficialSkills, gstackWorkflowSkills)
      },
      {
        id: 'superpowers',
        title: 'Superpowers',
        subtitle: '计划、TDD、debug 和完成前验证的方法论技能',
        purpose: 'Superpowers 不是业务插件，它是一组让 AI 做事更稳的方法：先想清楚、再测试、遇到问题系统排查、完成前验证。',
        design: 'agentic-workflow 在不同 `/wf-*` 中声明 required 或 conditional skills，执行者需要先加载对应 skill 文档再继续。',
        version: {
          current: codexSuperpowersVersion || '需在宿主插件中查看',
          latest: '未检测',
          updateAvailable: false
        },
        aiSupport: [
          hostSupport({
            host: 'Codex App',
            supported: codexSuperpowers,
            install: codexSuperpowers ? '~/.codex/plugins/cache/openai-curated/superpowers' : '未检测到 Codex Superpowers 插件',
            version: codexSuperpowersVersion || '未安装'
          }),
          hostSupport({
            host: 'Claude CLI',
            supported: claudeSuperpowers,
            install: claudeSuperpowers ? 'Claude 插件或共享 skill 来源' : '未检测到 Claude Superpowers 安装',
            version: codexSuperpowersVersion || '需在 Claude 插件中查看'
          })
        ],
        officialSkills: superpowersOfficialSkills,
        workflowSkills: superpowersWorkflowSkills,
        unusedSkills: unusedManualItems(superpowersOfficialSkills, superpowersWorkflowSkills)
      }
    ]
  };
}
