# Changelog

## 1.1.10 - 2026-05-22

- 补齐所有 OpenSpec 档位模板中的文件命名规范和路径展示规则，确保新安装项目也能继承中文工件命名与绝对路径输出要求。
- 增强 `validate-workflow.sh` 的版本源检查，发布前会校验模板是否包含文件命名规范和路径展示规则。
- 更新 `/wf-install` 文档对 VERSION 占位符的描述，避免与模板渲染实现产生歧义。

## 1.1.9 - 2026-05-22

- 修复 `openspec/config.yaml` 中 `naming:` 节不生效的问题：openspec CLI 不识别该自定义键，命名规范从未注入 AI 指令。将命名规范合并进 `context:` 字段，确保所有工件（proposal/design/tasks/specs）生成时均能获取中文命名规则。

## 1.1.8 - 2026-05-21

- Codex `/wf-*` 工作流新增强制依赖加载规则：显式声明 required/conditional skills、OpenSpec workflow 和 GStack review，不再只写“按方法论执行”。
- Codex `/wf-debug`、`/wf-complex`、`/wf-small`、`/wf-quick`、`/wf-plan` 新增启动自检和收尾审计，要求列出依赖加载状态、降级原因、gate/review 和验证结果。
- `AGENTS.md` 受控块和 README 新增依赖加载规则说明；缺少 Superpowers/GStack 时必须说明影响并等待用户确认后再降级。
- OpenSpec 配置模板改用 `__WORKFLOW_VERSION__` 占位符，安装和切换档位时由 `install.sh` 根据根目录 `VERSION` 渲染，避免多处手动改版本号。
- 新增 `scripts/bump-version.sh` 和 doctor 版本源检查，发布时只需维护 `VERSION` 和 `CHANGELOG.md`，模板中硬编码版本会被拦截。
- 清理 OpenSpec apply/archive 文档中的悬空引用：归档同步改用 `openspec archive`，blocked apply 改为复用 propose 或 `openspec instructions` 补齐 artifact；doctor 新增悬空 workflow 引用检查。

## 1.1.7 - 2026-05-21

- 工作流生成工件后强制展示完整绝对路径（非相对路径），便于用户直接定位文件。
- `openspec/config.yaml` 新增 `naming` 节：设计文档文件名使用中文，项目专有名词（API、模型名、功能 key）可保留英文；OpenSpec change 目录名继续使用 kebab-case。

## 1.1.6 - 2026-05-21

- 迁移版本检测到 GitHub Releases：`install.sh` 安装时自动检测 GitHub remote URL 写入 manifest.json `sourceRepo` 字段；`/wf-install` 优先通过 `git ls-remote --tags` 获取最新 release tag，无需本地仓库路径，无需手动 bump 版本。
- 旧版 manifest（无 `sourceRepo`）自动退化为本地路径模式，向后兼容。
- README 新增"发布新版本"章节，说明 `v<semver>` tag 约定。

## 1.1.5 - 2026-05-21

- 补全 Codex `/wf-install` 的 UI 优先规则：INSTALL 步骤 3（档位推荐）、步骤 4（仓库路径）、SWITCH 步骤 1（未归档警告）、步骤 3（仓库路径）、步骤 4（档位选择）均改为优先使用 AskUserQuestion 或等价 UI 交互工具；SWITCH 步骤 1 的文本 `[y/N]` 改为结构化 A/B 选项。
- Claude 端 `wf-small`、`wf-complex`、`wf-quick` 新增产物确认节点（绝对路径 + checkbox 摘要 + AskUserQuestion），对齐 Codex 版交互体验。
- 修正三个工作流的 `commit_checkpoints.end` 调用时机：统一移至归档决策之后，与 `openspec/config.yaml` 规范一致。

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
