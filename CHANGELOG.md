# Changelog

## 1.5.0 - 2026-06-29

- 新增 **`/wf-uninstall`**：卸载当前项目的工作流（OpenSpec + GStack 受控文件），**保留全局 `/wf-install`** 和你的 openspec 内容。
- `install.sh` 新增 `--uninstall` 模式：删除 wf-* 命令/skill、`openspec/config.yaml`、manifest、`.wf-active`；对 `.claude/CLAUDE.md`、`AGENTS.md` 仅剥离工作流块、保留其余内容；`openspec/changes`、`specs`、`archive` 等用户内容完整保留；**只操作目标项目目录，绝不触碰 `$HOME`**。默认卸载前备份到 `.agentic-workflow/uninstall-backup-<时间>/`，可用 `--no-backup` 关闭。
- 新增 `wf-uninstall` 模板（Claude + Codex），随项目安装；交互式预览删除/保留清单并确认后执行。
- 修复 `--uninstall` 预览中变量与全角标点相邻导致的 `unbound variable`（变量引用加花括号）。

## 1.4.0 - 2026-06-29

- 新增**全局安装**：`/wf-install` 可装到宿主全局（`~/.claude/commands/`、`~/.codex/skills/`），任意新项目无需先跑 install.sh 即可运行 `/wf-install` 安装工作流；不运行则不改动该项目（零入侵）。
- `install.sh` 新增 `--global` 模式：写入全局命令/skill 和全局配置 `~/.agentic-workflow/config`（记录 `sourceRepo`、`workflowPath`），不针对任何项目。
- 新增 `bootstrap.sh`：`curl -fsSL .../bootstrap.sh | bash` 一行安装——自动 clone/更新缓存仓库 `~/.agentic-workflow/repo` 后调 `install.sh --global`。
- `wf-install` 模板（Claude + Codex）新增「第 0 步：定位工作流仓库」：按 manifest → 全局配置 → 缓存仓库 → 按需 clone 的顺序解析仓库路径，全新项目自动 clone 到缓存，不再每次手输路径。

## 1.3.5 - 2026-06-22

- 修复 Codex App 端 `/wf-status` 安装失败：v1.3.4 在 install.sh 引用了 `templates/codex/skills/wf-status`，但该模板目录从未创建，导致安装时报 `cp: ... No such file or directory`。补建 `templates/codex/skills/wf-status/SKILL.md`（基于 Codex 版 wf-finish，沿用"优先使用 Codex App UI 交互工具"约定）。

## 1.3.4 - 2026-06-02

- install.sh 补充 `/wf-finish` 和 `/wf-status` 的 copy 调用（此前新项目升级后缺少这两个命令）。
- wf-debug 新增轻量路径：根因已知时跳过诊断收集和 skill 加载；git log 改为仅在疑似回归时运行，减少无关 context 消耗。

## 1.3.3 - 2026-06-02

- 新增 `/wf-finish` 命令：显式关闭当前工作流，区分 wf-plan/wf-debug（无 change，直接关闭）和 wf-quick/small/complex（有 in-progress change，询问保留或放弃）。
- 所有 wf-* 模板新增**切换与退出规则**：收到超出范围请求时必须先宣告工作流状态再处理，不得静默切换；调用其他 /wf-* 命令时自动切换当前工作流。
- CLAUDE.md 新增工作流切换全局规则，/wf-finish 加入命令列表。
- Claude Code 和 Codex App 两端同步上述改动。

## 1.3.2 - 2026-06-01

- Codex skills 全面同步 v1.3.x 改动：wf-debug / wf-small / wf-complex / wf-plan / wf-quick（已在 v1.3.0 完成）均已对齐 Claude 版模板。
- wf-debug Codex：新增诊断前置步骤（症状/最近 commit/相关文件/错误输出）、/gstack-investigate 条件路径（GStack 不可用时降级到 systematic-debugging）、状态行规则。
- wf-small Codex：新增状态行、.wf-active 写入/删除、任务上下文注入（git diff + grep）、归档默认化（任务全完成时直接归档）。
- wf-complex Codex：新增状态行、.wf-active 写入/删除、writing-plans 移到 propose 后展示前（修正位置）、归档默认化。
- wf-plan Codex：新增状态行。

## 1.3.1 - 2026-06-01

- wf-complex 修正 writing-plans 调用位置：从「用户确认实现后」移到「propose 完成后、展示结果前」（步骤 4→5），用户看到的 tasks 已经过细化，所见即所得。
- wf-debug 新增 /gstack-investigate 条件路径：多文件调用链复杂 bug 优先推荐 /gstack-investigate；GStack 未安装时显式说明并降级到 systematic-debugging；简单 bug 保留原有 systematic-debugging 路径。

## 1.3.0 - 2026-06-01

- 新增工作流状态感知（A 方案）：所有 wf-* 执行期间每次回复顶部输出状态行 `> wf-[name] · [change] · 步骤 N/M`，用户随时能确认当前所在步骤，支持口头纠偏。
- 新增 `.wf-active` 状态文件（B 方案）：wf-quick/small/complex 启动时写入，归档提交后删除，自动追加到 `.gitignore`；新增 `/wf-status` 命令读取并展示当前状态，支持恢复或放弃。
- CLAUDE.md 新增会话启动检测：每次对话开始时检查 `.wf-active`，存在时提示用户有未完成工作流。
- wf-quick 快速确认优化：proposal/tasks 展示后改为软确认，去掉强制 AskUserQuestion 阻塞，减少 vibe 用户主干路径交互次数。
- wf-quick/small/complex 归档默认化：所有任务完成时直接说明准备归档并执行；用户说「跳过归档」才保留 active；有未完成任务时保留原有询问流程。
- wf-quick/small 新增任务上下文注入（P2）：生成 tasks.md 前自动运行 `git diff --stat HEAD` 并 grep 相关源文件，使每个任务引用具体文件路径而非泛化描述。
- wf-debug 新增诊断前置步骤（P2）：执行 skill 前先完成结构化诊断收集（症状 / 最近 commit / 相关文件 / 错误输出），提升 debug 起点质量。

## 1.2.0 - 2026-05-27

- 新增本地 Dashboard MVP：用 Node Web UI 查看本机项目、工作流档位、OpenSpec 统计、doctor 结果、工作流策略和工具能力。
- Dashboard 支持自定义扫描目录，能识别已安装、部分配置和普通可安装项目；安装、升级和切档成功后会自动刷新项目列表。
- 新增 Dashboard 安装向导：先检测目标项目，再由用户选择 install / upgrade / switch-tier / status-only，执行前展示写入文件、目标档位、宿主和版本影响。
- 工具能力页按 OpenSpec、GStack、Superpowers 分组，展示版本检测、AI 宿主支持、官方技能手册、工作流引用、项目启用和本机可用状态，并支持搜索过滤。
- 工作流配置新增 `risk_triggers`，Dashboard 工作流策略页会优先读取项目真实配置，缺失时才回退到档位预设。
- `/wf-install` 改为用户决策优先：AI 只做检测和推荐，写入前必须展示选择面板和预览。
- `/wf-small` 风险判断改为轻量表格，降低工作流启动阶段的 token 消耗。
- doctor 默认把 `.DS_Store` 作为本地系统文件忽略，不再产生警告；需要查看路径时可设置 `VERBOSE_DS_STORE=1`。

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
