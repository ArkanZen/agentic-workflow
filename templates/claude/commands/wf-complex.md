---
description: 复杂后端：跨模块、架构变更或边界模糊，先探索再进入 OpenSpec。
  仅当用户显式输入 /wf-complex 时使用；不要因"复杂需求、复杂后端、架构变更、跨模块"等自然语言自动触发。
---

# /wf-complex

复杂变更通道。

**状态行规则**：在本工作流执行期间，每次回复开头输出一行：
`> wf-complex · <change-name> · 步骤 N/15`
change-name 在步骤 4（openspec propose）确定后填入，此前用 `…` 占位；N 为当前正在执行的步骤编号。

**切换与退出规则**：
- 收到超出当前范围的独立任务请求时，先宣告「wf-complex 已在步骤 N 暂停/切换，原因：[一句话]」，再处理新请求，不得静默切换
- 用户调用 `/wf-finish` 显式关闭；调用其他 `/wf-*` 命令时自动切换（当前工作流视为结束，更新 `.wf-active`）

适用于跨模块、架构变更、业务边界不清晰或实现风险较高的任务。

执行以下步骤：
1. 读取 openspec/config.yaml 中 commit_checkpoints.start 规则并执行。
   完成后写入 `.wf-active`（确保 git-ignored）：
   ```bash
   echo '{"workflow":"wf-complex","change":"pending","started":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > .wf-active
   grep -q "\.wf-active" .gitignore 2>/dev/null || echo ".wf-active" >> .gitignore
   ```
2. 调用 brainstorming skill（superpowers:brainstorming）探索需求、边界、风险和替代方案
3. 对照 `openspec/config.yaml` 的 `risk_triggers` 判断本次变更命中的风险类型，展示探索结论、风险和推荐路径，用 AskUserQuestion 询问是否确认进入 OpenSpec 提案：
   - 选项 A：确认进入提案
   - 选项 B：调整探索方向
   - 选项 C：取消
   用户确认前，不得执行 /openspec-propose。
4. 用户确认后，执行 /openspec-propose（含工程 gate，并按风险触发 UI/安全 gate）
5. propose 完成后，调用 superpowers:writing-plans 细化任务分解，确保 tasks.md 颗粒度合理、顺序清晰
6. 生成完成后必须展示：
   - proposal.md / design.md / tasks.md 的绝对路径
   - design 顶部 gate 状态摘要
   - tasks.md 中的 checkbox 清单摘要（已经过 writing-plans 细化）
7. 用 AskUserQuestion 询问用户是否确认进入实现：
   - 选项 A：确认实现（推荐）
   - 选项 B：修改设计/任务
   - 选项 C：取消
   用户确认前，不得执行 /openspec-apply-change。
8. 用户确认后，执行 /openspec-apply-change 实现。tasks.md 拆出多个相对独立的实现任务时，可加载 superpowers:subagent-driven-development 在当前会话内按独立任务推进执行（与 openspec-apply 配合，不替代其工件流程）
9. 实现完成后执行代码审查（命令名见 Host 命令映射/manifest，namespaced 用 /gstack-review）；**收到审查反馈后加载 superpowers:receiving-code-review，先技术核实再落实，不盲目照办**；若审查阻断，先修复再进入验收
10. 若命中 Web 流程风险，执行 /qa 或说明降级验证方式
11. 完成后调用 superpowers:verification-before-completion 验收，并在结果中说明已验证项
12. 验证通过后同步 `tasks.md`：将已确认完成的任务从 `- [ ]` 勾选为 `- [x]`；若存在无法确认完成的任务，先告知用户并保留未勾选状态
13. 若第 12 步所有任务已完成：说明「准备归档并完成此变更」，直接执行 /openspec-archive-change；
    用户明确说「跳过归档」时保留 active change 不归档。
    若有未完成任务：询问用户是否归档，用户确认后再执行 /openspec-archive-change。
14. 归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑
15. 归档决策完成后，读取 openspec/config.yaml 中 commit_checkpoints.end 规则并执行最终提交；
    最终提交应覆盖代码、测试、OpenSpec tasks 勾选、归档移动和 spec sync。
    提交完成后删除 `.wf-active`：`rm -f .wf-active`
