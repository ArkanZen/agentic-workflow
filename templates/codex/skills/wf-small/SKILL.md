---
name: wf-small
description: |
  小需求：功能点清晰、改动范围明确，走 OpenSpec 完整通道。
  仅当用户显式输入 /wf-small 时使用；不要因“小需求、明确需求、新增字段、加指标”等自然语言自动触发。
---

小需求完整通道。

**状态行规则**：在本工作流执行期间，每次回复开头输出一行：
`> wf-small · <change-name> · 步骤 N/14`
change-name 在步骤 4（openspec propose）确定后填入，此前用 `…` 占位；N 为当前正在执行的步骤编号。

**切换与退出规则**：
- 收到超出当前范围的独立任务请求时，先宣告「wf-[name] 已在步骤 N 暂停/切换，原因：[一句话]」，再处理新请求，不得静默切换
- 用户调用 `/wf-finish` 显式关闭；调用其他 `/wf-*` 命令时自动切换（当前工作流视为结束，更新 `.wf-active`）

适用于功能点清晰、改动范围明确、无需额外产品探索的变更。

## 强制依赖清单

必须在对应阶段执行指定 workflow 或审查命令。不得用手写步骤替代这些 workflow，也不得在未执行 gate 时声称已完成审查。

```yaml
required_workflows:
  proposal:
    - openspec-propose
  implementation:
    - openspec-apply-change
  archive:
    - openspec-archive-change
required_skills:
  before_claiming_done:
    - superpowers:verification-before-completion
conditional_reviews:
  architecture_risk:
    - /gstack-plan-eng-review
  ui_risk:
    - /gstack-plan-design-review
  security_risk:
    - /gstack-cso
conditional_skills:
  test_risk:
    - superpowers:test-driven-development
```

若宿主环境没有对应 workflow、skill 或审查命令，必须先明确说明缺失项和影响，再等待用户确认是否降级继续。

## Codex App 交互规则

- 有选项的地方，优先使用 Codex App 提供的 UI 交互工具（如 `request_user_input` 或当前宿主暴露的等价工具）。
- 只有 UI 交互工具不可用时，才退化为文本选项；文本选项必须短且明确。
- 用户确认前不得自动越过关键节点；特别是 proposal/design/tasks 生成后，必须暂停等待确认。
- 所有本地文件链接必须使用绝对路径，方便 Codex App 直接打开。

## 启动自检

开始执行时必须先展示或内部完成以下自检，并在首条进展中说明依赖状态：

- 当前工作流：`wf-small`
- 必须执行的 OpenSpec workflow：`openspec-propose`、`openspec-apply-change`、`openspec-archive-change`
- 风险触发器：读取 `openspec/config.yaml` 的 `risk_triggers`
- 必须 skill：完成前加载 `superpowers:verification-before-completion`
- 条件审查：架构风险触发 `/gstack-plan-eng-review`；UI 风险触发 `/gstack-plan-design-review`；安全风险触发 `/gstack-cso`
- 条件 skill：测试风险触发 `superpowers:test-driven-development`
- 已加载状态：逐项标记已加载 / 未加载并说明降级原因

**OpenSpec 命令兜底**：下文的 `/openspec-propose`、`/openspec-apply-change`、`/openspec-archive-change`（含 explore）均为 OpenSpec **skill 名**。若调用返回 `Unknown skill`，立即改用等价的 `/opsx:propose`、`/opsx:apply`、`/opsx:archive`（explore→`/opsx:explore`）继续，不得中断流程或声称失败。

执行以下步骤：
1. 读取 openspec/config.yaml 中 commit_checkpoints.start 规则并执行。
   完成后写入 `.wf-active`（确保 git-ignored）：
   ```bash
   echo '{"workflow":"wf-small","change":"pending","started":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > .wf-active
   grep -q "\.wf-active" .gitignore 2>/dev/null || echo ".wf-active" >> .gitignore
   ```
2. 将用户输入作为需求背景，不重复询问已说明的信息
3. 对照 `risk_triggers` 判断本次变更命中的风险类型，并在首轮摘要中用最多 6 行轻量表格列出结果。表格格式：`| 风险 | 命中 | 触发能力 |`；风险只覆盖架构/UI/安全/测试/数据口径/浏览器验证，理由只在必要时用不超过 12 个字补充。
4. 执行 `/openspec-propose`，生成 proposal、按风险触发的 design gate 和 tasks；不得手写替代 proposal 流程。
5. 若任一 gate 阻断，处理审查意见时加载 `superpowers:receiving-code-review`（先技术核实再改，不盲从），据此修改 proposal/design 后再继续
6. 任务上下文收集（展示结果前执行）：
   运行 `git diff --stat HEAD` 获取最近修改的文件列表；从 proposal 变更描述中提取关键词，grep 找到相关源文件路径。
   tasks.md 中每个任务须引用具体文件路径（若能确定），避免泛化描述。
7. 生成完成后必须展示：
   - proposal.md / design.md / tasks.md 的绝对路径链接
   - design 顶部 gate 状态摘要；若未触发某 gate，说明未触发理由
   - tasks.md 中的 checkbox 清单摘要
7. 若命中测试风险，先加载 `superpowers:test-driven-development` 并把测试约束写入 tasks。
8. 使用 UI 交互询问用户是否确认进入实现：
   - 选项 A：确认实现（推荐）
   - 选项 B：修改设计/任务
   - 选项 C：取消
   用户确认前，不得执行 /openspec-apply-change。
9. 用户确认后，执行 `/openspec-apply-change` 实现；不得绕过该 workflow 直接实现。
10. 实现完成后加载 `superpowers:verification-before-completion` 运行必要验证，并在结果中说明已验证项。
11. 验证通过后同步 `tasks.md`：将已确认完成的任务从 `- [ ]` 勾选为 `- [x]`；若存在无法确认完成的任务，先告知用户并保留未勾选状态。
12. 若第 11 步所有任务已完成：说明「准备归档并完成此变更」，直接执行 `/openspec-archive-change`；用户明确说「跳过归档」时保留 active change 不归档。
    若有未完成任务：使用 UI 交互询问用户是否归档，用户确认后再执行 `/openspec-archive-change`。
    归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑。
13. 归档决策完成后，读取 openspec/config.yaml 中 commit_checkpoints.end 规则并执行最终提交；最终提交应覆盖代码、测试、OpenSpec tasks 勾选、归档移动和 spec sync。
    提交完成后删除 `.wf-active`：`rm -f .wf-active`

## 收尾审计

完成前必须输出执行审计：

- `wf-small`：已执行
- OpenSpec workflow：列出 `propose`、`apply`、`archive` 的执行状态
- 风险触发器：列出命中风险、未命中风险和判定理由
- GStack gate：列出已触发审查命令、状态和是否阻断；未触发项列出跳过原因
- Superpowers skill：列出 `verification-before-completion`、`test-driven-development` 已加载 / 不适用 / 降级原因
- 验证：列出实际运行的命令和结果
