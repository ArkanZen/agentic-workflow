---
name: wf-uninstall
description: |
  卸载当前项目的工作流（OpenSpec + GStack 受控文件），保留全局 /wf-install 与你的 openspec 内容。
  只操作当前项目目录，绝不触碰 $HOME。
  仅当用户显式输入 /wf-uninstall 时使用；不要因“卸载、移除工作流、uninstall”等自然语言自动触发。
---

卸载**当前项目**的工作流安装。**只操作当前项目目录，绝不触碰 `$HOME`**，因此全局 `/wf-install`（`~/.codex/skills/wf-install/`、`~/.claude/commands/wf-install.md`）始终保留。

Codex App 环境下，优先使用 Codex App 的交互/确认 UI 工具展示预览并收集确认。

## 用户决策原则

wf-uninstall 只负责检测、预览和执行用户确认过的卸载动作。执行任何删除前，必须展示将移除/保留的文件清单和风险提示，并等待用户确认；不得因为“明显要卸载”就直接执行。

## 第 0 步：定位工作流仓库

卸载逻辑由 `install.sh --uninstall` 执行，需先确定 `<agentic-workflow-path>`，按以下顺序解析，**找到即停**：

```bash
WF_PATH="$(grep -o '"workflowPath"[^,]*' .agentic-workflow/manifest.json 2>/dev/null | sed 's/.*"workflowPath"[[:space:]]*:[[:space:]]*"//;s/"$//')"
[ -n "$WF_PATH" ] && [ -f "$WF_PATH/install.sh" ] && echo "RESOLVED:$WF_PATH"
[ -z "$WF_PATH" ] && WF_PATH="$(grep '^workflowPath=' "$HOME/.agentic-workflow/config" 2>/dev/null | cut -d= -f2-)"
[ -n "$WF_PATH" ] && [ -f "$WF_PATH/install.sh" ] && echo "RESOLVED:$WF_PATH"
[ -f "$HOME/.agentic-workflow/repo/install.sh" ] && echo "RESOLVED:$HOME/.agentic-workflow/repo"
```

若都没拿到，从全局配置或 manifest 读 `sourceRepo` 按需 clone 到 `~/.agentic-workflow/repo`；仍失败再询问用户路径。

## 第一步：检测安装状态

```bash
test -f openspec/config.yaml && echo "HAS_CONFIG" || echo "NO_CONFIG"
test -f .agentic-workflow/manifest.json && echo "HAS_MANIFEST" || echo "NO_MANIFEST"
ls .claude/commands/wf-*.md 2>/dev/null
ls -d .codex/skills/wf-* 2>/dev/null
```

若三者都不存在，提示「当前项目未检测到工作流安装，无需卸载」，结束。

## 第二步：展示卸载预览，等待确认

用 Codex App 交互工具展示，**必须明确区分删除与保留**：

```
即将卸载当前项目的工作流（目标：<current-dir>）。

将删除（完全托管）：
- .claude/commands/wf-*.md（含项目级 wf-install.md / wf-uninstall.md）
- .codex/skills/wf-*/
- openspec/config.yaml
- .agentic-workflow/manifest.json、.wf-active（若存在）

将只移除工作流块、保留其余内容：
- .claude/CLAUDE.md、AGENTS.md

将完整保留（你的内容）：
- openspec/changes/、openspec/specs/、openspec/archive/

不受影响（全局）：
- ~/.codex/skills/wf-install/、~/.claude/commands/wf-install.md、~/.agentic-workflow/

执行前会自动备份到 .agentic-workflow/uninstall-backup-<时间>/（可用 --no-backup 关闭）。

请选择：确认卸载 / 取消
```

## 第三步：执行卸载

用户确认后执行（`<current-dir>` 用 `pwd` 获取，路径加引号）：

```bash
bash "<agentic-workflow-path>/install.sh" --uninstall --target "<current-dir>" --no-interactive
```

若用户明确表示不需要备份，追加 `--no-backup`。

执行后输出脚本的卸载摘要，并提醒：
- 全局 `/wf-install` 已保留，可在该项目重新运行 `/wf-install` 安装；
- 备份目录确认无误后可删除；
- 若需将卸载提交到版本控制：`git add -A && git commit -m 'chore: uninstall agentic workflow'`。
