# AGENTS.md

项目级 AI 协作说明。下方 agentic-workflow 受控块由安装脚本维护。

<!-- agentic-workflow:start -->
## OpenSpec + GStack 工作流
<!-- agentic-workflow-tier: vibe -->
<!-- agentic-workflow-version: 1.5.0 -->

默认不启用本工作流。仅当用户显式输入 `/wf-*` 或 `/openspec-*` 命令时，才进入 OpenSpec + GStack 流程；普通开发请求按项目常规协作方式处理。

### 活跃工作流检测
每次对话开始时，检查项目根目录是否存在 `.wf-active` 文件（`cat .wf-active 2>/dev/null`）。
若存在，在首条回复中提示：
「检测到未完成的工作流：**wf-[name]** · 变更：[change] · 开始于 [started]。输入 `/wf-status` 查看详情，或告知如何继续。」
若不存在，静默继续，无需提示。

### 工作流切换与退出规则
- 工作流在用户显式调用 `/wf-finish` 或调用新的 `/wf-*` 命令前持续有效
- 收到超出当前工作流范围的独立任务请求时，必须先宣告「wf-[name] 已在步骤 N 暂停/切换，原因：[一句话]」，再处理新请求；**不得静默切换**
- 调用新的 `/wf-*` 命令时，当前工作流自动切换（更新 `.wf-active`）；wf-quick/small/complex 若有 in-progress change，需先说明该 change 的状态

### 工作流命令
- `/wf-quick` — 快速通道（文案/样式/明确 bug，跳过 gate）
- `/wf-small` — 小需求完整通道（OpenSpec + Gate）
- `/wf-complex` — 复杂后端/架构变更（探索 + OpenSpec + Gate）
- `/wf-debug` — Debug / 重构 / 单测（直接排查或实现）
- `/wf-plan` — 产品/架构方案（先评估是否值得做）
- `/wf-finish` — 显式关闭当前工作流，宣告完成或切换
- `/wf-status` — 查看当前活跃工作流状态，支持恢复或取消
- `/wf-uninstall` — 卸载当前项目的工作流（保留全局 /wf-install）
- `/openspec-propose` — 完整通道（proposal + design gate + tasks）
- `/openspec-apply-change` — 执行 tasks 实现代码
- `/openspec-archive-change` — 归档变更
- `/openspec-explore` — 探索思考

### 强制依赖加载规则
当工作流文档出现 `required_skills`、`required_workflows`、`required_reviews`、`conditional_skills`，或明确写出 `superpowers:*`、`openspec-*`、`/gstack-*`、`/plan-*` 等依赖时，执行者必须先加载或执行对应 skill/workflow/review，再进入下一步。

- 不得只按方法论摘要执行，必须读取对应 `SKILL.md` 或执行对应命令。
- 每个 `/wf-*` 开始时必须做启动自检，列出当前工作流、强制依赖和已加载状态。
- 依赖不可用时必须明确说明缺失项和影响，等待用户确认是否降级继续；不得声称已加载或已审查。
- 完成前必须输出执行审计，列出强制依赖、关键 workflow、review/gate 和验证结果。

### GStack 审查 Skill（由 openspec/config.yaml rules 驱动）
需先安装官方 GStack。Codex 安装方式：
`git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.codex/skills/gstack && cd ~/.codex/skills/gstack && ./setup --host codex`

- `/gstack-plan-eng-review` — 工程审查（完整通道必须）
- `/gstack-cso` — 安全审查（涉及配置/凭证时必须）
- `/gstack-review` — 代码审查（apply 后运行）

### Host 命令映射
`openspec/config.yaml` 中的 gate 规则使用通用审查名称；执行时按宿主映射：

| 审查动作 | Claude Code | Codex App |
|------|------|------|
| 工程审查 | `/plan-eng-review` | `/gstack-plan-eng-review` |
| UI/设计审查 | `/plan-design-review` | `/gstack-plan-design-review` |
| 安全审查 | `/cso` | `/gstack-cso` |
| 代码审查 | `/review` | `/gstack-review` |

### Gate 规则
见 openspec/config.yaml。design.md 顶部工程审查状态为「阻断」时，
不得生成 tasks.md，须先修改 proposal。
<!-- agentic-workflow:end -->
