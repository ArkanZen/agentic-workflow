---
name: wf-small
description: |
  小需求：功能点清晰、改动范围明确，走 OpenSpec 完整通道。
  仅当用户显式输入 /wf-small 时使用；不要因“小需求、明确需求、新增字段、加指标”等自然语言自动触发。
---

小需求完整通道。

适用于功能点清晰、改动范围明确、无需额外产品探索的变更。

## 强制依赖清单

必须在对应阶段执行指定 workflow 或审查命令。不得用手写步骤替代这些 workflow，也不得在未执行 gate 时声称已完成审查。

```yaml
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
conditional_skills:
  before_claiming_done:
    - superpowers:verification-before-completion
```

若宿主环境没有对应 workflow、skill 或审查命令，必须先明确说明缺失项和影响，再等待用户确认是否降级继续。

## Codex App 交互规则

- 有选项的地方，优先使用 Codex App 提供的 UI 交互工具（如 `request_user_input` 或当前宿主暴露的等价工具）。
- 只有 UI 交互工具不可用时，才退化为文本选项；文本选项必须短且明确。
- 用户确认前不得自动越过关键节点；特别是 proposal/design/tasks 生成后，必须暂停等待确认。
- 所有本地文件链接必须使用绝对路径，方便 Codex App 直接打开。

## 启动自检

开始执行时必须先展示或内部完成以下自检，并在首条进展中说明依赖状态：

- 当前工作流：`wf-small`
- 必须执行的 OpenSpec workflow：`openspec-propose`、`openspec-apply-change`、`openspec-archive-change`
- 必须执行的审查：`/gstack-plan-eng-review`
- 条件 skill：完成前优先加载 `superpowers:verification-before-completion`
- 已加载状态：逐项标记已加载 / 未加载并说明降级原因

执行以下步骤：
1. 读取 openspec/config.yaml 中 commit_checkpoints.start 规则并执行。
2. 将用户输入作为需求背景，不重复询问已说明的信息
3. 执行 `/openspec-propose`，生成 proposal、design gate 和 tasks；不得手写替代 proposal 流程。
4. 若 gate 阻断，先根据审查意见修改 proposal/design，再继续
5. 生成完成后必须展示：
   - proposal.md / design.md / tasks.md 的绝对路径链接
   - design 顶部 gate 状态摘要
   - tasks.md 中的 checkbox 清单摘要
6. 使用 UI 交互询问用户是否确认进入实现：
   - 选项 A：确认实现（推荐）
   - 选项 B：修改设计/任务
   - 选项 C：取消
   用户确认前，不得执行 /openspec-apply-change。
7. 用户确认后，执行 `/openspec-apply-change` 实现；不得绕过该 workflow 直接实现。
8. 实现完成后优先加载 `superpowers:verification-before-completion` 运行必要验证或 review，并在结果中说明已验证项。
9. 验证通过后同步 `tasks.md`：将已确认完成的任务从 `- [ ]` 勾选为 `- [x]`；若存在无法确认完成的任务，先告知用户并保留未勾选状态。
10. 询问用户是否归档；用户确认后再执行 `/openspec-archive-change`。归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑。
11. 归档决策完成后，读取 openspec/config.yaml 中 commit_checkpoints.end 规则并执行最终提交；最终提交应覆盖代码、测试、OpenSpec tasks 勾选、归档移动和 spec sync。

## 收尾审计

完成前必须输出执行审计：

- `wf-small`：已执行
- OpenSpec workflow：列出 `propose`、`apply`、`archive` 的执行状态
- GStack gate：列出审查命令、状态和是否阻断
- 条件 skill：列出 `verification-before-completion` 已加载 / 降级原因
- 验证：列出实际运行的命令和结果
