#!/usr/bin/env bash
# agentic-workflow/validate-workflow.sh
# 检查目标项目中的 agentic-workflow 安装状态、模板漂移和宿主工具可用性。

set -uo pipefail

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

ok() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo -e "  ${GREEN}✓${RESET} $*"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  echo -e "  ${YELLOW}⚠${RESET}  $*"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo -e "  ${RED}✗${RESET}  $*"
}

info() {
  echo -e "  ${CYAN}→${RESET} $*"
}

step() {
  echo -e "\n${BOLD}${BLUE}──${RESET} ${BOLD}$*${RESET}"
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WF_SKILL_NAMES=(wf-quick wf-small wf-complex wf-debug wf-plan wf-install)
target_dir="${1:-$PWD}"
if ! target_dir="$(realpath "$target_dir" 2>/dev/null)"; then
  fail "目标目录不存在：$target_dir"
  exit 1
fi

workflow_version="unknown"
if [[ -f "$script_dir/VERSION" ]]; then
  workflow_version="$(tr -d '[:space:]' < "$script_dir/VERSION")"
fi

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

read_marker() {
  local file="$1" key="$2"
  if [[ ! -f "$file" ]]; then
    return 1
  fi
  grep -E "(^#|<!--) agentic-workflow-${key}:" "$file" 2>/dev/null |
    head -1 |
    sed -E "s/.*agentic-workflow-${key}: *([^ >-]+).*/\1/"
}

compare_path() {
  local expected="$1" actual="$2" label="$3"
  if [[ ! -e "$expected" ]]; then
    fail "缺少模板：$expected"
    return
  fi
  if [[ ! -e "$actual" ]]; then
    warn "$label 未安装：$actual"
    return
  fi
  if diff -qr "$expected" "$actual" >/dev/null 2>&1; then
    ok "$label 与模板一致"
  else
    warn "$label 与模板存在差异"
    info "可运行：diff -ru \"$expected\" \"$actual\""
  fi
}

compare_codex_wf_skills() {
  local name
  for name in "${WF_SKILL_NAMES[@]}"; do
    compare_path "$script_dir/templates/codex/skills/$name" "$target_dir/.codex/skills/$name" "Codex $name"
  done
}

compare_claude_wf_commands() {
  local name
  for name in "${WF_SKILL_NAMES[@]}"; do
    compare_path "$script_dir/templates/claude/commands/$name.md" "$target_dir/.claude/commands/$name.md" "Claude $name"
  done
}

check_codex_dependency_guards() {
  local name file; local -a missing
  for name in "${WF_SKILL_NAMES[@]}"; do
    file="$script_dir/templates/codex/skills/$name/SKILL.md"
    missing=()
    grep -q "## 强制依赖清单" "$file" 2>/dev/null || missing+=("强制依赖清单")
    grep -q "## 启动自检" "$file" 2>/dev/null || missing+=("启动自检")
    grep -q "## 收尾审计" "$file" 2>/dev/null || missing+=("收尾审计")
    if [[ "${#missing[@]}" -eq 0 ]]; then
      ok "Codex $name 依赖守卫完整"
    else
      fail "Codex $name 缺少依赖守卫：${missing[*]}"
    fi
  done
}

check_version_source() {
  local file hardcoded_count
  for file in "$script_dir"/templates/openspec/config-*.yaml; do
    if grep -q "__WORKFLOW_VERSION__" "$file" 2>/dev/null; then
      ok "$(basename "$file") 使用 VERSION 占位符"
    else
      fail "$(basename "$file") 未使用 __WORKFLOW_VERSION__ 占位符"
    fi
    if grep -q "文件命名规范" "$file" 2>/dev/null; then
      ok "$(basename "$file") 包含文件命名规范"
    else
      fail "$(basename "$file") 缺少文件命名规范"
    fi
    if grep -q "路径展示规则" "$file" 2>/dev/null; then
      ok "$(basename "$file") 包含路径展示规则"
    else
      fail "$(basename "$file") 缺少路径展示规则"
    fi
  done

  hardcoded_count="$(grep -R "agentic-workflow-version: [0-9]" "$script_dir/templates" 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "$hardcoded_count" -eq 0 ]]; then
    ok "模板未硬编码发布版本"
  else
    fail "模板中仍有 $hardcoded_count 处硬编码发布版本"
  fi
}

check_config_risk_triggers() {
  local file name missing
  for file in "$script_dir"/templates/openspec/config-*.yaml; do
    name="$(basename "$file")"
    missing=()
    grep -q "^risk_triggers:" "$file" 2>/dev/null || missing+=("risk_triggers")
    grep -q "spec_change:" "$file" 2>/dev/null || missing+=("spec_change")
    grep -q "final_verification:" "$file" 2>/dev/null || missing+=("final_verification")
    case "$name" in
      config-vibe.yaml)
        grep -q "security:" "$file" 2>/dev/null || missing+=("security")
        ;;
      config-frontend.yaml)
        grep -q "ui:" "$file" 2>/dev/null || missing+=("ui")
        grep -q "browser_qa:" "$file" 2>/dev/null || missing+=("browser_qa")
        ;;
      config-backend.yaml)
        grep -q "architecture:" "$file" 2>/dev/null || missing+=("architecture")
        grep -q "security:" "$file" 2>/dev/null || missing+=("security")
        grep -q "code_review:" "$file" 2>/dev/null || missing+=("code_review")
        ;;
      config-fullstack.yaml)
        grep -q "architecture:" "$file" 2>/dev/null || missing+=("architecture")
        grep -q "ui:" "$file" 2>/dev/null || missing+=("ui")
        grep -q "security:" "$file" 2>/dev/null || missing+=("security")
        grep -q "browser_qa:" "$file" 2>/dev/null || missing+=("browser_qa")
        ;;
      config-python-data.yaml)
        grep -q "data_metric:" "$file" 2>/dev/null || missing+=("data_metric")
        grep -q "security:" "$file" 2>/dev/null || missing+=("security")
        ;;
    esac
    if [[ "${#missing[@]}" -eq 0 ]]; then
      ok "$name 风险触发规则完整"
    else
      fail "$name 风险触发规则缺失：${missing[*]}"
    fi
  done

  if [[ -f "$target_dir/openspec/config.yaml" ]]; then
    if grep -q "^risk_triggers:" "$target_dir/openspec/config.yaml" 2>/dev/null; then
      ok "目标项目包含 risk_triggers 风险触发规则"
    else
      warn "目标项目缺少 risk_triggers；建议运行升级或切档同步新模板"
    fi
  fi
}

check_workflow_strategy_docs() {
  local missing=()
  grep -q "高风险逃逸检查" "$script_dir/templates/codex/skills/wf-quick/SKILL.md" 2>/dev/null || missing+=("wf-quick 高风险逃逸检查")
  grep -q "risk_triggers" "$script_dir/templates/codex/skills/wf-small/SKILL.md" 2>/dev/null || missing+=("wf-small risk_triggers")
  grep -q "/gstack-review" "$script_dir/templates/codex/skills/wf-complex/SKILL.md" 2>/dev/null || missing+=("wf-complex 实现后 review")
  grep -q "/gstack-plan-ceo-review" "$script_dir/templates/codex/skills/wf-plan/SKILL.md" 2>/dev/null || missing+=("wf-plan 产品审查")
  grep -q "安全/数据口径风险" "$script_dir/templates/codex/skills/wf-debug/SKILL.md" 2>/dev/null || missing+=("wf-debug 记录升级建议")
  if [[ "${#missing[@]}" -eq 0 ]]; then
    ok "Codex 工作流策略文档完整"
  else
    fail "Codex 工作流策略文档缺失：${missing[*]}"
  fi

  missing=()
  grep -q "高风险逃逸检查" "$script_dir/templates/claude/commands/wf-quick.md" 2>/dev/null || missing+=("wf-quick 高风险逃逸检查")
  grep -q "risk_triggers" "$script_dir/templates/claude/commands/wf-small.md" 2>/dev/null || missing+=("wf-small risk_triggers")
  grep -q "/review" "$script_dir/templates/claude/commands/wf-complex.md" 2>/dev/null || missing+=("wf-complex 实现后 review")
  grep -q "/plan-ceo-review" "$script_dir/templates/claude/commands/wf-plan.md" 2>/dev/null || missing+=("wf-plan 产品审查")
  grep -q "安全/数据口径风险" "$script_dir/templates/claude/commands/wf-debug.md" 2>/dev/null || missing+=("wf-debug 记录升级建议")
  if [[ "${#missing[@]}" -eq 0 ]]; then
    ok "Claude 工作流策略文档完整"
  else
    fail "Claude 工作流策略文档缺失：${missing[*]}"
  fi
}

check_install_user_choice_guard() {
  local missing=()
  grep -q "用户决策原则" "$script_dir/templates/codex/skills/wf-install/SKILL.md" 2>/dev/null || missing+=("Codex 用户决策原则")
  grep -q "检测完成后必须展示选择面板" "$script_dir/templates/codex/skills/wf-install/SKILL.md" 2>/dev/null || missing+=("Codex 模式选择面板")
  grep -q "执行任何写入前" "$script_dir/templates/codex/skills/wf-install/SKILL.md" 2>/dev/null || missing+=("Codex 写入前确认")
  grep -q "用户决策原则" "$script_dir/templates/claude/commands/wf-install.md" 2>/dev/null || missing+=("Claude 用户决策原则")
  grep -q "检测完成后必须展示选择面板" "$script_dir/templates/claude/commands/wf-install.md" 2>/dev/null || missing+=("Claude 模式选择面板")
  grep -q "执行任何写入前" "$script_dir/templates/claude/commands/wf-install.md" 2>/dev/null || missing+=("Claude 写入前确认")
  if [[ "${#missing[@]}" -eq 0 ]]; then
    ok "wf-install 用户选择守卫完整"
  else
    fail "wf-install 用户选择守卫缺失：${missing[*]}"
  fi
}

check_dangling_workflow_references() {
  local forbidden_count pattern
  pattern="openspec-sync-specs|openspec-continue-change|/opsx:continue|opsx:continue"
  if command -v rg >/dev/null 2>&1; then
    forbidden_count="$(rg -uu "$pattern" "$script_dir" --glob '!validate-workflow.sh' 2>/dev/null | wc -l | tr -d ' ')"
  else
    forbidden_count="$(grep -rE "$pattern" "$script_dir" --exclude='validate-workflow.sh' 2>/dev/null | wc -l | tr -d ' ')"
  fi
  if [[ "$forbidden_count" -eq 0 ]]; then
    ok "未发现悬空 OpenSpec workflow 引用"
  else
    fail "发现 $forbidden_count 处悬空 OpenSpec workflow 引用"
    info "可运行：rg -uu \"$pattern\" \"$script_dir\""
  fi
}

echo ""
echo -e "${BOLD}${CYAN}agentic-workflow doctor${RESET}"
echo -e "  工作流仓库：$script_dir"
echo -e "  目标项目：$target_dir"
echo -e "  仓库版本：$workflow_version"

step "基础文件"
if [[ -f "$target_dir/openspec/config.yaml" ]]; then
  ok "openspec/config.yaml 存在"
  config_tier="$(read_marker "$target_dir/openspec/config.yaml" tier || true)"
  config_version="$(read_marker "$target_dir/openspec/config.yaml" version || true)"
  [[ -n "${config_tier:-}" ]] && ok "config 档位：$config_tier" || warn "config 缺少 agentic-workflow-tier 标记"
  [[ -n "${config_version:-}" ]] && ok "config 版本：$config_version" || warn "config 缺少 agentic-workflow-version 标记"
  if [[ -n "${config_version:-}" && "$config_version" != "$workflow_version" ]]; then
    warn "config 版本与仓库版本不一致：$config_version != $workflow_version"
  fi
else
  fail "缺少 openspec/config.yaml"
fi

if [[ -f "$target_dir/AGENTS.md" ]]; then
  ok "AGENTS.md 存在"
  if grep -q "agentic-workflow:start" "$target_dir/AGENTS.md"; then
    ok "AGENTS.md 含受控工作流说明块"
  else
    warn "AGENTS.md 缺少受控工作流说明块"
  fi
else
  warn "AGENTS.md 不存在，Codex 项目级入口缺失"
fi

if [[ -f "$target_dir/.agentic-workflow/manifest.json" ]]; then
  ok "manifest 存在：.agentic-workflow/manifest.json"
else
  warn "manifest 不存在；重新运行 install.sh 可生成"
fi

step "模板漂移"
compare_codex_wf_skills
compare_claude_wf_commands

step "Codex 依赖守卫"
check_codex_dependency_guards

step "风险触发规则"
check_config_risk_triggers
check_workflow_strategy_docs
check_install_user_choice_guard

step "版本源"
check_version_source

step "悬空引用"
check_dangling_workflow_references

if [[ -f "$target_dir/.claude/CLAUDE.md" ]]; then
  claude_version="$(read_marker "$target_dir/.claude/CLAUDE.md" version || true)"
  if [[ -n "${claude_version:-}" ]]; then
    [[ "$claude_version" == "$workflow_version" ]] && ok "CLAUDE.md 版本一致：$claude_version" || warn "CLAUDE.md 版本落后：$claude_version != $workflow_version"
  else
    warn "CLAUDE.md 缺少版本标记"
  fi
else
  warn ".claude/CLAUDE.md 不存在"
fi

step "宿主工具"
command -v openspec >/dev/null 2>&1 && ok "openspec CLI 可用" || fail "openspec CLI 不可用"

if [[ -d "$HOME/.codex/skills/gstack" ]] || compgen -G "$HOME/.codex/skills/gstack-*" >/dev/null; then
  ok "Codex GStack skills 已安装"
else
  warn "Codex GStack skills 未安装，Codex 侧 gate 会降级或卡住"
fi

if [[ -d "$HOME/.claude/skills/gstack" || -d "$HOME/.gstack/repos/gstack" ]]; then
  ok "Claude/GStack 安装可见"
else
  warn "Claude GStack skills 未安装"
fi

if compgen -G "$HOME/.codex/plugins/cache/openai-curated/superpowers/*" >/dev/null; then
  ok "Codex Superpowers 插件已安装"
else
  warn "Codex Superpowers 插件未安装，复杂/Debug 模式会降级"
fi

step "杂项"
ds_files="$(find "$target_dir" "$script_dir/templates" -name .DS_Store -type f 2>/dev/null | sort -u)"
ds_count="$(printf '%s\n' "$ds_files" | sed '/^$/d' | wc -l | tr -d ' ')"
if [[ "$ds_count" == "0" ]]; then
  ok "未发现 .DS_Store"
else
  info "发现 $ds_count 个 .DS_Store，已按本地系统文件忽略"
  if [[ "${VERBOSE_DS_STORE:-0}" == "1" || "${AW_VERBOSE_DS_STORE:-0}" == "1" ]]; then
    printf '%s\n' "$ds_files" | sed '/^$/d' | sed 's/^/    - /'
  fi
fi

step "摘要"
echo -e "  通过：${GREEN}${PASS_COUNT}${RESET}  警告：${YELLOW}${WARN_COUNT}${RESET}  失败：${RED}${FAIL_COUNT}${RESET}"
echo ""

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi
