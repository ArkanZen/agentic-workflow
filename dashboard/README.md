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
- 使用菜单切换总览、工具能力、工作流、健康检查和设置，减少单页信息堆叠。
- 工具能力按 OpenSpec、GStack、Superpowers 分页展示 AI 支持矩阵、官方技能和工作流已用技能。
- 展示档位、版本、宿主、工具能力和 OpenSpec active change 统计。
- 运行 doctor 并展示通过、警告、失败数量和原始输出。
- 通过白名单动作触发工作流升级和档位切换。

## 边界

- 只在本机运行，不提供远程访问和账号体系。
- API 不接受任意 shell 命令，只执行预定义维护动作。
- 首版不自动安装第三方插件。
