---
name: wf-complex
description: |
  复杂后端：跨模块、架构变更或边界模糊，先探索再进入 OpenSpec。
  触发词：wf-complex、复杂需求、复杂后端、架构变更、跨模块。
---

复杂变更通道。

适用于跨模块、架构变更、业务边界不清晰或实现风险较高的任务。

执行以下步骤：
1. 调用 brainstorming skill 探索需求、边界、风险和替代方案
2. 设计确认后，执行 /openspec-propose（含 /gstack-plan-eng-review gate）
3. apply 前按 writing-plans 风格细化任务分解
4. 执行 /openspec-apply-change 实现
5. 完成后执行 verification-before-completion 验收
6. 验收通过后执行 /openspec-archive-change 归档
