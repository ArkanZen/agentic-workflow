## Why

agentic-workflow 已经能安装、升级和校验项目工作流，但多项目状态仍分散在命令行输出、manifest 和 OpenSpec 文件中。需要一个本地 Web UI，让用户直观看到哪些项目已安装工作流、各自档位和健康状态，并能安全触发常用维护操作。

## What Changes

- 新增 Node 本地 Web UI MVP，用于扫描本机项目目录并展示 agentic-workflow 安装状态。
- 新增本地 API，读取 `.agentic-workflow/manifest.json`、`openspec/config.yaml`、宿主模板和工具依赖状态。
- 支持对单项目运行 doctor，并展示通过、警告、失败数量和原始输出。
- 支持受控触发工作流更新、档位切换等维护命令，执行前展示影响范围并要求确认。
- 提供极客风暗色仪表盘界面，展示项目列表、项目详情、OpenSpec 统计、插件/工具版本状态。
- 非目标：不做远程后台、账号体系、插件市场、任意拖拽编排、业务代码修改，也不自动安装第三方插件。

## Capabilities

### New Capabilities
- `local-workflow-dashboard`: 本地项目工作流扫描、状态展示、doctor 执行和受控维护操作。

### Modified Capabilities
- 无。

## Impact

- 影响新增 `dashboard/` 本地 Web UI 与 API 代码。
- 复用现有 `install.sh`、`validate-workflow.sh`、`.agentic-workflow/manifest.json` 和 `openspec/config.yaml`。
- 可能新增 Node 前端依赖和本地开发脚本，不改变既有安装脚本行为。
