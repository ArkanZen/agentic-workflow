import { useEffect, useMemo, useState } from 'react';
import { fetchProjects, previewAction, runAction, runDoctor } from './api.js';

// 工作流档位选项，用于切换档位动作。
const TIERS = ['backend', 'python-data', 'frontend', 'fullstack', 'vibe'];

// 本地扫描目录缓存键，仅保存在浏览器本地，不写入项目文件。
const ROOTS_STORAGE_KEY = 'agentic-workflow-dashboard.roots';

// 详情页菜单定义，避免把所有内容堆在一个页面。
const SECTIONS = [
  { id: 'overview', label: '总览' },
  { id: 'tools', label: '工具能力' },
  { id: 'workflows', label: '工作流' },
  { id: 'health', label: '健康检查' },
  { id: 'settings', label: '设置' }
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
  return (
    <button className={`project-row ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <span className="project-name">{project.name}</span>
      <span>{project.tier}</span>
      <span>{project.workflowVersion}</span>
      <span>{project.hosts?.codex ? 'Codex' : '未装'} / {project.hosts?.claude ? 'Claude' : '未装'}</span>
      <Badge label={health} tone={healthTone(project.doctor)} />
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
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="quiet">{emptyText}</p>
      ) : items.map((item) => (
        <details className="skill-item" key={`${title}-${item.name}`}>
          <summary>
            <strong>{item.name}</strong>
            {item.workflows?.length > 0 && <span>{item.workflows.join(' / ')}</span>}
          </summary>
          <p>{item.purpose}</p>
        </details>
      ))}
    </div>
  );
}

/**
 * 工具能力面板组件。
 * @param {{capabilities: object}} props 组件属性。
 * @returns {JSX.Element} 能力面板。
 */
function CapabilityPanel({ capabilities }) {
  const tools = capabilities?.tools ?? [];
  const summary = capabilities?.summary;
  const [activeTool, setActiveTool] = useState(tools[0]?.id ?? 'openspec');
  const tool = tools.find((item) => item.id === activeTool) ?? tools[0];

  useEffect(() => {
    if (tools.length > 0 && !tools.some((item) => item.id === activeTool)) {
      setActiveTool(tools[0].id);
    }
  }, [activeTool, tools]);

  if (!tool) {
    return <section className="panel"><h2>工具能力</h2><p className="quiet">尚未检测到工具能力数据</p></section>;
  }

  return (
    <section className="panel">
      <div className="panel-title-row">
        <div>
          <h2>工具能力</h2>
          <p>按工具维度解释 OpenSpec、GStack、Superpowers，同时展示用途、宿主支持和工作流引用关系。</p>
        </div>
        {summary && <Badge label={`${summary.readyTools}/${summary.totalTools} 工具可用`} tone={summary.outdatedCount > 0 ? 'warn' : 'pass'} />}
      </div>
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
      <div className="skill-columns">
        <SkillList title="官方定义的技能" items={tool.officialSkills} emptyText="暂无官方技能数据" />
        <SkillList title="工作流中用到的技能" items={tool.workflowSkills} emptyText="当前工作流未使用" />
        <SkillList title="未用到但可扩展" items={tool.unusedSkills} emptyText="当前工具已全部覆盖" />
      </div>
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
 * 项目总览面板。
 * @param {{project: object}} props 组件属性。
 * @returns {JSX.Element} 总览内容。
 */
function OverviewPanel({ project }) {
  return (
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
          <div><span>安装状态</span><strong>{project.installed ? '已安装' : '部分配置'}</strong></div>
          <div><span>Codex App</span><strong>{booleanLabel(project.hosts?.codex)}</strong></div>
          <div><span>Claude CLI</span><strong>{booleanLabel(project.hosts?.claude)}</strong></div>
          <div><span>doctor（健康检查）</span><strong>{healthLabel(project.doctor)}</strong></div>
        </div>
      </section>
    </>
  );
}

/**
 * 工作流说明面板。
 * @returns {JSX.Element} 工作流内容。
 */
function WorkflowPanel() {
  return (
    <section className="panel">
      <div className="panel-title-row">
        <div>
          <h2>工作流定义</h2>
          <p>默认折叠长说明，展开后分别看官方定位和本项目怎么使用。</p>
        </div>
      </div>
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
  );
}

/**
 * 健康检查面板。
 * @param {{project: object, doctorTab: string, setDoctorTab: (tab: string) => void, running: boolean, onDoctor: () => void}} props 组件属性。
 * @returns {JSX.Element} 健康检查内容。
 */
function HealthPanel({ project, doctorTab, setDoctorTab, running, onDoctor }) {
  return (
    <section className="panel">
      <h2>doctor（健康检查）</h2>
      <div className="actions">
        <button onClick={onDoctor} disabled={running}>{running ? '检查中' : '运行 doctor（健康检查）'}</button>
      </div>
      {project.doctor && (
        <div className="doctor-tabs">
          <button className={doctorTab === 'fail' ? 'active' : ''} onClick={() => setDoctorTab('fail')}>
            失败 <span>{project.doctor.failCount}</span>
          </button>
          <button className={doctorTab === 'warn' ? 'active' : ''} onClick={() => setDoctorTab('warn')}>
            警告 <span>{project.doctor.warnCount}</span>
          </button>
          <button className={doctorTab === 'pass' ? 'active' : ''} onClick={() => setDoctorTab('pass')}>
            通过 <span>{project.doctor.passCount}</span>
          </button>
          <button className={doctorTab === 'raw' ? 'active' : ''} onClick={() => setDoctorTab('raw')}>
            原始日志
          </button>
        </div>
      )}
      <DoctorResult doctor={project.doctor} activeTab={doctorTab} />
    </section>
  );
}

/**
 * 设置与维护面板。
 * @param {object} props 组件属性。
 * @returns {JSX.Element} 设置内容。
 */
function SettingsPanel({
  actionTier,
  setActionTier,
  running,
  onPreview,
  actionPreview,
  onRunAction,
  actionLog,
  rootsInput,
  setRootsInput,
  onRefresh,
  loading,
  installTarget,
  setInstallTarget
}) {
  return (
    <>
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
      </section>
      <section className="panel">
        <h2>安装工作流</h2>
        <p className="overview-note">给扫描目录内的本地项目安装 agentic-workflow。目标目录必须已存在，并且位于上面的扫描目录内。</p>
        <div className="install-grid">
          <label className="field">
            <span>目标项目目录</span>
            <input value={installTarget} onChange={(event) => setInstallTarget(event.target.value)} placeholder="/path/to/local/project" />
          </label>
          <label className="field">
            <span>workflow tier（工作流档位）</span>
            <select value={actionTier} onChange={(event) => setActionTier(event.target.value)}>
              {TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
            </select>
          </label>
          <button disabled={running || !installTarget.trim()} onClick={() => onPreview('install', installTarget.trim())}>预览 install（安装）</button>
        </div>
      </section>
      <section className="panel">
        <h2>workflow actions（工作流维护）</h2>
        <div className="action-grid">
          <select value={actionTier} onChange={(event) => setActionTier(event.target.value)}>
            {TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
          </select>
          <button disabled={running} onClick={() => onPreview('upgrade')}>预览 upgrade（升级）</button>
          <button disabled={running} onClick={() => onPreview('switch-tier')}>预览 switch tier（切档）</button>
          <button disabled={running} onClick={() => onPreview('ignore-workflow-docs')}>预览 gitignore（忽略工作流文档）</button>
        </div>
        {actionPreview && (
          <div className="confirm">
            <p>{actionPreview.summary}</p>
            <code>{actionPreview.command}</code>
            <button disabled={running} onClick={onRunAction}>确认执行 command（命令）</button>
          </div>
        )}
        {actionLog && <pre>{actionLog}</pre>}
      </section>
    </>
  );
}

/**
 * 项目详情组件。
 * @param {object} props 组件属性。
 * @returns {JSX.Element} 项目详情。
 */
function ProjectDetail({
  project,
  roots,
  onDoctor,
  rootsInput,
  setRootsInput,
  onRefresh,
  loading
}) {
  const [running, setRunning] = useState(false);
  const [actionTier, setActionTier] = useState(project?.tier ?? 'vibe');
  const [actionLog, setActionLog] = useState('');
  const [actionPreview, setActionPreview] = useState(null);
  const [doctorTab, setDoctorTab] = useState('fail');
  const [activeSection, setActiveSection] = useState('overview');
  const [installTarget, setInstallTarget] = useState(project?.path ?? '');

  useEffect(() => {
    setActionTier(project?.tier ?? 'vibe');
    setActionLog('');
    setActionPreview(null);
    setDoctorTab('fail');
    setInstallTarget(project?.path ?? '');
  }, [project]);

  if (!project) {
    return <section className="panel empty">请先选择一个项目查看详情</section>;
  }

  /**
   * 执行 doctor 并回写当前项目状态。
   * @returns {Promise<void>}
   */
  async function handleDoctor() {
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
      setActiveSection('health');
    } catch (error) {
      setActionLog(error.message);
    } finally {
      setRunning(false);
    }
  }

  /**
   * 预览维护动作，供用户确认影响范围。
   * @param {string} action 动作名称。
   * @param {string} targetPath 可选目标项目路径。
   * @returns {Promise<void>}
   */
  async function handlePreview(action, targetPath = project.path) {
    setRunning(true);
    setActionLog('');
    try {
      const preview = await previewAction({
        action,
        projectPath: targetPath,
        tier: actionTier,
        roots
      });
      setActionPreview({ ...preview, action, projectPath: targetPath });
      setActiveSection('settings');
    } catch (error) {
      setActionLog(error.message);
    } finally {
      setRunning(false);
    }
  }

  /**
   * 执行已预览的维护动作。
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
        projectPath: actionPreview.projectPath ?? project.path,
        tier: actionTier,
        roots
      });
      setActionLog(`${result.summary}\n\n${result.stdout}${result.stderr}`);
      setActionPreview(null);
    } catch (error) {
      setActionLog(error.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="detail">
      <div className="detail-head">
        <div>
          <p className="eyebrow">项目详情</p>
          <h1>{project.name}</h1>
          <p className="path">{project.path}</p>
        </div>
        <Badge label={project.installed ? '已安装' : '部分配置'} tone={project.installed ? 'pass' : 'warn'} />
      </div>
      <nav className="section-menu">
        {SECTIONS.map((section) => (
          <button className={activeSection === section.id ? 'active' : ''} key={section.id} onClick={() => setActiveSection(section.id)}>
            {section.label}
          </button>
        ))}
      </nav>
      {activeSection === 'overview' && <OverviewPanel project={project} />}
      {activeSection === 'tools' && <CapabilityPanel capabilities={project.capabilities} />}
      {activeSection === 'workflows' && <WorkflowPanel />}
      {activeSection === 'health' && (
        <HealthPanel
          project={project}
          doctorTab={doctorTab}
          setDoctorTab={setDoctorTab}
          running={running}
          onDoctor={handleDoctor}
        />
      )}
      {activeSection === 'settings' && (
        <SettingsPanel
          actionTier={actionTier}
          setActionTier={setActionTier}
          running={running}
          onPreview={handlePreview}
          actionPreview={actionPreview}
          onRunAction={handleRunAction}
          actionLog={actionLog}
          rootsInput={rootsInput}
          setRootsInput={setRootsInput}
          onRefresh={onRefresh}
          loading={loading}
          installTarget={installTarget}
          setInstallTarget={setInstallTarget}
        />
      )}
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

  /**
   * 刷新项目扫描结果。
   * @returns {Promise<void>}
   */
  async function refreshProjects() {
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
      setSelectedPath((current) => current || result.projects[0]?.path || '');
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
      project.path === selectedProject.path ? { ...project, doctor } : project
    )));
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
        <div className="scan-summary">
          <span>扫描目录</span>
          <strong>{roots.length}</strong>
          <button onClick={refreshProjects} disabled={loading}>{loading ? '扫描中' : '刷新'}</button>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="project-list">
          {projects.map((project) => (
            <ProjectRow
              key={project.path}
              project={project}
              selected={selectedProject?.path === project.path}
              onSelect={() => setSelectedPath(project.path)}
            />
          ))}
        </div>
      </aside>

      <ProjectDetail
        project={selectedProject}
        roots={roots}
        onDoctor={updateDoctor}
        rootsInput={rootsInput}
        setRootsInput={setRootsInput}
        onRefresh={refreshProjects}
        loading={loading}
      />
    </main>
  );
}
