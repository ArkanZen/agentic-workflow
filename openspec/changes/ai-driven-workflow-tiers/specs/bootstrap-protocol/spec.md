## ADDED Requirements

### Requirement: README AI 安装指南章节
README.md SHALL 包含独立的「AI 安装指南」章节，内容对 LLM 可读，包含：
1. 档位列表（标识符 + 用户语言描述 + 检测信号摘要）
2. Bootstrap 调用格式：`bash install.sh --type <档位> --target <目录> --no-interactive`
3. 一句话安装示例对话

#### Scenario: AI 读取 README 后完成安装
- **WHEN** 用户对 AI 说"帮我安装这个工作流：<仓库地址>"
- **THEN** AI 读取 README 的 AI 安装指南，分析目标项目，推荐档位，经用户确认后执行 install.sh，无需任何预装命令

#### Scenario: 非技术用户理解档位
- **WHEN** 用户或 AI 读取 README 档位说明
- **THEN** 每个档位的描述使用"你的项目是做什么"的语言，不出现 gate/审查/状态机等技术术语

---

### Requirement: install.sh 非交互参数
`install.sh` SHALL 支持以下参数供 AI 程序化调用：
- `--type <档位标识符>`：指定安装档位，跳过交互式选择
- `--target <目录>`：指定目标项目目录，跳过交互式输入
- `--no-interactive`：完全非交互模式，所有参数必须通过 flag 提供；冲突文件默认跳过（不覆盖）
- `--switch`：切换已有工作流档位，配合 `--type` 使用

无参数调用时行为与现有版本完全一致（向后兼容）。

#### Scenario: AI 程序化安装
- **WHEN** AI 执行 `bash install.sh --type python-data --target /path/to/project --no-interactive`
- **THEN** 安装完成，无交互提示，冲突文件跳过，退出码 0

#### Scenario: 向后兼容
- **WHEN** 用户执行 `bash install.sh`（无参数）
- **THEN** 行为与修改前完全一致，进入交互式选择流程
