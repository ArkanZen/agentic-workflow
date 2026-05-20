---
description: 复杂后端：跨模块、架构变更或边界模糊，先探索再进入 OpenSpec。
  仅当用户显式输入 /wf-complex 时使用；不要因“复杂需求、复杂后端、架构变更、跨模块”等自然语言自动触发。
---

# /wf-complex

复杂变更通道。

适用于跨模块、架构变更、业务边界不清晰或实现风险较高的任务。

执行以下步骤：
1. 读取 openspec/config.yaml 中 commit_checkpoints.start 规则并执行。
2. 调用 brainstorming skill（superpowers:brainstorming）探索需求、边界、风险和替代方案
3. 设计确认后，执行 /openspec-propose（含 GStack design gate）
4. apply 前调用 superpowers:writing-plans 细化任务分解
5. 执行 /openspec-apply-change 实现
6. 完成后调用 superpowers:verification-before-completion 验收
7. 读取 openspec/config.yaml 中 commit_checkpoints.end 规则并执行。
8. 验收通过后询问用户是否归档；用户确认后再执行 /openspec-archive-change
9. 归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑
