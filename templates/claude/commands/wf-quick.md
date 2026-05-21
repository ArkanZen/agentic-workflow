---
description: 快速通道：文案、样式、明确 bug，跳过 gate，直接生成 proposal + tasks。
  仅当用户显式输入 /wf-quick 时使用；不要因"快速通道、快速修复、quick fix、小改动"等自然语言自动触发。
---

# /wf-quick

快速通道变更。

首先确认此变更符合 openspec/config.yaml 中 quick_change_criteria 定义的全部条件：
改动范围 ≤ 3 个文件、不涉及新功能/架构/安全敏感逻辑、意图无歧义。

若不符合，告知用户改用 /wf-small 走完整通道。

若符合，执行以下步骤：
1. 从用户输入派生 kebab-case 变更名（加 `quick-` 前缀，例如 `quick-fix-date-format`）
2. 运行 `openspec new change "<name>"`
3. 运行 `openspec instructions proposal --change "<name>" --json`，生成 proposal.md
4. 跳过 design.md（快速通道不生成此工件，不运行任何 gate）
5. 运行 `openspec instructions tasks --change "<name>" --json`，生成 tasks.md
6. 生成完成后必须展示：
   - quick_change_criteria 判定结论
   - proposal.md / tasks.md 的绝对路径
   - tasks.md 中的 checkbox 清单摘要
7. 用 AskUserQuestion 询问用户是否确认按这些 tasks 直接实现：
   - 选项 A：确认实现（推荐）
   - 选项 B：修改 tasks/proposal
   - 选项 C：取消
   用户确认前，不得执行 /openspec-apply-change。
8. 用户确认后，执行 /openspec-apply-change 实现
9. 实现完成后运行最小必要验证，并在结果中说明已验证项
10. 验证通过后同步 `tasks.md`：将已确认完成的任务从 `- [ ]` 勾选为 `- [x]`；若存在无法确认完成的任务，先告知用户并保留未勾选状态
11. 询问用户是否归档；用户确认后再执行 /openspec-archive-change
12. 归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑；若第 10 步已确认全部任务完成，归档不应因任务未勾选再次打断
13. 归档决策完成后，读取 openspec/config.yaml 中 commit_checkpoints.end 规则并执行最终提交；最终提交应覆盖代码、测试、OpenSpec tasks 勾选、归档移动和 spec sync
