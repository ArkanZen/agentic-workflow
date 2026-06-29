#!/usr/bin/env bash
# agentic-workflow/bootstrap.sh
# 一行安装全局 /wf-install 引导命令（无需先手动 clone 仓库）
#
# 用法：
#   curl -fsSL https://raw.githubusercontent.com/ArkanZen/agentic-workflow/master/bootstrap.sh | bash
#
# 可选环境变量：
#   AGENTIC_WORKFLOW_SOURCE_REPO  覆盖源仓库地址（默认 ArkanZen/agentic-workflow）
#   AGENTIC_WORKFLOW_REF          指定分支/标签（默认 master）

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
ok()   { echo -e "  ${GREEN}✓${RESET} $*"; }
err()  { echo -e "  ${RED}✗${RESET}  $*" >&2; }
info() { echo -e "  ${CYAN}→${RESET} $*"; }

SOURCE_REPO="${AGENTIC_WORKFLOW_SOURCE_REPO:-https://github.com/ArkanZen/agentic-workflow}"
REF="${AGENTIC_WORKFLOW_REF:-master}"
CACHE_DIR="$HOME/.agentic-workflow/repo"

command -v git >/dev/null 2>&1 || { err "需要 git，请先安装 git"; exit 1; }

echo ""
echo -e "${BOLD}${CYAN}agentic-workflow 全局引导安装${RESET}"
info "源仓库: $SOURCE_REPO ($REF)"
info "缓存目录: $CACHE_DIR"
echo ""

if [[ -d "$CACHE_DIR/.git" ]]; then
  info "缓存仓库已存在，更新中…"
  git -C "$CACHE_DIR" fetch --depth 1 origin "$REF" --quiet
  git -C "$CACHE_DIR" checkout --quiet "$REF" 2>/dev/null || true
  git -C "$CACHE_DIR" reset --hard "origin/$REF" --quiet 2>/dev/null \
    || git -C "$CACHE_DIR" pull --ff-only --quiet
  ok "缓存仓库已更新"
else
  mkdir -p "$(dirname "$CACHE_DIR")"
  info "clone 仓库到缓存…"
  git clone --single-branch --branch "$REF" --depth 1 "$SOURCE_REPO" "$CACHE_DIR" --quiet
  ok "已 clone 到 $CACHE_DIR"
fi

echo ""
bash "$CACHE_DIR/install.sh" --global
