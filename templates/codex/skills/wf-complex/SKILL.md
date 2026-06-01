---
name: wf-complex
description: |
  复杂后端：跨模块、架构变更或边界模糊，先探索再进入 OpenSpec。
  仅当用户显式输入 /wf-complex 时使用；不要因“复杂需求、复杂后端、架构变更、跨模块”等自然语言自动触发。
---

复杂变更通道。

**状态行规则**：在本工作流执行期间，每次回复开头输出一行：
`> wf-complex · <change-name> · 步骤 N/14`
change-name 在步骤 4（openspec propose）确定后填入，此前用 `…` 占位；N 为当前正在执行的步骤编号。

适用于跨模块、架构变更、业务边界不清晰或实现风险较高的任务。

## 强制依赖清单

必须在对应阶段开始前加载指定 skill 的 `SKILL.md`。不得只按方法论摘要执行，也不得把“调用 skill”理解为普通文字说明。

```yaml
required_skills:
  exploration:
    - superpowers:brainstorming
  task_decomposition:
    - superpowers:writing-plans
  final_verification:
    - superpowers:verification-before-completion
required_workflows:
  proposal:
    - openspec-propose
  implementation:
    - openspec-apply-change
  archive:
    - openspec-archive-change
required_reviews:
  design_gate:
    - /gstack-plan-eng-review
  implementation_review:
    - /gstack-review
conditional_reviews:
  ui_risk:
    - /gstack-plan-design-review
  security_risk:
    - /gstack-cso
  browser_qa:
    - /gstack-qa
```

若宿主环境没有对应 skill 或审查命令，必须先明确说明缺失项和影响，再等待用户确认是否降级继续；不得声称已加载或已审查。

## Codex App 交互规则

- 有选项的地方，优先使用 Codex App 提供的 UI 交互工具（如 `request_user_input` 或当前宿主暴露的等价工具）。
- 只有 UI 交互工具不可用时，才退化为文本选项；文本选项必须短且明确。
- 探索结果、OpenSpec 产物、最终 tasks 和归档/提交决策都必须暂停等待用户确认。
- 所有本地文件链接必须使用绝对路径，方便 Codex App 直接打开。

## 启动自检

开始执行时必须先展示或内部完成以下自检，并在首条进展中说明已加载的依赖：

- 当前工作流：`wf-complex`
- 必须加载的 Superpowers skill：`brainstorming`、`writing-plans`、`verification-before-completion`
- 必须执行的 OpenSpec workflow：`openspec-propose`、`openspec-apply-change`、`openspec-archive-change`
- 必须执行的审查：`/gstack-plan-eng-review`、实现后的 `/gstack-review`
- 条件审查：UI 风险触发 `/gstack-plan-design-review`；安全风险触发 `/gstack-cso`；Web 流程触发 `/gstack-qa`
- 已加载状态：逐项标记已加载 / 未加载并说明降级原因

执行以下步骤：
1. 读取 openspec/config.yaml 中 commit_checkpoints.start 规则并执行。
   完成后写入 `.wf-active`（确保 git-ignored）：
   ```bash
   echo '{"workflow":"wf-complex","change":"pending","started":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > .wf-active
   grep -q "\.wf-active" .gitignore 2>/dev/null || echo ".wf-active" >> .gitignore
   ```
2. 加载并执行 `superpowers:brainstorming`，探索需求、边界、风险和替代方案。
3. 对照 `risk_triggers` 判断本次变更命中的风险类型，展示探索结论、风险和推荐路径，使用 UI 交互询问用户是否确认进入 OpenSpec 提案。
4. 用户确认后，执行 `/openspec-propose`（含 `/gstack-plan-eng-review`，并按风险触发 UI/安全 gate）；不得手写替代 proposal 流程。
5. propose 完成后，加载并执行 `superpowers:writing-plans` 细化任务分解，确保 tasks.md 颗粒度合理、顺序清晰。
6. proposal/design/tasks 生成后必须展示：
   - proposal.md / design.md / tasks.md 的绝对路径链接
   - design 顶部 gate 状态摘要
   - tasks.md 中的 checkbox 清单摘要（已经过 writing-plans 细化）
7. 使用 UI 交互询问用户是否确认该设计和 tasks；用户确认前不得实现。
8. 用户确认后，执行 `/openspec-apply-change` 实现；不得绕过该 workflow 直接实现。
9. 实现完成后执行 `/gstack-review`；若审查阻断，先修复再进入验收。
10. 若命中 Web 流程风险，执行 `/gstack-qa` 或说明降级验证方式。
11. 完成后加载并执行 `superpowers:verification-before-completion` 验收，并在结果中说明已验证项。
12. 验证通过后同步 `tasks.md` 勾选状态；若存在无法确认完成的任务，先告知用户并保留未勾选状态。
13. 若第 12 步所有任务已完成：说明「准备归档并完成此变更」，直接执行 `/openspec-archive-change`；用户明确说「跳过归档」时保留 active change 不归档。
    若有未完成任务：使用 UI 交互询问用户是否归档，用户确认后再执行 `/openspec-archive-change`。
    归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑。
14. 归档决策完成后，读取 openspec/config.yaml 中 commit_checkpoints.end 规则并执行最终提交；最终提交应覆盖代码、测试、OpenSpec tasks 勾选、归档移动和 spec sync。
    提交完成后删除 `.wf-active`：`rm -f .wf-active`

## 收尾审计

完成前必须输出执行审计：

- `wf-complex`：已执行
- 强制依赖 skill：逐项列出已加载 / 降级原因
- OpenSpec workflow：列出 `propose`、`apply`、`archive` 的执行状态
- GStack gate：列出审查命令、状态和是否阻断
- 风险触发器：列出命中风险、条件 gate 和跳过原因
- 验证：列出实际运行的命令和结果
