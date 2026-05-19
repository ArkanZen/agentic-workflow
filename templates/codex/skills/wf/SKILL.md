---
name: wf
description: |
  工作流模式选择器。描述任务，选择模式，路由到正确工具链。
  5 种模式：快速通道 / 小需求 / 复杂后端 / Debug重构单测 / 产品架构方案。
  触发词：wf、工作流、我想做、开始、新任务。
---

工作流模式选择。

用 AskUserQuestion 展示 5 个模式，让用户选择：

- ⚡ 快速通道 — 文案/样式/明确 bug，≤3 文件，跳过 gate
- 🔧 小需求 — 功能点清晰（OpenSpec + GStack）
- 🏗️ 复杂后端 — 跨模块/架构/边界模糊（OpenSpec + GStack + Superpowers）
- 🔍 Debug/重构/单测 — 问题已知（Superpowers 优先）
- 💡 产品/架构方案 — 还不确定做不做（GStack 优先）

如果用户已在调用时描述了任务，将描述带入对应工具链第一步，不要重复询问。

路由规则：

**Mode 0（快速通道）**
→ 执行 /openspec-quick 流程

**Mode 1（小需求）**
→ 执行 /openspec-propose 完整通道

**Mode 2（复杂后端）**
→ 步骤一：调用 brainstorming skill 探索需求和边界
→ 步骤二：执行 /openspec-propose（含 /gstack-plan-eng-review gate）
→ 步骤三：apply 前细化任务分解（writing-plans 风格）
→ 步骤四：/openspec-apply-change 实现
→ 步骤五：完成后执行 verification-before-completion 验收
→ 步骤六：/openspec-archive-change 归档

**Mode 3（Debug/重构/单测）**
→ 判断子类型：
  - 找 bug → 按 systematic-debugging 方法论：复现 → 假设 → 验证 → 修复
  - 补单测 → 按 TDD 方法论：先写测试 → 实现 → 验证覆盖率
  - 纯重构 → 先明确重构边界和目标，再逐步实现
→ 完成后询问：「是否用 /openspec-quick 记录结论？」

**Mode 4（产品/架构方案）**
→ 步骤一：调用 /gstack-plan-eng-review 从工程视角评估可行性
→ 步骤二：从产品视角梳理：值得做？用户价值？替代方案？
→ 步骤三：完成后询问：「决定做了吗？选 Mode 1 还是 2 继续？」

注意：Codex 侧 Mode 4 用 /gstack-plan-eng-review 替代 GStack 原生 /office-hours。
如需完整 office-hours 体验，切换到 Claude Code 执行。
