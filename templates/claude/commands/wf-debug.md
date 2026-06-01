---
description: Debug/重构/单测：问题已知，无需新 spec，直接进入排查或实现。
  仅当用户显式输入 /wf-debug 时使用；不要因"debug、修 bug、重构、补单测、测试"等自然语言自动触发。
---

# /wf-debug

Debug / 重构 / 单测通道。

**状态行规则**：在本工作流执行期间，每次回复开头输出一行：
`> wf-debug · <问题简述>`
问题简述从用户输入中提取，控制在 10 个字以内。

**诊断收集**（执行任何 skill 前先完成，约 2 分钟）：
1. **症状**：用一句话确认问题现象（从用户输入提取或补充询问）
2. **最近改动**：运行 `git log --oneline -5`，列出最近 5 次提交
3. **相关文件**：根据问题描述，grep 相关源文件路径（`grep -r "<关键词>" --include="*.{js,ts,py,go}" -l . 2>/dev/null | head -5`）
4. **错误输出**：若用户已提供错误信息，摘录关键行；若未提供，询问是否有错误日志或测试输出

诊断收集完成后，判断任务子类型并直接处理：

- **找 bug / 排查问题**：调用 superpowers:systematic-debugging，按复现 → 假设 → 验证 → 修复推进
- **补单测 / TDD 新功能**：调用 superpowers:test-driven-development，先写测试，再实现并验证
- **纯重构**：调用 superpowers:brainstorming 确认重构边界，再直接实现

完成后询问：「是否需要用 /wf-quick 记录这次修改的结论？」若本次修复涉及行为变化、接口变化或安全/数据口径风险，应推荐改用 /wf-small 记录完整 OpenSpec change。
