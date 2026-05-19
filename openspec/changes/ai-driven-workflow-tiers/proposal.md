## Why

现有工作流只有 backend / frontend 两个档位，覆盖不了 Python 数据项目、全栈 monorepo 和轻量原型场景；安装方式依赖用户手动选择，无法满足"把仓库地址丢给 AI，一句话完成安装"的目标。需要扩展档位体系，并为 AI 提供自动检测和驱动安装的能力。

## What Changes

- **新增 3 个工作流档位模板**：`python-data`（Python 数据/报表）、`fullstack`（前后端合体）、`vibe`（轻量快速模式）
- **新增 `/wf-install` 命令**（Claude Code + Codex 双版本）：AI 分析项目信号 → 置信度推荐 → 用户确认 → 安装或切换档位
- **`install.sh` 支持非交互模式**：新增 `--type`、`--switch`、`--no-interactive` 参数，供 AI 程序化调用
- **README 新增 AI 安装指南**：LLM 可读的档位说明 + 检测信号规则，使 AI 无需预装任何命令即可完成 Bootstrap
- **档位描述改为用户语言**：所有档位用"你的项目是做什么"而非"会触发哪些 gate"来描述，服务非技术用户

## Capabilities

### New Capabilities

- `workflow-tiers`: 5 个标准档位定义（backend / python-data / frontend / fullstack / vibe），含 gate 矩阵、检测信号、用户语言描述
- `ai-install-command`: `/wf-install` 命令，支持全新安装、档位切换（任意互换）、版本升级三种场景
- `bootstrap-protocol`: README AI 安装指南 + `install.sh` 非交互模式，使 AI 无需预装命令即可一句话完成安装

### Modified Capabilities

- `install-script`: `install.sh` 增加 `--type` / `--switch` / `--no-interactive` 参数；档位列表从 2 个扩展到 5 个

## Non-Goals

- 不修改 OpenSpec 状态机核心逻辑（proposal/design/tasks 流转）
- 不改变现有 GStack skill 移植版内容
- 不自动修改目标项目的业务代码或 spec 文件
- 不支持多 config.yaml 并存（fullstack 采用单文件合并规则方案）
- 档位切换不回滚已有 openspec/changes/ 历史

## Impact

- `templates/openspec/` 新增 3 个 yaml 文件
- `templates/claude/commands/` 新增 `wf-install.md`
- `templates/codex/skills/` 新增 `wf-install/SKILL.md`
- `install.sh` 参数接口变更（向后兼容，无参数时仍进入交互模式）
- `README.md` 新增 AI 安装指南章节
