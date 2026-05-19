---
name: wf-debug
description: |
  Debug/重构/单测：问题已知，无需新 spec，直接进入排查或实现。
  触发词：wf-debug、debug、修 bug、重构、补单测、测试。
---

Debug / 重构 / 单测通道。

判断任务子类型并直接处理：

- 找 bug / 排查问题：按 systematic-debugging 方法论，复现 → 假设 → 验证 → 修复
- 补单测 / TDD 新功能：按 test-driven-development 方法论，先写测试 → 实现 → 验证覆盖率
- 纯重构：先明确重构边界和目标，再逐步实现

完成后询问：「是否用 /wf-quick 记录结论？」
