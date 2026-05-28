# agentic-workflow Dashboard

本目录提供本地 Node Web UI MVP，用于查看本机项目的 agentic-workflow 安装状态、OpenSpec 统计、doctor 结果和受控维护操作。

## 启动

```bash
cd dashboard
npm install
npm run dev
```

默认地址：

- 前端：`http://127.0.0.1:5173`
- 本地 API：`http://127.0.0.1:4317`

## MVP 能力

- 扫描显式目录下安装或部分配置了 agentic-workflow 的项目。
- 在设置页自定义扫描目录；默认只扫描当前工作流仓库，避免绑定个人 workspace 路径。
- 扫描已安装、部分配置和普通可安装项目；普通项目通过 `.git`、`package.json`、`pyproject.toml`、`requirements.txt`、`go.mod` 等信号识别。
- 使用菜单切换总览、工具能力、工作流、健康检查和设置，减少单页信息堆叠。
- 工作流策略页解释项目档位、任务工作流、风险触发器和插件能力之间的关系。
- 工具能力按 OpenSpec、GStack、Superpowers 分页展示 AI 支持矩阵、官方技能、工作流已用技能、项目启用状态和本机可用状态，并支持搜索和状态过滤。
- 安装工作流页先检测目标项目状态，再由用户选择安装、升级、切换 workflow tier 或只看状态；执行前展示写入文件、版本、宿主和保留 OpenSpec 内容的说明。
- 展示档位、版本、宿主、工具能力和 OpenSpec active change 统计。
- 运行 doctor 并展示通过、警告、失败数量和原始输出。
- 通过白名单动作触发工作流安装、升级、档位切换和工作流文档 gitignore 写入。

## 边界

- 只在本机运行，不提供远程访问和账号体系。
- API 不接受任意 shell 命令，只执行预定义维护动作。
- 首版不自动安装第三方插件。
- 发布包不应包含 `node_modules/`、`dist/`、`.playwright-mcp/`、`.DS_Store` 等本地依赖、构建产物和验证临时文件。
