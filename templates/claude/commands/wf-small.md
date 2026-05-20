---
description: 小需求：功能点清晰、改动范围明确，走 OpenSpec 完整通道。
  触发词：wf-small、小需求、明确需求、新增字段、加指标。
---

# /wf-small

小需求完整通道。

适用于功能点清晰、改动范围明确、无需额外产品探索的变更。

执行以下步骤：
1. 将用户输入作为需求背景，不重复询问已说明的信息
2. 执行 /openspec-propose，生成 proposal、design gate 和 tasks
3. 若 gate 阻断，先根据审查意见修改 proposal/design，再继续
4. tasks 明确后，执行 /openspec-apply-change 实现
5. 实现完成后运行必要验证或 review，并在结果中说明已验证项
6. 验证通过后询问用户是否归档；用户确认后再执行 /openspec-archive-change
7. 归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑
