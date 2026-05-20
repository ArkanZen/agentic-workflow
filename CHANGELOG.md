# Changelog

## 1.1.0 - 2026-05-20

- 调整 `/wf-quick`、`/wf-small`、`/wf-complex` 的收尾策略：实现和验证完成后询问用户是否归档，用户确认后才执行 `/openspec-archive-change`。
- 保留 `/openspec-archive-change` 自身的变更选择、未完成任务检查和 delta spec 同步确认，避免后台静默归档。
- 新增仓库级 `VERSION` 文件，作为工作流模板版本的唯一来源，方便后续发布和升级判断。
- 更新配置模板版本到 `1.1.0`。
- 增强 `/wf-install` 的版本检查说明：已安装版本落后于仓库版本时进入升级模式。

## 1.0.0 - 2026-05-19

- 初始发布：提供 OpenSpec 配置模板、Claude Code 命令、Codex skills、安装脚本和五种项目档位。
