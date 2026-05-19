## MODIFIED Requirements

### Requirement: 档位列表从 2 个扩展到 5 个
`install.sh` 的交互式档位选择 SHALL 支持 5 个档位（backend / python-data / frontend / fullstack / vibe），并映射到对应 config 模板文件。

映射关系：
- `backend` → `templates/openspec/config-backend.yaml`
- `python-data` → `templates/openspec/config-python-data.yaml`
- `frontend` → `templates/openspec/config-frontend.yaml`
- `fullstack` → `templates/openspec/config-fullstack.yaml`
- `vibe` → `templates/openspec/config-vibe.yaml`

档位选择菜单 SHALL 使用用户语言描述（emoji + 中文功能描述），不使用技术 gate 术语。

#### Scenario: 交互式选择 python-data
- **WHEN** 用户在菜单中选择"🐍 Python 数据项目"
- **THEN** `PROJECT_TYPE` 设为 `python-data`，安装 `config-python-data.yaml`

#### Scenario: Fullstack 额外创建 specs 子目录
- **WHEN** 用户选择 `fullstack` 档位
- **THEN** 除安装 `config-fullstack.yaml` 外，额外创建 `openspec/specs/frontend/` 和 `openspec/specs/backend/` stub 目录

---

### Requirement: 非交互参数支持（新增）
见 `specs/bootstrap-protocol/spec.md` 中的「install.sh 非交互参数」需求。本 spec 仅记录 `install.sh` 内部实现约束：
- `--no-interactive` 时，`ask()` / `ask_yn()` / `ask_menu()` 均不调用，使用参数默认值
- `--switch` 时，跳过「全量安装」逻辑，只替换 `config.yaml` 并更新 CLAUDE.md/AGENTS.md 中的档位引用

#### Scenario: --no-interactive 冲突处理
- **WHEN** `--no-interactive` 模式下目标文件已存在
- **THEN** 默认跳过（不覆盖），不弹出确认提示，在输出中标注「已跳过」
