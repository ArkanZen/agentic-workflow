---
name: wf-debug
description: |
  Debug/重构/单测：问题已知，无需新 spec，直接进入排查或实现。
  仅当用户显式输入 /wf-debug 时使用；不要因“debug、修 bug、重构、补单测、测试”等自然语言自动触发。
---

Debug / 重构 / 单测通道。

## Codex App 交互规则

- 有选项的地方，优先使用 Codex App 提供的 UI 交互工具（如 `request_user_input` 或当前宿主暴露的等价工具）。
- 只有 UI 交互工具不可用时，才退化为文本选项；文本选项必须短且明确。
- 完成后询问是否记录结论时，优先使用 UI 选项。

判断任务子类型并直接处理：

- 找 bug / 排查问题：按 systematic-debugging 方法论，复现 → 假设 → 验证 → 修复
- 补单测 / TDD 新功能：按 test-driven-development 方法论，先写测试 → 实现 → 验证覆盖率
- 纯重构：先明确重构边界和目标，再逐步实现

完成后询问：「是否用 /wf-quick 记录结论？」
