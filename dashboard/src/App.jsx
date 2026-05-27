import { useEffect, useMemo, useState } from 'react';
import { fetchProjects, previewAction, runAction, runDoctor } from './api.js';

// 工作流档位选项，用于切换档位动作。
const TIERS = ['backend', 'python-data', 'frontend', 'fullstack', 'vibe'];

// 工作流说明用于给新用户理解每个 /wf-* 的定位，默认折叠展示。
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
 * 工具能力面板组件。
 * @param {{capabilities: object}} props 组件属性。
 * @returns {JSX.Element} 能力面板。
 */
function CapabilityPanel({ capabilities, onActionPreview }) {
  const groups = capabilities?.groups ?? [];
  const summary = capabilities?.summary;
  return (
    <section className="panel">
      <div className="panel-title-row">
        <div>
          <h2>工具能力</h2>
          <p>给新用户看的版本：这些工具分别负责记录需求、做审查、补方法论。</p>
        </div>
        {summary && <Badge label={`${summary.availableCapabilities}/${summary.totalCapabilities} 可用`} tone={summary.updateCount > 0 ? 'warn' : 'pass'} />}
      </div>
      {summary && <p className="beginner-note">{summary.beginnerText}</p>}
      <div className="capability-groups">
        {groups.map((group) => (
          <details className="capability-group" key={group.id} open={group.id !== 'claude'}>
            <summary className="capability-group-head">
              <h3>{group.title}</h3>
              <p>{group.subtitle}</p>
            </summary>
            <div className="capability-list">
              {group.capabilities.map((capability) => (
                <div className="capability-row" key={capability.id}>
                  <div className="capability-main">
                    <div className="capability-title">{capability.title}</div>
                    <p>{capability.subtitle}</p>
                  </div>
                  <div className="capability-status-block">
                    <span className={`state-dot ${capability.available ? 'state-dot-ok' : 'state-dot-missing'}`} />
                    <span className={`state-text ${capability.available ? 'state-ok' : 'state-missing'}`}>
                      {booleanLabel(capability.available)}
                    </span>
                  </div>
                  <div className="version-stack">
                    <span>当前：{capability.version.current}</span>
                    <span>最新：{capability.version.latest}</span>
                    <span>{capability.detail}</span>
                  </div>
                  <div className="usage">
                    <strong>{capability.definedInWorkflow ? '工作流已定义' : '工作流未定义'}</strong>
                    {capability.definedItems.length > 0 && (
                      <details className="inline-details">
                        <summary>查看定义项</summary>
                        <ul>
                          {capability.definedItems.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </details>
                    )}
                  </div>
                  <div className="update-cell">
                    {capability.version.updateMode === 'command' && capability.version.updateAvailable && (
                      <button onClick={() => onActionPreview(capability.version.updateAction)}>预览更新</button>
                    )}
                    {capability.version.updateMode === 'command' && !capability.version.updateAvailable && (
                      <span className="quiet">无需更新</span>
                    )}
                    {capability.version.updateMode === 'manual' && (
                      <details className="inline-details">
                        <summary>更新方式</summary>
                        <p>{capability.version.updateHint}</p>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
      <details className="workflow-guide">
        <summary>查看各工作流说明</summary>
        <div className="workflow-guide-list">
          {WORKFLOW_GUIDES.map((workflow) => (
            <div className="workflow-guide-item" key={workflow.name}>
              <strong>{workflow.name}</strong>
              <p><span>官方说明：</span>{workflow.official}</p>
              <p><span>项目说明：</span>{workflow.project}</p>
            </div>
          ))}
        </div>
      </details>
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
 * 项目详情组件。
 * @param {{project: object | null, roots: string[], onDoctor: (result: object) => void}} props 组件属性。
 * @returns {JSX.Element} 项目详情。
 */
function ProjectDetail({ project, roots, onDoctor }) {
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
    } catch (error) {
      setActionLog(error.message);
    } finally {
      setRunning(false);
    }
  }

  /**
   * 预览维护动作，供用户确认影响范围。
   * @param {string} action 动作名称。
   * @returns {Promise<void>}
   */
  async function handlePreview(action) {
    setRunning(true);
    setActionLog('');
    try {
      const preview = await previewAction({
        action,
        projectPath: project.path,
        tier: actionTier,
        roots
      });
      setActionPreview({ ...preview, action });
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
        projectPath: project.path,
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

      <div className="metrics">
        <div><span>workflow tier（工作流档位）</span><strong>{project.tier}</strong></div>
        <div><span>模板版本</span><strong>{project.workflowVersion}</strong></div>
        <div><span>OpenSpec active（活跃变更）</span><strong>{project.openspec?.activeCount ?? 0}</strong></div>
        <div><span>任务进度</span><strong>{project.openspec?.completedTasks ?? 0}/{project.openspec?.totalTasks ?? 0}</strong></div>
      </div>

      <CapabilityPanel capabilities={project.capabilities} onActionPreview={handlePreview} />

      <section className="panel">
        <h2>doctor（健康检查）</h2>
        <div className="actions">
          <button onClick={handleDoctor} disabled={running}>{running ? '检查中' : '运行 doctor（健康检查）'}</button>
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

      <section className="panel">
        <h2>workflow actions（工作流维护）</h2>
        <div className="action-grid">
          <select value={actionTier} onChange={(event) => setActionTier(event.target.value)}>
            {TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
          </select>
          <button disabled={running} onClick={() => handlePreview('upgrade')}>预览 upgrade（升级）</button>
          <button disabled={running} onClick={() => handlePreview('switch-tier')}>预览 switch tier（切档）</button>
          <button disabled={running} onClick={() => handlePreview('ignore-workflow-docs')}>预览 gitignore（忽略工作流文档）</button>
        </div>
        {actionPreview && (
          <div className="confirm">
            <p>{actionPreview.summary}</p>
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
 * Dashboard 根组件。
 * @returns {JSX.Element} 应用根节点。
 */
export function App() {
  const [rootsInput, setRootsInput] = useState('');
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

        <label className="roots">
          <span>扫描目录</span>
          <textarea value={rootsInput} onChange={(event) => setRootsInput(event.target.value)} />
        </label>
        <button className="scan" onClick={refreshProjects} disabled={loading}>
          {loading ? '扫描中...' : '开始扫描'}
        </button>
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

      <ProjectDetail project={selectedProject} roots={roots} onDoctor={updateDoctor} />
    </main>
  );
}
