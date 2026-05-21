# Changelog

## 1.1.4 - 2026-05-21

- 深度优化 Codex 版工作流交互：`/wf-quick`、`/wf-small`、`/wf-complex` 在 proposal / design / tasks 等关键产物后暂停确认，并展示本地路径、gate 状态和任务摘要。
- Codex App 中存在选项时优先使用 UI 交互工具；不可用时才退化为明确文本选项，覆盖设计确认、checkpoint、归档和安装/切换选择。
- 调整最终提交顺序：先完成归档决策和 spec sync，再执行 end checkpoint commit，避免归档后残留未提交文件。
- 更新所有 OpenSpec 配置模板和根配置的 checkpoint 文案，并将模板版本提升到 `1.1.4`。

## 1.1.3 - 2026-05-20

- 将 `docs/` 目录加入 `.gitignore` 并从仓库追踪中移除，避免内部设计文档随仓库公开。
- 将 `.superpowers/` 加入 `.gitignore`，避免本地会话缓存被提交。

## 1.1.2 - 2026-05-20

- 统一项目命名为 `agentic-workflow`，更新 README、安装脚本、模板配置和历史文档中的旧名称。
- 新安装和升级写入 `agentic-workflow-tier` / `agentic-workflow-version` 标记。
- 移除旧版工作流标记兼容逻辑，安装脚本仅保留当前 `agentic-workflow-*` 标记。

## 1.1.1 - 2026-05-20

- 优化 `/wf-quick` 收尾流程：验证通过后先同步 `tasks.md` 勾选状态，再询问是否归档，避免归档阶段因任务已完成但未勾选而二次打断。
- 新增 `install.sh --upgrade`，用于 `/wf-install` 升级模式覆盖已安装的受控 wf 命令和 Codex skills。
- `install.sh --no-interactive` 检测到目标项目已有 agentic-workflow 时自动进入更新模式，兼容旧版 `/wf-install` 的自升级。
- 更新 `/wf-install` 升级分支，执行安装脚本时传入 `--upgrade`。

## 1.1.0 - 2026-05-20

- 调整 `/wf-quick`、`/wf-small`、`/wf-complex` 的收尾策略：实现和验证完成后询问用户是否归档，用户确认后才执行 `/openspec-archive-change`。
- 保留 `/openspec-archive-change` 自身的变更选择、未完成任务检查和 delta spec 同步确认，避免后台静默归档。
- 新增仓库级 `VERSION` 文件，作为工作流模板版本的唯一来源，方便后续发布和升级判断。
- 更新配置模板版本到 `1.1.0`。
- 增强 `/wf-install` 的版本检查说明：已安装版本落后于仓库版本时进入升级模式。

## 1.0.0 - 2026-05-19

- 初始发布：提供 OpenSpec 配置模板、Claude Code 命令、Codex skills、安装脚本和五种项目档位。
