---
description: 小需求：功能点清晰、改动范围明确，走 OpenSpec 完整通道。
  仅当用户显式输入 /wf-small 时使用；不要因"小需求、明确需求、新增字段、加指标"等自然语言自动触发。
---

# /wf-small

小需求完整通道。

**状态行规则**：在本工作流执行期间，每次回复开头输出一行：
`> wf-small · <change-name> · 步骤 N/14`
change-name 在步骤 3（openspec propose）确定后填入，此前用 `…` 占位；N 为当前正在执行的步骤编号。

**切换与退出规则**：
- 收到超出当前范围的独立任务请求时，先宣告「wf-small 已在步骤 N 暂停/切换，原因：[一句话]」，再处理新请求，不得静默切换
- 用户调用 `/wf-finish` 显式关闭；调用其他 `/wf-*` 命令时自动切换（当前工作流视为结束，更新 `.wf-active`）

适用于功能点清晰、改动范围明确、无需额外产品探索的变更。

执行以下步骤：
1. 读取 openspec/config.yaml 中 commit_checkpoints.start 规则并执行。
   完成后写入 `.wf-active`（确保 git-ignored）：
   ```bash
   echo '{"workflow":"wf-small","change":"pending","started":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > .wf-active
   grep -q "\.wf-active" .gitignore 2>/dev/null || echo ".wf-active" >> .gitignore
   ```
2. 将用户输入作为需求背景，不重复询问已说明的信息
3. 对照 `openspec/config.yaml` 的 `risk_triggers` 判断本次变更命中的风险类型，并用最多 6 行轻量表格列出结果。表格格式：`| 风险 | 命中 | 触发能力 |`；风险只覆盖架构/UI/安全/测试/数据口径/浏览器验证，理由只在必要时用不超过 12 个字补充
4. 执行 /openspec-propose，生成 proposal、按风险触发的 design gate 和 tasks
   propose 完成后更新 `.wf-active` 中的 change 字段为实际变更名
5. 若任一 gate 阻断，处理审查意见时加载 superpowers:receiving-code-review（先技术核实再改，不盲从），据此修改 proposal/design 后再继续
6. 任务上下文收集（生成 tasks 前执行）：
   运行 `git diff --stat HEAD` 获取最近修改的文件列表；
   从 proposal 变更描述中提取 2-3 个关键词，grep 找到相关源文件路径。
   在 tasks.md 中，每个任务须引用具体文件路径（若能确定），避免泛化描述。
7. 生成完成后必须展示：
   - proposal.md / design.md / tasks.md 的绝对路径
   - design 顶部 gate 状态摘要；若未触发某 gate，说明未触发理由
   - tasks.md 中的 checkbox 清单摘要
8. 若命中测试风险，先加载 superpowers:test-driven-development 并把测试约束写入 tasks
9. 用 AskUserQuestion 询问用户是否确认进入实现：
   - 选项 A：确认实现（推荐）
   - 选项 B：修改设计/任务
   - 选项 C：取消
   用户确认前，不得执行 /openspec-apply-change。
10. 用户确认后，执行 /openspec-apply-change 实现
11. 完成前调用 superpowers:verification-before-completion，运行必要验证并说明已验证项
12. 验证通过后同步 `tasks.md`：将已确认完成的任务从 `- [ ]` 勾选为 `- [x]`；若存在无法确认完成的任务，先告知用户并保留未勾选状态
13. 若第 12 步所有任务已完成：说明「准备归档并完成此变更」，直接执行 /openspec-archive-change；
    用户明确说「跳过归档」时保留 active change 不归档。
    若有未完成任务：询问用户是否归档，用户确认后再执行 /openspec-archive-change。
    归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑。
14. 归档决策完成后，读取 openspec/config.yaml 中 commit_checkpoints.end 规则并执行最终提交；
    最终提交应覆盖代码、测试、OpenSpec tasks 勾选、归档移动和 spec sync。
    提交完成后删除 `.wf-active`：`rm -f .wf-active`
