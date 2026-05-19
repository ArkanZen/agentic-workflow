---
name: wf-quick
description: |
  快速通道：文案、样式、明确 bug，跳过 gate，直接生成 proposal + tasks。
  适用于 ≤3 文件、无架构/安全影响、意图无歧义的小改动。
  触发词：wf-quick、快速通道、快速修复、quick fix、小改动。
---

快速通道变更。

首先确认此变更符合 openspec/config.yaml 中 quick_change_criteria 定义的全部条件：
改动范围 ≤ 3 个文件、不涉及新功能/架构/安全敏感逻辑、意图无歧义。

若不符合，告知用户改用 /wf-small 走完整通道。

若符合，执行以下步骤：
1. 从用户输入派生 kebab-case 变更名（加 `quick-` 前缀，例如 `quick-fix-date-format`）
2. 运行 `openspec new change "<name>"`
3. 运行 `openspec instructions proposal --change "<name>" --json`，生成 proposal.md
4. 跳过 design.md（快速通道不生成此工件，不运行任何 gate）
5. 运行 `openspec instructions tasks --change "<name>" --json`，生成 tasks.md
6. 展示最终状态，提示用户运行 /openspec-apply-change 开始实现
