# 设计文档：OpenSpec + GStack 工作流落地方案（双生态版）

**日期**：2026-05-19  
**状态**：已审批，待实施  
**仓库**：`/Users/ryan/aiworkspace/arkan-workflow`（工作流模板中心仓库）  
**适用项目**：plutus-daily-report（主示例）；threea-cup、fe-backend-mobius 同理适用  

---

## 一、总体架构

### 核心原则

`openspec/` 目录是两个 CLI 的共享状态；gate 逻辑住在 `openspec/config.yaml` 的 `rules:`；两个 CLI 通过名称相同的 skill 实现审查对等。人在两个 CLI 之间切换时，只切换工具，不切换工件。

`arkan-workflow` 是所有工作流文件的**唯一来源（source of truth）**。Codex skill 模板、Claude 命令模板、openspec 配置模板全部维护在此处，各项目通过安装步骤从这里获取。

### 三层结构

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: 工件层（两个 CLI 完全共享，位于各项目中）       │
│                                                     │
│  <project>/openspec/                                │
│  ├── config.yaml   ← GStack gate 规则（从模板安装）   │
│  ├── specs/        ← baseline + delta specs         │
│  └── changes/      ← 每次变更的工件                  │
└─────────────────────────────────────────────────────┘
┌──────────────────────┐  ┌──────────────────────────┐
│  Layer 2A:           │  │  Layer 2B:               │
│  Claude Code 工具层   │  │  Codex 工具层             │
│                      │  │                          │
│  ~/.claude/skills/   │  │  <project>/.codex/skills/ │
│  gstack/             │  │  gstack-plan-eng-review/  │
│  (原生 GStack 全套)   │  │  gstack-cso/             │
│                      │  │  gstack-review/          │
│                      │  │  openspec-*/（已有）      │
└──────────────────────┘  └──────────────────────────┘
┌──────────────────────┐  ┌──────────────────────────┐
│  Layer 3A:           │  │  Layer 3B:               │
│  CC 入口             │  │  Codex 入口              │
│                      │  │                          │
│  CLAUDE.md 中的      │  │  AGENTS.md 中的           │
│  workflow 说明       │  │  workflow 说明            │
└──────────────────────┘  └──────────────────────────┘
        ↑                          ↑
        └──────────────────────────┘
          模板均来自 arkan-workflow/templates/
```

### 工作流状态机

**完整通道**（新功能 / 架构变更 / 跨模块改动）：

```
propose → [工程审查 gate] → design → [确认通过] → tasks → apply → archive
```

**快速通道**（文案 / 样式 / 明确 bug 修复）：

```
/openspec-quick → tasks → apply → archive
（跳过 design.md，跳过所有 gate）
```

### Gate 判定条件

| 阶段 | 必须运行的 skill | 通过条件 | 阻断条件 |
|------|----------------|---------|---------|
| `proposal → design` | `/plan-eng-review` | 无 `[BLOCKED]` 标记 | 任意 `[BLOCKED]` |
| `design → tasks` | 确认 design.md 顶部关卡结果 | 状态为「通过」或「仅警告」 | 状态缺失或「阻断」 |
| 安全敏感变更 | 额外运行 `/cso` | 无高危漏洞 | 密钥泄露或高危漏洞 |

---

## 二、文件树

### arkan-workflow（模板中心仓库）

```
/Users/ryan/aiworkspace/arkan-workflow/
├── docs/
│   └── specs/
│       └── 2026-05-19-openspec-gstack-workflow-design.md  ← 本文件
├── templates/
│   ├── openspec/
│   │   ├── config-backend.yaml          ← 后端项目 openspec/config.yaml 模板
│   │   └── config-frontend.yaml         ← 前端项目 openspec/config.yaml 模板
│   ├── claude/
│   │   └── commands/
│   │       └── openspec-quick.md        ← Claude Code 快速通道命令模板
│   └── codex/
│       └── skills/
│           ├── gstack-plan-eng-review/
│           │   └── SKILL.md             ← 从 GStack 移植，剥除 preamble
│           ├── gstack-plan-design-review/
│           │   └── SKILL.md             ← 前端项目专用
│           ├── gstack-cso/
│           │   └── SKILL.md
│           ├── gstack-review/
│           │   └── SKILL.md
│           └── openspec-quick/
│               └── SKILL.md             ← Codex 快速通道 skill 模板
└── README.md                            ← 安装说明
```

### 各项目结构（以 plutus-daily-report 为例）

```
/Users/ryan/aiworkspace/plutus-daliy-report/
├── openspec/                              ← 两个 CLI 共享，只此一份
│   ├── config.yaml                        ← 从 arkan-workflow/templates/openspec/config-backend.yaml 安装
│   ├── specs/
│   │   ├── system.md                      ← 项目专属：逆向提取的系统级 baseline
│   │   └── project.md                     ← 项目专属：技术栈、约束、安全规定
│   └── changes/
│       └── <change-id>/                   ← openspec new change 自动生成
│           ├── proposal.md
│           ├── design.md                  ← gate 结果记录在此顶部
│           └── tasks.md
├── .claude/
│   ├── CLAUDE.md                          ← 追加 workflow 段落
│   └── commands/
│       └── openspec-quick.md              ← 从 arkan-workflow/templates/claude/commands/ 安装
├── .codex/
│   └── skills/
│       ├── openspec-propose/              ← 已有
│       ├── openspec-apply-change/         ← 已有
│       ├── openspec-archive-change/       ← 已有
│       ├── openspec-explore/              ← 已有
│       ├── gstack-plan-eng-review/        ← 从 arkan-workflow/templates/codex/skills/ 安装
│       ├── gstack-cso/                    ← 从 arkan-workflow/templates/codex/skills/ 安装
│       ├── gstack-review/                 ← 从 arkan-workflow/templates/codex/skills/ 安装
│       └── openspec-quick/                ← 从 arkan-workflow/templates/codex/skills/ 安装
└── AGENTS.md                              ← 追加 workflow 段落（两个 CLI 共读）
```

---

## 三、模板文件内容

### `templates/openspec/config-backend.yaml`

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

### `templates/openspec/config-frontend.yaml`

在后端版基础上，`rules.design` 关卡部分替换为：

```yaml
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
```

### `templates/claude/commands/openspec-quick.md`

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

### `templates/codex/skills/openspec-quick/SKILL.md`

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

---

## 四、Codex GStack Skill 移植策略

### 移植原则

| 内容 | 处理方式 |
|------|---------|
| GStack preamble（bash 环境检查、遥测、升级检查） | 完全剥除，替换为简短中文头部说明 |
| 审查维度与评分逻辑 | 完整保留 |
| `[BLOCKED]` / `[WARN]` / `[APPROVED]` 标记约定 | 完整保留，与 config.yaml rules 对齐 |
| GStack 专属工具调用（gbrain、gstack-config） | 剥除 |
| 审查结果写入 design.md 的格式 | 保留并与 config.yaml 格式对齐 |

### 需要移植的 Skill

| GStack 源路径 | arkan-workflow 模板路径 | 适用场景 |
|--------------|----------------------|---------|
| `~/.gstack/repos/gstack/.hermes/skills/gstack-plan-eng-review/SKILL.md` | `templates/codex/skills/gstack-plan-eng-review/SKILL.md` | 所有项目，design gate 主审查 |
| `~/.gstack/repos/gstack/.hermes/skills/gstack-plan-design-review/SKILL.md` | `templates/codex/skills/gstack-plan-design-review/SKILL.md` | 前端项目，UI 变更审查 |
| `~/.gstack/repos/gstack/.hermes/skills/gstack-cso/SKILL.md` | `templates/codex/skills/gstack-cso/SKILL.md` | 安全敏感变更 |
| `~/.gstack/repos/gstack/.hermes/skills/gstack-review/SKILL.md` | `templates/codex/skills/gstack-review/SKILL.md` | apply 完成后代码 review |

### 移植后 SKILL.md 头部格式（以 plan-eng-review 为例）

```yaml
---
name: gstack-plan-eng-review
description: |
  工程审查：以工程经理视角审查 OpenSpec proposal/design，
  覆盖架构、数据流、边界条件、测试覆盖、性能。
  在 openspec/config.yaml 的 design gate 中被调用。
  审查结果须写入 design.md 顶部关卡章节。
  触发词：技术审查、工程审查、架构审查。
---
```

之后直接接 GStack 原有审查逻辑正文（无 bash preamble）。

---

## 五、角色裁剪建议

### 后端 Java 业务系统（threea-cup 类）— 4 个角色

| 角色 | Skill | 介入阶段 | 价值 |
|------|-------|---------|------|
| 工程经理 | `/plan-eng-review` | design gate（必须） | Dubbo 接口设计、MyBatis 查询边界、事务范围 |
| 产品负责人 | `/plan-ceo-review` | design gate（大需求） | 功能是否值得做、scope 是否合理 |
| 安全官 | `/cso` | design gate（安全敏感） | SQL 注入、接口鉴权、凭证处理 |
| 代码审查 | `/review` | apply 完成后 | 落地代码质量 |

### 前端 Web（fe-backend-mobius 类）— 4 个角色

| 角色 | Skill | 介入阶段 | 价值 |
|------|-------|---------|------|
| 工程经理 | `/plan-eng-review` | design gate（必须） | 组件架构、状态管理、bundle 体积 |
| 设计师 | `/plan-design-review` | design gate（UI 变更） | UI/UX 一致性、视觉层级 |
| 代码审查 | `/review` | apply 完成后 | 代码质量、可维护性 |
| QA | `/qa` | apply 完成后（有 staging URL） | 浏览器真实验证 |

### Vibe Coding / FC 部署（plutus-daily-report 类）— 3 个角色

| 角色 | Skill | 介入阶段 | 价值 |
|------|-------|---------|------|
| 工程经理 | `/plan-eng-review` | design gate（必须） | FC 部署约束、基类影响范围 |
| 安全官 | `/cso` | design gate（每次） | Apollo 凭证不入代码、FC 环境变量规范 |
| 代码审查 | `/review` | apply 完成后 | 防止 vibe coding 积累技术债 |

### OpenSpec Profile

**推荐：`core`**。`rules:` 注入 gate 逻辑不需要改 artifact 模板；`custom` profile 维护成本不值得。

---

## 六、入口文件内容

### CLAUDE.md 追加段落

```markdown
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

### Gate 规则
见 openspec/config.yaml。design.md 顶部工程审查状态为「阻断」时，
不得生成 tasks.md，须先修改 proposal。
```

### AGENTS.md 追加段落（两个 CLI 共读）

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

---

## 七、初始化步骤

### arkan-workflow 安装脚本（一次性，各项目共用）

```bash
# 1. 进入目标项目
cd /Users/ryan/aiworkspace/plutus-daliy-report   # 或其他项目

# 2. 初始化 OpenSpec（--force 覆盖已有 config）
openspec init --tools claude,codex --profile core --force

# 3. 从 arkan-workflow 复制对应模板
WORKFLOW=/Users/ryan/aiworkspace/arkan-workflow

# openspec config（后端项目用 config-backend.yaml）
cp $WORKFLOW/templates/openspec/config-backend.yaml openspec/config.yaml

# Claude 快速通道命令
mkdir -p .claude/commands
cp $WORKFLOW/templates/claude/commands/openspec-quick.md .claude/commands/

# Codex GStack skills
mkdir -p .codex/skills
cp -r $WORKFLOW/templates/codex/skills/gstack-plan-eng-review .codex/skills/
cp -r $WORKFLOW/templates/codex/skills/gstack-cso .codex/skills/
cp -r $WORKFLOW/templates/codex/skills/gstack-review .codex/skills/
cp -r $WORKFLOW/templates/codex/skills/openspec-quick .codex/skills/

# 4. 手动创建项目专属文件（内容见第三节）
# openspec/specs/project.md  ← 填入本项目技术栈和约束
# openspec/specs/system.md   ← 逆向提取系统级 baseline

# 5. 在 CLAUDE.md 和 AGENTS.md 末尾追加 workflow 段落（内容见第六节）
```

### 前端项目差异

```bash
# config 用前端版
cp $WORKFLOW/templates/openspec/config-frontend.yaml openspec/config.yaml

# 额外安装设计审查 skill
cp -r $WORKFLOW/templates/codex/skills/gstack-plan-design-review .codex/skills/
```

---

## 八、完整使用示例（plutus-daily-report）

**场景**：周报新增「退款率」指标。

### 完整通道

```
/openspec-propose 周报新增退款率指标
```

1. AI 创建 `openspec/changes/add-refund-rate-metric/`，生成 `proposal.md`
2. 依据 config.yaml rules，自动调用 `/plan-eng-review`
3. 假设发现警告：「orders 表访问权限待确认」→ 状态「仅警告」→ gate 通过
4. `design.md` 顶部写入关卡结果，继续生成正文和 `tasks.md`
5. `/openspec-apply-change add-refund-rate-metric` 实现代码
6. `/review` 代码审查
7. `/openspec-archive-change add-refund-rate-metric` 归档

### 快速通道

```
/openspec-quick 修复 jiashifu 子报表战区映射 bug
```

AI 确认符合快速条件（已知 bug，≤1 文件，无架构影响），
创建 `quick-fix-jiashifu-zone-mapping/`，生成 proposal.md + tasks.md，跳过 gate。

### 切换 CLI 示范

同一项目，打开 Codex App，同样输入 `/openspec-propose`，
读取同一份 `openspec/config.yaml` 和 `specs/`，工件完全兼容。

---

## 九、两套方案对比小结

| 维度 | Claude Code 生态 | Codex 生态 |
|------|----------------|-----------|
| GStack 审查 | 原生 skill，全功能（含浏览器 QA、telemetry） | 移植 skill，审查逻辑完整，preamble 降级 |
| OpenSpec 集成 | 原生 skill（`.claude/skills/`） | 原生 skill（`.codex/skills/`，已有） |
| 快速通道 | `.claude/commands/openspec-quick.md` | `.codex/skills/openspec-quick/SKILL.md` |
| 共享工件 | `openspec/` 目录 | 同一份，无差异 |
| Gate 机制 | `openspec/config.yaml` rules | 同一份 config，名称对齐 |
| 模板来源 | `arkan-workflow/templates/` | 同上 |
| 维护点 | GStack 自动升级 | 移植 skill 需手动同步 GStack 更新 |
| 浏览器 QA | `/qa` 全功能 | 无浏览器，需补充 staging URL 测试 |

---

## 十、5 个高概率踩坑及预防

1. **快速通道被滥用**  
   AI 判断是否符合 quick_change_criteria 时可能偏宽松。预防：config.yaml 中判定条件写「缺一不可」，且在 AGENTS.md 中明确「涉及数据流/接口/配置一律走完整通道」。

2. **Codex 移植 skill 与 GStack 原版审查逻辑漂移**  
   GStack 持续更新，移植后的 Codex skill 会滞后。预防：移植时在 skill 头部注明源版本号和移植日期；每季度执行一次 diff 对比并更新 arkan-workflow 模板。

3. **design.md 关卡章节格式不统一**  
   AI 可能改变「通过 / 仅警告 / 阻断」措辞，导致 tasks gate check 读取失败。预防：config.yaml rules 中用精确格式示例，tasks rules 中明确「读取关键字为『阻断』」。

4. **brownfield 初始化时 system.md 遗漏关键约束**  
   逆向提取的 baseline 可能遗漏细节，导致后续 proposal 缺乏上下文。预防：初始化后用一个低风险小改动验证 AI 是否正确读取了 system.md 的约束（例如 /openspec-quick 改一个文案）。

5. **Apollo 凭证不小心进入 proposal.md**  
   rules 里的安全规定依赖 AI 遵守。预防：在 CI 中加 secret scanning（如 truffleHog），发现凭证字符串立即告警；openspec/ 目录须提交 git，不得 .gitignore。
