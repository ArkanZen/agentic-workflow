# AGENTS.md

项目级 AI 协作说明。下方 agentic-workflow 受控块由安装脚本维护。

<!-- agentic-workflow:start -->
## OpenSpec + GStack 工作流
<!-- agentic-workflow-tier: vibe -->
<!-- agentic-workflow-version: 1.1.7 -->

默认不启用本工作流。仅当用户显式输入 `/wf-*` 或 `/openspec-*` 命令时，才进入 OpenSpec + GStack 流程；普通开发请求按项目常规协作方式处理。

### 工作流命令
- `/wf-quick` — 快速通道（文案/样式/明确 bug，跳过 gate）
- `/wf-small` — 小需求完整通道（OpenSpec + Gate）
- `/wf-complex` — 复杂后端/架构变更（探索 + OpenSpec + Gate）
- `/wf-debug` — Debug / 重构 / 单测（直接排查或实现）
- `/wf-plan` — 产品/架构方案（先评估是否值得做）
- `/openspec-propose` — 完整通道（proposal + design gate + tasks）
- `/openspec-apply-change` — 执行 tasks 实现代码
- `/openspec-archive-change` — 归档变更
- `/openspec-explore` — 探索思考

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
