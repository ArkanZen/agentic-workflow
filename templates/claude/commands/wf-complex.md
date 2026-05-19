---
description: 复杂后端：跨模块、架构变更或边界模糊，先探索再进入 OpenSpec。
  触发词：wf-complex、复杂需求、复杂后端、架构变更、跨模块。
---

# /wf-complex

复杂变更通道。

适用于跨模块、架构变更、业务边界不清晰或实现风险较高的任务。

执行以下步骤：
1. 调用 brainstorming skill（superpowers:brainstorming）探索需求、边界、风险和替代方案
2. 设计确认后，执行 /openspec-propose（含 GStack design gate）
3. apply 前调用 superpowers:writing-plans 细化任务分解
4. 执行 /openspec-apply-change 实现
5. 完成后调用 superpowers:verification-before-completion 验收
6. 验收通过后执行 /openspec-archive-change 归档
