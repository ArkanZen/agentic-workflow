---
name: wf-quick
description: |
  快速通道：文案、样式、明确 bug，跳过 gate，直接生成 proposal + tasks。
  适用于 ≤3 文件、无架构/安全影响、意图无歧义的小改动。
  仅当用户显式输入 /wf-quick 时使用；不要因“快速通道、快速修复、quick fix、小改动”等自然语言自动触发。
---

快速通道变更。

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
- quick 虽然跳过 design gate，但 proposal/tasks 生成后仍必须暂停展示并等待确认。
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
4. 运行 `openspec instructions proposal --change "<name>" --json`，生成 proposal.md
   提示：先运行 `git diff --stat`，把变更文件列表粘贴到 proposal 背景一栏可节省时间。
5. 跳过 design.md（快速通道不生成此工件，不运行任何 gate）
6. 运行 `openspec instructions tasks --change "<name>" --json`，生成 tasks.md
7. 生成完成后必须展示：
   - quick_change_criteria 判定结论
   - risk_triggers 逃逸检查结论
   - proposal.md / tasks.md 的绝对路径链接
   - tasks.md 中的 checkbox 清单摘要
8. 使用 UI 交互询问用户是否确认按这些 tasks 直接实现：
   - 选项 A：确认实现（推荐）
   - 选项 B：修改 tasks/proposal
   - 选项 C：取消
   用户确认前，不得执行 /openspec-apply-change。
9. 用户确认后，执行 `/openspec-apply-change` 实现；不得绕过该 workflow 直接实现。
10. 实现完成后优先加载 `superpowers:verification-before-completion`，运行最小必要验证，并在结果中说明已验证项。
11. 验证通过后同步 `tasks.md`：将已确认完成的任务从 `- [ ]` 勾选为 `- [x]`；若存在无法确认完成的任务，先告知用户并保留未勾选状态。
12. 询问用户是否归档；用户确认后再执行 `/openspec-archive-change`。归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑；若第 11 步已确认全部任务完成，归档不应因任务未勾选再次打断。
13. 归档决策完成后，读取 openspec/config.yaml 中 commit_checkpoints.end 规则并执行最终提交；最终提交应覆盖代码、测试、OpenSpec tasks 勾选、归档移动和 spec sync。

## 收尾审计

完成前必须输出执行审计：

- `wf-quick`：已执行
- quick_change_criteria：列出判定结论
- risk_triggers：列出逃逸检查结论；若升级为其他 workflow，说明原因
- OpenSpec workflow：列出 `apply`、`archive` 的执行状态
- 条件 skill：列出 `systematic-debugging`、`verification-before-completion` 已加载 / 不适用 / 降级原因
- 验证：列出实际运行的命令和结果
