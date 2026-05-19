# agentic-workflow

> 一套面向 AI 辅助开发的工作流框架，让 Claude Code 和 Codex App 共用同一套审查规则、同一份变更历史。

一条命令安装，AI 自动识别项目类型，无需手动配置。

---

## 为什么需要这个

AI 写代码越来越快，但容易跳过设计评审、埋下质量隐患。这个工作流通过在 `openspec/config.yaml` 里注入 **gate 规则**，让 AI 在生成方案时自我审查，不通过就不能推进到实现阶段。

核心思路：
- **OpenSpec**：spec 驱动的变更管理状态机（proposal → design gate → tasks → 归档）
- **Gate 机制**：AI 自我执行的审查关卡，配置即规则
- **双生态**：Claude Code 和 Codex App 用同一套命令、同一份 `openspec/` 产物

---

## 五种工作流档位

按项目类型选一个，安装对应的 `config.yaml`：

| 档位 | 适用场景 | Gate |
|------|---------|------|
| 📦 `backend` | 服务器 API、业务逻辑、数据库操作 | 工程审查 + 条件安全审查 |
| 🐍 `python-data` | 数据分析、自动报表、数据处理脚本 | 工程审查 + SQL 口径审查 + 条件安全审查 |
| 🎨 `frontend` | 网页界面、H5、React/Vue/小程序 | 工程审查 + 条件 UI 设计审查 |
| 🔗 `fullstack` | 同一仓库里既有前端界面又有后端服务 | 工程审查 + UI 设计审查 + 条件安全审查 |
| ⚡ `vibe` | 个人项目、原型验证、不需要严格审查 | 无 gate，所有变更走快速通道 |

---

## 安装

### 方式一：让 AI 帮你装（推荐）

把这个仓库地址丢给 AI，说一句话：

```
帮我安装一下这个工作流：https://github.com/ArkanZen/agentic-workflow
```

AI 会：
1. 读取本文件了解档位规则
2. 分析你的项目结构，推断最匹配的档位
3. 展示置信度推荐，等待你确认
4. 自动执行安装，无需额外操作

### 方式二：手动安装

```bash
# 克隆本仓库（选一个本地目录）
git clone https://github.com/ArkanZen/agentic-workflow ~/agentic-workflow

# 进入你的项目目录
cd /path/to/your/project

# 运行安装脚本（会有交互式菜单引导你选择档位和工具链）
bash ~/agentic-workflow/install.sh
```

### 方式三：非交互安装（CI / AI 程序化调用）

```bash
bash ~/agentic-workflow/install.sh \
  --type python-data \
  --target /path/to/your/project \
  --no-interactive
```

| 参数 | 说明 |
|------|------|
| `--type <档位>` | backend / python-data / frontend / fullstack / vibe |
| `--target <目录>` | 目标项目目录（默认交互询问） |
| `--no-interactive` | 完全非交互，冲突文件默认跳过 |
| `--switch` | 仅替换 config.yaml，切换档位（不重新安装） |

---

## 安装后的工作流

安装完成后，在 Claude Code 或 Codex App 里运行 `/wf`，选择模式：

| 模式 | 场景 | 工具链 |
|------|------|--------|
| ⚡ 快速通道 | 文案/样式/明确 bug | `/openspec-quick` |
| 🔧 小需求 | 新增字段、加指标 | OpenSpec → Gate 审查 |
| 🏗️ 复杂后端 | 重构、新接口设计 | 方案探索 → OpenSpec → Gate |
| 🔍 Debug/单测 | 找 bug、补测试 | 直接进入实现 |
| 💡 产品/架构 | 做不做、怎么设计 | 方案讨论 |

### 切换档位

项目类型变了？用 `/wf-install` 命令，AI 会检测当前档位并引导切换。

---

## Gate 机制

`openspec/config.yaml` 的 `rules:` 字段定义了 AI 必须遵守的审查规则。

以 `backend` 档位为例，`design.md` 生成前必须通过工程审查：
```
工程审查状态：[阻断 / 通过 / 仅警告]

阻断时 → 禁止生成 tasks.md，须先修改 proposal
```

Gate 完全由 AI 自我执行，无需外部工具介入。

---

## 前置条件

- **openspec CLI** — 变更管理工具（`pip install openspec` 或参考 [openspec 文档]）
- **Claude Code** 或 **Codex App**（至少一个）
- 目标项目已初始化 `git`

---

## AI 安装指南（供 AI 读取）

> 本节为 LLM 参考信息。

### 档位检测信号

| 标识符 | 决定性信号（优先级 1） | 强信号（优先级 2） |
|--------|---------------------|-----------------|
| `python-data` | `requirements.txt` 含 pandas/sqlalchemy/pymysql/openpyxl | `pyproject.toml` + `notebooks/` 目录 |
| `fullstack` | `package.json` 同时含前端依赖（react/vue/next）AND 后端依赖（express/nest/koa） | — |
| `vibe` | README 含 prototype/poc/demo/vibe | 文件总数 < 50，无 CI |
| `frontend` | `package.json` 含 react/vue/next（无后端依赖） | — |
| `backend` | `pom.xml` / `go.mod` / `Cargo.toml` | `package.json` 含 express/nest/koa（无前端依赖） |

**冲突规则**：Python 项目（含 `requirements.txt` 或 `pyproject.toml`）有 `templates/` 或 `static/` 目录时，**不计为前端信号**（这是 Jinja2/Flask 的标准结构）。

### Bootstrap 命令

```bash
bash <agentic-workflow-path>/install.sh --type <tier> --target <project-dir> --no-interactive
```

---

## License

MIT
