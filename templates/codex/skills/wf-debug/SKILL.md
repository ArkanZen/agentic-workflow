---
name: wf-debug
description: |
  Debug/重构/单测：问题已知，无需新 spec，直接进入排查或实现。
  仅当用户显式输入 /wf-debug 时使用；不要因“debug、修 bug、重构、补单测、测试”等自然语言自动触发。
---

Debug / 重构 / 单测通道。

## 强制依赖清单

必须在排查、阅读代码、运行测试或提出修复前，先根据任务子类型加载对应 skill 的 `SKILL.md`。不得只按方法论摘要执行，也不得把“按某方法论”理解为无需加载 skill。

```yaml
required_skills:
  bug_or_unexpected_behavior:
    - superpowers:systematic-debugging
  tests_or_tdd_feature:
    - superpowers:test-driven-development
  pure_refactor:
    - superpowers:brainstorming
conditional_skills:
  before_claiming_done:
    - superpowers:verification-before-completion
```

若宿主环境没有对应 skill，必须先明确说明“未能加载 <skill>”及原因，再按本文件中的硬性检查点降级执行；不得声称已加载。

## Codex App 交互规则

- 有选项的地方，优先使用 Codex App 提供的 UI 交互工具（如 `request_user_input` 或当前宿主暴露的等价工具）。
- 只有 UI 交互工具不可用时，才退化为文本选项；文本选项必须短且明确。
- 完成后询问是否记录结论时，优先使用 UI 选项。

## 启动自检

开始执行时必须先展示或内部完成以下自检，并在首条进展中说明已加载的依赖：

- 当前工作流：`wf-debug`
- 任务子类型：bug / 单测或 TDD / 纯重构
- 必须加载的 skill：按上方强制依赖清单列出
- 已加载状态：已加载 / 未加载并说明降级原因
- 下一步：进入对应 skill 的第一阶段或第一步

判断任务子类型并直接处理：

- 找 bug / 排查问题：必须先加载 `superpowers:systematic-debugging`，完成 Phase 1 根因调查前禁止提出修复方案。
- 补单测 / TDD 新功能：必须先加载 `superpowers:test-driven-development`，先写失败测试并确认失败，再实现和验证。
- 纯重构：必须先加载 `superpowers:brainstorming` 明确重构边界和目标；若改变行为，还必须加载 `superpowers:test-driven-development`。

## 收尾审计

完成前必须加载 `superpowers:verification-before-completion`（若可用）并输出执行审计：

- `wf-debug`：已执行
- 强制依赖 skill：逐项列出已加载 / 降级原因
- 根因调查或边界确认：已完成
- 测试或验证：列出实际运行的命令和结果
- 修改范围：列出关键文件

完成后询问：「是否用 /wf-quick 记录结论？」
