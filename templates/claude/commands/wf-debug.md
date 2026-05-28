---
description: Debug/重构/单测：问题已知，无需新 spec，直接进入排查或实现。
  仅当用户显式输入 /wf-debug 时使用；不要因“debug、修 bug、重构、补单测、测试”等自然语言自动触发。
---

# /wf-debug

Debug / 重构 / 单测通道。

判断任务子类型并直接处理：

- 找 bug / 排查问题：调用 superpowers:systematic-debugging，按复现 → 假设 → 验证 → 修复推进
- 补单测 / TDD 新功能：调用 superpowers:test-driven-development，先写测试，再实现并验证
- 纯重构：调用 superpowers:brainstorming 确认重构边界，再直接实现

完成后询问：「是否需要用 /wf-quick 记录这次修改的结论？」若本次修复涉及行为变化、接口变化或安全/数据口径风险，应推荐改用 /wf-small 记录完整 OpenSpec change。
