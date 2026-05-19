# arkan-workflow

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
WORKFLOW=/Users/ryan/aiworkspace/arkan-workflow
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
# openspec/specs/project.md  ← 填入技术栈和约束
# openspec/specs/system.md   ← 逆向提取系统级 baseline

# 6. 在 AGENTS.md 和 .claude/CLAUDE.md 末尾追加 workflow 段落
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
