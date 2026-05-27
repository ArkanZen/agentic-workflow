## 1. Dashboard 项目骨架

- [x] 1.1 创建 `dashboard/` Node 本地 Web UI 项目结构、脚本和 README，覆盖 Geek style dashboard UI。
- [x] 1.2 配置 Vite + React + Express 开发入口，确保一个命令可启动本地 API 和前端页面，覆盖 Project discovery。

## 2. 本地 API 与扫描能力

- [x] 2.1 实现项目扫描器，读取显式扫描根中的 manifest/config 并识别已安装或部分配置项目，覆盖 Project discovery。
- [x] 2.2 实现能力检测和 OpenSpec 统计读取，覆盖 Project health summary 与 OpenSpec statistics。
- [x] 2.3 实现 doctor runner，包装 `validate-workflow.sh` 并解析通过、警告、失败数量，同时保留原始输出，覆盖 Project health summary。
- [x] 2.4 实现受控 workflow actions API，仅允许 doctor、upgrade、switch tier 白名单动作，覆盖 Controlled workflow actions。

## 3. 前端仪表盘体验

- [x] 3.1 实现暗色极客风项目总览，展示项目名、路径、档位、版本、宿主、健康和能力状态，覆盖 Geek style dashboard UI。
- [x] 3.2 实现项目详情面板，展示 manifest、OpenSpec 统计、doctor 输出和可用维护操作，覆盖 Project health summary 与 OpenSpec statistics。
- [x] 3.3 实现写操作确认交互，展示影响范围和动作摘要后再调用受控 API，覆盖 Controlled workflow actions。
- [x] 3.4 增加 gitignore 一键忽略工作流文档动作，覆盖 Controlled workflow actions。
- [x] 3.5 将工具能力板块改为按 Codex App、Claude CLI 和 Shared 分组展示，覆盖 Project health summary。
- [x] 3.6 展示工作流定义了哪些 OpenSpec/GStack/Superpowers 命令或 skill，以及哪些能力未定义，覆盖 Project health summary。
- [x] 3.7 增加工具版本检测、更新提示和宿主差异化更新动作，覆盖 Project health summary 与 Controlled workflow actions。
- [x] 3.8 优化工具能力排版，增加新手摘要和可折叠工作流说明，覆盖 Geek style dashboard UI。

## 4. 验证与文档

- [x] 4.1 为扫描器、doctor 输出解析和命令构造补充单元测试，覆盖 Project discovery、Project health summary、Controlled workflow actions。
- [x] 4.2 在主 README 中补充 dashboard 启动方式和 MVP 能力说明，覆盖 Geek style dashboard UI。
- [x] 4.3 运行构建、测试和 OpenSpec 状态检查，确认任务可验证完成。
