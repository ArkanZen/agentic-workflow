# OpenSpec + GStack 双生态工作流实施方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `agentic-workflow` 中创建全套工作流模板（OpenSpec 配置、Claude 命令、Codex skills、GStack 移植 skill），并完成 `plutus-daliy-report` 项目的初始化接入。

**Architecture:** 所有模板集中维护于 `agentic-workflow/templates/`，各项目通过拷贝安装。`openspec/config.yaml` 的 `rules:` 字段注入 GStack gate 逻辑（AI 自我执行），两个 CLI 通过同名 skill 实现审查对等，共享同一份 `openspec/` 工件目录。

**Tech Stack:** OpenSpec CLI（`openspec` 命令）、Claude Code CLI（`.claude/commands/`）、Codex App（`.codex/skills/`）、GStack（`~/.gstack/repos/gstack/.hermes/skills/`）。

---

## 文件地图

```
agentic-workflow/templates/
├── openspec/
│   ├── config-backend.yaml          [CREATE] Task 1
│   └── config-frontend.yaml         [CREATE] Task 2
├── claude/commands/
│   ├── wf.md                        [CREATE] Task 3
│   └── openspec-quick.md            [CREATE] Task 4
└── codex/skills/
    ├── wf/SKILL.md                  [CREATE] Task 5
    ├── openspec-quick/SKILL.md      [CREATE] Task 6
    ├── gstack-plan-eng-review/SKILL.md  [CREATE] Task 7（从 GStack 移植）
    ├── gstack-cso/SKILL.md          [CREATE] Task 8（从 GStack 移植）
    ├── gstack-review/SKILL.md       [CREATE] Task 9（从 GStack 移植）
    └── gstack-plan-design-review/SKILL.md [CREATE] Task 10（从 GStack 移植）

agentic-workflow/README.md             [CREATE] Task 11

plutus-daliy-report/
├── openspec/config.yaml             [REPLACE] Task 12
├── openspec/specs/project.md        [CREATE] Task 13
├── openspec/specs/system.md         [CREATE] Task 14
├── .codex/skills/
│   ├── gstack-plan-eng-review/      [COPY from Task 7] Task 12
│   ├── gstack-cso/                  [COPY from Task 8] Task 12
│   ├── gstack-review/               [COPY from Task 9] Task 12
│   └── openspec-quick/              [COPY from Task 6] Task 12
├── .claude/commands/
│   ├── wf.md                        [COPY from Task 3] Task 12
│   └── openspec-quick.md            [COPY from Task 4] Task 12
├── AGENTS.md                        [APPEND] Task 15
└── .claude/CLAUDE.md                [CREATE] Task 15
```

---

### Task 1: 创建 templates/openspec/config-backend.yaml

**Files:**
- Create: `agentic-workflow/templates/openspec/config-backend.yaml`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p /Users/ryan/aiworkspace/agentic-workflow/templates/openspec
mkdir -p /Users/ryan/aiworkspace/agentic-workflow/templates/claude/commands
mkdir -p /Users/ryan/aiworkspace/agentic-workflow/templates/codex/skills/wf
mkdir -p /Users/ryan/aiworkspace/agentic-workflow/templates/codex/skills/openspec-quick
mkdir -p /Users/ryan/aiworkspace/agentic-workflow/templates/codex/skills/gstack-plan-eng-review
mkdir -p /Users/ryan/aiworkspace/agentic-workflow/templates/codex/skills/gstack-cso
mkdir -p /Users/ryan/aiworkspace/agentic-workflow/templates/codex/skills/gstack-review
mkdir -p /Users/ryan/aiworkspace/agentic-workflow/templates/codex/skills/gstack-plan-design-review
```

预期输出：无报错。

- [ ] **Step 2: 写入 config-backend.yaml**

写入文件 `agentic-workflow/templates/openspec/config-backend.yaml`，内容如下：

```yaml
schema: spec-driven

context: |
  完整项目上下文见 openspec/specs/project.md。
  AI 在生成每个工件时须先读取该文件。

# 快速通道判定标准（满足以下全部条件时可用 /openspec-quick 跳过 design gate）
quick_change_criteria: |
  以下情形均可走快速通道（缺一不可）：
  1. 改动范围 ≤ 3 个文件
  2. 不涉及新功能、架构调整、安全敏感逻辑
  3. Root cause 明确（bug 修复）或改动意图无歧义（文案/样式）
  适用类型：纯文案/翻译调整、CSS 样式修改（不改组件结构）、
            已知 bug 修复、文档更新。
  不适用：任何涉及数据流变更、新接口、外部调用、配置处理的改动。

rules:
  proposal:
    - 提案控制在 600 字以内。
    - 必须包含「非目标」章节，明确圈定边界。
    - 安全规则：禁止在任何工件中写入 Apollo 凭证、Token、密码或内部地址。
      只引用配置键名（如「从 Apollo sensitive-config 读取数据库连接」），不写实际值。

  specs:
    - Delta spec 须用「扩展/覆盖」语言引用 system.md 中已有基线，不重复陈述。

  design:
    - |
      关卡：在撰写 design.md 正文前，必须调用 /plan-eng-review 审查提案。
      将审查结果记录在 design.md 最顶部，格式如下：

        ## 关卡：工程审查
        状态：通过 | 仅警告 | 阻断
        审查者：gstack/plan-eng-review
        问题清单：<逐条列出，或填「无」>

      若状态为「阻断」，立即停止，不得继续撰写 design.md 其余内容。
      告知用户修改提案后再继续。
    - |
      关卡（安全敏感变更）：若变更涉及认证鉴权、外部 API 调用、凭证处理或
      部署配置，须额外调用 /cso，并追加记录：

        ## 关卡：安全审查
        状态：通过 | 阻断
        审查者：gstack/cso
        问题清单：<逐条列出，或填「无」>

  tasks:
    - |
      关卡检查：读取 design.md 顶部的工程审查关卡，确认状态为「通过」或「仅警告」。
      若状态为「阻断」或关卡章节缺失，立即停止并输出：
      「阻断：设计关卡未通过，请先修改提案。」
    - 每个任务的实现工作量控制在 2–3 小时以内。
    - 每个任务须注明它实现的是哪个 spec 章节。
```

- [ ] **Step 3: 验证文件存在**

```bash
cat /Users/ryan/aiworkspace/agentic-workflow/templates/openspec/config-backend.yaml | head -5
```

预期输出：`schema: spec-driven`

- [ ] **Step 4: Commit**

```bash
cd /Users/ryan/aiworkspace/agentic-workflow
git add templates/openspec/config-backend.yaml
git commit -m "feat: add openspec config-backend.yaml template with GStack gate rules"
```

---

### Task 2: 创建 templates/openspec/config-frontend.yaml

**Files:**
- Create: `agentic-workflow/templates/openspec/config-frontend.yaml`

- [ ] **Step 1: 写入 config-frontend.yaml**

写入文件 `agentic-workflow/templates/openspec/config-frontend.yaml`，内容如下（在后端版基础上，design rules 增加 /plan-design-review 门控）：

```yaml
schema: spec-driven

context: |
  完整项目上下文见 openspec/specs/project.md。
  AI 在生成每个工件时须先读取该文件。

quick_change_criteria: |
  以下情形均可走快速通道（缺一不可）：
  1. 改动范围 ≤ 3 个文件
  2. 不涉及新功能、架构调整、安全敏感逻辑
  3. Root cause 明确（bug 修复）或改动意图无歧义（文案/样式）
  适用类型：纯文案/翻译调整、CSS 样式修改（不改组件结构）、
            已知 bug 修复、文档更新。
  不适用：任何涉及数据流变更、新接口、外部调用、配置处理的改动。

rules:
  proposal:
    - 提案控制在 600 字以内。
    - 必须包含「非目标」章节，明确圈定边界。
    - 安全规则：禁止在任何工件中写入 Token、密码或内部地址。
      只引用配置键名，不写实际值。

  specs:
    - Delta spec 须用「扩展/覆盖」语言引用 system.md 中已有基线，不重复陈述。

  design:
    - |
      关卡：在撰写 design.md 前，必须调用 /plan-eng-review。
      若变更包含 UI 组件，还须调用 /plan-design-review。
      将两个关卡结果均记录在 design.md 最顶部：

        ## 关卡：工程审查
        状态：通过 | 仅警告 | 阻断
        审查者：gstack/plan-eng-review
        问题清单：<逐条列出，或填「无」>

        ## 关卡：设计审查（仅 UI 变更）
        状态：通过 | 仅警告 | 阻断
        审查者：gstack/plan-design-review
        问题清单：<逐条列出，或填「无」>

      任意关卡状态为「阻断」则停止。

  tasks:
    - |
      关卡检查：读取 design.md 顶部的工程审查关卡，确认状态为「通过」或「仅警告」。
      若状态为「阻断」或关卡章节缺失，立即停止并输出：
      「阻断：设计关卡未通过，请先修改提案。」
    - 每个任务的实现工作量控制在 2–3 小时以内。
    - 每个任务须注明它实现的是哪个 spec 章节。
```

- [ ] **Step 2: Commit**

```bash
cd /Users/ryan/aiworkspace/agentic-workflow
git add templates/openspec/config-frontend.yaml
git commit -m "feat: add openspec config-frontend.yaml template with design review gate"
```

---

### Task 3: 创建 templates/claude/commands/wf.md

**Files:**
- Create: `agentic-workflow/templates/claude/commands/wf.md`

- [ ] **Step 1: 写入 wf.md**

写入文件 `agentic-workflow/templates/claude/commands/wf.md`：

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/ryan/aiworkspace/agentic-workflow
git add templates/claude/commands/wf.md
git commit -m "feat: add /wf 5-mode workflow dispatcher for Claude Code"
```

---

### Task 4: 创建 templates/claude/commands/openspec-quick.md

**Files:**
- Create: `agentic-workflow/templates/claude/commands/openspec-quick.md`

- [ ] **Step 1: 写入 openspec-quick.md**

写入文件 `agentic-workflow/templates/claude/commands/openspec-quick.md`：

```markdown
---
description: 快速通道变更：跳过 design gate，直接生成 proposal + tasks。
  适用于文案调整、样式修改、明确 bug 修复（≤3 文件，无架构/安全影响）。
---

快速通道变更。

首先确认此变更符合 openspec/config.yaml 中 quick_change_criteria 定义的全部条件：
改动范围 ≤ 3 个文件、不涉及新功能/架构/安全敏感逻辑、意图无歧义。

若不符合，告知用户改用 /openspec-propose 走完整通道。

若符合，执行以下步骤：
1. 从用户输入派生 kebab-case 变更名（加 `quick-` 前缀，例如 `quick-fix-date-format`）
2. 运行 `openspec new change "<name>"`
3. 运行 `openspec instructions proposal --change "<name>" --json`，生成 proposal.md
4. 跳过 design.md（快速通道不生成此工件，不运行任何 gate）
5. 运行 `openspec instructions tasks --change "<name>" --json`，生成 tasks.md
6. 展示最终状态，提示用户运行 /openspec-apply-change 开始实现
```

- [ ] **Step 2: Commit**

```bash
cd /Users/ryan/aiworkspace/agentic-workflow
git add templates/claude/commands/openspec-quick.md
git commit -m "feat: add /openspec-quick fast-track command for Claude Code"
```

---

### Task 5: 创建 templates/codex/skills/wf/SKILL.md

**Files:**
- Create: `agentic-workflow/templates/codex/skills/wf/SKILL.md`

- [ ] **Step 1: 写入 wf SKILL.md**

写入文件 `agentic-workflow/templates/codex/skills/wf/SKILL.md`：

```yaml
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
```

- [ ] **Step 2: Commit**

```bash
cd /Users/ryan/aiworkspace/agentic-workflow
git add templates/codex/skills/wf/
git commit -m "feat: add /wf 5-mode workflow dispatcher for Codex"
```

---

### Task 6: 创建 templates/codex/skills/openspec-quick/SKILL.md

**Files:**
- Create: `agentic-workflow/templates/codex/skills/openspec-quick/SKILL.md`

- [ ] **Step 1: 写入 openspec-quick SKILL.md**

写入文件 `agentic-workflow/templates/codex/skills/openspec-quick/SKILL.md`：

```yaml
---
name: openspec-quick
description: |
  快速通道变更：跳过 design gate，直接生成 proposal + tasks。
  适用于文案调整、样式修改、明确 bug 修复（≤3 文件，无架构/安全影响）。
  触发词：快速修复、quick fix、小改动、quick。
---

快速通道变更。

首先确认此变更符合 openspec/config.yaml 中 quick_change_criteria 定义的全部条件：
改动范围 ≤ 3 个文件、不涉及新功能/架构/安全敏感逻辑、意图无歧义。

若不符合，告知用户改用 /openspec-propose 走完整通道。

若符合，执行以下步骤：
1. 从用户输入派生 kebab-case 变更名（加 `quick-` 前缀，例如 `quick-fix-date-format`）
2. 运行 `openspec new change "<name>"`
3. 运行 `openspec instructions proposal --change "<name>" --json`，生成 proposal.md
4. 跳过 design.md（快速通道不生成此工件，不运行任何 gate）
5. 运行 `openspec instructions tasks --change "<name>" --json`，生成 tasks.md
6. 展示最终状态，提示用户运行 /openspec-apply-change 开始实现
```

- [ ] **Step 2: Commit**

```bash
cd /Users/ryan/aiworkspace/agentic-workflow
git add templates/codex/skills/openspec-quick/
git commit -m "feat: add openspec-quick fast-track skill for Codex"
```

---

### Task 7: 移植 gstack-plan-eng-review → Codex SKILL.md

**Files:**
- Read: `~/.gstack/repos/gstack/.hermes/skills/gstack-plan-eng-review/SKILL.md` (lines 793–1656)
- Create: `agentic-workflow/templates/codex/skills/gstack-plan-eng-review/SKILL.md`

**移植策略：** 剥除 bash preamble（原文件前 792 行），保留审查逻辑正文（第 793 行起），添加中文 SKILL 头部。同时剥除以下 GStack 专属调用：gstack-config、gstack-learnings-search、gstack-slug 等 bash 命令（改为在同等位置写入说明文字），以及文末的 Telemetry section（若存在）。

- [ ] **Step 1: 读取 GStack 源文件审查逻辑部分**

读取文件 `~/.gstack/repos/gstack/.hermes/skills/gstack-plan-eng-review/SKILL.md`，起始行 793，读到文件末尾。

- [ ] **Step 2: 写入移植后的 SKILL.md**

写入文件 `agentic-workflow/templates/codex/skills/gstack-plan-eng-review/SKILL.md`。

文件结构：

```
[新中文头部] + [GStack 源文件第 793 行到末尾的内容，按以下规则处理]
```

**新头部（放在文件最顶部）：**

```yaml
---
name: gstack-plan-eng-review
description: |
  工程审查：以工程经理视角审查 OpenSpec proposal/design，
  覆盖架构、数据流、边界条件、测试覆盖、性能。
  在 openspec/config.yaml 的 design gate 中被调用。
  审查结果须写入 design.md 顶部关卡章节，格式：
    ## 关卡：工程审查
    状态：通过 | 仅警告 | 阻断
    审查者：gstack/plan-eng-review
    问题清单：<逐条列出，或填「无」>
  触发词：技术审查、工程审查、架构审查。
移植说明: 从 GStack gstack-plan-eng-review 移植，去除 bash preamble 和遥测。
移植日期: 2026-05-19
---

> 注意：本 skill 是从 GStack 工程审查 skill 移植的 Codex 版本。
> bash 环境检查、gstack 遥测等已剥除。审查逻辑与 GStack 原版对等。
> 需要完整 GStack 体验（含 office-hours、设计 mockup 等），请切换到 Claude Code。
```

**正文处理规则（应用于 GStack 源文件 793 行至末尾）：**

1. 保留所有审查维度、评分逻辑、AskUserQuestion 调用格式
2. 保留 `[BLOCKED]` / `[WARN]` / `[APPROVED]` 标记约定
3. 保留 Confidence Calibration 和 Finding format
4. **剥除**以下 bash 块（用注释替代）：
   - Design Doc Check（`ls -t ~/.gstack/projects/...` 系列）→ 替换为：「检查当前目录的 openspec/changes/ 下是否有相关 proposal.md 或 design.md，作为审查输入。」
   - Prior Learnings（`gstack-learnings-search`）→ 替换为：「（跳过：gstack-learnings 在 Codex 中不可用）」
   - Test Plan Artifact（`gstack-slug`、写入 `~/.gstack/projects/`）→ 替换为：「将测试计划概要写入当前变更的 design.md 底部。」
   - Telemetry（若文件末尾存在）→ 完全删除
5. **保留**所有其他 bash 块（文件检测、git 命令等），因为 Codex 支持 bash 执行

- [ ] **Step 3: 验证文件存在且非空**

```bash
wc -l /Users/ryan/aiworkspace/agentic-workflow/templates/codex/skills/gstack-plan-eng-review/SKILL.md
```

预期输出：行数 > 500（原文件去除 preamble 后仍有大量审查逻辑）

- [ ] **Step 4: Commit**

```bash
cd /Users/ryan/aiworkspace/agentic-workflow
git add templates/codex/skills/gstack-plan-eng-review/
git commit -m "feat: port gstack-plan-eng-review to Codex skill format (strip preamble, keep review logic)"
```

---

### Task 8: 移植 gstack-cso → Codex SKILL.md

**Files:**
- Read: `~/.gstack/repos/gstack/.hermes/skills/gstack-cso/SKILL.md` (lines 779–1480)
- Create: `agentic-workflow/templates/codex/skills/gstack-cso/SKILL.md`

**移植策略：** 同 Task 7。去除 preamble（前 778 行），保留安全审查逻辑（第 779 行起的 `## User-invocable` 开始）。

- [ ] **Step 1: 读取 GStack 源文件审查逻辑部分**

读取文件 `~/.gstack/repos/gstack/.hermes/skills/gstack-cso/SKILL.md`，起始行 779，读到文件末尾。

- [ ] **Step 2: 写入移植后的 SKILL.md**

写入文件 `agentic-workflow/templates/codex/skills/gstack-cso/SKILL.md`。

**新头部：**

```yaml
---
name: gstack-cso
description: |
  安全审查：全面安全审计，覆盖 OWASP Top 10、密钥泄露、依赖供应链、
  CI/CD 管道、LLM 安全等。在 openspec/config.yaml 安全敏感变更 gate 中调用。
  审查结果须写入 design.md 顶部关卡章节，格式：
    ## 关卡：安全审查
    状态：通过 | 阻断
    审查者：gstack/cso
    问题清单：<逐条列出，或填「无」>
  触发词：安全审查、security review、cso。
移植说明: 从 GStack gstack-cso 移植，去除 bash preamble 和遥测。
移植日期: 2026-05-19
---

> 注意：本 skill 是从 GStack CSO（Chief Security Officer）审查 skill 移植的 Codex 版本。
> bash 环境检查、gstack 遥测等已剥除。安全审查逻辑（14 个 Phase）与 GStack 原版对等。
```

**正文处理规则（应用于源文件 779 行至末尾）：**

1. 保留所有 14 个审查 Phase（Phases 0-14）
2. 保留所有 bash 搜索命令（git log、grep 等）
3. 保留严重性评级、FP 规则、Finding 格式
4. 保留所有 Mode 参数解析逻辑
5. **剥除**：Prior Learnings 中的 `gstack-learnings-search` bash 块 → 替换为「（跳过：gstack-learnings 在 Codex 中不可用）」
6. **剥除**：文末 Telemetry section（若存在）
7. **保留**：`## Important: Use the Grep tool for all code searches`（重要指令）

- [ ] **Step 3: Commit**

```bash
cd /Users/ryan/aiworkspace/agentic-workflow
git add templates/codex/skills/gstack-cso/
git commit -m "feat: port gstack-cso security audit skill to Codex format"
```

---

### Task 9: 移植 gstack-review → Codex SKILL.md

**Files:**
- Read: `~/.gstack/repos/gstack/.hermes/skills/gstack-review/SKILL.md` (lines 771–1422)
- Create: `agentic-workflow/templates/codex/skills/gstack-review/SKILL.md`

**移植策略：** 去除 preamble（前 770 行），保留代码审查逻辑（第 771 行起的 `## Step 0: Detect platform and base branch`）。

- [ ] **Step 1: 读取 GStack 源文件审查逻辑部分**

读取文件 `~/.gstack/repos/gstack/.hermes/skills/gstack-review/SKILL.md`，起始行 771，读到文件末尾。

- [ ] **Step 2: 写入移植后的 SKILL.md**

写入文件 `agentic-workflow/templates/codex/skills/gstack-review/SKILL.md`。

**新头部：**

```yaml
---
name: gstack-review
description: |
  代码审查：以资深工程师视角审查 apply 完成后的代码变更，
  覆盖范围漂移、计划完成度、代码质量、测试覆盖。
  在 /openspec-apply-change 完成后调用。
  触发词：代码审查、review、code review。
移植说明: 从 GStack gstack-review 移植，去除 bash preamble 和遥测。
移植日期: 2026-05-19
---

> 注意：本 skill 是从 GStack Pre-Landing PR Review skill 移植的 Codex 版本。
> bash 环境检查、gstack 遥测等已剥除。代码审查逻辑与 GStack 原版对等。
```

**正文处理规则（应用于源文件 771 行至末尾）：**

1. 保留所有 Step（Step 0 到末尾），包括：
   - Step 0: Detect platform and base branch
   - Step 1: Check branch
   - Step 1.5: Scope Drift Detection
   - Plan File Discovery
   - Actionable Item Extraction
   - Verification Mode
   - Cross-Reference Against Diff
   - Output Format
2. 保留所有 git 命令和 bash 块
3. **剥除**：Prior Learnings 中的 `gstack-learnings-search` → 替换为「（跳过：gstack-learnings 在 Codex 中不可用）」
4. **剥除**：文末 Telemetry（若存在）
5. **注意**：Plan file discovery 中的 `~/.gstack/projects/` 路径 → 替换为 `openspec/changes/` 目录搜索

- [ ] **Step 3: Commit**

```bash
cd /Users/ryan/aiworkspace/agentic-workflow
git add templates/codex/skills/gstack-review/
git commit -m "feat: port gstack-review code review skill to Codex format"
```

---

### Task 10: 移植 gstack-plan-design-review → Codex SKILL.md

**Files:**
- Read: `~/.gstack/repos/gstack/.hermes/skills/gstack-plan-design-review/SKILL.md` (lines 820–1844)
- Create: `agentic-workflow/templates/codex/skills/gstack-plan-design-review/SKILL.md`

**移植策略：** 去除 preamble（前 819 行），保留设计审查逻辑（第 820 行起的 `## Design Philosophy`）。注意：此 skill 依赖 gstack designer（浏览器 mockup 生成工具），在 Codex 中不可用，需在头部注明此限制。

- [ ] **Step 1: 读取 GStack 源文件审查逻辑部分**

读取文件 `~/.gstack/repos/gstack/.hermes/skills/gstack-plan-design-review/SKILL.md`，起始行 820，读到文件末尾。

- [ ] **Step 2: 写入移植后的 SKILL.md**

写入文件 `agentic-workflow/templates/codex/skills/gstack-plan-design-review/SKILL.md`。

**新头部：**

```yaml
---
name: gstack-plan-design-review
description: |
  设计审查：以设计师视角审查 OpenSpec proposal/design 中的 UI/UX 决策，
  覆盖视觉层级、组件架构、响应式设计、可用性。前端项目专用。
  在 openspec/config.yaml 的 design gate（UI 变更时）中被调用。
  审查结果须写入 design.md 顶部关卡章节，格式：
    ## 关卡：设计审查（仅 UI 变更）
    状态：通过 | 仅警告 | 阻断
    审查者：gstack/plan-design-review
    问题清单：<逐条列出，或填「无」>
  触发词：设计审查、UI 审查、design review。
移植说明: 从 GStack gstack-plan-design-review 移植，去除 bash preamble 和遥测。
移植日期: 2026-05-19
---

> 注意：本 skill 是从 GStack Plan Design Review skill 移植的 Codex 版本。
> bash 环境检查、gstack 遥测等已剥除。
> **重要限制**：gstack designer（浏览器 mockup 生成器）在 Codex 中不可用。
> 在需要生成 mockup 的步骤中，改为输出 ASCII art 线框图作为替代。
> 如需完整 mockup 生成体验，切换到 Claude Code + GStack 执行。
```

**正文处理规则（应用于源文件 820 行至末尾）：**

1. 保留设计哲学、设计原则、认知模式、UX 原则等全部审查维度
2. 保留评分逻辑（0-10 分制）
3. 保留所有设计审查步骤
4. **修改**：所有 `generate`、`variants`、`compare`、`iterate`、`check`、`evolve` mockup 命令 → 改为「输出 ASCII art 线框图替代（gstack designer 在 Codex 中不可用）」
5. **剥除**：DESIGN SETUP section（gstack 浏览器工具依赖）→ 替换为「（跳过：gstack designer 不可用，改用 ASCII art）」
6. **剥除**：Prior Learnings 中的 `gstack-learnings-search` → 替换为「（跳过）」
7. **剥除**：文末 Telemetry（若存在）

- [ ] **Step 3: Commit**

```bash
cd /Users/ryan/aiworkspace/agentic-workflow
git add templates/codex/skills/gstack-plan-design-review/
git commit -m "feat: port gstack-plan-design-review UI review skill to Codex format"
```

---

### Task 11: 创建 agentic-workflow README.md

**Files:**
- Create: `agentic-workflow/README.md`

- [ ] **Step 1: 写入 README.md**

写入文件 `agentic-workflow/README.md`：

```markdown
# agentic-workflow

OpenSpec + GStack 工作流模板中心仓库。

所有工作流模板在此维护，各项目通过安装步骤获取。两个 CLI（Claude Code 和 Codex App）
通过同名 skill 实现审查对等，共享同一份 `openspec/` 工件目录。

## 模板列表

| 路径 | 用途 | 适用 |
|------|------|------|
| `templates/openspec/config-backend.yaml` | 后端项目 OpenSpec 配置，含 GStack gate | 所有后端项目 |
| `templates/openspec/config-frontend.yaml` | 前端项目 OpenSpec 配置，含设计 gate | 前端项目 |
| `templates/claude/commands/wf.md` | 5 模式工作流入口 | Claude Code |
| `templates/claude/commands/openspec-quick.md` | 快速通道变更 | Claude Code |
| `templates/codex/skills/wf/` | 5 模式工作流入口 | Codex App |
| `templates/codex/skills/openspec-quick/` | 快速通道变更 | Codex App |
| `templates/codex/skills/gstack-plan-eng-review/` | 工程审查（从 GStack 移植） | Codex App |
| `templates/codex/skills/gstack-cso/` | 安全审查（从 GStack 移植） | Codex App |
| `templates/codex/skills/gstack-review/` | 代码审查（从 GStack 移植） | Codex App |
| `templates/codex/skills/gstack-plan-design-review/` | 设计审查（从 GStack 移植） | Codex App，前端 |

## 安装（后端项目）

```bash
WORKFLOW=/Users/ryan/aiworkspace/agentic-workflow
PROJECT=/path/to/your/project
cd "$PROJECT"

# 1. 复制 OpenSpec 配置
cp "$WORKFLOW/templates/openspec/config-backend.yaml" openspec/config.yaml

# 2. 创建 specs 目录
mkdir -p openspec/specs

# 3. 安装 Claude 命令
mkdir -p .claude/commands
cp "$WORKFLOW/templates/claude/commands/wf.md" .claude/commands/
cp "$WORKFLOW/templates/claude/commands/openspec-quick.md" .claude/commands/

# 4. 安装 Codex skills
mkdir -p .codex/skills
cp -r "$WORKFLOW/templates/codex/skills/wf" .codex/skills/
cp -r "$WORKFLOW/templates/codex/skills/openspec-quick" .codex/skills/
cp -r "$WORKFLOW/templates/codex/skills/gstack-plan-eng-review" .codex/skills/
cp -r "$WORKFLOW/templates/codex/skills/gstack-cso" .codex/skills/
cp -r "$WORKFLOW/templates/codex/skills/gstack-review" .codex/skills/

# 5. 手动创建项目专属文件
# openspec/specs/project.md  ← 填入技术栈和约束（参考本仓库 docs/specs/ 下的示例）
# openspec/specs/system.md   ← 逆向提取系统级 baseline

# 6. 在 AGENTS.md 和 .claude/CLAUDE.md 末尾追加 workflow 段落（见 docs/templates/）
```

## 安装（前端项目差异）

```bash
# config 用前端版
cp "$WORKFLOW/templates/openspec/config-frontend.yaml" openspec/config.yaml

# 额外安装设计审查 skill
cp -r "$WORKFLOW/templates/codex/skills/gstack-plan-design-review" .codex/skills/
```

## 工作流模式

| # | 模式 | 工具链 | 触发场景 |
|---|------|--------|---------|
| 0 | ⚡ 快速通道 | openspec-quick（无 gate） | 文案/样式/明确 bug |
| 1 | 🔧 小需求 | OpenSpec → GStack gate | 新增指标、加字段 |
| 2 | 🏗️ 复杂后端 | Brainstorm → OpenSpec → GStack → Superpowers | 重构基类、新接口 |
| 3 | 🔍 Debug/重构/单测 | Superpowers 优先 | 找 bug、补单测 |
| 4 | 💡 产品/架构方案 | GStack office-hours + CEO review | 做不做、怎么设计 |

## Gate 机制

`openspec/config.yaml` 的 `rules:` 字段注入 gate 逻辑，AI 自我执行。
`design.md` 顶部工程审查状态为「阻断」时，不得生成 `tasks.md`。

## 维护说明

- GStack 持续更新，移植 skill 需定期手动 diff 更新（建议每季度一次）
- 移植 skill 头部注明移植日期，便于追踪漂移
```

- [ ] **Step 2: Commit**

```bash
cd /Users/ryan/aiworkspace/agentic-workflow
git add README.md
git commit -m "docs: add agentic-workflow README with installation guide"
```

---

### Task 12: 初始化 plutus-daliy-report 工作流文件

**Files:**
- Modify: `plutus-daliy-report/openspec/config.yaml` (replace content)
- Create: `plutus-daliy-report/.claude/commands/wf.md` (copy from template)
- Create: `plutus-daliy-report/.claude/commands/openspec-quick.md` (copy from template)
- Create: `plutus-daliy-report/.codex/skills/gstack-plan-eng-review/SKILL.md` (copy from template)
- Create: `plutus-daliy-report/.codex/skills/gstack-cso/SKILL.md` (copy from template)
- Create: `plutus-daliy-report/.codex/skills/gstack-review/SKILL.md` (copy from template)
- Create: `plutus-daliy-report/.codex/skills/openspec-quick/SKILL.md` (copy from template)

- [ ] **Step 1: 替换 openspec/config.yaml**

将 `plutus-daliy-report/openspec/config.yaml` 内容替换为 `agentic-workflow/templates/openspec/config-backend.yaml` 的内容。

注意：plutus-daliy-report 是 Vibe Coding / FC 部署项目，使用后端模板。

- [ ] **Step 2: 安装 Claude 命令**

```bash
WORKFLOW=/Users/ryan/aiworkspace/agentic-workflow
PROJECT=/Users/ryan/aiworkspace/plutus-daliy-report

cp "$WORKFLOW/templates/claude/commands/wf.md" "$PROJECT/.claude/commands/"
cp "$WORKFLOW/templates/claude/commands/openspec-quick.md" "$PROJECT/.claude/commands/"
```

预期：`.claude/commands/` 目录新增 `wf.md` 和 `openspec-quick.md`

- [ ] **Step 3: 安装 Codex GStack skills**

```bash
WORKFLOW=/Users/ryan/aiworkspace/agentic-workflow
PROJECT=/Users/ryan/aiworkspace/plutus-daliy-report

cp -r "$WORKFLOW/templates/codex/skills/gstack-plan-eng-review" "$PROJECT/.codex/skills/"
cp -r "$WORKFLOW/templates/codex/skills/gstack-cso" "$PROJECT/.codex/skills/"
cp -r "$WORKFLOW/templates/codex/skills/gstack-review" "$PROJECT/.codex/skills/"
cp -r "$WORKFLOW/templates/codex/skills/openspec-quick" "$PROJECT/.codex/skills/"
```

注意：`wf` skill 暂不复制到 plutus-daliy-report，因为该项目通过 AGENTS.md 说明而非额外 skill 入口（简化安装）。如需 `/wf` 命令在 Codex 中工作，可额外安装：
```bash
cp -r "$WORKFLOW/templates/codex/skills/wf" "$PROJECT/.codex/skills/"
```

- [ ] **Step 4: 验证安装结果**

```bash
ls /Users/ryan/aiworkspace/plutus-daliy-report/.claude/commands/
ls /Users/ryan/aiworkspace/plutus-daliy-report/.codex/skills/
```

预期输出：
```
# .claude/commands/:
opsx  openspec-quick.md  wf.md

# .codex/skills/:
gstack-cso  gstack-plan-eng-review  gstack-review  openspec-apply-change  openspec-archive-change  openspec-explore  openspec-propose  openspec-quick
```

- [ ] **Step 5: Commit plutus-daliy-report 工作流文件**

```bash
cd /Users/ryan/aiworkspace/plutus-daliy-report
git add openspec/config.yaml .claude/commands/wf.md .claude/commands/openspec-quick.md .codex/skills/
git commit -m "feat: install agentic-workflow templates (GStack skills + /wf + /openspec-quick)"
```

---

### Task 13: 创建 openspec/specs/system.md（plutus-daliy-report）

**Files:**
- Create: `plutus-daliy-report/openspec/specs/system.md`

从 AGENTS.md 和已知代码结构逆向提取系统级 baseline。

- [ ] **Step 1: 读取现有 AGENTS.md 获取上下文**

读取 `plutus-daliy-report/AGENTS.md` 全文，了解项目背景。

- [ ] **Step 2: 写入 system.md**

写入文件 `plutus-daliy-report/openspec/specs/system.md`：

```markdown
# plutus-daily-report — System Baseline

> 本文件是系统级 baseline spec，供 AI 生成 OpenSpec 工件时参考。
> Delta spec 应引用本文件中的已有基线，而非重复陈述。

## 部署目标

- **平台**：阿里云 Function Compute (FC)
- **运行时**：`custom.debian11`（非 Python 内置运行时）
- **Handler**：`app.main.handler`（Mangum → FastAPI）
- **打包**：`bash build.sh` → `plutus-daily-report.zip`（约 56MB，>50MB 须走 OSS 上传）

## 入口与模块结构

```
app/
├── main.py                         ← FastAPI app + Mangum handler，入口
├── service/
│   └── reports/
│       ├── new_site_base_report.py ← 多报表共用基类（高危：修改前必须确认影响范围）
│       ├── daily_new_site_zhaijies.py
│       ├── jianeizhu_v1.py
│       └── jiashifu_v1.py
├── dao/
│   ├── base.py                     ← BaseReport 基类（高危：同上）
│   └── sqls/
│       └── daily_new_site_report_company_sql.py  ← 多报表共用 SQL（高危）
```

## 数据流

```
HTTP 请求
  → Mangum（FC → ASGI 协议转换）
  → FastAPI 路由
  → Report Service（子类）
  → BaseReport（基类：数据拉取 + 指标计算）
  → MySQL via PyMySQL
  → HTML 渲染（含内联 echarts CDN）
  → 截图 API（HTTP POST，外部服务）
  → 返回报告
```

## 关键配置（仅引用键名，禁止写入实际值）

- **Apollo**：`http://meta.apollo.homeking365.com`，AppID `plutus`，Namespace `sensitive-config`
- **数据库**：MySQL，连接串来自 Apollo（Spring JDBC 格式，代码自动过滤 PyMySQL 不兼容参数）
- **截图 API**：`SCREENSHOT_API_URL`（FC 内网地址）、`SCREENSHOT_API_TOKEN`（Bearer Token）— 均通过 FC 环境变量注入，禁止硬编码

## 报表期间格式

| 类型 | 格式 | 示例 |
|------|------|------|
| 日报 | `YYYY-MM-DD` | `2026-05-19` |
| 月报 | `YYYY-MM` | `2026-05` |
| 周报 | `YYYY-Www` | `2026-W20` |

注意：`report_date` 类型在传递时须为 `str`（不是 `datetime.date`），否则聚合数据为 0。

## 已知约束与踩坑

1. **多报表基类共用**：`new_site_base_report.py`、`base.py`、共用 SQL — 修改前须确认影响范围，优先在子类中覆盖方法，不动基类。
2. **战区映射**：`dept_name` 是站点名，不是事业部名 — 须用 `lvl1_dept_name` fallback。
3. **JDBC URL 参数兼容**：代码已自动过滤 PyMySQL 不兼容参数，Delta spec 中不需重新处理。
4. **echarts CDN**：已改为本地内联，截图服务无法访问外网 CDN — Delta spec 中不使用外部 CDN 方案。
5. **re.sub 替换 echarts 代码**：必须用 lambda 作为 repl（防止 `\d` bad escape）。

## 安全约束（强制）

- Apollo 凭证（数据库密码、Token 等）：禁止写入任何 spec、design、commit
- 截图 API 凭证：通过 FC 环境变量注入，禁止硬编码
- openspec/ 目录须提交 git，禁止 .gitignore

## 参考文档

- `docs/deploy_to_fc.md` — FC 部署完整指南
- `docs/daily_new_site_report_company.md` — 报表数据口径
```

- [ ] **Step 2: Commit**

```bash
cd /Users/ryan/aiworkspace/plutus-daliy-report
git add openspec/specs/system.md
git commit -m "feat: add openspec/specs/system.md baseline from reverse-engineering"
```

---

### Task 14: 创建 openspec/specs/project.md（plutus-daliy-report）

**Files:**
- Create: `plutus-daliy-report/openspec/specs/project.md`

- [ ] **Step 1: 写入 project.md**

写入文件 `plutus-daliy-report/openspec/specs/project.md`：

```markdown
# plutus-daily-report — Project Context

> 本文件是项目级上下文，供 AI 生成 OpenSpec 工件时参考技术栈、约束和风格决策。

## 项目定位

自动化日报生成系统：每天从 MySQL 拉取多品牌销售数据，渲染 HTML 报表，截图，发送微信群。

## 技术栈

| 层次 | 技术 |
|------|------|
| 部署 | 阿里云 FC，custom.debian11 runtime |
| 框架 | FastAPI + Mangum（FC ↔ ASGI 桥接） |
| 数据库 | MySQL via PyMySQL |
| 配置中心 | Apollo（AppID: plutus，Namespace: sensitive-config） |
| 渲染 | Python 模板 + 内联 echarts（本地 CDN） |
| 截图 | 外部截图 API（HTTP POST） |
| 打包 | bash build.sh → zip → OSS |

## 报表角色矩阵

| 报表 | 品牌 | 基类 |
|------|------|------|
| daily_new_site_zhaijies | 宅捷斯 | NewSiteBaseReport |
| jianeizhu_v1 | 家内住 | NewSiteBaseReport |
| jiashifu_v1 | 甲市府 | NewSiteBaseReport |

## 开发约定

1. **基类优先原则**：公共逻辑在基类中实现，差异在子类中覆盖（不改基类）
2. **子类覆盖优先**：若改动只对某品牌有意义，在子类中 `override` 对应方法
3. **SQL 复用**：`daily_new_site_report_company_sql.py` 中的 SQL 被多报表共用
4. **期间格式一致性**：参见 system.md 的期间格式规范

## 安全规则（所有 spec/design/task 工件均适用）

- **禁止**：写入 Apollo 凭证、数据库密码、Token、内部 URL 实际值
- **允许**：引用配置键名（如「从 Apollo sensitive-config 读取 DB 连接字符串」）
- **禁止**：openspec/ 目录加入 .gitignore
- **FC 环境变量**：截图 API 凭证通过 FC 控制台配置，任何 spec 不记录实际值

## 工作流角色（plutus-daliy-report 采用 3 个审查角色）

| 角色 | Skill | 介入阶段 | 核心价值 |
|------|-------|---------|---------|
| 工程经理 | `/plan-eng-review` | design gate（必须） | FC 约束、基类影响范围 |
| 安全官 | `/cso` | design gate（安全敏感变更） | Apollo 凭证规范、FC 环境变量安全 |
| 代码审查 | `/review` | apply 完成后 | 防止 vibe coding 积累技术债 |
```

- [ ] **Step 2: Commit**

```bash
cd /Users/ryan/aiworkspace/plutus-daliy-report
git add openspec/specs/project.md
git commit -m "feat: add openspec/specs/project.md with tech stack and security constraints"
```

---

### Task 15: 更新 AGENTS.md 和创建 CLAUDE.md（plutus-daliy-report）

**Files:**
- Modify: `plutus-daliy-report/AGENTS.md` (append workflow section)
- Create: `plutus-daliy-report/.claude/CLAUDE.md`

- [ ] **Step 1: 读取当前 AGENTS.md**

读取 `plutus-daliy-report/AGENTS.md` 确认末尾内容，避免重复追加。

- [ ] **Step 2: 追加 workflow 段落到 AGENTS.md**

在 `plutus-daliy-report/AGENTS.md` 末尾追加以下内容：

```markdown

## OpenSpec + GStack 工作流

所有功能变更通过 OpenSpec 状态机管理。禁止直接修改代码而不经过 propose 阶段。

### 工作流命令
- `/openspec-propose` — 发起新变更（完整通道）
- `/openspec-quick` — 快速通道（文案/样式/明确 bug，跳过 design gate）
- `/openspec-apply-change` — 实现代码
- `/openspec-archive-change` — 归档变更
- `/openspec-explore` — 探索思考

### GStack 审查 Skill（由 openspec/config.yaml rules 驱动）
- `/gstack-plan-eng-review` — 工程审查（完整通道必须）
- `/gstack-cso` — 安全审查（涉及配置/凭证时必须）
- `/gstack-review` — 代码审查（apply 后运行）

### Gate 规则
见 openspec/config.yaml。design.md 顶部工程审查状态为「阻断」时，
不得生成 tasks.md，须先修改 proposal。
```

- [ ] **Step 3: 创建 .claude/CLAUDE.md**

写入文件 `plutus-daliy-report/.claude/CLAUDE.md`：

```markdown
# CLAUDE.md — plutus-daily-report

Claude Code 专用说明（补充 AGENTS.md）。

## OpenSpec + GStack 工作流

所有功能变更通过 OpenSpec 状态机管理。禁止直接修改代码而不经过 propose 阶段。

### 工作流命令
- `/openspec-propose` — 发起新变更（完整通道：proposal + design gate + tasks）
- `/openspec-quick` — 快速通道（跳过 design gate，仅生成 proposal + tasks）
- `/openspec-apply-change` — 执行 tasks 实现代码
- `/openspec-archive-change` — 归档变更，合并 delta spec 回主 spec
- `/openspec-explore` — 探索阶段，思考清楚再 propose

### GStack 审查 Skill（design gate 中由 config.yaml rules 驱动）
- `/plan-eng-review` — 工程审查（所有完整通道变更必须）
- `/cso` — 安全审查（涉及配置/凭证/外部调用时必须）
- `/review` — 代码审查（apply 完成后运行）

### 工作流入口
- `/wf` — 统一入口，选择模式（Mode 0-4）自动路由到对应工具链

### Gate 规则
见 openspec/config.yaml。design.md 顶部工程审查状态为「阻断」时，
不得生成 tasks.md，须先修改 proposal。

## 安全规则

- 禁止在任何工件或代码中写入 Apollo 凭证、数据库密码、Token 实际值
- 截图 API 凭证通过 FC 环境变量注入，禁止硬编码
- openspec/ 目录须提交 git，禁止 .gitignore
```

- [ ] **Step 4: Commit**

```bash
cd /Users/ryan/aiworkspace/plutus-daliy-report
git add AGENTS.md .claude/CLAUDE.md
git commit -m "feat: add workflow instructions to AGENTS.md and create .claude/CLAUDE.md"
```

---

### Task 16: 自我验证（Spec Coverage Check）

- [ ] **Step 1: 验证 agentic-workflow 模板完整性**

```bash
find /Users/ryan/aiworkspace/agentic-workflow/templates -type f | sort
```

预期输出（11 个文件）：
```
templates/claude/commands/openspec-quick.md
templates/claude/commands/wf.md
templates/codex/skills/gstack-cso/SKILL.md
templates/codex/skills/gstack-plan-design-review/SKILL.md
templates/codex/skills/gstack-plan-eng-review/SKILL.md
templates/codex/skills/gstack-review/SKILL.md
templates/codex/skills/openspec-quick/SKILL.md
templates/codex/skills/wf/SKILL.md
templates/openspec/config-backend.yaml
templates/openspec/config-frontend.yaml
```

- [ ] **Step 2: 验证 plutus-daliy-report 工作流文件**

```bash
ls /Users/ryan/aiworkspace/plutus-daliy-report/.claude/commands/
ls /Users/ryan/aiworkspace/plutus-daliy-report/.codex/skills/
ls /Users/ryan/aiworkspace/plutus-daliy-report/openspec/specs/
```

预期：
- `.claude/commands/`: `opsx  openspec-quick.md  wf.md`
- `.codex/skills/`: 8 个 skills（4 个原有 + 4 个新安装）
- `openspec/specs/`: `project.md  system.md`

- [ ] **Step 3: 验证 gate 关键字完整性**

```bash
grep -c "阻断" /Users/ryan/aiworkspace/plutus-daliy-report/openspec/config.yaml
```

预期输出：>= 2（两处 gate 检查都包含「阻断」关键字）

- [ ] **Step 4: 验证安全规则存在**

```bash
grep -l "Apollo" /Users/ryan/aiworkspace/plutus-daliy-report/openspec/config.yaml
grep -l "Apollo" /Users/ryan/aiworkspace/plutus-daliy-report/openspec/specs/project.md
```

预期：两个文件都找到匹配（安全规则已写入）

---

## 执行顺序说明

Tasks 1-6 可并行（均为 agentic-workflow 模板创建，互不依赖）。
Tasks 7-10 需先读取 GStack 源文件（串行或并行均可，彼此独立）。
Task 11 依赖 Tasks 1-10 完成（需要模板文件清单已确定）。
Task 12 依赖 Tasks 1-10 完成（需要模板文件）。
Tasks 13-14 独立，仅依赖读取 AGENTS.md（Task 12 之前或之后均可）。
Task 15 依赖 Tasks 12-14（需要 spec 文件先存在）。
Task 16 依赖所有前置 Tasks。
