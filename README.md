# agentic-workflow

> 一套面向 AI 辅助开发的工作流框架，让 Claude Code 和 Codex App 共用同一套审查规则、同一份变更历史。

它不是一个隐藏服务，也不会把所有事情塞进一个黑盒命令里。它做的事很直接：把 OpenSpec、GStack、Superpowers 和 Claude/Codex 的 skill 机制组合起来，给 AI 写代码加上可追踪的计划、审查和归档流程。

---

## 为什么需要这个

AI 写代码越来越快，但容易跳过设计评审、缺少上下文记录，最后留下“代码改了，但为什么这么改没人知道”的问题。

这个工作流把一次变更拆成可检查的步骤：

```text
用户描述需求
→ 选择 /wf-* 模式
→ OpenSpec 生成 proposal / design / tasks
→ GStack 或 Superpowers 参与审查、探索、Debug、TDD
→ /openspec-apply-change 实现
→ review / 验证 / archive 归档
```

其中 gate 规则写在 `openspec/config.yaml` 里，由 AI 在生成方案时读取并执行。没有额外后端服务，也没有远程审批系统；规则就是配置，产物就是仓库里的 Markdown 文件。

---

## 工具组合

| 工具 | 在工作流里的职责 | 是否必需 |
|------|------------------|----------|
| **OpenSpec** | 管理变更状态机和产物目录，生成/维护 `proposal.md`、`design.md`、`tasks.md`、归档历史 | 必需 |
| **agentic-workflow** | 安装项目档位、提供 `/wf-*` 路由命令、写入 `openspec/config.yaml` gate 规则 | 必需 |
| **Claude Code / Codex App** | 运行命令和 skills 的宿主，不保存业务状态 | 至少一个 |
| **GStack** | 提供工程审查、安全审查、代码审查、产品/架构评估等高质量 review skill | 推荐 |
| **Superpowers** | 提供复杂需求拆解、Debug、TDD、验证前检查等方法论 skill | 可选增强 |

### 谁负责什么

- **OpenSpec 负责记录事实**：每个变更为什么做、准备怎么做、有哪些任务，都落在 `openspec/changes/` 下。
- **agentic-workflow 负责路由**：`/wf-quick`、`/wf-small`、`/wf-complex` 等命令把任务送到合适流程。
- **GStack 负责审查质量**：例如 `/plan-eng-review`、`/cso`、`/review` 或 Codex 侧的 `/gstack-plan-eng-review`、`/gstack-cso`、`/gstack-review`。
- **Superpowers 负责方法论**：例如 brainstorming、systematic-debugging、test-driven-development、verification-before-completion。
- **Claude/Codex 负责执行**：它们读取这些命令和配置，然后在当前项目里工作。

GStack 使用官方安装方案。本仓库不内置 GStack skills，避免和官方版本产生漂移。

---

## 前置条件

- **openspec CLI**：变更管理工具，可用 `openspec --version` 检查。
- **git**：目标项目需要是 git 仓库，`openspec/` 产物需要被提交。
- **Claude Code 或 Codex App**：至少安装一个，用来运行 `/wf-*` 命令。

### 推荐安装 GStack

GStack 不是安装本工作流的硬依赖，但缺少它时，工程审查、安全审查、代码审查和产品/架构评估命令不可用。

Codex 官方安装方式：

```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.codex/skills/gstack
cd ~/.codex/skills/gstack && ./setup --host codex
```

Claude Code 官方安装方式：

```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup
```

### 可选安装 Superpowers

Superpowers 插件不是硬依赖。未安装时，`/wf-complex` 和 `/wf-debug` 仍可运行，但会降级为按模板方法论执行，无法调用完整 Superpowers skill。

- Codex：在插件/工具面板安装 Superpowers。
- Claude Code：运行 `/plugins install superpowers`。

---

## 新电脑检查清单

在新电脑上安装前，可以先检查：

```bash
openspec --version
git status
command -v codex || command -v claude
test -d ~/.codex/skills/gstack || ls ~/.codex/skills/gstack-* 2>/dev/null
```

结果怎么理解：

- `openspec --version` 失败：先安装 OpenSpec。
- `command -v codex || command -v claude` 失败：先安装至少一个 AI coding host。
- 找不到 `~/.codex/skills/gstack` 或 `~/.codex/skills/gstack-*`：Codex 侧 GStack 未安装，GStack 审查命令不可用。
- Superpowers 未安装：不影响安装，但 `/wf-complex`、`/wf-debug` 会降级。

安装后可运行工作流自检：

```bash
bash ~/agentic-workflow/validate-workflow.sh /path/to/your/project
```

自检会检查 `openspec/config.yaml` 版本、`AGENTS.md` 工作流块、`.agentic-workflow/manifest.json`、Claude/Codex 模板漂移、GStack/Superpowers 可用性，以及模板目录中的 `.DS_Store` 等发布噪音。

---

## 五种工作流档位

按项目类型选一个，安装对应的 `config.yaml`：

| 档位 | 适用场景 | Gate |
|------|----------|------|
| 📦 `backend` | 服务器 API、业务逻辑、数据库操作 | 工程审查 + 条件安全审查 |
| 🐍 `python-data` | 数据分析、自动报表、数据处理脚本 | 工程审查 + SQL 口径审查 + 条件安全审查 |
| 🎨 `frontend` | 网页界面、H5、React/Vue/小程序 | 工程审查 + 条件 UI 设计审查 |
| 🔗 `fullstack` | 同一仓库里既有前端界面又有后端服务 | 工程审查 + UI 设计审查 + 条件安全审查 |
| ⚡ `vibe` | 个人项目、原型验证、不需要严格审查 | 无 gate，所有变更走快速通道 |

---

## 安装

### 方式一：让 AI 帮你装（推荐）

把这个仓库地址丢给 AI，说一句话：

```text
帮我安装一下这个工作流：https://github.com/ArkanZen/agentic-workflow
```

AI 会：

1. 读取本文件了解档位规则
2. 分析你的项目结构，推断最匹配的档位
3. 展示置信度推荐，等待你确认
4. 自动执行安装，并提示缺失的 GStack / Superpowers 增强项

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
| `--no-interactive` | 完全非交互；全新安装时冲突文件默认跳过，检测到已安装 agentic-workflow 时进入更新模式 |
| `--upgrade` | 升级受控工作流模板，配合 `--no-interactive` 时覆盖已安装的 wf 命令和 skill |
| `--switch` | 仅替换 config.yaml，切换档位（不重新安装） |
| `--version` | 输出当前 agentic-workflow 模板版本 |

---

## 版本与升级

仓库根目录的 `VERSION` 是工作流模板版本的唯一来源，`CHANGELOG.md` 记录每次发布的行为变化。安装后的项目会在 `openspec/config.yaml` 写入：

```yaml
# agentic-workflow-tier: backend
# agentic-workflow-version: 1.1.4
```

后续其他人更新工作流时，先拉取本仓库最新代码，再在目标项目运行 `/wf-install`。AI 会读取目标项目中的 `agentic-workflow-version`，再对比本仓库 `VERSION`：版本落后时进入升级模式，版本一致时进入切换档位模式。

---

## 安装后的工作流

安装完成后，默认协作方式不变；只有在 Claude Code 或 Codex App 里显式输入 `/wf-*` 或 `/openspec-*` 命令时，才进入 OpenSpec + GStack 流程。

| 命令 | 适用场景 | 实际用到的工具 | 缺少增强项时的影响 |
|------|----------|----------------|--------------------|
| `/wf-quick` | 文案、样式、明确 bug，改动很小 | OpenSpec 快速通道，生成 proposal + tasks，跳过 gate | 不依赖 GStack / Superpowers |
| `/wf-small` | 新增字段、加指标、范围清晰的小需求 | OpenSpec 完整通道 + GStack gate | 缺少 GStack 时无法完成审查 gate |
| `/wf-complex` | 跨模块、架构变更、边界模糊 | Superpowers 探索/计划 + OpenSpec + GStack gate | 缺少 Superpowers 会降级；缺少 GStack 会卡在审查 gate |
| `/wf-debug` | 找 bug、补测试、重构 | Superpowers Debug / TDD 方法论 | 缺少 Superpowers 时按模板方法论执行 |
| `/wf-plan` | 产品/架构方案，先判断值不值得做 | GStack 产品/工程评估 | 缺少 GStack 时只能做普通讨论 |

### Codex App 适配

Codex 版 `/wf-quick`、`/wf-small` 和 `/wf-complex` 会在关键产物生成后暂停，让用户先确认再进入实现：proposal / design / tasks 会以本地绝对路径链接展示，并附带 gate 状态和任务摘要。存在选项时，Codex App 中优先使用 UI 交互工具；如果当前环境没有 UI 工具，才退化为明确的文本选项。

Git checkpoint 也按 Codex App 交互优化：开始前发现脏工作区时优先给出「提交现有改动 / 跳过 / 取消」选项；结束时先完成归档决策和 spec sync，再进入最终提交，避免归档后又留下未提交的 spec 变更。

安装脚本会创建或更新 `AGENTS.md`，作为 Codex 的项目级入口。它还会写入 `.agentic-workflow/manifest.json`，记录当前模板版本、档位、启用宿主、受控文件哈希，以及 GStack 命令在 Claude Code 与 Codex App 中的映射。后续 `/wf-install` 或 `validate-workflow.sh` 可用它发现 config 版本一致但 skill 文件漂移的情况。

GStack gate 使用同一套语义，但不同宿主命令名不同：

| 审查动作 | Claude Code | Codex App |
|----------|-------------|-----------|
| 工程审查 | `/plan-eng-review` | `/gstack-plan-eng-review` |
| UI/设计审查 | `/plan-design-review` | `/gstack-plan-design-review` |
| 安全审查 | `/cso` | `/gstack-cso` |
| 代码审查 | `/review` | `/gstack-review` |

### 切换档位

项目类型变了？用 `/wf-install` 命令，AI 会检测当前档位并引导切换。

### 归档策略

`/wf-quick`、`/wf-small` 和 `/wf-complex` 都不会在实现完成后静默归档。它们会先完成必要验证或 review，然后询问是否归档；用户确认后才执行 `/openspec-archive-change`。归档命令仍会保留变更选择、未完成任务检查和 delta spec 同步确认。最终 commit 必须发生在归档决策之后：选择归档时先归档再 commit，选择暂不归档时提交 active change 和实现改动。

---

## Gate 机制

`openspec/config.yaml` 的 `rules:` 字段定义了 AI 必须遵守的审查规则。

以 `backend` 档位为例，`design.md` 生成前必须通过工程审查：

```text
工程审查状态：[阻断 / 通过 / 仅警告]

阻断时 → 禁止生成 tasks.md，须先修改 proposal
```

Gate 完全由配置驱动。它不是远程服务，也不是安装脚本里的隐藏逻辑；AI 会读取 `openspec/config.yaml`，按其中规则决定是否可以推进到下一步。

---

## AI 安装指南（供 AI 读取）

> 本节为 LLM 参考信息。

### 档位检测信号

| 标识符 | 决定性信号（优先级 1） | 强信号（优先级 2） |
|--------|------------------------|--------------------|
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
