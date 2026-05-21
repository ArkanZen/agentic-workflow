---
name: wf-complex
description: |
  复杂后端：跨模块、架构变更或边界模糊，先探索再进入 OpenSpec。
  仅当用户显式输入 /wf-complex 时使用；不要因“复杂需求、复杂后端、架构变更、跨模块”等自然语言自动触发。
---

复杂变更通道。

适用于跨模块、架构变更、业务边界不清晰或实现风险较高的任务。

## Codex App 交互规则

- 有选项的地方，优先使用 Codex App 提供的 UI 交互工具（如 `request_user_input` 或当前宿主暴露的等价工具）。
- 只有 UI 交互工具不可用时，才退化为文本选项；文本选项必须短且明确。
- 探索结果、OpenSpec 产物、最终 tasks 和归档/提交决策都必须暂停等待用户确认。
- 所有本地文件链接必须使用绝对路径，方便 Codex App 直接打开。

执行以下步骤：
1. 读取 openspec/config.yaml 中 commit_checkpoints.start 规则并执行。
2. 调用 brainstorming skill 探索需求、边界、风险和替代方案
3. 展示探索结论、风险和推荐路径，使用 UI 交互询问用户是否确认进入 OpenSpec 提案。
4. 用户确认后，执行 /openspec-propose（含 /gstack-plan-eng-review gate）
5. proposal/design/tasks 生成后必须展示：
   - proposal.md / design.md / tasks.md 的绝对路径链接
   - design 顶部 gate 状态摘要
   - tasks.md 中的 checkbox 清单摘要
6. 使用 UI 交互询问用户是否确认该设计和 tasks；用户确认前不得实现。
7. apply 前按 writing-plans 风格细化任务分解，并再次展示最终任务摘要。
8. 用户确认后，执行 /openspec-apply-change 实现。
9. 完成后执行 verification-before-completion 验收，并在结果中说明已验证项。
10. 验证通过后同步 `tasks.md` 勾选状态；若存在无法确认完成的任务，先告知用户并保留未勾选状态。
11. 询问用户是否归档；用户确认后再执行 /openspec-archive-change。归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑。
12. 归档决策完成后，读取 openspec/config.yaml 中 commit_checkpoints.end 规则并执行最终提交；最终提交应覆盖代码、测试、OpenSpec tasks 勾选、归档移动和 spec sync。
