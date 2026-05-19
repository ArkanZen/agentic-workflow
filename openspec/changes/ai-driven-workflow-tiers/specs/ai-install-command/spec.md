## ADDED Requirements

### Requirement: /wf-install 三种操作模式
系统 SHALL 在 `/wf-install` 命令中自动检测当前状态并路由到对应操作模式：
- **INSTALL**：`openspec/config.yaml` 不存在，执行全量安装
- **UPGRADE**：config.yaml 存在且版本落后，提示升级
- **SWITCH**：config.yaml 存在且版本相同，展示档位列表供切换

#### Scenario: 全新项目安装
- **WHEN** 目标项目无 `openspec/config.yaml`
- **THEN** 进入 INSTALL 模式，AI 分析项目信号，输出置信度推荐，用户确认后调用 `install.sh --type <档位> --no-interactive`

#### Scenario: 档位切换
- **WHEN** 用户执行 `/wf-install` 且已有 config.yaml
- **THEN** 进入 SWITCH 模式，展示当前档位和所有可切换目标，用户选择后替换 config.yaml，保留 `openspec/changes/` 历史

#### Scenario: 任意档位互换
- **WHEN** 用户选择任意目标档位（包括 vibe ↔ backend 等跨类型切换）
- **THEN** 系统不阻止任何方向的切换，仅在有未归档变更时展示警告

---

### Requirement: 未归档变更警告
系统 SHALL 在切换档位前检查未归档变更，存在时展示警告并要求用户确认。

未归档变更定义：`openspec/changes/` 下存在子目录且该目录无 `.archived` 标记文件。

#### Scenario: 切换时有未归档变更
- **WHEN** 用户确认切换档位，且存在 N 个未归档变更
- **THEN** 展示变更名称列表和警告文案，询问"继续切换？[y/N]"，默认不切换

#### Scenario: 切换时无未归档变更
- **WHEN** 用户确认切换档位，且无未归档变更
- **THEN** 直接执行切换，无额外确认步骤

---

### Requirement: 命令双版本
系统 SHALL 同时提供 Claude Code 版（`.claude/commands/wf-install.md`）和 Codex 版（`.codex/skills/wf-install/SKILL.md`），两者行为一致。

#### Scenario: Claude Code 安装后可用
- **WHEN** `install.sh` 完成安装（含 Claude Code 工具链）
- **THEN** `.claude/commands/wf-install.md` 存在，用户可在 Claude Code 中运行 `/wf-install`

#### Scenario: Codex 安装后可用
- **WHEN** `install.sh` 完成安装（含 Codex 工具链）
- **THEN** `.codex/skills/wf-install/SKILL.md` 存在，用户可在 Codex App 中使用
