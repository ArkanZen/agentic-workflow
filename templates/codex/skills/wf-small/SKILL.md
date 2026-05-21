---
name: wf-small
description: |
  小需求：功能点清晰、改动范围明确，走 OpenSpec 完整通道。
  仅当用户显式输入 /wf-small 时使用；不要因“小需求、明确需求、新增字段、加指标”等自然语言自动触发。
---

小需求完整通道。

适用于功能点清晰、改动范围明确、无需额外产品探索的变更。

## Codex App 交互规则

- 有选项的地方，优先使用 Codex App 提供的 UI 交互工具（如 `request_user_input` 或当前宿主暴露的等价工具）。
- 只有 UI 交互工具不可用时，才退化为文本选项；文本选项必须短且明确。
- 用户确认前不得自动越过关键节点；特别是 proposal/design/tasks 生成后，必须暂停等待确认。
- 所有本地文件链接必须使用绝对路径，方便 Codex App 直接打开。

执行以下步骤：
1. 读取 openspec/config.yaml 中 commit_checkpoints.start 规则并执行。
2. 将用户输入作为需求背景，不重复询问已说明的信息
3. 执行 /openspec-propose，生成 proposal、design gate 和 tasks
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
7. 用户确认后，执行 /openspec-apply-change 实现。
8. 实现完成后运行必要验证或 review，并在结果中说明已验证项。
9. 验证通过后同步 `tasks.md`：将已确认完成的任务从 `- [ ]` 勾选为 `- [x]`；若存在无法确认完成的任务，先告知用户并保留未勾选状态。
10. 询问用户是否归档；用户确认后再执行 /openspec-archive-change。归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑。
11. 归档决策完成后，读取 openspec/config.yaml 中 commit_checkpoints.end 规则并执行最终提交；最终提交应覆盖代码、测试、OpenSpec tasks 勾选、归档移动和 spec sync。
