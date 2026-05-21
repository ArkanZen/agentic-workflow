---
description: 小需求：功能点清晰、改动范围明确，走 OpenSpec 完整通道。
  仅当用户显式输入 /wf-small 时使用；不要因"小需求、明确需求、新增字段、加指标"等自然语言自动触发。
---

# /wf-small

小需求完整通道。

适用于功能点清晰、改动范围明确、无需额外产品探索的变更。

执行以下步骤：
1. 读取 openspec/config.yaml 中 commit_checkpoints.start 规则并执行。
2. 将用户输入作为需求背景，不重复询问已说明的信息
3. 执行 /openspec-propose，生成 proposal、design gate 和 tasks
4. 若 gate 阻断，先根据审查意见修改 proposal/design，再继续
5. 生成完成后必须展示：
   - proposal.md / design.md / tasks.md 的绝对路径
   - design 顶部 gate 状态摘要
   - tasks.md 中的 checkbox 清单摘要
6. 用 AskUserQuestion 询问用户是否确认进入实现：
   - 选项 A：确认实现（推荐）
   - 选项 B：修改设计/任务
   - 选项 C：取消
   用户确认前，不得执行 /openspec-apply-change。
7. 用户确认后，执行 /openspec-apply-change 实现
8. 实现完成后运行必要验证或 review，并在结果中说明已验证项
9. 验证通过后同步 `tasks.md`：将已确认完成的任务从 `- [ ]` 勾选为 `- [x]`；若存在无法确认完成的任务，先告知用户并保留未勾选状态
10. 询问用户是否归档；用户确认后再执行 /openspec-archive-change
11. 归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑
12. 归档决策完成后，读取 openspec/config.yaml 中 commit_checkpoints.end 规则并执行最终提交；最终提交应覆盖代码、测试、OpenSpec tasks 勾选、归档移动和 spec sync
