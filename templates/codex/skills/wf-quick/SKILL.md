---
name: wf-quick
description: |
  快速通道：文案、样式、明确 bug，跳过 gate，直接生成 proposal + tasks。
  适用于 ≤3 文件、无架构/安全影响、意图无歧义的小改动。
  仅当用户显式输入 /wf-quick 时使用；不要因"快速通道、快速修复、quick fix、小改动"等自然语言自动触发。
---

快速通道变更。

## 状态行规则

在本工作流执行期间，每次回复开头输出一行：
`> wf-quick · <change-name> · 步骤 N/13`
change-name 在步骤 2 确定后填入，此前用 `…` 占位；N 为当前正在执行的步骤编号。

**切换与退出规则**：
- 收到超出当前范围的独立任务请求时，先宣告「wf-[name] 已在步骤 N 暂停/切换，原因：[一句话]」，再处理新请求，不得静默切换
- 用户调用 `/wf-finish` 显式关闭；调用其他 `/wf-*` 命令时自动切换（当前工作流视为结束，更新 `.wf-active`）

## 强制依赖清单

快速通道会跳过 design gate，但不能跳过 OpenSpec 记录、实现确认和完成验证。

```yaml
required_workflows:
  implementation:
    - openspec-apply-change
  archive:
    - openspec-archive-change
conditional_skills:
  bug_or_unexpected_behavior:
    - superpowers:systematic-debugging
  before_claiming_done:
    - superpowers:verification-before-completion
```

若快速通道处理的是明确 bug，必须先加载 `superpowers:systematic-debugging` 完成根因确认，再生成 quick change。若宿主环境没有对应 skill 或 workflow，必须先明确说明缺失项和影响，再等待用户确认是否降级继续。

## Codex App 交互规则

- 有选项的地方，优先使用 Codex App 提供的 UI 交互工具（如 `request_user_input` 或当前宿主暴露的等价工具）。
- 只有 UI 交互工具不可用时，才退化为文本选项；文本选项必须短且明确。
- 所有本地文件链接必须使用绝对路径，方便 Codex App 直接打开。

## 启动自检

开始执行时必须先展示或内部完成以下自检，并在首条进展中说明依赖状态：

- 当前工作流：`wf-quick`
- quick_change_criteria：待判定 / 已符合 / 不符合
- 必须执行的 OpenSpec workflow：`openspec-apply-change`、`openspec-archive-change`
- 条件 skill：明确 bug 时加载 `superpowers:systematic-debugging`；完成前优先加载 `superpowers:verification-before-completion`
- 已加载状态：逐项标记已加载 / 未加载并说明降级原因

首先确认此变更符合 openspec/config.yaml 中 quick_change_criteria 定义的全部条件：
改动范围 ≤ 3 个文件、不涉及新功能/架构/安全敏感逻辑、意图无歧义。

若不符合，告知用户改用 /wf-small 走完整通道。

若符合，执行以下步骤：
0. 若任务是明确 bug，先加载并执行 `superpowers:systematic-debugging`，完成根因确认后再继续。
1. 对照 `openspec/config.yaml` 的 `risk_triggers` 做高风险逃逸检查：命中架构、UI、安全、数据口径、跨层、外部调用、部署配置任一风险时，停止 quick 并推荐 `/wf-small` 或 `/wf-complex`。
2. 从用户输入派生 kebab-case 变更名（加 `quick-` 前缀，例如 `quick-fix-date-format`）
3. 运行 `openspec new change "<name>"`
   完成后写入 `.wf-active`（确保 git-ignored）：
   ```bash
   echo '{"workflow":"wf-quick","change":"<name>","started":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > .wf-active
   grep -q "\.wf-active" .gitignore 2>/dev/null || echo ".wf-active" >> .gitignore
   ```
4. 运行 `openspec instructions proposal --change "<name>" --json`，生成 proposal.md
5. 跳过 design.md（快速通道不生成此工件，不运行任何 gate）
6. 任务上下文收集（生成 tasks 前执行）：
   运行 `git diff --stat HEAD` 获取最近修改的文件列表；
   从 proposal 变更描述中提取 2-3 个关键词，grep 找到相关源文件路径。
   生成 tasks.md 时，每个任务须引用具体文件路径（若能确定），避免泛化描述。
7. 运行 `openspec instructions tasks --change "<name>" --json`，生成 tasks.md；不得绕过该 workflow 直接实现。
8. 展示以下内容：
   - quick_change_criteria 判定结论
   - risk_triggers 逃逸检查结论
   - proposal.md / tasks.md 的绝对路径链接
   - tasks.md 中的 checkbox 清单摘要
   然后说明：「tasks 已就绪，准备实现。如无异议请告知继续；需要修改请说明。」
   等待用户回复：肯定性回复 → 进入步骤 9；提出修改 → 按要求调整后重回步骤 8；取消 → 停止，保留 `.wf-active` 供后续恢复。
9. 执行 `/openspec-apply-change` 实现；不得绕过该 workflow 直接实现。
10. 实现完成后优先加载 `superpowers:verification-before-completion`，运行最小必要验证，并在结果中说明已验证项。
11. 验证通过后同步 `tasks.md`：将已确认完成的任务从 `- [ ]` 勾选为 `- [x]`；若存在无法确认完成的任务，先告知用户并保留未勾选状态。
12. 若第 11 步所有任务已完成：说明「准备归档并完成此变更」，直接执行 `/openspec-archive-change`；
    用户明确说「跳过归档」时保留 active change 不归档。
    若有未完成任务：使用 UI 交互询问用户是否归档，用户确认后再执行 `/openspec-archive-change`。
    归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑。
13. 归档决策完成后，读取 openspec/config.yaml 中 commit_checkpoints.end 规则并执行最终提交；
    最终提交应覆盖代码、测试、OpenSpec tasks 勾选、归档移动和 spec sync。
    提交完成后删除 `.wf-active`：`rm -f .wf-active`

## 收尾审计

完成前必须输出执行审计：

- `wf-quick`：已执行
- quick_change_criteria：列出判定结论
- risk_triggers：列出逃逸检查结论；若升级为其他 workflow，说明原因
- OpenSpec workflow：列出 `apply`、`archive` 的执行状态
- 条件 skill：列出 `systematic-debugging`、`verification-before-completion` 已加载 / 不适用 / 降级原因
- 验证：列出实际运行的命令和结果
