#!/usr/bin/env bash
# 更新工作流版本号，并确认发布说明已准备好。

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "用法：$0 <semver版本号，例如 1.2.0>" >&2
  exit 1
fi

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
new_version="$1"

if [[ ! "$new_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "版本号必须符合 semver 三段格式：$new_version" >&2
  exit 1
fi

if ! grep -q "^## ${new_version} -" "$repo_dir/CHANGELOG.md"; then
  cat >&2 <<EOF
CHANGELOG.md 缺少 ${new_version} 对应条目，VERSION 尚未修改。
请新增标题：

## ${new_version} - YYYY-MM-DD

EOF
  exit 1
fi

printf '%s\n' "$new_version" > "$repo_dir/VERSION"

echo "已更新 VERSION：${new_version}"
echo "下一步建议运行：./validate-workflow.sh ."
