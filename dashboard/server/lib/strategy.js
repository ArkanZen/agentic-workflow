// 项目档位策略，描述每个档位的默认治理强度和重点风险。
export const TIER_STRATEGIES = [
  {
    id: 'vibe',
    title: 'vibe',
    purpose: '个人项目和原型验证，默认低摩擦，但保留安全底线。',
    defaultWorkflow: '/wf-quick',
    governance: '轻量',
    enabledRisks: ['security', 'final_verification']
  },
  {
    id: 'frontend',
    title: 'frontend',
    purpose: '前端项目，重点关注 UI/体验、浏览器验证和轻量工程风险。',
    defaultWorkflow: '/wf-small',
    governance: '体验优先',
    enabledRisks: ['ui', 'browser_qa', 'test_driven', 'final_verification']
  },
  {
    id: 'backend',
    title: 'backend',
    purpose: '后端服务，重点关注架构边界、接口、权限、配置和测试。',
    defaultWorkflow: '/wf-small',
    governance: '工程优先',
    enabledRisks: ['architecture', 'security', 'code_review', 'test_driven', 'final_verification']
  },
  {
    id: 'fullstack',
    title: 'fullstack',
    purpose: '前后端合体项目，默认治理最强，跨层变更需要多 gate 串联。',
    defaultWorkflow: '/wf-small',
    governance: '强治理',
    enabledRisks: ['architecture', 'ui', 'security', 'code_review', 'browser_qa', 'planning', 'final_verification']
  },
  {
    id: 'python-data',
    title: 'python-data',
    purpose: '数据、报表和指标项目，重点关注 SQL、聚合逻辑、指标口径和下游影响。',
    defaultWorkflow: '/wf-small',
    governance: '口径优先',
    enabledRisks: ['architecture', 'data_metric', 'security', 'test_driven', 'final_verification']
  }
];

// 任务工作流策略，描述每个 /wf-* 入口适合处理什么问题。
export const TASK_WORKFLOWS = [
  {
    id: '/wf-plan',
    title: '/wf-plan',
    purpose: '先判断值不值得做，以及应该收敛到哪个执行路径。',
    requiredCapabilities: ['/plan-eng-review'],
    conditionalCapabilities: ['/plan-ceo-review', '/office-hours']
  },
  {
    id: '/wf-quick',
    title: '/wf-quick',
    purpose: '低风险小改动，保留 OpenSpec 记录和完成前验证。',
    requiredCapabilities: ['openspec-apply-change', 'openspec-archive-change'],
    conditionalCapabilities: ['superpowers:systematic-debugging', 'superpowers:verification-before-completion']
  },
  {
    id: '/wf-small',
    title: '/wf-small',
    purpose: '清晰小需求，默认走 OpenSpec，按风险触发 gate。',
    requiredCapabilities: ['openspec-propose', 'openspec-apply-change', 'openspec-archive-change', 'superpowers:verification-before-completion'],
    conditionalCapabilities: ['/plan-eng-review', '/plan-design-review', '/cso', 'superpowers:test-driven-development']
  },
  {
    id: '/wf-complex',
    title: '/wf-complex',
    purpose: '复杂或高风险变更，覆盖探索、方案、任务分解、实现、审查和验收。',
    requiredCapabilities: ['superpowers:brainstorming', 'openspec-propose', '/plan-eng-review', 'superpowers:writing-plans', 'openspec-apply-change', 'superpowers:verification-before-completion', '/review', 'openspec-archive-change'],
    conditionalCapabilities: ['/plan-design-review', '/cso', '/qa', '/qa-only']
  },
  {
    id: '/wf-debug',
    title: '/wf-debug',
    purpose: '问题排查、重构和单测，不默认创建 OpenSpec change。',
    requiredCapabilities: ['superpowers:systematic-debugging', 'superpowers:test-driven-development', 'superpowers:brainstorming'],
    conditionalCapabilities: ['superpowers:verification-before-completion', 'openspec-apply-change']
  }
];

// 风险触发器是插件能力调用的统一解释层。
export const RISK_TRIGGERS = [
  {
    id: 'spec_change',
    title: '规格变更',
    condition: '新功能、行为变化、接口变化、项目可见能力变化。',
    capabilities: ['openspec-propose', 'openspec-apply-change', 'openspec-archive-change']
  },
  {
    id: 'architecture',
    title: '架构风险',
    condition: '跨模块、数据流、边界调整、核心抽象变化。',
    capabilities: ['/plan-eng-review']
  },
  {
    id: 'ui',
    title: 'UI/体验风险',
    condition: '新增页面、核心流程、交互、信息架构、可视化或布局体系变化。',
    capabilities: ['/plan-design-review', '/design-review']
  },
  {
    id: 'security',
    title: '安全风险',
    condition: '凭证、权限、认证鉴权、外部 API、部署配置或敏感数据处理。',
    capabilities: ['/cso']
  },
  {
    id: 'code_review',
    title: '代码质量风险',
    condition: '复杂实现、核心逻辑、重构后行为不确定或回归风险较高。',
    capabilities: ['/review']
  },
  {
    id: 'browser_qa',
    title: '浏览器验证',
    condition: 'Web UI、交互流程、视觉回归、控制台错误或端到端路径。',
    capabilities: ['/qa', '/qa-only']
  },
  {
    id: 'debug',
    title: 'Debug 风险',
    condition: 'bug、异常、不确定根因、线上问题或复现不稳定。',
    capabilities: ['superpowers:systematic-debugging']
  },
  {
    id: 'test_driven',
    title: '测试风险',
    condition: '新行为、核心逻辑、修 bug 防回归或需要先约束行为。',
    capabilities: ['superpowers:test-driven-development']
  },
  {
    id: 'planning',
    title: '计划风险',
    condition: '多步骤、多文件、执行路径不清晰或需要拆分任务。',
    capabilities: ['superpowers:writing-plans']
  },
  {
    id: 'data_metric',
    title: '数据口径风险',
    condition: 'SQL、聚合逻辑、指标口径、报表下游影响或时间边界。',
    capabilities: ['data-metric-review']
  },
  {
    id: 'final_verification',
    title: '完成声明',
    condition: '所有实现型任务在声明完成前都需要验证。',
    capabilities: ['superpowers:verification-before-completion']
  }
];

/**
 * 规范化能力名称，抹平 Codex 和 Claude 的 GStack 命令前缀差异。
 * @param {string} name 能力名称。
 * @returns {string} 规范化名称。
 */
export function normalizeCapabilityName(name) {
  return name.replace(/^\/gstack-/, '/');
}

/**
 * 从 OpenSpec 配置文本中提取真实启用的风险触发器。
 * @param {string | null} configContent 配置文本。
 * @returns {string[]} 风险触发器 id 列表。
 */
export function parseRiskTriggerIds(configContent) {
  if (!configContent?.includes('risk_triggers:')) {
    return [];
  }
  const lines = configContent.split('\n');
  const startIndex = lines.findIndex((line) => line.trim() === 'risk_triggers:');
  if (startIndex < 0) {
    return [];
  }
  const ids = [];
  for (const line of lines.slice(startIndex + 1)) {
    if (line.trim() && !line.startsWith(' ')) {
      break;
    }
    const match = line.match(/^  ([a-zA-Z0-9_-]+):\s*$/);
    if (match) {
      ids.push(match[1]);
    }
  }
  return ids;
}

/**
 * 查找指定项目档位策略。
 * @param {string} tier 项目档位。
 * @returns {object} 档位策略。
 */
export function findTierStrategy(tier) {
  return TIER_STRATEGIES.find((item) => item.id === tier) ?? TIER_STRATEGIES[0];
}

/**
 * 构建项目策略摘要。
 * @param {string} tier 项目档位。
 * @param {string | null} configContent 配置文本。
 * @returns {object} 项目策略摘要。
 */
export function buildProjectStrategy(tier, configContent = null) {
  const tierStrategy = findTierStrategy(tier);
  const configRiskIds = parseRiskTriggerIds(configContent);
  const enabledRiskIds = new Set(configRiskIds.length > 0 ? configRiskIds : ['spec_change', ...tierStrategy.enabledRisks]);
  const enabledRiskTriggers = RISK_TRIGGERS.filter((risk) => enabledRiskIds.has(risk.id));
  const enabledCapabilities = [...new Set(enabledRiskTriggers
    .flatMap((risk) => risk.capabilities)
    .map(normalizeCapabilityName))];

  return {
    tier: tierStrategy,
    source: configRiskIds.length > 0 ? 'config' : 'tier-preset',
    taskWorkflows: TASK_WORKFLOWS,
    riskTriggers: RISK_TRIGGERS,
    enabledRiskTriggers,
    enabledCapabilities
  };
}
