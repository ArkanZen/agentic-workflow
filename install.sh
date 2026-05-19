#!/usr/bin/env bash
# arkan-workflow/install.sh
# 交互式工作流安装脚本

set -euo pipefail

# ── 颜色 ──────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

ok()   { echo -e "  ${GREEN}✓${RESET} $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $*"; }
err()  { echo -e "  ${RED}✗${RESET}  $*" >&2; }
step() { echo -e "\n${BOLD}${BLUE}──${RESET} ${BOLD}$*${RESET}"; }
info() { echo -e "  ${CYAN}→${RESET} $*"; }

# ── 路径 ──────────────────────────────────────────────────────────────────────
WORKFLOW_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES="$WORKFLOW_DIR/templates"

# ── 参数解析 ──────────────────────────────────────────────────────────────────
NO_INTERACTIVE=false
SWITCH_MODE=false
ARG_TYPE=""
ARG_TARGET=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --type)           ARG_TYPE="$2";   shift 2 ;;
    --target)         ARG_TARGET="$2"; shift 2 ;;
    --no-interactive) NO_INTERACTIVE=true; shift ;;
    --switch)         SWITCH_MODE=true; shift ;;
    -*)               err "未知参数: $1"; exit 1 ;;
    *)                ARG_TARGET="$1"; shift ;;  # 位置参数：目标目录
  esac
done

# ── 工具函数 ──────────────────────────────────────────────────────────────────
ask() {
  local prompt="$1" default="$2" answer
  printf "  ${BOLD}%s${RESET} [%s]: " "$prompt" "$default" >/dev/tty
  read -r answer </dev/tty
  echo "${answer:-$default}"
}

ask_yn() {
  local prompt="$1" default="${2:-n}" answer
  local hint; [[ "$default" == "y" ]] && hint="Y/n" || hint="y/N"
  printf "  ${BOLD}%s${RESET} [%s]: " "$prompt" "$hint" >/dev/tty
  read -r answer </dev/tty
  answer="${answer:-$default}"
  [[ "$answer" =~ ^[Yy] ]]
}

ask_menu() {
  local prompt="$1"; shift
  local options=("$@") i
  for i in "${!options[@]}"; do
    echo -e "    $((i+1))) ${options[$i]}" >/dev/tty
  done
  local answer
  while true; do
    printf "  ${BOLD}%s${RESET} [1-%d]: " "$prompt" "${#options[@]}" >/dev/tty
    read -r answer </dev/tty
    answer="${answer:-1}"
    if [[ "$answer" =~ ^[0-9]+$ ]] && (( answer >= 1 && answer <= ${#options[@]} )); then
      echo "$answer"; return
    fi
    echo -e "  ${YELLOW}⚠${RESET}  请输入 1 到 ${#options[@]} 之间的数字" >/dev/tty
  done
}

# ── Banner ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}║   arkan-workflow 安装脚本                    ║${RESET}"
echo -e "${BOLD}${CYAN}║   OpenSpec + GStack 双生态工作流             ║${RESET}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════╝${RESET}"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# 第一步：目标项目目录
# ══════════════════════════════════════════════════════════════════════════════
step "目标项目"
if [[ -n "$ARG_TARGET" ]]; then
  TARGET_DIR="$(realpath "$ARG_TARGET")"
  info "目标目录: $TARGET_DIR"
else
  raw=$(ask "项目目录" "$PWD")
  TARGET_DIR="$(realpath "$raw")"
fi

if [[ ! -d "$TARGET_DIR" ]]; then
  err "目录不存在: $TARGET_DIR"
  exit 1
fi
ok "目标目录: $TARGET_DIR"

# ══════════════════════════════════════════════════════════════════════════════
# 第二步：硬环境检查（不通过则退出）
# ══════════════════════════════════════════════════════════════════════════════
step "环境检查（硬）"

# openspec CLI
if command -v openspec &>/dev/null; then
  ok "openspec CLI 已安装 ($(openspec --version 2>/dev/null || echo 'version unknown'))"
else
  err "openspec CLI 未安装"
  echo ""
  echo -e "  安装方法（选其一）:"
  echo -e "    npm install -g openspec"
  echo -e "    npx openspec@latest"
  echo ""
  echo -e "  安装后重新运行此脚本。"
  exit 1
fi

# Git 仓库
if git -C "$TARGET_DIR" rev-parse --git-dir &>/dev/null 2>&1; then
  ok "git 仓库已初始化"
else
  err "目标目录不是 git 仓库: $TARGET_DIR"
  echo ""
  echo -e "  openspec/ 目录需要提交 git 才能发挥完整作用。"
  echo -e "  请先运行: git init \"$TARGET_DIR\""
  exit 1
fi

# ── Switch 模式 ───────────────────────────────────────────────────────────────
# --switch 只替换 openspec/config.yaml，不做完整安装，安装后退出
if [[ "$SWITCH_MODE" == "true" ]]; then
  if [[ -z "$ARG_TYPE" ]]; then
    err "--switch 需要配合 --type <档位> 使用"
    exit 1
  fi
  # --switch 模式下若未通过参数指定目标目录，则交互询问（非交互模式默认 PWD）
  if [[ -z "$ARG_TARGET" ]] && [[ "$NO_INTERACTIVE" == "false" ]]; then
    raw=$(ask "目标项目目录" "$PWD")
    TARGET_DIR="$(realpath "$raw")"
  elif [[ -n "$ARG_TARGET" ]]; then
    TARGET_DIR="$(realpath "$ARG_TARGET")"
  else
    TARGET_DIR="$PWD"
  fi
  if [[ ! -f "$TARGET_DIR/openspec/config.yaml" ]]; then
    err "未找到 openspec/config.yaml，请先运行完整安装"
    exit 1
  fi
  case "$ARG_TYPE" in
    python-data) new_tmpl="$TEMPLATES/openspec/config-python-data.yaml" ;;
    frontend)    new_tmpl="$TEMPLATES/openspec/config-frontend.yaml"    ;;
    fullstack)   new_tmpl="$TEMPLATES/openspec/config-fullstack.yaml"   ;;
    vibe)        new_tmpl="$TEMPLATES/openspec/config-vibe.yaml"        ;;
    backend)     new_tmpl="$TEMPLATES/openspec/config-backend.yaml"     ;;
    *) err "未知档位: $ARG_TYPE"; exit 1 ;;
  esac
  cp "$new_tmpl" "$TARGET_DIR/openspec/config.yaml"
  ok "档位已切换到: $ARG_TYPE"
  if [[ "$ARG_TYPE" == "fullstack" ]]; then
    mkdir -p "$TARGET_DIR/openspec/specs/frontend" "$TARGET_DIR/openspec/specs/backend"
    ok "openspec/specs/frontend/ 和 backend/（已创建）"
  fi
  echo ""
  echo -e "  ${GREEN}${BOLD}切换完成。${RESET}"
  echo ""
  exit 0
fi

# ══════════════════════════════════════════════════════════════════════════════
# 第三步：交互选项
# ══════════════════════════════════════════════════════════════════════════════
step "安装配置"

# 项目类型
# 若通过 --type 参数指定，则跳过交互；否则展示菜单
if [[ -n "$ARG_TYPE" ]]; then
  PROJECT_TYPE="$ARG_TYPE"
  ok "项目类型: $PROJECT_TYPE（来自参数）"
else
  echo ""
  echo -e "  ${BOLD}选择最符合你的项目类型${RESET}："
  type_choice=$(ask_menu "项目类型" \
    "📦 后端服务 — 服务器 API、业务逻辑、数据库操作" \
    "🐍 Python 数据项目 — 数据分析、自动报表、数据处理脚本" \
    "🎨 前端应用 — 网页界面、H5、React/Vue/小程序" \
    "🔗 前后端合体 — 同一个仓库里既有前端界面又有后端服务" \
    "⚡ 轻量快速模式 — 个人项目、快速验证想法、不需要严格审查流程")
  case "$type_choice" in
    1) PROJECT_TYPE="backend"      ;;
    2) PROJECT_TYPE="python-data"  ;;
    3) PROJECT_TYPE="frontend"     ;;
    4) PROJECT_TYPE="fullstack"    ;;
    5) PROJECT_TYPE="vibe"         ;;
  esac
  ok "项目类型: $PROJECT_TYPE"
fi

# 工具链
echo ""
echo -e "  ${BOLD}安装工具链${RESET}（Claude Code / Codex App）："
cli_choice=$(ask_menu "选择工具" \
  "Claude Code + Codex App（两个都装）" \
  "仅 Claude Code" \
  "仅 Codex App")
case "$cli_choice" in
  1) INSTALL_CLAUDE=true;  INSTALL_CODEX=true  ;;
  2) INSTALL_CLAUDE=true;  INSTALL_CODEX=false ;;
  3) INSTALL_CLAUDE=false; INSTALL_CODEX=true  ;;
esac
[[ "$INSTALL_CLAUDE" == "true" ]] && ok "Claude Code 工具链"
[[ "$INSTALL_CODEX"  == "true" ]] && ok "Codex App 工具链"

# ══════════════════════════════════════════════════════════════════════════════
# 第四步：软环境检查（给出警告，不阻断）
# ══════════════════════════════════════════════════════════════════════════════
step "环境检查（软）"
SOFT_WARN=false

if [[ "$INSTALL_CLAUDE" == "true" ]]; then
  if command -v claude &>/dev/null; then
    ok "claude CLI 已在 PATH"
  else
    warn "claude CLI 未在 PATH（安装 Claude Code 后 .claude/commands/ 才会生效）"
    SOFT_WARN=true
  fi

  if [[ -d "$HOME/.gstack/repos/gstack/.hermes/skills" ]]; then
    ok "GStack 已安装 (~/.gstack)"
  else
    warn "GStack 未安装（~/.gstack 不存在）"
    info "Claude Code 侧原生 GStack skill 不可用，移植版 Codex skill 不受影响"
    info "安装 GStack: https://gstack.dev"
    SOFT_WARN=true
  fi

  if [[ -d "$HOME/.claude/plugins/cache/claude-plugins-official/superpowers" ]]; then
    ok "Superpowers 插件已安装"
  else
    warn "Superpowers 未安装"
    info "/wf Mode 2（复杂后端）和 Mode 3（Debug/重构/单测）依赖以下 skill："
    info "  brainstorming / writing-plans / verification-before-completion"
    info "  systematic-debugging / test-driven-development"
    info "安装方法：Claude Code 中运行 /plugins install superpowers"
    SOFT_WARN=true
  fi
fi

if [[ "$INSTALL_CODEX" == "true" ]]; then
  if command -v codex &>/dev/null; then
    ok "codex CLI 已在 PATH"
  elif [[ -d "$TARGET_DIR/.codex" ]]; then
    ok ".codex/ 目录已存在（Codex App 已使用此项目）"
  else
    warn "未检测到 Codex App（codex 命令不在 PATH，且 .codex/ 不存在）"
    info "Codex skills 仍会安装，Codex App 启动后即可识别"
    SOFT_WARN=true
  fi
fi

if [[ "$SOFT_WARN" == "false" ]]; then
  ok "所有软检查通过"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 第五步：状态检测
# ══════════════════════════════════════════════════════════════════════════════
step "状态检测"

EXISTING_CONFIG=false
EXISTING_WORKFLOW=false
EXISTING_CLAUDE_COMMANDS=false
EXISTING_CODEX_SKILLS=false

[[ -f "$TARGET_DIR/openspec/config.yaml" ]] && EXISTING_CONFIG=true

if [[ "$EXISTING_CONFIG" == "true" ]]; then
  if grep -q "quick_change_criteria" "$TARGET_DIR/openspec/config.yaml" 2>/dev/null; then
    EXISTING_WORKFLOW=true
    warn "检测到已有 arkan-workflow 配置（openspec/config.yaml 含 quick_change_criteria）"
    info "本次安装为更新模式"
  else
    info "检测到现有 openspec/config.yaml（非 arkan-workflow 模板），将提示覆盖"
  fi
else
  ok "全新安装"
fi

[[ -f "$TARGET_DIR/.claude/commands/wf.md" ]]          && EXISTING_CLAUDE_COMMANDS=true
[[ -d "$TARGET_DIR/.codex/skills/gstack-plan-eng-review" ]] && EXISTING_CODEX_SKILLS=true

[[ "$EXISTING_CLAUDE_COMMANDS" == "true" ]] && warn "已有 Claude 工作流命令（将提示覆盖）"
[[ "$EXISTING_CODEX_SKILLS"   == "true" ]] && warn "已有 Codex GStack skill（将提示覆盖）"

# ══════════════════════════════════════════════════════════════════════════════
# 第六步：确认安装计划
# ══════════════════════════════════════════════════════════════════════════════
step "安装计划"
echo ""
echo -e "  将在 ${BOLD}$TARGET_DIR${RESET} 安装："
echo -e "    • openspec/config.yaml（$PROJECT_TYPE 模板）"
echo -e "    • openspec/specs/project.md 和 system.md（如不存在则创建 stub）"
[[ "$INSTALL_CLAUDE" == "true" ]] && echo -e "    • .claude/commands/wf.md + openspec-quick.md + wf-install.md"
[[ "$INSTALL_CLAUDE" == "true" ]] && echo -e "    • .claude/CLAUDE.md（如不存在则创建）"
[[ "$INSTALL_CODEX"  == "true" ]] && echo -e "    • .codex/skills/wf/ + openspec-quick/ + wf-install/ + gstack-plan-eng-review/"
[[ "$INSTALL_CODEX"  == "true" ]] && echo -e "    • .codex/skills/gstack-cso/ + gstack-review/"
[[ "$PROJECT_TYPE"   == "frontend" || "$PROJECT_TYPE" == "fullstack" ]] && [[ "$INSTALL_CODEX" == "true" ]] && \
  echo -e "    • .codex/skills/gstack-plan-design-review/（前端/全栈专属）"
echo -e "    • AGENTS.md 追加 workflow 段落（如不存在则跳过）"
echo ""

# --no-interactive 模式下跳过确认，直接执行
if [[ "$NO_INTERACTIVE" == "false" ]]; then
  if ! ask_yn "确认安装?"; then
    echo -e "\n  已取消。"
    exit 0
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# 第七步：执行安装
# ══════════════════════════════════════════════════════════════════════════════
step "安装中..."

INSTALLED=()
SKIPPED=()

# 辅助：复制文件，有冲突时询问是否覆盖；--no-interactive 模式下默认跳过
copy_file() {
  local src="$1" dest="$2" label="$3"
  mkdir -p "$(dirname "$dest")"
  if [[ -f "$dest" ]]; then
    if [[ "$NO_INTERACTIVE" == "true" ]]; then
      info "$label（已跳过，文件已存在）"
      SKIPPED+=("$label")
    elif ask_yn "  已存在 $label，覆盖?" "n"; then
      cp "$src" "$dest"
      ok "$label（已更新）"
      INSTALLED+=("$label")
    else
      info "$label（跳过）"
      SKIPPED+=("$label")
    fi
  else
    cp "$src" "$dest"
    ok "$label"
    INSTALLED+=("$label")
  fi
}

# 辅助：复制目录，有冲突时询问是否覆盖；--no-interactive 模式下默认跳过
copy_dir() {
  local src="$1" dest="$2" label="$3"
  if [[ -d "$dest" ]]; then
    if [[ "$NO_INTERACTIVE" == "true" ]]; then
      info "$label（已跳过，目录已存在）"
      SKIPPED+=("$label")
    elif ask_yn "  已存在 $label，覆盖?" "n"; then
      rm -rf "$dest"
      cp -r "$src" "$dest"
      ok "$label（已更新）"
      INSTALLED+=("$label")
    else
      info "$label（跳过）"
      SKIPPED+=("$label")
    fi
  else
    cp -r "$src" "$dest"
    ok "$label"
    INSTALLED+=("$label")
  fi
}

echo ""

# — openspec/config.yaml ───────────────────────────────────────────────────────
# 根据项目类型选择对应的配置模板
case "$PROJECT_TYPE" in
  python-data) config_tmpl="$TEMPLATES/openspec/config-python-data.yaml" ;;
  frontend)    config_tmpl="$TEMPLATES/openspec/config-frontend.yaml"    ;;
  fullstack)   config_tmpl="$TEMPLATES/openspec/config-fullstack.yaml"   ;;
  vibe)        config_tmpl="$TEMPLATES/openspec/config-vibe.yaml"        ;;
  *)           config_tmpl="$TEMPLATES/openspec/config-backend.yaml"     ;;
esac
copy_file "$config_tmpl" "$TARGET_DIR/openspec/config.yaml" "openspec/config.yaml"
# fullstack 项目额外创建前后端子目录，方便分类管理 spec 文件
if [[ "$PROJECT_TYPE" == "fullstack" ]]; then
  mkdir -p "$TARGET_DIR/openspec/specs/frontend" "$TARGET_DIR/openspec/specs/backend"
  ok "openspec/specs/frontend/ 和 backend/（fullstack 子目录已创建）"
fi

# — openspec/specs/ stubs ──────────────────────────────────────────────────────
mkdir -p "$TARGET_DIR/openspec/specs"

if [[ ! -f "$TARGET_DIR/openspec/specs/project.md" ]]; then
  cat > "$TARGET_DIR/openspec/specs/project.md" << 'STUB'
# [项目名] — Project Context

> 本文件是项目级上下文，供 AI 生成 OpenSpec 工件时参考。
> **TODO: 填写以下各节。**

## 项目定位

<!-- 一句话描述项目功能 -->

## 技术栈

| 层次 | 技术 |
|------|------|
| 部署 | <!-- 例：阿里云 FC, Vercel, Docker --> |
| 框架 | <!-- 例：FastAPI, Next.js, Spring Boot --> |
| 数据库 | <!-- 例：MySQL, PostgreSQL, MongoDB --> |
| 配置中心 | <!-- 例：Apollo, Vault, 环境变量 --> |

## 开发约定

<!-- 列出代码规范、命名约定、分支策略等 -->

## 安全规则（所有 spec/design/task 工件均适用）

- **禁止**：写入任何密钥、Token、密码、内部地址实际值
- **允许**：引用配置键名（例：「从环境变量 DB_URL 读取连接串」）
STUB
  ok "openspec/specs/project.md（stub，请手动填写）"
  INSTALLED+=("openspec/specs/project.md")
else
  info "openspec/specs/project.md 已存在（跳过）"
  SKIPPED+=("openspec/specs/project.md")
fi

if [[ ! -f "$TARGET_DIR/openspec/specs/system.md" ]]; then
  cat > "$TARGET_DIR/openspec/specs/system.md" << 'STUB'
# [项目名] — System Baseline

> 本文件是系统级 baseline spec，供 AI 生成 OpenSpec 工件时参考。
> Delta spec 应引用本文件中的已有基线，而非重复陈述。
> **TODO: 填写以下各节。**

## 入口与模块结构

```
<!-- 在此描述目录结构和核心模块，标注高危文件 -->
```

## 数据流

```
<!-- ASCII 图描述请求/数据从入口到输出的流转 -->
```

## 关键配置（仅引用键名，禁止写入实际值）

<!-- 例：数据库连接串来自环境变量 DATABASE_URL -->

## 已知约束与踩坑

<!-- 1. ... -->
<!-- 2. ... -->
STUB
  ok "openspec/specs/system.md（stub，请手动填写）"
  INSTALLED+=("openspec/specs/system.md")
else
  info "openspec/specs/system.md 已存在（跳过）"
  SKIPPED+=("openspec/specs/system.md")
fi

# — Claude Code ────────────────────────────────────────────────────────────────
if [[ "$INSTALL_CLAUDE" == "true" ]]; then
  copy_file "$TEMPLATES/claude/commands/wf.md" \
    "$TARGET_DIR/.claude/commands/wf.md" ".claude/commands/wf.md"
  copy_file "$TEMPLATES/claude/commands/openspec-quick.md" \
    "$TARGET_DIR/.claude/commands/openspec-quick.md" ".claude/commands/openspec-quick.md"
  copy_file "$TEMPLATES/claude/commands/wf-install.md" \
    "$TARGET_DIR/.claude/commands/wf-install.md" ".claude/commands/wf-install.md"

  if [[ ! -f "$TARGET_DIR/.claude/CLAUDE.md" ]]; then
    mkdir -p "$TARGET_DIR/.claude"
    cat > "$TARGET_DIR/.claude/CLAUDE.md" << 'CLAUDEMD'
# CLAUDE.md

Claude Code 工作流说明（补充 AGENTS.md）。

## OpenSpec + GStack 工作流

所有功能变更通过 OpenSpec 状态机管理。禁止直接修改代码而不经过 propose 阶段。

### 工作流命令
- `/wf` — 统一入口，选择模式（Mode 0-4）自动路由
- `/openspec-propose` — 完整通道（proposal + design gate + tasks）
- `/openspec-quick` — 快速通道（文案/样式/明确 bug，跳过 gate）
- `/openspec-apply-change` — 执行 tasks 实现代码
- `/openspec-archive-change` — 归档变更

### GStack 审查 Skill（由 openspec/config.yaml rules 驱动）
- `/plan-eng-review` — 工程审查（完整通道必须）
- `/cso` — 安全审查（涉及配置/凭证/外部调用时）
- `/review` — 代码审查（apply 后运行）

### Gate 规则
见 openspec/config.yaml。design.md 顶部工程审查状态为「阻断」时，
不得生成 tasks.md，须先修改 proposal。
CLAUDEMD
    ok ".claude/CLAUDE.md"
    INSTALLED+=(".claude/CLAUDE.md")
  else
    info ".claude/CLAUDE.md 已存在（跳过）"
    SKIPPED+=(".claude/CLAUDE.md")
  fi
fi

# — Codex App ──────────────────────────────────────────────────────────────────
if [[ "$INSTALL_CODEX" == "true" ]]; then
  mkdir -p "$TARGET_DIR/.codex/skills"

  copy_dir "$TEMPLATES/codex/skills/wf" \
    "$TARGET_DIR/.codex/skills/wf" ".codex/skills/wf"
  copy_dir "$TEMPLATES/codex/skills/openspec-quick" \
    "$TARGET_DIR/.codex/skills/openspec-quick" ".codex/skills/openspec-quick"
  copy_dir "$TEMPLATES/codex/skills/wf-install" \
    "$TARGET_DIR/.codex/skills/wf-install" ".codex/skills/wf-install"
  copy_dir "$TEMPLATES/codex/skills/gstack-plan-eng-review" \
    "$TARGET_DIR/.codex/skills/gstack-plan-eng-review" ".codex/skills/gstack-plan-eng-review"
  copy_dir "$TEMPLATES/codex/skills/gstack-cso" \
    "$TARGET_DIR/.codex/skills/gstack-cso" ".codex/skills/gstack-cso"
  copy_dir "$TEMPLATES/codex/skills/gstack-review" \
    "$TARGET_DIR/.codex/skills/gstack-review" ".codex/skills/gstack-review"

  # frontend 和 fullstack 均需要 UI 设计审查 skill
  if [[ "$PROJECT_TYPE" == "frontend" || "$PROJECT_TYPE" == "fullstack" ]]; then
    copy_dir "$TEMPLATES/codex/skills/gstack-plan-design-review" \
      "$TARGET_DIR/.codex/skills/gstack-plan-design-review" \
      ".codex/skills/gstack-plan-design-review"
  fi
fi

# — AGENTS.md 追加 ─────────────────────────────────────────────────────────────
if [[ -f "$TARGET_DIR/AGENTS.md" ]]; then
  if grep -q "OpenSpec + GStack 工作流" "$TARGET_DIR/AGENTS.md" 2>/dev/null; then
    info "AGENTS.md 已含工作流段落（跳过）"
    SKIPPED+=("AGENTS.md workflow section")
  else
    cat >> "$TARGET_DIR/AGENTS.md" << 'AGENTSECTION'

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
AGENTSECTION
    ok "AGENTS.md（追加 workflow 段落）"
    INSTALLED+=("AGENTS.md")
  fi
else
  info "AGENTS.md 不存在（跳过）"
fi

# ══════════════════════════════════════════════════════════════════════════════
# 第八步：安装摘要
# ══════════════════════════════════════════════════════════════════════════════
step "安装完成"
echo ""

if [[ ${#INSTALLED[@]} -gt 0 ]]; then
  echo -e "  ${GREEN}${BOLD}已安装 / 更新：${RESET}"
  for f in "${INSTALLED[@]}"; do echo -e "    ${GREEN}✓${RESET} $f"; done
  echo ""
fi

if [[ ${#SKIPPED[@]} -gt 0 ]]; then
  echo -e "  ${YELLOW}${BOLD}已跳过：${RESET}"
  for f in "${SKIPPED[@]}"; do echo -e "    ${YELLOW}–${RESET} $f"; done
  echo ""
fi

# ── 后续手动步骤 ───────────────────────────────────────────────────────────────
MANUAL_STEPS=()

if grep -q "TODO: 填写以下各节" "$TARGET_DIR/openspec/specs/project.md" 2>/dev/null; then
  MANUAL_STEPS+=("编辑 openspec/specs/project.md — 填写技术栈、开发约定、安全规则")
fi
if grep -q "TODO: 填写以下各节" "$TARGET_DIR/openspec/specs/system.md" 2>/dev/null; then
  MANUAL_STEPS+=("编辑 openspec/specs/system.md — 填写模块结构、数据流、踩坑清单")
fi
MANUAL_STEPS+=("git add openspec/ .claude/ .codex/ AGENTS.md && git commit -m 'feat: install arkan-workflow'")

echo -e "  ${BOLD}后续步骤：${RESET}"
for i in "${!MANUAL_STEPS[@]}"; do
  echo -e "    $((i+1)). ${MANUAL_STEPS[$i]}"
done

echo ""
echo -e "  ${CYAN}快速使用：${RESET}"
echo -e "    Claude Code: ${BOLD}/wf${RESET}  或  ${BOLD}/openspec-quick <描述>${RESET}"
echo -e "    Codex App:   ${BOLD}/wf${RESET}  或  ${BOLD}/openspec-quick <描述>${RESET}"
echo ""
echo -e "  ${GREEN}${BOLD}安装脚本执行完毕。${RESET}"
echo ""
