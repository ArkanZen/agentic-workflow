#!/usr/bin/env bash
# agentic-workflow/install.sh
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
if [[ -f "$WORKFLOW_DIR/VERSION" ]]; then
  WORKFLOW_VERSION="$(tr -d '[:space:]' < "$WORKFLOW_DIR/VERSION")"
else
  WORKFLOW_VERSION="unknown"
fi
SOURCE_REPO=""  # 由 detect_source_repo() 在安装执行阶段填充

# ── 参数解析 ──────────────────────────────────────────────────────────────────
NO_INTERACTIVE=false
SWITCH_MODE=false
UPGRADE_MODE=false
ARG_TYPE=""
ARG_TARGET=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --type)
      [[ $# -lt 2 ]] && { err "--type 需要一个值（例：--type python-data）"; exit 1; }
      ARG_TYPE="$2"; shift 2 ;;
    --target)
      [[ $# -lt 2 ]] && { err "--target 需要一个路径"; exit 1; }
      ARG_TARGET="$2"; shift 2 ;;
    --no-interactive) NO_INTERACTIVE=true; shift ;;
    --upgrade)        UPGRADE_MODE=true; shift ;;
    --switch)         SWITCH_MODE=true; shift ;;
    --version)        echo "$WORKFLOW_VERSION"; exit 0 ;;
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

# ── 工作流标记 ────────────────────────────────────────────────────────────────
WORKFLOW_MARKER_PREFIX="agentic-workflow"

# 检查文件是否包含指定类型的行注释标记
has_hash_marker() {
  local file="$1" key="$2"
  grep -q "^# ${WORKFLOW_MARKER_PREFIX}-${key}:" "$file" 2>/dev/null
}

# 检查文件是否包含指定类型的 HTML 注释标记
has_html_marker() {
  local file="$1" key="$2"
  grep -q "<!-- ${WORKFLOW_MARKER_PREFIX}-${key}:" "$file" 2>/dev/null
}

# 更新行注释标记的值
update_hash_marker() {
  local file="$1" key="$2" value="$3"
  sed -i.bak "s|^# ${WORKFLOW_MARKER_PREFIX}-${key}: .*|# ${WORKFLOW_MARKER_PREFIX}-${key}: ${value}|" "$file"
}

# 更新 HTML 注释标记的值
update_html_marker() {
  local file="$1" key="$2" value="$3"
  sed -i.bak "s|<!-- ${WORKFLOW_MARKER_PREFIX}-${key}: .* -->|<!-- ${WORKFLOW_MARKER_PREFIX}-${key}: ${value} -->|" "$file"
}

# 转义 JSON 字符串，供 manifest 写入路径和版本信息
json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

# 检测 agentic-workflow 仓库的 GitHub 远程 URL，供 manifest 写入 sourceRepo
# 返回 HTTPS URL（去 .git 后缀），无法检测时返回空字符串
detect_source_repo() {
  local url
  url="$(git -C "$WORKFLOW_DIR" remote get-url origin 2>/dev/null)" || { echo ""; return; }
  # SSH → HTTPS: git@github.com:owner/repo.git → https://github.com/owner/repo
  if [[ "$url" =~ ^git@github\.com:(.+)$ ]]; then
    url="https://github.com/${BASH_REMATCH[1]}"
  fi
  url="${url%.git}"
  [[ "$url" =~ ^https://github\.com/ ]] && echo "$url" || echo ""
}

# 通过 git ls-remote 查询 GitHub repo 最新 release tag，返回去掉 v 前缀的版本号
# 失败或无 tag 时返回空字符串；无需 auth、无 rate limit
get_latest_remote_version() {
  local repo_url="$1" latest
  latest="$(git ls-remote --tags --refs "$repo_url" 'v[0-9]*' 2>/dev/null \
    | awk '{print $2}' \
    | sed 's|refs/tags/||' \
    | sort -V \
    | tail -1)"
  echo "${latest#v}"
}

# 计算文件哈希，优先使用 macOS 默认可用的 shasum
hash_file() {
  local file="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
  else
    cksum "$file" | awk '{print $1 "-" $2}'
  fi
}

# 渲染模板占位符，确保 VERSION 是工作流版本的唯一来源
render_template_file() {
  local src="$1" dest="$2"
  [[ -z "${WORKFLOW_VERSION:-}" ]] && { echo "ERROR: WORKFLOW_VERSION 未设置，无法渲染模板" >&2; exit 1; }
  sed "s/__WORKFLOW_VERSION__/${WORKFLOW_VERSION}/g" "$src" > "$dest"
}

# 收集受控安装文件，用于 manifest 记录本次安装的真实落点
collect_manifest_files() {
  local target="$1"
  {
    [[ -f "$target/openspec/config.yaml" ]] && echo "openspec/config.yaml"
    [[ -f "$target/AGENTS.md" ]] && echo "AGENTS.md"
    [[ -f "$target/.claude/CLAUDE.md" ]] && echo ".claude/CLAUDE.md"
    find "$target/.claude/commands" -maxdepth 1 -type f -name 'wf-*.md' 2>/dev/null | sed "s|^$target/||"
    find "$target/.codex/skills" -path '*/wf-*/*' -type f 2>/dev/null | sed "s|^$target/||"
  } | sort
}

# 写入安装清单，避免只看 config.yaml 版本导致宿主 skill 漂移不可见
write_manifest() {
  local target="$1" tier="$2" install_claude="$3" install_codex="$4"
  local manifest_dir="$target/.agentic-workflow"
  local manifest="$manifest_dir/manifest.json"
  local files_file rel abs hash comma
  mkdir -p "$manifest_dir"
  files_file="$(mktemp)"
  collect_manifest_files "$target" > "$files_file"

  {
    printf '{\n'
    printf '  "schemaVersion": 1,\n'
    printf '  "workflowVersion": "%s",\n' "$(json_escape "$WORKFLOW_VERSION")"
    printf '  "tier": "%s",\n' "$(json_escape "$tier")"
    printf '  "installedAt": "%s",\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    printf '  "workflowPath": "%s",\n' "$(json_escape "$WORKFLOW_DIR")"
    printf '  "sourceRepo": "%s",\n' "$(json_escape "$SOURCE_REPO")"
    printf '  "hosts": {\n'
    printf '    "claude": %s,\n' "$install_claude"
    printf '    "codex": %s\n' "$install_codex"
    printf '  },\n'
    printf '  "gstackCommandMap": {\n'
    printf '    "claude": {\n'
    printf '      "engineeringReview": "/plan-eng-review",\n'
    printf '      "designReview": "/plan-design-review",\n'
    printf '      "securityReview": "/cso",\n'
    printf '      "codeReview": "/review"\n'
    printf '    },\n'
    printf '    "codex": {\n'
    printf '      "engineeringReview": "/gstack-plan-eng-review",\n'
    printf '      "designReview": "/gstack-plan-design-review",\n'
    printf '      "securityReview": "/gstack-cso",\n'
    printf '      "codeReview": "/gstack-review"\n'
    printf '    }\n'
    printf '  },\n'
    printf '  "files": [\n'
    comma=""
    while IFS= read -r rel; do
      [[ -z "$rel" ]] && continue
      abs="$target/$rel"
      [[ -f "$abs" ]] || continue
      hash="$(hash_file "$abs")"
      printf '%s    {"path": "%s", "sha256": "%s"}' "$comma" "$(json_escape "$rel")" "$(json_escape "$hash")"
      comma=$',\n'
    done < "$files_file"
    printf '\n  ]\n'
    printf '}\n'
  } > "$manifest"

  rm -f "$files_file"
  ok ".agentic-workflow/manifest.json"
  INSTALLED+=(".agentic-workflow/manifest.json")
}

# ── Banner ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}║   agentic-workflow 安装脚本                 ║${RESET}"
echo -e "${BOLD}${CYAN}║   OpenSpec + GStack 双生态工作流             ║${RESET}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════╝${RESET}"
echo -e "  ${CYAN}版本:${RESET} ${WORKFLOW_VERSION}"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# 第一步：目标项目目录
# ══════════════════════════════════════════════════════════════════════════════
step "目标项目"
if [[ "$NO_INTERACTIVE" == "true" && -z "$ARG_TARGET" ]]; then
  err "--no-interactive 模式需要 --target 参数"; exit 1
fi
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

INSTALLED=()
SKIPPED=()

# ── Switch 模式 ───────────────────────────────────────────────────────────────
# --switch 只替换 openspec/config.yaml，不做完整安装，安装后退出
if [[ "$SWITCH_MODE" == "true" ]]; then
  if [[ -z "$ARG_TYPE" ]]; then
    err "--switch 需要配合 --type <档位> 使用"
    exit 1
  fi
  # TARGET_DIR 已由脚本入口确定，此处直接使用
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
  cp "$TARGET_DIR/openspec/config.yaml" "$TARGET_DIR/openspec/config.yaml.bak"
  ok "config.yaml 已备份为 config.yaml.bak"
  render_template_file "$new_tmpl" "$TARGET_DIR/openspec/config.yaml"
  ok "档位已切换到: $ARG_TYPE"
  # 更新 .claude/CLAUDE.md 中的档位注释
  if [[ -f "$TARGET_DIR/.claude/CLAUDE.md" ]]; then
    update_hash_marker "$TARGET_DIR/.claude/CLAUDE.md" "tier" "$ARG_TYPE"
    update_html_marker "$TARGET_DIR/.claude/CLAUDE.md" "tier" "$ARG_TYPE"
    if has_hash_marker "$TARGET_DIR/.claude/CLAUDE.md" "version"; then
      update_hash_marker "$TARGET_DIR/.claude/CLAUDE.md" "version" "$WORKFLOW_VERSION"
    fi
    if has_html_marker "$TARGET_DIR/.claude/CLAUDE.md" "version"; then
      update_html_marker "$TARGET_DIR/.claude/CLAUDE.md" "version" "$WORKFLOW_VERSION"
    fi
    rm -f "$TARGET_DIR/.claude/CLAUDE.md.bak"
    ok ".claude/CLAUDE.md 档位注释已更新"
  fi
  # 更新 AGENTS.md 中的档位注释
  if [[ -f "$TARGET_DIR/AGENTS.md" ]]; then
    update_html_marker "$TARGET_DIR/AGENTS.md" "tier" "$ARG_TYPE"
    if has_html_marker "$TARGET_DIR/AGENTS.md" "version"; then
      update_html_marker "$TARGET_DIR/AGENTS.md" "version" "$WORKFLOW_VERSION"
    fi
    rm -f "$TARGET_DIR/AGENTS.md.bak"
    ok "AGENTS.md 档位注释已更新"
  fi
  if [[ "$ARG_TYPE" == "fullstack" ]]; then
    mkdir -p "$TARGET_DIR/openspec/specs/frontend" "$TARGET_DIR/openspec/specs/backend"
    ok "openspec/specs/frontend/ 和 backend/（已创建）"
  fi
  SWITCH_CLAUDE=false
  SWITCH_CODEX=false
  [[ -d "$TARGET_DIR/.claude" ]] && SWITCH_CLAUDE=true
  [[ -d "$TARGET_DIR/.codex" ]] && SWITCH_CODEX=true
  write_manifest "$TARGET_DIR" "$ARG_TYPE" "$SWITCH_CLAUDE" "$SWITCH_CODEX"
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
  case "$ARG_TYPE" in
    backend|python-data|frontend|fullstack|vibe) ;;
    *) err "未知档位: ${ARG_TYPE}（有效值：backend, python-data, frontend, fullstack, vibe）"; exit 1 ;;
  esac
  PROJECT_TYPE="$ARG_TYPE"
  ok "项目类型: ${PROJECT_TYPE}（来自参数）"
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
    *) PROJECT_TYPE="backend"      ;;
  esac
  ok "项目类型: $PROJECT_TYPE"
fi

# 工具链
echo ""
if [[ "$NO_INTERACTIVE" == "true" ]]; then
  # 非交互模式下默认安装全部工具链，无需等待 TTY 输入
  INSTALL_CLAUDE=true; INSTALL_CODEX=true
  ok "安装工具链: Claude Code + Codex App（默认）"
else
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
fi
[[ "$INSTALL_CLAUDE" == "true" ]] && ok "Claude Code 工具链"
[[ "$INSTALL_CODEX"  == "true" ]] && ok "Codex App 工具链"

# ══════════════════════════════════════════════════════════════════════════════
# 第四步：软环境检查（给出警告，不阻断）
# ══════════════════════════════════════════════════════════════════════════════
step "环境检查（软）"
SOFT_WARN=false
CLAUDE_SUPERPOWERS_INSTALLED=false
CODEX_SUPERPOWERS_INSTALLED=false
CLAUDE_GSTACK_INSTALLED=false
CODEX_GSTACK_INSTALLED=false

[[ -d "$HOME/.claude/plugins/cache/claude-plugins-official/superpowers" ]] && CLAUDE_SUPERPOWERS_INSTALLED=true
if compgen -G "$HOME/.codex/plugins/cache/openai-curated/superpowers/*" >/dev/null; then
  CODEX_SUPERPOWERS_INSTALLED=true
fi
[[ -d "$HOME/.claude/skills/gstack" || -d "$HOME/.gstack/repos/gstack" ]] && CLAUDE_GSTACK_INSTALLED=true
if [[ -d "$HOME/.codex/skills/gstack" ]] || compgen -G "$HOME/.codex/skills/gstack-*" >/dev/null; then
  CODEX_GSTACK_INSTALLED=true
fi

if [[ "$INSTALL_CLAUDE" == "true" ]]; then
  if command -v claude &>/dev/null; then
    ok "claude CLI 已在 PATH"
  else
    warn "claude CLI 未在 PATH（安装 Claude Code 后 .claude/commands/ 才会生效）"
    SOFT_WARN=true
  fi

  if [[ "$CLAUDE_GSTACK_INSTALLED" == "true" ]]; then
    ok "Claude Code GStack 已安装"
  else
    warn "Claude Code GStack 未安装（不阻塞安装，GStack 审查命令不可用）"
    info "官方安装：git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup"
    SOFT_WARN=true
  fi

  if [[ "$CLAUDE_SUPERPOWERS_INSTALLED" == "true" ]]; then
    ok "Superpowers 插件已安装"
  else
    warn "Superpowers 插件未安装（不阻塞安装，复杂/Debug 模式会降级）"
    info "影响范围：/wf-complex、/wf-debug 和明确 bug 场景的 /wf-quick 无法加载完整 Superpowers skill，执行时必须提示降级并等待确认"
    info "建议安装：在 Claude Code 中运行 /plugins install superpowers"
    info "依赖的 Superpowers skill："
    info "  brainstorming / writing-plans / verification-before-completion"
    info "  systematic-debugging / test-driven-development"
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

  if [[ "$CODEX_SUPERPOWERS_INSTALLED" == "true" ]]; then
    ok "Codex Superpowers 插件已安装"
  else
    warn "Codex Superpowers 插件未安装（不阻塞安装，复杂/Debug/明确 bug 模式会提示降级）"
    info "提示：如需 /wf-complex、/wf-debug 和明确 bug 场景 /wf-quick 的完整 Superpowers 体验，请在当前环境安装 Superpowers 插件"
    info "安装方式：在 Codex 插件/工具面板中安装 Superpowers；若使用 Claude Code，则运行 /plugins install superpowers"
    SOFT_WARN=true
  fi

  if [[ "$CODEX_GSTACK_INSTALLED" == "true" ]]; then
    ok "官方 GStack Codex skills 已安装"
  else
    warn "官方 GStack Codex skills 未安装（不阻塞安装，GStack 审查命令不可用）"
    info "官方安装：git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.codex/skills/gstack"
    info "然后运行：cd ~/.codex/skills/gstack && ./setup --host codex"
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
    warn "检测到已有 agentic-workflow 配置（openspec/config.yaml 含 quick_change_criteria）"
    info "本次安装为更新模式"
    if [[ "$NO_INTERACTIVE" == "true" ]]; then
      UPGRADE_MODE=true
      info "非交互更新将覆盖受控工作流模板"
    fi
  else
    info "检测到现有 openspec/config.yaml（非 agentic-workflow 模板），将提示覆盖"
  fi
else
  ok "全新安装"
fi

[[ -f "$TARGET_DIR/.claude/commands/wf-quick.md" ]]    && EXISTING_CLAUDE_COMMANDS=true
[[ -d "$TARGET_DIR/.codex/skills/wf-quick" ]] && EXISTING_CODEX_SKILLS=true

[[ "$EXISTING_CLAUDE_COMMANDS" == "true" ]] && warn "已有 Claude 工作流命令（将提示覆盖）"
[[ "$EXISTING_CODEX_SKILLS"   == "true" ]] && warn "已有 Codex 工作流 skill（将提示覆盖）"

# ══════════════════════════════════════════════════════════════════════════════
# 第六步：确认安装计划
# ══════════════════════════════════════════════════════════════════════════════
step "安装计划"
echo ""
echo -e "  将在 ${BOLD}$TARGET_DIR${RESET} 安装："
echo -e "    • openspec/config.yaml（$PROJECT_TYPE 模板）"
echo -e "    • openspec/specs/project.md 和 system.md（如不存在则创建 stub）"
[[ "$INSTALL_CLAUDE" == "true" ]] && echo -e "    • .claude/commands/wf-{quick,small,complex,debug,plan}.md + wf-install.md"
[[ "$INSTALL_CLAUDE" == "true" ]] && echo -e "    • .claude/CLAUDE.md（如不存在则创建）"
[[ "$INSTALL_CODEX"  == "true" ]] && echo -e "    • .codex/skills/wf-{quick,small,complex,debug,plan}/ + wf-install/"
[[ "$INSTALL_CODEX"  == "true" ]] && echo -e "    • 检测官方 GStack Codex skills（未安装则提示官方安装命令，不复制旧版内置 GStack skills）"
echo -e "    • AGENTS.md workflow 段落（如不存在则创建）"
echo -e "    • .agentic-workflow/manifest.json（记录安装清单和 host 命令映射）"
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

# 检测 GitHub 远程 URL，写入 manifest.json sourceRepo 字段
SOURCE_REPO="$(detect_source_repo)"

# 辅助：复制并渲染文件，有冲突时询问是否覆盖；升级模式下自动覆盖受控模板
copy_file() {
  local src="$1" dest="$2" label="$3"
  mkdir -p "$(dirname "$dest")"
  if [[ -f "$dest" ]]; then
    if [[ "$UPGRADE_MODE" == "true" ]]; then
      render_template_file "$src" "$dest"
      ok "${label}（已升级）"
      INSTALLED+=("$label")
    elif [[ "$NO_INTERACTIVE" == "true" ]]; then
      info "${label}（已跳过，文件已存在）"
      SKIPPED+=("$label")
    elif ask_yn "  已存在 ${label}，覆盖?" "n"; then
      render_template_file "$src" "$dest"
      ok "${label}（已更新）"
      INSTALLED+=("$label")
    else
      info "${label}（跳过）"
      SKIPPED+=("$label")
    fi
  else
    render_template_file "$src" "$dest"
    ok "$label"
    INSTALLED+=("$label")
  fi
}

# 辅助：复制目录，有冲突时询问是否覆盖；升级模式下自动覆盖受控模板
copy_dir() {
  local src="$1" dest="$2" label="$3"
  if [[ -d "$dest" ]]; then
    if [[ "$UPGRADE_MODE" == "true" ]]; then
      rm -rf "$dest"
      cp -r "$src" "$dest"
      ok "${label}（已升级）"
      INSTALLED+=("$label")
    elif [[ "$NO_INTERACTIVE" == "true" ]]; then
      info "${label}（已跳过，目录已存在）"
      SKIPPED+=("$label")
    elif ask_yn "  已存在 ${label}，覆盖?" "n"; then
      rm -rf "$dest"
      cp -r "$src" "$dest"
      ok "${label}（已更新）"
      INSTALLED+=("$label")
    else
      info "${label}（跳过）"
      SKIPPED+=("$label")
    fi
  else
    cp -r "$src" "$dest"
    ok "$label"
    INSTALLED+=("$label")
  fi
}

# 辅助：移除已废弃入口，避免旧命令和新命令同时出现造成误用
remove_obsolete_path() {
  local path="$1" label="$2"
  if [[ -e "$path" ]]; then
    if [[ "$NO_INTERACTIVE" == "true" ]] || ask_yn "  检测到已废弃的 ${label}，删除?" "y"; then
      rm -rf "$path"
      ok "${label}（已删除）"
      INSTALLED+=("${label} removed")
    else
      info "${label}（保留）"
      SKIPPED+=("$label")
    fi
  fi
}

# 辅助：渲染受控工作流说明块，安装和升级时整块替换，避免句子级迁移逻辑持续膨胀
render_workflow_block() {
  local host="$1" tier="$2"
  cat << WORKFLOWBLOCK
<!-- agentic-workflow:start -->
## OpenSpec + GStack 工作流
<!-- ${WORKFLOW_MARKER_PREFIX}-tier: ${tier} -->
<!-- ${WORKFLOW_MARKER_PREFIX}-version: ${WORKFLOW_VERSION} -->

默认不启用本工作流。仅当用户显式输入 \`/wf-*\` 或 \`/openspec-*\` 命令时，才进入 OpenSpec + GStack 流程；普通开发请求按项目常规协作方式处理。

### 活跃工作流检测
每次对话开始时，检查项目根目录是否存在 \`.wf-active\` 文件（\`cat .wf-active 2>/dev/null\`）。
若存在，在首条回复中提示：
「检测到未完成的工作流：**wf-[name]** · 变更：[change] · 开始于 [started]。输入 \`/wf-status\` 查看详情，或告知如何继续。」
若不存在，静默继续，无需提示。

### 工作流切换与退出规则
- 工作流在用户显式调用 \`/wf-finish\` 或调用新的 \`/wf-*\` 命令前持续有效
- 收到超出当前工作流范围的独立任务请求时，必须先宣告「wf-[name] 已在步骤 N 暂停/切换，原因：[一句话]」，再处理新请求；**不得静默切换**
- 调用新的 \`/wf-*\` 命令时，当前工作流自动切换（更新 \`.wf-active\`）；wf-quick/small/complex 若有 in-progress change，需先说明该 change 的状态

### 工作流命令
- \`/wf-quick\` — 快速通道（文案/样式/明确 bug，跳过 gate）
- \`/wf-small\` — 小需求完整通道（OpenSpec + Gate）
- \`/wf-complex\` — 复杂后端/架构变更（探索 + OpenSpec + Gate）
- \`/wf-debug\` — Debug / 重构 / 单测（直接排查或实现）
- \`/wf-plan\` — 产品/架构方案（先评估是否值得做）
- \`/wf-finish\` — 显式关闭当前工作流，宣告完成或切换
- \`/wf-status\` — 查看当前活跃工作流状态，支持恢复或取消
- \`/openspec-propose\` — 完整通道（proposal + design gate + tasks）
- \`/openspec-apply-change\` — 执行 tasks 实现代码
- \`/openspec-archive-change\` — 归档变更
- \`/openspec-explore\` — 探索思考

### 强制依赖加载规则
当工作流文档出现 \`required_skills\`、\`required_workflows\`、\`required_reviews\`、\`conditional_skills\`，或明确写出 \`superpowers:*\`、\`openspec-*\`、\`/gstack-*\`、\`/plan-*\` 等依赖时，执行者必须先加载或执行对应 skill/workflow/review，再进入下一步。

- 不得只按方法论摘要执行，必须读取对应 \`SKILL.md\` 或执行对应命令。
- 每个 \`/wf-*\` 开始时必须做启动自检，列出当前工作流、强制依赖和已加载状态。
- 依赖不可用时必须明确说明缺失项和影响，等待用户确认是否降级继续；不得声称已加载或已审查。
- 完成前必须输出执行审计，列出强制依赖、关键 workflow、review/gate 和验证结果。

### GStack 审查 Skill（由 openspec/config.yaml rules 驱动）
需先安装官方 GStack。${host} 安装方式：
WORKFLOWBLOCK

  if [[ "$host" == "Claude Code" ]]; then
    cat << 'WORKFLOWBLOCK'
`git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup`

- `/plan-eng-review` — 工程审查（完整通道必须）
- `/cso` — 安全审查（涉及配置/凭证/外部调用时）
- `/review` — 代码审查（apply 后运行）
WORKFLOWBLOCK
  else
    cat << 'WORKFLOWBLOCK'
`git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.codex/skills/gstack && cd ~/.codex/skills/gstack && ./setup --host codex`

- `/gstack-plan-eng-review` — 工程审查（完整通道必须）
- `/gstack-cso` — 安全审查（涉及配置/凭证时必须）
- `/gstack-review` — 代码审查（apply 后运行）
WORKFLOWBLOCK
  fi

  cat << 'WORKFLOWBLOCK'

### Host 命令映射
`openspec/config.yaml` 中的 gate 规则使用通用审查名称；执行时按宿主映射：

| 审查动作 | Claude Code | Codex App |
|------|------|------|
| 工程审查 | `/plan-eng-review` | `/gstack-plan-eng-review` |
| UI/设计审查 | `/plan-design-review` | `/gstack-plan-design-review` |
| 安全审查 | `/cso` | `/gstack-cso` |
| 代码审查 | `/review` | `/gstack-review` |

### Gate 规则
见 openspec/config.yaml。design.md 顶部工程审查状态为「阻断」时，
不得生成 tasks.md，须先修改 proposal。
<!-- agentic-workflow:end -->
WORKFLOWBLOCK
}

# 辅助：写入或更新受控工作流说明块；旧版无 marker 段落只迁移一次
upsert_workflow_block() {
  local file="$1" host="$2" tier="$3" label="$4"
  local block_file tmp_file
  block_file="$(mktemp)"
  tmp_file="$(mktemp)"
  render_workflow_block "$host" "$tier" > "$block_file"

  if grep -q "<!-- agentic-workflow:start -->" "$file" 2>/dev/null; then
    awk -v start="<!-- agentic-workflow:start -->" \
        -v end="<!-- agentic-workflow:end -->" \
        -v block="$block_file" '
      BEGIN {
        while ((getline line < block) > 0) replacement = replacement line ORS
        close(block)
      }
      $0 == start {
        printf "%s", replacement
        in_block = 1
        next
      }
      $0 == end && in_block {
        in_block = 0
        next
      }
      !in_block { print }
    ' "$file" > "$tmp_file"
    mv "$tmp_file" "$file"
    ok "${label} 工作流块已更新"
    INSTALLED+=("${label} workflow block")
  elif grep -q "^## OpenSpec + GStack 工作流$" "$file" 2>/dev/null; then
    awk -v title="## OpenSpec + GStack 工作流" \
        -v block="$block_file" '
      BEGIN {
        while ((getline line < block) > 0) replacement = replacement line ORS
        close(block)
      }
      $0 == title {
        printf "%s", replacement
        replaced = 1
        exit
      }
      { print }
      END {
        if (!replaced) printf "\n%s", replacement
      }
    ' "$file" > "$tmp_file"
    mv "$tmp_file" "$file"
    ok "${label} 旧工作流段落已迁移为受控块"
    INSTALLED+=("${label} workflow block")
  else
    {
      printf "\n"
      cat "$block_file"
    } >> "$file"
    ok "${label} 工作流块已追加"
    INSTALLED+=("${label} workflow block")
  fi

  rm -f "$block_file" "$tmp_file"
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
  remove_obsolete_path "$TARGET_DIR/.claude/commands/wf.md" ".claude/commands/wf.md"
  remove_obsolete_path "$TARGET_DIR/.claude/commands/openspec-quick.md" ".claude/commands/openspec-quick.md"

  copy_file "$TEMPLATES/claude/commands/wf-quick.md" \
    "$TARGET_DIR/.claude/commands/wf-quick.md" ".claude/commands/wf-quick.md"
  copy_file "$TEMPLATES/claude/commands/wf-small.md" \
    "$TARGET_DIR/.claude/commands/wf-small.md" ".claude/commands/wf-small.md"
  copy_file "$TEMPLATES/claude/commands/wf-complex.md" \
    "$TARGET_DIR/.claude/commands/wf-complex.md" ".claude/commands/wf-complex.md"
  copy_file "$TEMPLATES/claude/commands/wf-debug.md" \
    "$TARGET_DIR/.claude/commands/wf-debug.md" ".claude/commands/wf-debug.md"
  copy_file "$TEMPLATES/claude/commands/wf-plan.md" \
    "$TARGET_DIR/.claude/commands/wf-plan.md" ".claude/commands/wf-plan.md"
  copy_file "$TEMPLATES/claude/commands/wf-finish.md" \
    "$TARGET_DIR/.claude/commands/wf-finish.md" ".claude/commands/wf-finish.md"
  copy_file "$TEMPLATES/claude/commands/wf-status.md" \
    "$TARGET_DIR/.claude/commands/wf-status.md" ".claude/commands/wf-status.md"
  copy_file "$TEMPLATES/claude/commands/wf-install.md" \
    "$TARGET_DIR/.claude/commands/wf-install.md" ".claude/commands/wf-install.md"

  if [[ ! -f "$TARGET_DIR/.claude/CLAUDE.md" ]]; then
    mkdir -p "$TARGET_DIR/.claude"
    cat > "$TARGET_DIR/.claude/CLAUDE.md" << CLAUDEMD
# CLAUDE.md
# ${WORKFLOW_MARKER_PREFIX}-tier: ${PROJECT_TYPE}
# ${WORKFLOW_MARKER_PREFIX}-version: ${WORKFLOW_VERSION}

Claude Code 工作流说明（补充 AGENTS.md）。
CLAUDEMD
    ok ".claude/CLAUDE.md"
    INSTALLED+=(".claude/CLAUDE.md")
  fi
  if has_hash_marker "$TARGET_DIR/.claude/CLAUDE.md" "tier"; then
    update_hash_marker "$TARGET_DIR/.claude/CLAUDE.md" "tier" "$PROJECT_TYPE"
  fi
  if has_hash_marker "$TARGET_DIR/.claude/CLAUDE.md" "version"; then
    update_hash_marker "$TARGET_DIR/.claude/CLAUDE.md" "version" "$WORKFLOW_VERSION"
  fi
  rm -f "$TARGET_DIR/.claude/CLAUDE.md.bak"
  upsert_workflow_block "$TARGET_DIR/.claude/CLAUDE.md" "Claude Code" "$PROJECT_TYPE" ".claude/CLAUDE.md"
fi

# — Codex App ──────────────────────────────────────────────────────────────────
if [[ "$INSTALL_CODEX" == "true" ]]; then
  mkdir -p "$TARGET_DIR/.codex/skills"

  remove_obsolete_path "$TARGET_DIR/.codex/skills/wf" ".codex/skills/wf"
  remove_obsolete_path "$TARGET_DIR/.codex/skills/openspec-quick" ".codex/skills/openspec-quick"
  remove_obsolete_path "$TARGET_DIR/.codex/skills/gstack-plan-eng-review" ".codex/skills/gstack-plan-eng-review"
  remove_obsolete_path "$TARGET_DIR/.codex/skills/gstack-plan-design-review" ".codex/skills/gstack-plan-design-review"
  remove_obsolete_path "$TARGET_DIR/.codex/skills/gstack-cso" ".codex/skills/gstack-cso"
  remove_obsolete_path "$TARGET_DIR/.codex/skills/gstack-review" ".codex/skills/gstack-review"

  copy_dir "$TEMPLATES/codex/skills/wf-quick" \
    "$TARGET_DIR/.codex/skills/wf-quick" ".codex/skills/wf-quick"
  copy_dir "$TEMPLATES/codex/skills/wf-small" \
    "$TARGET_DIR/.codex/skills/wf-small" ".codex/skills/wf-small"
  copy_dir "$TEMPLATES/codex/skills/wf-complex" \
    "$TARGET_DIR/.codex/skills/wf-complex" ".codex/skills/wf-complex"
  copy_dir "$TEMPLATES/codex/skills/wf-debug" \
    "$TARGET_DIR/.codex/skills/wf-debug" ".codex/skills/wf-debug"
  copy_dir "$TEMPLATES/codex/skills/wf-plan" \
    "$TARGET_DIR/.codex/skills/wf-plan" ".codex/skills/wf-plan"
  copy_dir "$TEMPLATES/codex/skills/wf-finish" \
    "$TARGET_DIR/.codex/skills/wf-finish" ".codex/skills/wf-finish"
  copy_dir "$TEMPLATES/codex/skills/wf-status" \
    "$TARGET_DIR/.codex/skills/wf-status" ".codex/skills/wf-status"
  copy_dir "$TEMPLATES/codex/skills/wf-install" \
    "$TARGET_DIR/.codex/skills/wf-install" ".codex/skills/wf-install"
fi

# — AGENTS.md ─────────────────────────────────────────────────────────────────
if [[ ! -f "$TARGET_DIR/AGENTS.md" ]]; then
  cat > "$TARGET_DIR/AGENTS.md" << 'AGENTSMD'
# AGENTS.md

项目级 AI 协作说明。下方 agentic-workflow 受控块由安装脚本维护。
AGENTSMD
  ok "AGENTS.md"
  INSTALLED+=("AGENTS.md")
fi
upsert_workflow_block "$TARGET_DIR/AGENTS.md" "Codex" "$PROJECT_TYPE" "AGENTS.md"

# — 安装清单 ──────────────────────────────────────────────────────────────────
write_manifest "$TARGET_DIR" "$PROJECT_TYPE" "$INSTALL_CLAUDE" "$INSTALL_CODEX"

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
MANUAL_STEPS+=("运行 ./validate-workflow.sh <目标项目> 检查模板漂移、manifest 和宿主工具")
MANUAL_STEPS+=("git add openspec/ .claude/ .codex/ AGENTS.md .agentic-workflow/manifest.json && git commit -m 'feat: install agentic workflow'")

echo -e "  ${BOLD}后续步骤：${RESET}"
for i in "${!MANUAL_STEPS[@]}"; do
  echo -e "    $((i+1)). ${MANUAL_STEPS[$i]}"
done

echo ""
echo -e "  ${CYAN}快速使用：${RESET}"
echo -e "    Claude Code: ${BOLD}/wf-quick${RESET} / ${BOLD}/wf-small${RESET} / ${BOLD}/wf-complex${RESET} / ${BOLD}/wf-debug${RESET} / ${BOLD}/wf-plan${RESET}"
echo -e "    Codex App:   ${BOLD}/wf-quick${RESET} / ${BOLD}/wf-small${RESET} / ${BOLD}/wf-complex${RESET} / ${BOLD}/wf-debug${RESET} / ${BOLD}/wf-plan${RESET}"
echo ""
echo -e "  ${GREEN}${BOLD}安装脚本执行完毕。${RESET}"
echo ""
echo -e "  ${CYAN}→ 启动 Dashboard 查看项目状态：${RESET}"
echo -e "    ${BOLD}npm --prefix \"$WORKFLOW_DIR/dashboard\" install && npm --prefix \"$WORKFLOW_DIR/dashboard\" run dev${RESET}"
echo ""
