# ai-driven-workflow-tiers — Tasks

## 1. 新增 config 模板文件

- [ ] 1.1 创建 `templates/openspec/config-python-data.yaml`：在 config-backend.yaml 基础上，增加 SQL 数据口径审查 gate 规则，安全规则改为通用（不含 Apollo 专属）（spec: workflow-tiers §五档位定义）
- [ ] 1.2 创建 `templates/openspec/config-vibe.yaml`：无任何 gate，`quick_change_criteria` 设为"所有变更均可走快速通道"，附用户语言说明（spec: workflow-tiers §五档位定义）
- [ ] 1.3 创建 `templates/openspec/config-fullstack.yaml`：合并 frontend + backend gate 规则（工程审查 + UI设计审查 + 条件安全审查），context 说明含前后端两层结构（spec: workflow-tiers §Fullstack 目录结构规范）

## 2. 修改 install.sh — 档位扩展

- [ ] 2.1 将档位菜单从 2 项扩展到 5 项，使用 emoji + 用户语言描述，`PROJECT_TYPE` 变量支持 backend / python-data / frontend / fullstack / vibe（spec: install-script §档位列表扩展）
- [ ] 2.2 更新 config 模板映射：`case "$PROJECT_TYPE"` 分支覆盖全部 5 个档位（spec: install-script §档位列表扩展）
- [ ] 2.3 fullstack 档位安装后额外创建 `openspec/specs/frontend/` 和 `openspec/specs/backend/` stub 目录（spec: install-script §Fullstack 额外目录）

## 3. 修改 install.sh — 非交互参数

- [ ] 3.1 添加参数解析：`--type <档位>`、`--target <目录>`、`--no-interactive`、`--switch`（spec: bootstrap-protocol §install.sh 非交互参数）
- [ ] 3.2 `--no-interactive` 模式：跳过所有 `ask()` / `ask_yn()` / `ask_menu()` 调用，冲突文件默认跳过（spec: install-script §非交互参数支持）
- [ ] 3.3 `--switch` 模式：只替换 `openspec/config.yaml`，跳过其他文件安装，更新 CLAUDE.md / AGENTS.md 中的档位引用注释（spec: ai-install-command §档位切换）
- [ ] 3.4 验证向后兼容：无参数调用时行为与现有版本一致（spec: bootstrap-protocol §向后兼容）

## 4. 新增 /wf-install 命令

- [ ] 4.1 创建 `templates/claude/commands/wf-install.md`：包含三种操作模式路由（INSTALL / UPGRADE / SWITCH）、置信度推荐展示格式、未归档变更警告逻辑（spec: ai-install-command §三种操作模式 + §未归档变更警告）
- [ ] 4.2 创建 `templates/codex/skills/wf-install/SKILL.md`：与 Claude Code 版本行为一致的 Codex 格式（spec: ai-install-command §命令双版本）
- [ ] 4.3 检测信号规则写入命令文件：按优先级 1→2→3 的顺序，含 Python Jinja2 模板误判规避规则（spec: workflow-tiers §档位检测信号规则）

## 5. README AI 安装指南

- [ ] 5.1 在 `README.md` 新增「AI 安装指南」章节：5 个档位的用户语言描述 + 检测信号摘要 + Bootstrap 调用格式（spec: bootstrap-protocol §README AI 安装指南章节）
- [ ] 5.2 添加一句话安装示例对话，示范 AI 如何从"帮我安装"到执行 `install.sh --no-interactive`（spec: bootstrap-protocol §AI 读取 README 后完成安装）

## 6. 更新 install.sh 将 /wf-install 纳入安装清单

- [ ] 6.1 在 Claude Code 工具链安装逻辑中加入 `copy_file` 调用：安装 `wf-install.md` 到 `.claude/commands/`（spec: ai-install-command §命令双版本）
- [ ] 6.2 在 Codex 工具链安装逻辑中加入 `copy_dir` 调用：安装 `wf-install/` 到 `.codex/skills/`（spec: ai-install-command §命令双版本）

## 7. 验收测试

- [ ] 7.1 用 `bash install.sh --type python-data --target /tmp/test-project --no-interactive` 验证非交互安装，检查 config.yaml 内容和退出码
- [ ] 7.2 用 `bash install.sh --type vibe --target /tmp/test-project --switch --no-interactive` 验证档位切换，确认 changes/ 目录不被删除
- [ ] 7.3 检查 5 个档位的交互式菜单在终端中正常显示（emoji + 中文描述可见）
