import { useEffect, useMemo, useState } from 'react';
import { detectInstall, fetchProjects, previewAction, runAction, runDoctor } from './api.js';

// 工作流档位选项，用于安装、升级和切换档位动作。
const TIERS = ['backend', 'python-data', 'frontend', 'fullstack', 'vibe'];

// 安装向导支持的写入动作，status-only 只展示检测状态。
const INSTALL_MODES = [
  { id: 'install', label: '安装工作流', description: '目标项目还没有工作流配置时使用' },
  { id: 'upgrade', label: '升级模板', description: '保留当前档位，同步仓库里的新版模板' },
  { id: 'switch-tier', label: '切换档位', description: '项目已安装，但想改成其他 workflow tier' },
  { id: 'status-only', label: '只看状态', description: '不写文件，只查看检测结果' }
];

// 本地扫描目录缓存键，仅保存在浏览器本地，不写入项目文件。
const ROOTS_STORAGE_KEY = 'agentic-workflow-dashboard.roots';

// 左侧全局主导航，区分全局功能和项目上下文。
const GLOBAL_VIEWS = [
  { id: 'dashboard', label: '仪表盘' },
  { id: 'projects', label: '项目' },
  { id: 'install', label: '安装工作流' },
  { id: 'strategy', label: '工作流策略' },
  { id: 'tools', label: '工具能力' },
  { id: 'scan', label: '扫描设置' },
  { id: 'workflows', label: '关于工作流' }
];

// 工作流说明用于解释每个 /wf-* 的定位，默认折叠展示。
const WORKFLOW_GUIDES = [
  {
    name: '/wf-quick',
    official: '快速通道：适合文案、样式、小 bug 和很明确的轻量变更。',
    project: '在本项目中用于跳过完整 gate，快速生成 proposal/tasks 后实现。'
  },
  {
    name: '/wf-small',
    official: '小需求完整通道：适合范围清晰、需要 OpenSpec 记录和工程审查的功能。',
    project: '当前 Dashboard MVP 就使用这个流程，包含 propose、GStack gate、apply、verification。'
  },
  {
    name: '/wf-complex',
    official: '复杂需求通道：适合跨模块、架构变化或边界不清晰的需求。',
    project: '会引入 Superpowers brainstorming/writing-plans，再进入 OpenSpec 与 GStack gate。'
  },
  {
    name: '/wf-debug',
    official: 'Debug / 重构 / 单测通道：适合已知问题排查、TDD 和行为验证。',
    project: '会按场景加载 systematic-debugging、test-driven-development 或 verification。'
  },
  {
    name: '/wf-plan',
    official: '产品/架构方案通道：先判断值不值得做，以及如何收敛范围。',
    project: '用于实现前的方案评估，必须走 GStack 工程可行性审查。'
  },
  {
    name: '/wf-install',
    official: '安装/升级/切档通道：管理 agentic-workflow 在目标项目中的安装状态。',
    project: '用于首次安装、升级模板、切换 backend/frontend/fullstack 等 workflow tier。'
  }
];

/**
 * 格式化布尔状态为简短标签。
 * @param {boolean} value 布尔值。
 * @returns {string} 状态标签。
 */
function booleanLabel(value) {
  return value ? '可用' : '缺失';
}

/**
 * 规范化能力名称，用于对齐 Codex 和 Claude 的 GStack 命令差异。
 * @param {string} name 能力名称。
 * @returns {string} 规范化名称。
 */
function normalizeCapabilityName(name) {
  return name.replace(/^\/gstack-/, '/');
}

/**
 * 根据健康统计推导项目状态。
 * @param {object | null} doctor doctor 结果。
 * @returns {string} 状态标签。
 */
function healthLabel(doctor) {
  if (!doctor) {
    return '未检查';
  }
  if (doctor.failCount > 0) {
    return '失败';
  }
  if (doctor.warnCount > 0) {
    return '警告';
  }
  return '通过';
}

/**
 * 根据 doctor 结果推导徽标颜色。
 * @param {object | null} doctor doctor 结果。
 * @returns {string} 徽标色调。
 */
function healthTone(doctor) {
  if (!doctor) {
    return 'muted';
  }
  if (doctor.failCount > 0) {
    return 'fail';
  }
  if (doctor.warnCount > 0) {
    return 'warn';
  }
  return 'pass';
}

/**
 * 获取项目安装状态标签。
 * @param {object} project 项目摘要。
 * @returns {{label: string, tone: string}} 展示状态。
 */
function installStatus(project) {
  if (project?.installed) {
    return { label: '已安装', tone: 'pass' };
  }
  if (project?.partial) {
    return { label: '部分配置', tone: 'warn' };
  }
  return { label: '可安装', tone: 'muted' };
}

/**
 * 单个状态徽标组件。
 * @param {{label: string, tone?: string}} props 组件属性。
 * @returns {JSX.Element} 徽标元素。
 */
function Badge({ label, tone = 'muted' }) {
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

/**
 * 项目列表行组件。
 * @param {{project: object, selected: boolean, onSelect: () => void}} props 组件属性。
 * @returns {JSX.Element} 项目行。
 */
function ProjectRow({ project, selected, onSelect }) {
  const health = healthLabel(project.doctor);
  const status = installStatus(project);
  return (
    <button className={`project-row ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <span className="project-name">{project.name}</span>
      <span>{project.tier}</span>
      <span>{project.workflowVersion}</span>
      <span>{project.hosts?.codex ? 'Codex' : '未装'} / {project.hosts?.claude ? 'Claude' : '未装'}</span>
      <span className="row-badges">
        <Badge label={status.label} tone={status.tone} />
        <Badge label={health} tone={healthTone(project.doctor)} />
      </span>
    </button>
  );
}

/**
 * 技能列表组件。
 * @param {{title: string, items: object[], emptyText: string}} props 组件属性。
 * @returns {JSX.Element} 技能列表。
 */
function SkillList({ title, items, emptyText }) {
  return (
    <div className="skill-box">
      <h3>{title}<span className="skill-count">{items.length}</span></h3>
      {items.length === 0 ? (
        <p className="quiet">{emptyText}</p>
      ) : items.map((item) => (
        <details className="skill-item" key={`${title}-${item.name}`}>
          <summary>
            <strong>{item.name}</strong>
            <span className="skill-meta">
              {item.category && <em>{item.category}</em>}
              {item.workflows?.length > 0 && <em>{item.workflows.join(' / ')}</em>}
            </span>
          </summary>
          <p>{item.purpose}</p>
          {item.statuses?.length > 0 && (
            <div className="status-strip">
              {item.statuses.map((status) => (
                <span className={`mini-status ${status.active ? 'active' : ''}`} key={status.label}>{status.label}</span>
              ))}
            </div>
          )}
          {item.officialText && <p className="skill-official">官方说明：{item.officialText}</p>}
          {item.source && <p className="skill-source">来源：{item.source}</p>}
        </details>
      ))}
    </div>
  );
}

/**
 * 页面标题组件。
 * @param {{eyebrow: string, title: string, subtitle?: string, badge?: JSX.Element}} props 组件属性。
 * @returns {JSX.Element} 页面标题。
 */
function PageHead({ eyebrow, title, subtitle, badge }) {
  return (
    <div className="detail-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle && <p className="path">{subtitle}</p>}
      </div>
      {badge}
    </div>
  );
}

/**
 * 全局仪表盘页面。
 * @param {{projects: object[], roots: string[]}} props 组件属性。
 * @returns {JSX.Element} 仪表盘页面。
 */
function DashboardPage({ projects, roots }) {
  const installedCount = projects.filter((project) => project.installed).length;
  const partialCount = projects.filter((project) => project.partial).length;
  const installableCount = projects.filter((project) => project.installable).length;
  const activeChanges = projects.reduce((sum, project) => sum + (project.openspec?.activeCount ?? 0), 0);

  return (
    <section className="detail">
      <PageHead eyebrow="全局概览" title="仪表盘" subtitle="查看本机 agentic-workflow 项目的总体状态" />
      <div className="metrics">
        <div><span>扫描目录</span><strong>{roots.length}</strong></div>
        <div><span>已安装项目</span><strong>{installedCount}</strong></div>
        <div><span>可安装项目</span><strong>{installableCount}</strong></div>
        <div><span>部分配置 / OpenSpec active</span><strong>{partialCount}/{activeChanges}</strong></div>
      </div>
      <section className="panel">
        <h2>项目快照</h2>
        <div className="summary-grid">
          {projects.slice(0, 8).map((project) => (
            <div key={project.path}>
              <span>{project.path}</span>
              <strong>{project.name}</strong>
            </div>
          ))}
          {projects.length === 0 && <p className="quiet">还没有扫描到工作流项目</p>}
        </div>
      </section>
    </section>
  );
}

/**
 * 工具能力页面。
 * @param {{capabilities: object | null, project: object | null}} props 组件属性。
 * @returns {JSX.Element} 能力页面。
 */
function ToolsPage({ capabilities, project }) {
  const tools = capabilities?.tools ?? [];
  const summary = capabilities?.summary;
  const [activeTool, setActiveTool] = useState(tools[0]?.id ?? 'openspec');
  const [skillQuery, setSkillQuery] = useState('');
  const [skillFilter, setSkillFilter] = useState('all');
  const tool = tools.find((item) => item.id === activeTool) ?? tools[0];
  const projectCapabilities = new Set((project?.strategy?.enabledCapabilities ?? []).map(normalizeCapabilityName));

  useEffect(() => {
    if (tools.length > 0 && !tools.some((item) => item.id === activeTool)) {
      setActiveTool(tools[0].id);
    }
  }, [activeTool, tools]);

  /**
   * 给官方技能补充四象限状态，帮助判断当前项目是否实际启用。
   * @param {object} item 技能项。
   * @returns {object} 带状态的技能项。
   */
  function decorateOfficialSkill(item) {
    const workflowNames = new Set((tool.workflowSkills ?? []).map((skill) => normalizeCapabilityName(skill.name)));
    const normalizedName = normalizeCapabilityName(item.name);
    return {
      ...item,
      statuses: [
        { label: '官方定义', active: true },
        { label: '工作流使用', active: workflowNames.has(normalizedName) },
        { label: '项目启用', active: projectCapabilities.has(normalizedName) },
        { label: '本机可用', active: Boolean(item.available) }
      ]
    };
  }

  const decoratedOfficialSkills = (tool?.officialSkills ?? []).map(decorateOfficialSkill);
  const filteredOfficialSkills = decoratedOfficialSkills.filter((item) => {
    const text = [
      item.name,
      item.purpose,
      item.category,
      item.source,
      item.officialText,
      ...(item.workflows ?? [])
    ].join(' ').toLowerCase();
    const normalizedName = normalizeCapabilityName(item.name);
    const matchesQuery = !skillQuery.trim() || text.includes(skillQuery.trim().toLowerCase());
    const matchesFilter = skillFilter === 'all'
      || (skillFilter === 'workflow' && item.statuses.some((status) => status.label === '工作流使用' && status.active))
      || (skillFilter === 'project' && projectCapabilities.has(normalizedName))
      || (skillFilter === 'available' && item.available);
    return matchesQuery && matchesFilter;
  });

  return (
    <section className="detail">
      <PageHead
        eyebrow="全局能力"
        title="工具能力"
        subtitle="OpenSpec、GStack、Superpowers 的版本检测和工作流引用关系"
        badge={summary && <Badge label={`${summary.readyTools}/${summary.totalTools} 工具可用`} tone={summary.outdatedCount > 0 ? 'warn' : 'pass'} />}
      />
      {!tool ? (
        <section className="panel"><p className="quiet">尚未检测到工具能力数据</p></section>
      ) : (
        <section className="panel">
          {summary && <p className="overview-note">{summary.overviewText}</p>}
          <div className="tool-tabs">
            {tools.map((item) => (
              <button className={item.id === tool.id ? 'active' : ''} key={item.id} onClick={() => setActiveTool(item.id)}>
                {item.title}
              </button>
            ))}
          </div>
          <div className="tool-hero">
            <div>
              <p className="eyebrow">当前工具</p>
              <h3>{tool.title}</h3>
              <p>{tool.subtitle}</p>
            </div>
            <div className="version-card">
              <span>当前版本：{tool.version.current}</span>
              <span>最新版本：{tool.version.latest}</span>
              <Badge label={tool.version.updateAvailable ? '可更新' : '已就绪'} tone={tool.version.updateAvailable ? 'warn' : 'pass'} />
            </div>
          </div>
          <div className="explain-grid">
            <div>
              <h3>用途说明</h3>
              <p>{tool.purpose}</p>
            </div>
            <div>
              <h3>设计细节</h3>
              <p>{tool.design}</p>
            </div>
          </div>
          <div className="support-matrix">
            {tool.aiSupport.map((support) => (
              <div className="support-row" key={`${tool.id}-${support.host}`}>
                <div>
                  <strong>{support.host}</strong>
                  <p>{support.install}</p>
                </div>
                <div>
                  <span className={`state-dot ${support.supported ? 'state-dot-ok' : 'state-dot-missing'}`} />
                  <span className={`state-text ${support.supported ? 'state-ok' : 'state-missing'}`}>{support.status}</span>
                </div>
                <div>
                  <span>版本：{support.version}</span>
                  <p>{support.updateAvailable ? '检测到落后版本' : '版本状态正常'}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="skill-toolbar">
            <label className="field">
              <span>搜索 skill / command（命令）/ 用途</span>
              <input value={skillQuery} onChange={(event) => setSkillQuery(event.target.value)} placeholder="例如 review、openspec、测试驱动" />
            </label>
            <label className="field">
              <span>状态过滤</span>
              <select value={skillFilter} onChange={(event) => setSkillFilter(event.target.value)}>
                <option value="all">全部官方技能</option>
                <option value="workflow">工作流中已使用</option>
                <option value="project">当前项目已启用</option>
                <option value="available">本机可用</option>
              </select>
            </label>
          </div>
          <div className="skill-columns">
            <SkillList title="官方技能手册" items={filteredOfficialSkills} emptyText="没有匹配的技能" />
            <SkillList title="工作流中用到的技能" items={tool.workflowSkills} emptyText="当前工作流未使用" />
            <SkillList title="未用到但可扩展" items={tool.unusedSkills} emptyText="当前工具已全部覆盖" />
          </div>
        </section>
      )}
    </section>
  );
}

/**
 * 工作流策略页面。
 * @param {{project: object | null}} props 组件属性。
 * @returns {JSX.Element} 策略页面。
 */
function StrategyPage({ project }) {
  const strategy = project?.strategy;
  return (
    <section className="detail">
      <PageHead
        eyebrow="策略模型"
        title="工作流策略"
        subtitle="用项目档位、任务工作流和风险触发器解释插件技能为什么会被调用"
        badge={project && <Badge label={project.tier} tone="pass" />}
      />
      {!strategy ? (
        <section className="panel"><p className="quiet">选择一个已安装项目后查看策略</p></section>
      ) : (
        <>
          <section className="panel">
            <h2>当前项目档位</h2>
            <div className="strategy-hero">
              <div>
                <p className="eyebrow">Project Tier</p>
                <h3>{strategy.tier.title}</h3>
                <p>{strategy.tier.purpose}</p>
              </div>
              <div className="summary-grid">
                <div><span>默认工作流</span><strong>{strategy.tier.defaultWorkflow}</strong></div>
                <div><span>治理强度</span><strong>{strategy.tier.governance}</strong></div>
              </div>
            </div>
          </section>
          <section className="panel">
            <h2>本项目启用的风险触发器</h2>
            <div className="risk-grid">
              {strategy.enabledRiskTriggers.map((risk) => (
                <div className="risk-card" key={risk.id}>
                  <strong>{risk.title}</strong>
                  <p>{risk.condition}</p>
                  <div className="skill-meta">
                    {risk.capabilities.map((capability) => <em key={capability}>{capability}</em>)}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <h2>任务工作流</h2>
            <div className="workflow-strategy-list">
              {strategy.taskWorkflows.map((workflow) => (
                <details className="workflow-guide-item" key={workflow.id}>
                  <summary><strong>{workflow.title}</strong></summary>
                  <p>{workflow.purpose}</p>
                  <p><span>必选能力：</span>{workflow.requiredCapabilities.join(' / ')}</p>
                  <p><span>条件能力：</span>{workflow.conditionalCapabilities.join(' / ')}</p>
                </details>
              ))}
            </div>
          </section>
        </>
      )}
    </section>
  );
}

/**
 * 工作流说明页面。
 * @returns {JSX.Element} 工作流说明页面。
 */
function WorkflowsPage() {
  return (
    <section className="detail">
      <PageHead eyebrow="工作流说明" title="关于工作流" subtitle="查看 /wf-* 官方定位和本项目定义" />
      <section className="panel">
        <div className="workflow-guide-list">
          {WORKFLOW_GUIDES.map((workflow) => (
            <details className="workflow-guide-item" key={workflow.name}>
              <summary><strong>{workflow.name}</strong></summary>
              <p><span>官方说明：</span>{workflow.official}</p>
              <p><span>项目说明：</span>{workflow.project}</p>
            </details>
          ))}
        </div>
      </section>
    </section>
  );
}

/**
 * doctor 结果展示组件，支持按状态 tab 查看检查项。
 * @param {{doctor: object | null, activeTab: string}} props 组件属性。
 * @returns {JSX.Element} doctor 结果区域。
 */
function DoctorResult({ doctor, activeTab }) {
  if (!doctor) {
    return <pre>doctor 尚未运行</pre>;
  }

  if (activeTab === 'raw') {
    return <pre>{doctor.rawOutput}</pre>;
  }

  const items = doctor.items?.[activeTab] ?? [];
  const emptyText = {
    fail: '没有失败项',
    warn: '没有警告项',
    pass: '没有通过项'
  }[activeTab];

  return (
    <div className="doctor-list">
      {items.length === 0 ? (
        <p className="empty-result">{emptyText}</p>
      ) : items.map((item, index) => (
        <div className={`doctor-item doctor-item-${activeTab}`} key={`${activeTab}-${index}`}>
          <span>{activeTab === 'fail' ? '✗' : activeTab === 'warn' ? '⚠' : '✓'}</span>
          <p>{item}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * 展示维护动作预览详情，帮助用户在执行前理解影响范围。
 * @param {{preview: object}} props 组件属性。
 * @returns {JSX.Element | null} 预览详情。
 */
function ActionPreviewDetails({ preview }) {
  const details = preview?.details;
  if (!details) {
    return null;
  }

  return (
    <div className="preview-details">
      <div className="summary-grid">
        <div><span>动作</span><strong>{details.actionLabel}</strong></div>
        <div><span>目标档位</span><strong>{details.tier}</strong></div>
        <div><span>当前版本</span><strong>{details.currentVersion ?? '不适用'}</strong></div>
        <div><span>仓库版本</span><strong>{details.repoVersion ?? '不适用'}</strong></div>
      </div>
      {details.hosts?.length > 0 && (
        <div className="install-files">
          <span>启用宿主</span>
          <div className="skill-meta">
            {details.hosts.map((host) => <em key={host}>{host}</em>)}
          </div>
        </div>
      )}
      <div className="install-files">
        <span>写入影响</span>
        <div className="preview-file-list">
          {details.files?.map((file) => (
            <div key={file.path}>
              <strong>{file.path}</strong>
              <span>{file.status}</span>
            </div>
          ))}
        </div>
      </div>
      {details.notes?.length > 0 && (
        <div className="preview-notes">
          {details.notes.map((note) => <p key={note}>{note}</p>)}
        </div>
      )}
    </div>
  );
}

/**
 * 项目详情页面。
 * @param {object} props 组件属性。
 * @returns {JSX.Element} 项目详情页面。
 */
function ProjectsPage({ project, roots, onDoctor, onSelectProject, projects, onActionComplete }) {
  const [running, setRunning] = useState(false);
  const [actionTier, setActionTier] = useState(project?.tier ?? 'vibe');
  const [actionLog, setActionLog] = useState('');
  const [actionPreview, setActionPreview] = useState(null);
  const [doctorTab, setDoctorTab] = useState('fail');

  useEffect(() => {
    setActionTier(project?.tier ?? 'vibe');
    setActionLog('');
    setActionPreview(null);
    setDoctorTab('fail');
  }, [project]);

  /**
   * 执行 doctor 并回写当前项目状态。
   * @returns {Promise<void>}
   */
  async function handleDoctor() {
    if (!project) {
      return;
    }
    setRunning(true);
    setActionLog('');
    try {
      const result = await runDoctor(project.path, roots);
      onDoctor(result);
      if (result.failCount > 0) {
        setDoctorTab('fail');
      } else if (result.warnCount > 0) {
        setDoctorTab('warn');
      } else {
        setDoctorTab('pass');
      }
    } catch (error) {
      setActionLog(error.message);
    } finally {
      setRunning(false);
    }
  }

  /**
   * 预览项目维护动作。
   * @param {string} action 动作名称。
   * @returns {Promise<void>}
   */
  async function handlePreview(action) {
    if (!project) {
      return;
    }
    setRunning(true);
    setActionLog('');
    try {
      const preview = await previewAction({
        action,
        projectPath: project.path,
        tier: actionTier,
        roots
      });
      setActionPreview({ ...preview, action, projectPath: project.path });
    } catch (error) {
      setActionLog(error.message);
    } finally {
      setRunning(false);
    }
  }

  /**
   * 执行已预览的项目维护动作。
   * @returns {Promise<void>}
   */
  async function handleRunAction() {
    if (!actionPreview) {
      return;
    }
    setRunning(true);
    try {
      const result = await runAction({
        action: actionPreview.action,
        projectPath: actionPreview.projectPath,
        tier: actionTier,
        roots
      });
      setActionLog(`${result.summary}\n\n${result.stdout}${result.stderr}`);
      setActionPreview(null);
      await onActionComplete?.(actionPreview.projectPath);
    } catch (error) {
      setActionLog(error.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="detail">
      <PageHead
        eyebrow="项目管理"
        title={project?.name ?? '项目'}
        subtitle={project?.path ?? '选择一个已发现项目查看详情'}
        badge={project && <Badge label={installStatus(project).label} tone={installStatus(project).tone} />}
      />
      <section className="panel project-picker-panel">
        <h2>项目列表</h2>
        <div className="project-list project-list-main">
          {projects.map((item) => (
            <ProjectRow
              key={item.path}
              project={item}
              selected={project?.path === item.path}
              onSelect={() => onSelectProject(item.path)}
            />
          ))}
        </div>
      </section>
      {!project ? (
        <section className="panel empty">还没有选择项目</section>
      ) : (
        <>
          <div className="metrics">
            <div><span>workflow tier（工作流档位）</span><strong>{project.tier}</strong></div>
            <div><span>模板版本</span><strong>{project.workflowVersion}</strong></div>
            <div><span>OpenSpec active（活跃变更）</span><strong>{project.openspec?.activeCount ?? 0}</strong></div>
            <div><span>任务进度</span><strong>{project.openspec?.completedTasks ?? 0}/{project.openspec?.totalTasks ?? 0}</strong></div>
          </div>
          <section className="panel">
            <h2>项目状态</h2>
            <div className="summary-grid">
              <div><span>安装状态</span><strong>{installStatus(project).label}</strong></div>
              <div><span>Codex App</span><strong>{booleanLabel(project.hosts?.codex)}</strong></div>
              <div><span>Claude CLI</span><strong>{booleanLabel(project.hosts?.claude)}</strong></div>
              <div><span>doctor（健康检查）</span><strong>{healthLabel(project.doctor)}</strong></div>
            </div>
          </section>
          <section className="panel">
            <h2>doctor（健康检查）</h2>
            <div className="actions">
              <button onClick={handleDoctor} disabled={running}>{running ? '检查中' : '运行 doctor（健康检查）'}</button>
            </div>
            {project.doctor && (
              <div className="doctor-tabs">
                <button className={doctorTab === 'fail' ? 'active' : ''} onClick={() => setDoctorTab('fail')}>失败 <span>{project.doctor.failCount}</span></button>
                <button className={doctorTab === 'warn' ? 'active' : ''} onClick={() => setDoctorTab('warn')}>警告 <span>{project.doctor.warnCount}</span></button>
                <button className={doctorTab === 'pass' ? 'active' : ''} onClick={() => setDoctorTab('pass')}>通过 <span>{project.doctor.passCount}</span></button>
                <button className={doctorTab === 'raw' ? 'active' : ''} onClick={() => setDoctorTab('raw')}>原始日志</button>
              </div>
            )}
            <DoctorResult doctor={project.doctor} activeTab={doctorTab} />
          </section>
          <section className="panel">
            <h2>项目维护</h2>
            <div className="action-grid">
              <select value={actionTier} onChange={(event) => setActionTier(event.target.value)}>
                {TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
              </select>
              {project.installable && <button disabled={running} onClick={() => handlePreview('install')}>预览 install（安装）</button>}
              <button disabled={running} onClick={() => handlePreview('upgrade')}>预览 upgrade（升级）</button>
              <button disabled={running} onClick={() => handlePreview('switch-tier')}>预览 switch tier（切档）</button>
              <button disabled={running} onClick={() => handlePreview('ignore-workflow-docs')}>预览 gitignore（忽略工作流文档）</button>
            </div>
            {actionPreview && (
              <div className="confirm">
                <p>{actionPreview.summary}</p>
                <ActionPreviewDetails preview={actionPreview} />
                <code>{actionPreview.command}</code>
                <button disabled={running} onClick={handleRunAction}>确认执行 command（命令）</button>
              </div>
            )}
            {actionLog && <pre>{actionLog}</pre>}
          </section>
        </>
      )}
    </section>
  );
}

/**
 * 安装工作流全局页面。
 * @param {object} props 组件属性。
 * @returns {JSX.Element} 安装页面。
 */
function InstallPage({ roots, defaultTarget, projects, onActionComplete }) {
  const [running, setRunning] = useState(false);
  const [installTier, setInstallTier] = useState('vibe');
  const [installTarget, setInstallTarget] = useState(defaultTarget ?? '');
  const [installMode, setInstallMode] = useState('install');
  const [installDetection, setInstallDetection] = useState(null);
  const [actionLog, setActionLog] = useState('');
  const [actionPreview, setActionPreview] = useState(null);

  useEffect(() => {
    setInstallTarget((current) => current || defaultTarget || '');
  }, [defaultTarget]);

  /**
   * 检测目标项目安装状态，并把推荐动作回填到选择区。
   * @returns {Promise<void>}
   */
  async function handleDetect({ keepLog = false } = {}) {
    setRunning(true);
    if (!keepLog) {
      setActionLog('');
    }
    setActionPreview(null);
    try {
      const detection = await detectInstall({
        projectPath: installTarget.trim(),
        roots
      });
      setInstallDetection(detection);
      setInstallTier(detection.recommendedTier && TIERS.includes(detection.recommendedTier) ? detection.recommendedTier : 'vibe');
      setInstallMode(detection.recommendedAction ?? 'install');
    } catch (error) {
      setActionLog(error.message);
    } finally {
      setRunning(false);
    }
  }

  /**
   * 预览用户选择的安装维护动作。
   * @returns {Promise<void>}
   */
  async function handlePreview() {
    if (installMode === 'status-only') {
      setActionPreview(null);
      setActionLog('当前选择为只看状态，不会执行写入动作。');
      return;
    }
    setRunning(true);
    setActionLog('');
    try {
      const preview = await previewAction({
        action: installMode,
        projectPath: installTarget.trim(),
        tier: installTier,
        roots
      });
      setActionPreview({ ...preview, action: installMode, projectPath: installTarget.trim() });
    } catch (error) {
      setActionLog(error.message);
    } finally {
      setRunning(false);
    }
  }

  /**
   * 执行已预览的安装、升级或切档动作。
   * @returns {Promise<void>}
   */
  async function handleRunAction() {
    if (!actionPreview) {
      return;
    }
    setRunning(true);
    try {
      const result = await runAction({
        action: actionPreview.action,
        projectPath: actionPreview.projectPath,
        tier: installTier,
        roots
      });
      setActionLog(`${result.summary}\n\n${result.stdout}${result.stderr}`);
      setActionPreview(null);
      await onActionComplete?.(actionPreview.projectPath);
      await handleDetect({ keepLog: true });
    } catch (error) {
      setActionLog(error.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="detail">
      <PageHead eyebrow="全局安装" title="安装工作流" subtitle="给扫描目录内的本地项目安装 agentic-workflow" />
      <section className="panel">
        <h2>安装向导</h2>
        <p className="overview-note">先检测目标项目，再由你选择安装、升级或切档。目标目录必须位于扫描设置中的任一扫描目录内。</p>
        <div className="install-grid">
          {projects.length > 0 && (
            <label className="field">
              <span>从已扫描项目选择</span>
              <select
                value={installTarget}
                onChange={(event) => {
                  setInstallTarget(event.target.value);
                  setInstallDetection(null);
                  setActionPreview(null);
                }}
              >
                <option value="">手动输入路径</option>
                {projects.map((project) => <option key={project.path} value={project.path}>{project.name}</option>)}
              </select>
            </label>
          )}
          <label className="field">
            <span>目标项目目录</span>
            <input
              value={installTarget}
              onChange={(event) => {
                setInstallTarget(event.target.value);
                setInstallDetection(null);
                setActionPreview(null);
              }}
              placeholder="/path/to/local/project"
            />
          </label>
          <button disabled={running || !installTarget.trim()} onClick={handleDetect}>{running ? '检测中' : '检测安装状态'}</button>
        </div>
        {installDetection && (
          <>
            <div className="install-status-grid">
              <div><span>检测状态</span><strong>{installDetection.status}</strong></div>
              <div><span>当前档位</span><strong>{installDetection.currentTier}</strong></div>
              <div><span>当前版本</span><strong>{installDetection.currentVersion}</strong></div>
              <div><span>仓库版本</span><strong>{installDetection.repoVersion}</strong></div>
            </div>
            <p className="overview-note">{installDetection.reason}</p>
            <div className="install-choice-grid">
              <div>
                <h3>选择维护动作</h3>
                <div className="mode-grid">
                  {INSTALL_MODES.map((mode) => (
                    <button
                      className={installMode === mode.id ? 'active' : ''}
                      key={mode.id}
                      onClick={() => {
                        setInstallMode(mode.id);
                        setActionPreview(null);
                      }}
                    >
                      <strong>{mode.label}</strong>
                      <span>{mode.description}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3>选择 workflow tier（工作流档位）</h3>
                <select
                  value={installTier}
                  onChange={(event) => {
                    setInstallTier(event.target.value);
                    setActionPreview(null);
                  }}
                  disabled={installMode === 'status-only'}
                >
                  {TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
                </select>
                <div className="candidate-list">
                  {installDetection.candidates?.map((candidate) => (
                    <button
                      className={installTier === candidate.tier ? 'active' : ''}
                      key={candidate.tier}
                      onClick={() => {
                        setInstallTier(candidate.tier);
                        setActionPreview(null);
                      }}
                      disabled={installMode === 'status-only'}
                    >
                      <span>{candidate.tier}</span>
                      <strong>{candidate.confidence}%</strong>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {installDetection.reasons?.length > 0 && (
              <details className="inline-details">
                <summary>查看档位推荐依据</summary>
                {installDetection.reasons.map((reason) => <p key={reason}>{reason}</p>)}
              </details>
            )}
            <div className="install-files">
              <span>可能写入的文件</span>
              <div className="skill-meta">
                {installDetection.files?.map((file) => <em key={file}>{file}</em>)}
              </div>
            </div>
            <div className="actions">
              <button disabled={running || installMode === 'status-only'} onClick={handlePreview}>预览所选动作</button>
            </div>
          </>
        )}
        {actionPreview && (
          <div className="confirm">
            <p>{actionPreview.summary}</p>
            <ActionPreviewDetails preview={actionPreview} />
            <code>{actionPreview.command}</code>
            <button disabled={running} onClick={handleRunAction}>确认执行 command（命令）</button>
          </div>
        )}
        {actionLog && <pre>{actionLog}</pre>}
      </section>
    </section>
  );
}

/**
 * 扫描设置全局页面。
 * @param {object} props 组件属性。
 * @returns {JSX.Element} 扫描设置页面。
 */
function ScanSettingsPage({ rootsInput, setRootsInput, onRefresh, loading, error }) {
  return (
    <section className="detail">
      <PageHead eyebrow="扫描边界" title="扫描设置" subtitle="配置 Dashboard 可以查看和操作的本地目录" />
      <section className="panel">
        <h2>扫描目录</h2>
        <p className="overview-note">这是开源工具，不假设你的项目放在哪里。每行一个目录，保存于浏览器本地，点击扫描后生效。</p>
        <label className="roots roots-wide">
          <span>自定义扫描目录</span>
          <textarea value={rootsInput} onChange={(event) => setRootsInput(event.target.value)} />
        </label>
        <button className="scan scan-inline" onClick={onRefresh} disabled={loading}>
          {loading ? '扫描中...' : '按这些目录扫描'}
        </button>
        {error && <p className="error">{error}</p>}
      </section>
    </section>
  );
}

/**
 * 从浏览器本地缓存读取扫描目录。
 * @returns {string} 扫描目录文本。
 */
function readStoredRoots() {
  return window.localStorage.getItem(ROOTS_STORAGE_KEY) ?? '';
}

/**
 * Dashboard 根组件。
 * @returns {JSX.Element} 应用根节点。
 */
export function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [rootsInput, setRootsInput] = useState(() => readStoredRoots());
  const [roots, setRoots] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedProject = useMemo(
    () => projects.find((project) => project.path === selectedPath) ?? projects[0] ?? null,
    [projects, selectedPath]
  );
  const capabilities = projects[0]?.capabilities ?? null;

  /**
   * 刷新项目扫描结果。
   * @returns {Promise<void>}
   */
  async function refreshProjects(preferredPath = '') {
    setLoading(true);
    setError('');
    try {
      const nextRoots = rootsInput
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
      const result = await fetchProjects(nextRoots);
      setRoots(result.roots);
      setProjects(result.projects);
      setSelectedPath((current) => preferredPath || current || result.projects[0]?.path || '');
      if (!rootsInput) {
        setRootsInput(result.roots.join('\n'));
      }
      window.localStorage.setItem(ROOTS_STORAGE_KEY, (nextRoots.length ? nextRoots : result.roots).join('\n'));
    } catch (scanError) {
      setError(scanError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshProjects();
  }, []);

  /**
   * 更新当前项目 doctor 结果。
   * @param {object} doctor doctor 结果。
   * @returns {void}
   */
  function updateDoctor(doctor) {
    setProjects((items) => items.map((project) => (
      project.path === selectedProject?.path ? { ...project, doctor } : project
    )));
  }

  /**
   * 选择项目并进入项目页面。
   * @param {string} projectPath 项目路径。
   * @returns {void}
   */
  function selectProject(projectPath) {
    setSelectedPath(projectPath);
    setActiveView('projects');
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="signal" />
          <div>
            <p className="eyebrow">本地控制台</p>
            <h1>agentic workflow</h1>
          </div>
        </div>
        <nav className="main-nav">
          {GLOBAL_VIEWS.map((view) => (
            <button className={activeView === view.id ? 'active' : ''} key={view.id} onClick={() => setActiveView(view.id)}>
              {view.label}
            </button>
          ))}
        </nav>
        <div className="scan-summary">
          <span>扫描目录</span>
          <strong>{roots.length}</strong>
          <button onClick={() => refreshProjects()} disabled={loading}>{loading ? '扫描中' : '刷新'}</button>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="sidebar-section-title">项目</div>
        <div className="project-list">
          {projects.map((project) => (
            <ProjectRow
              key={project.path}
              project={project}
              selected={selectedProject?.path === project.path}
              onSelect={() => selectProject(project.path)}
            />
          ))}
        </div>
      </aside>

      {activeView === 'dashboard' && <DashboardPage projects={projects} roots={roots} />}
      {activeView === 'projects' && (
        <ProjectsPage
          project={selectedProject}
          roots={roots}
          onDoctor={updateDoctor}
          onSelectProject={selectProject}
          projects={projects}
          onActionComplete={refreshProjects}
        />
      )}
      {activeView === 'install' && (
        <InstallPage
          roots={roots}
          defaultTarget={selectedProject?.path}
          projects={projects}
          onActionComplete={refreshProjects}
        />
      )}
      {activeView === 'strategy' && <StrategyPage project={selectedProject} />}
      {activeView === 'tools' && <ToolsPage capabilities={capabilities} project={selectedProject} />}
      {activeView === 'scan' && (
        <ScanSettingsPage
          rootsInput={rootsInput}
          setRootsInput={setRootsInput}
          onRefresh={() => refreshProjects()}
          loading={loading}
          error={error}
        />
      )}
      {activeView === 'workflows' && <WorkflowsPage />}
    </main>
  );
}
