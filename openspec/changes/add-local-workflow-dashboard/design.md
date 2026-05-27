## GStack Gate

- 状态：通过
- 审查命令：/gstack-plan-eng-review
- 阻断项：无
- 审查摘要：基于当前 OpenSpec design 直接审查；MVP 范围收敛在 `dashboard/` 本地 Node Web UI，复用现有脚本，写操作采用白名单命令和已扫描项目路径，风险可由测试和 UI 二次确认覆盖。
- 复核摘要：工具能力板块重构仍属于展示层和能力检测层改动，不新增危险写操作；需确保“工作流是否定义该能力”由后端结构化字段提供，避免前端凭文案猜测。

## Context

当前项目以 shell 脚本、OpenSpec 工件和宿主 skill/command 模板提供工作流能力。安装状态主要落在 `.agentic-workflow/manifest.json`、`openspec/config.yaml`、`.codex/skills/`、`.claude/commands/` 中；健康检查由 `validate-workflow.sh` 输出。用户维护多个本地项目时，需要反复进入不同目录执行命令，缺少统一视图。

本设计新增 `dashboard/` 本地 Node Web UI。它不是远程后台，只在用户本机运行，通过本地 API 读取项目工作流状态并包装已有脚本。

## Goals / Non-Goals

**Goals:**
- 提供本地项目列表，展示安装状态、档位、版本、宿主、doctor 结果和工具依赖状态。
- 提供单项目详情页，展示 manifest、config、OpenSpec active/archive 统计和受控文件漂移。
- 支持运行 doctor、工作流升级、档位切换等受控维护操作。
- 使用极客风暗色界面，优先服务扫描、比较和维护效率。
- 复用现有脚本，不复制安装/校验核心逻辑。

**Non-Goals:**
- 不提供远程访问、账号体系、团队权限或中心化数据库。
- 不做任意插件市场、拖拽流程编排或第三方插件自动安装。
- 不修改目标项目业务代码。
- 不在 MVP 中实现完整 OpenSpec 编辑器，只展示统计和文件入口。

## Decisions

### 1. 使用 dashboard 子项目承载 Node 本地 Web UI

新增 `dashboard/`，包含 Vite + React 前端和 Express 本地 API。开发时由一个 Node 命令同时启动 API 和静态资源服务。

备选方案：
- Tauri 桌面应用：体验更像后台工具，但首版引入桌面打包和系统权限复杂度。
- 纯静态页面：实现快，但无法安全执行 doctor、升级和扫描本地文件。

选择 Node Web UI，因为它最贴合当前仓库脚本生态，MVP 可以快速验证信息架构和操作闭环。

### 2. 项目发现以显式扫描根目录为边界

API 默认扫描 `~/aiworkspace`、`~/workspace` 和当前仓库父目录；用户可在 UI 输入额外扫描根。扫描只识别含 `.agentic-workflow/manifest.json` 或 `openspec/config.yaml` 工作流标记的目录。

这样避免全盘扫描带来的性能和隐私风险，也让未来可以把扫描根保存到本地配置。

### 3. 状态读取优先复用现有文件和脚本

项目状态来源：
- `.agentic-workflow/manifest.json`：版本、档位、宿主、受控文件。
- `openspec/config.yaml`：档位和版本注释、gate 配置。
- `validate-workflow.sh <project>`：doctor 结果和模板漂移。
- `openspec list --json`：active change 数量、完成任务统计。
- 本机命令检测：`openspec --version`、GStack/Superpowers 路径。

本地 API 做轻量解析，不重新实现 install/doctor 规则。

### 4. 工具能力按 AI 宿主分组展示

工具能力不再以扁平卡片展示 `OpenSpec CLI`、`Codex GStack` 等内部字段，而是按当前支持的 AI 宿主分组：
- `Codex App`：展示 Codex 侧 GStack、Superpowers 和已安装/未安装状态。
- `Claude CLI`：展示 Claude 侧 GStack、Superpowers 和已安装/未安装状态。
- `Shared`：展示 OpenSpec CLI 等跨宿主基础能力。

每个能力项展示英文专有名词作为主标题，中文说明作为副标题；状态用文本/指示灯表达，版本号或安装路径作为详情，不再把“可用”做成类似操作按钮的样式。

同时，能力项需要展示工作流是否定义了该能力，以及定义了哪些命令或 skill。例如 OpenSpec 定义 `openspec-propose`、`openspec-apply-change`、`openspec-archive-change`；GStack 在 Codex App 和 Claude CLI 中分别有宿主映射；Superpowers 在 Codex App 和 Claude CLI 的不同 `/wf-*` 中均有定义。

能力面板还需要面向新用户展示版本与更新方式：
- OpenSpec CLI 查询当前版本和 npm 最新版本，落后时提供受控更新动作。
- Codex App 与 Claude CLI 的 GStack 分别按各自安装目录检查版本，落后时提供对应 setup 更新动作。
- Superpowers 按宿主插件市场管理，展示当前插件版本和更新说明，不伪装成可执行的一键更新。
- 每个 `/wf-*` 的官方说明和本项目说明默认折叠，避免长文本压垮页面。

### 5. 写操作必须是受控命令

维护操作只允许调用白名单命令：
- `bash install.sh --target <project> --type <tier> --no-interactive --upgrade`
- `bash install.sh --target <project> --type <tier> --no-interactive --switch`
- `bash validate-workflow.sh <project>`
- 更新目标项目 `.gitignore` 的受控工作流文档忽略块

所有写操作在前端展示影响范围和命令摘要后再执行。API 不提供任意 shell 输入。

## Data Flow

```text
Browser UI
   |
   | HTTP /api/projects /api/projects/:id/doctor /api/projects/:id/actions
   v
Local Express API
   |
   +-- Project scanner
   |     `-- manifest/config/host template checks
   |
   +-- Doctor runner
   |     `-- validate-workflow.sh <project>
   |
   +-- Workflow operator
   |     `-- install.sh --upgrade / --switch
   |
   `-- OpenSpec reader
         `-- openspec list --json
```

## Risks / Trade-offs

- [Risk] 本地 API 误执行任意命令 → Mitigation：只允许固定白名单动作和受限参数，路径必须来自已扫描项目。
- [Risk] 扫描大目录变慢 → Mitigation：限制扫描深度，优先查找 `.agentic-workflow/manifest.json`，UI 显示扫描中状态。
- [Risk] doctor 输出格式变化导致解析不准 → Mitigation：MVP 同时保留原始输出，结构化统计只作为辅助展示。
- [Risk] Node 依赖增加仓库复杂度 → Mitigation：所有新增内容放入 `dashboard/`，不影响现有安装脚本。

## Migration Plan

1. 新增 `dashboard/` 子项目和 README。
2. 实现本地 API、扫描器、doctor runner、受控操作接口。
3. 实现暗色仪表盘 UI。
4. 补充单元测试覆盖解析和命令构造逻辑。
5. 在主 README 增加本地 dashboard 的启动说明。

回滚策略：删除 `dashboard/` 和 README 中相关说明，不影响既有工作流安装能力。

## Open Questions

- MVP 是否需要持久化扫描根目录；首版可先用运行时输入，后续再加本地配置文件。
