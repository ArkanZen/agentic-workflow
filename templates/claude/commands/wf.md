---
description: 工作流模式选择器。描述任务，选择模式，AI 路由到正确工具链。
  触发词：wf、工作流、我想做、开始、新任务。
---

工作流模式选择。

用 AskUserQuestion 展示 5 个模式，让用户选择：

- ⚡ 快速通道 — 文案/样式/明确 bug，改动 ≤3 文件，跳过所有 gate
- 🔧 小需求 — 功能点清晰，改动范围明确（OpenSpec + GStack）
- 🏗️ 复杂后端 — 跨模块/架构变更/边界模糊（OpenSpec + GStack + Superpowers）
- 🔍 Debug/重构/单测 — 问题已知，无需新 spec（Superpowers 优先）
- 💡 产品/架构方案 — 还不确定是否值得做（GStack 优先）

如果用户已在 /wf 命令参数里描述了任务，将描述带入对应工具链的第一步，不要再重复询问。

路由规则：

**Mode 0（快速通道）**
→ 执行 openspec-quick 流程（见 .claude/commands/openspec-quick.md）

**Mode 1（小需求）**
→ 执行 /openspec-propose 完整通道

**Mode 2（复杂后端）**
→ 步骤一：调用 brainstorming skill（superpowers:brainstorming）探索需求和边界
→ 步骤二：设计确认后，执行 /openspec-propose（含 GStack design gate）
→ 步骤三：apply 前，调用 superpowers:writing-plans 细化任务分解
→ 步骤四：/openspec-apply-change 实现
→ 步骤五：完成后调用 superpowers:verification-before-completion 验收
→ 步骤六：/openspec-archive-change 归档

**Mode 3（Debug/重构/单测）**
→ 判断子类型：
  - 找 bug / 排查问题 → 调用 superpowers:systematic-debugging
  - 补单测 / TDD 新功能 → 调用 superpowers:test-driven-development
  - 纯重构 → 调用 superpowers:brainstorming 确认重构边界，再直接实现
→ 完成后询问：「是否需要用 /openspec-quick 记录这次修改的结论？」

**Mode 4（产品/架构方案）**
→ 步骤一：调用 GStack /office-hours（自由探索想法）
→ 步骤二：调用 /plan-ceo-review（值得做？scope 合理？）
→ 步骤三：review 完成后询问：「决定做了吗？选 Mode 1 还是 2 继续？」
