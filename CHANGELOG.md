# Changelog

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
