# agentic-workflow

> 一套可安装到任意项目中的 AI 协作工作流模板，让 Claude Code 和 Codex App 共用同一套 OpenSpec 变更记录、GStack 审查规则和本地执行约定。

agentic-workflow 不是后台服务，也不是远程审批平台。它只把一组模板、命令和项目级说明安装进你的仓库，让 AI 在本地读同一份规则、产出同一类 Markdown 工件，并把“为什么改、怎么改、做完了吗”留在版本控制里。

适合这些场景：

- 你已经在用 Claude Code 或 Codex App 写代码，希望 AI 不要跳过方案、审查和归档。
- 你的团队想用 OpenSpec 记录需求和实现任务，但不想搭额外服务。
- 你维护多个项目，希望用同一套 `/wf-*` 命令在后端、前端、数据脚本、全栈仓库和个人原型之间切换。
- 你想把工作流开源给其他项目复用，并通过 GitHub Releases 管理模板版本。

---

## 一分钟理解

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

其中 gate 规则写在 `openspec/config.yaml`，受控命令写在 `.claude/commands/` 和 `.codex/skills/`，安装清单写在 `.agentic-workflow/manifest.json`。规则就是配置，产物就是仓库里的文件，后续可以用 `validate-workflow.sh` 检查模板漂移和宿主依赖。

## 核心能力

| 能力 | 说明 |
|------|------|
| 五档位安装 | `backend`、`python-data`、`frontend`、`fullstack`、`vibe`，覆盖严肃工程到个人原型 |
| 全局装卸 | `install.sh --global` 一次装好 `/wf-install` 处处可用；`/wf-uninstall` 干净卸载且保留你的 `openspec/` 内容 |
| 降耦合兜底 | GStack/Superpowers 为增强项，缺失时审查降级到 Claude 原生 `/code-review`、`/security-review` 或自检清单 |
| 双宿主适配 | 同时安装 Claude Code 命令和 Codex App skills，GStack 命令名按安装模式（flat/namespaced）探测并写入 manifest |
| 强制依赖加载 | Codex `/wf-*` 会先声明并加载 required workflows / reviews / skills，缺失时必须说明影响并等待确认 |
| UI 优先交互 | Codex App 中存在选项时优先使用结构化 UI，缺少 UI 工具时才退化为文本选项 |
| 可追踪版本 | `VERSION` 是唯一模板版本源，安装清单记录 `sourceRepo`，升级优先通过 GitHub Releases 检测 |
| 本地 doctor | `validate-workflow.sh` 检查 config、AGENTS、manifest、Claude/Codex 模板、GStack/Superpowers 和发布噪音 |
| 本地 Dashboard | `dashboard/` 提供 Node Web UI，集中查看本机项目、安装工作流、运行 doctor、理解工具能力和策略 |
| 中文工件规范 | 独立设计文档文件名使用中文描述，OpenSpec change 目录继续使用 kebab-case，兼顾可读性和 CLI 兼容 |

## 近期重点

完整历史见 [CHANGELOG.md](CHANGELOG.md) 与 [GitHub Releases](https://github.com/ArkanZen/agentic-workflow/releases)。当前 1.7.x 的几个关键能力：

- **全局安装 `/wf-install`**：任意新项目无需先跑 `install.sh`——`curl` 一行或 `install.sh --global` 装好后处处可用（见「安装 · 方式零」）。
- **`/wf-uninstall`**：干净卸载当前项目工作流，保留全局命令、保留你的 `openspec/` 内容，默认带备份。
- **GStack/Superpowers 降为增强项 + 原生兜底**：缺失时审查自动降级到 Claude 内置 `/code-review`、`/security-review` 或结构化自检清单，不再硬卡。
- **GStack 命令名探测**：命名模式（flat/namespaced）安装时探测并写入 manifest，不再按宿主硬编码（修复了 namespaced 安装下命令找不到的问题）。
- **常驻块预算**：`validate-workflow.sh` 守住每轮加载的常驻块 ≤70 行，防止上下文成本悄悄膨胀。

---

## 它会安装什么

运行安装后，目标项目会获得一组受控文件：

| 路径 | 用途 |
|------|------|
| `openspec/config.yaml` | 档位、gate、命名规则、checkpoint 和宿主命令映射 |
| `AGENTS.md` | Codex 项目级入口，说明何时启用工作流和如何处理依赖 |
| `.claude/commands/wf-*.md` | Claude Code 侧 `/wf-*` 命令 |
| `.codex/skills/wf-*/SKILL.md` | Codex App 侧 `/wf-*` skills |
| `.agentic-workflow/manifest.json` | 安装版本、档位、宿主、受控文件哈希和源仓库信息 |

它不会安装后台进程，不会上传业务代码，也不会替你改目标项目的业务逻辑。

## 工具职责

| 工具 | 在工作流里的职责 | 是否必需 |
|------|------------------|----------|
| **OpenSpec** | 管理变更状态机和产物目录，生成/维护 `proposal.md`、`design.md`、`tasks.md`、归档历史 | 必需 |
| **agentic-workflow** | 安装项目档位、提供 `/wf-*` 路由命令、写入 `openspec/config.yaml` gate 规则 | 必需 |
| **Claude Code / Codex App** | 运行命令和 skills 的宿主，不保存业务状态 | 至少一个 |
| **GStack** | 提供工程审查、安全审查、代码审查、产品/架构评估等高质量 review skill | 推荐 |
| **Superpowers** | 提供复杂需求拆解、Debug、TDD、验证前检查等方法论 skill | 可选增强 |

- **OpenSpec 负责记录事实**：每个变更为什么做、准备怎么做、有哪些任务，都落在 `openspec/changes/` 下。
- **agentic-workflow 负责路由**：`/wf-quick`、`/wf-small`、`/wf-complex` 等命令把任务送到合适流程。
- **GStack 负责审查质量**：工程 / 安全 / 代码 / 设计审查（具体命令名按安装模式，见下方「GStack gate 命令名」与「审查降级链」）。
- **Superpowers 负责方法论**：例如 brainstorming、systematic-debugging、test-driven-development、verification-before-completion。
- **Claude/Codex 负责执行**：它们读取这些命令和配置，然后在当前项目里工作。

GStack 使用官方安装方案。本仓库不内置 GStack skills，避免和官方版本产生漂移。

---

## 前置条件

- **openspec CLI**：变更管理工具，可用 `openspec --version` 检查。
- **git**：目标项目需要是 git 仓库，`openspec/` 产物需要被提交。
- **Claude Code 或 Codex App**：至少安装一个，用来运行 `/wf-*` 命令。

### 推荐安装 GStack

GStack 不是安装本工作流的硬依赖，但缺少它时，工程审查、安全审查、代码审查和产品/架构评估命令不可用。严格档位下这通常意味着 gate 无法完成；轻量档位下也必须明确说明降级原因，不能声称已经完成审查。

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

Superpowers 插件不是安装硬依赖。未安装时，`/wf-complex`、`/wf-debug` 和明确 bug 场景下的 `/wf-quick` 必须先说明缺失项和影响，等待用户确认后才可降级为模板检查清单；不得声称已加载对应 Superpowers skill。

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

常见结果：

- **通过**：目标项目的受控文件与当前模板一致。
- **警告**：通常表示缺少增强工具、manifest 版本落后、模板发生本地改动或存在发布噪音。
- **失败**：通常表示缺少必要文件、版本源错误或模板中仍有硬编码版本号，需要先修复再发布。

## 本地 Dashboard MVP

如果你维护多个本地项目，推荐先启动 Node Web UI，再通过 Dashboard 给项目安装工作流。它可以查看每个项目的安装状态、workflow tier（工作流档位）、版本、宿主、OpenSpec active change（活跃变更）统计、GStack/Superpowers 工具能力和 doctor（健康检查）结果。

**前提条件：** Node.js 18+

```bash
# 从仓库根目录直接启动（无需 cd）
npm --prefix dashboard install
npm --prefix dashboard run dev

# 或进入子目录启动
cd dashboard && npm install && npm run dev
```

启动后有两个本地服务：
- **UI**：`http://127.0.0.1:5173`（Vite 开发服务，端口占用时自动递增）
- **API**：`http://127.0.0.1:4317`（Express 后端，仅监听本地回环地址）

如需自定义 API 端口：`DASHBOARD_PORT=8080 npm run dev`

本地 API 只监听 `127.0.0.1`，写操作仅允许预定义 workflow actions（工作流维护动作）：运行 doctor（健康检查）、install（安装工作流）、upgrade（升级）当前档位模板、switch tier（切换工作流档位）和写入工作流文档 `.gitignore` 忽略块。MVP 不提供远程访问、账号体系、插件市场或第三方插件自动安装。

Dashboard 首次使用建议：

1. 打开“扫描设置”，把本地项目所在目录加入扫描边界。
2. 回到“安装工作流”，从已扫描项目中选择目标项目。
3. 点击“检测安装状态”，查看推荐档位和候选原因。
4. 选择 install / upgrade / switch tier，并先看预览中的写入文件、宿主和版本影响。
5. 确认执行后，Dashboard 会自动刷新项目列表并保留当前目标项目。

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

### 方式零：全局安装 `/wf-install`（一次装好，处处可用）

把 `/wf-install` 引导命令装到宿主全局，之后**任意新项目**都能直接运行 `/wf-install` 安装工作流——不再需要先对每个项目跑一次 `install.sh`。

```bash
# 全新机器：一行 curl 安装（自动 clone 缓存仓库后写入全局命令）
curl -fsSL https://raw.githubusercontent.com/ArkanZen/agentic-workflow/master/bootstrap.sh | bash

# 本地已有仓库：直接用 --global
bash ~/agentic-workflow/install.sh --global
```

它只写入这些文件：

| 文件 | 作用 |
|------|------|
| `~/.claude/commands/wf-install.md` | Claude Code 侧全局 `/wf-install` |
| `~/.codex/skills/wf-install/` | Codex App 侧全局 `wf-install` skill |
| `~/.agentic-workflow/config` | 记录 `sourceRepo` / 本地仓库路径，供命令按需 clone 或复用 |

**零入侵保证**：全局只多出上面这一个命令，让 `/wf-install` 在所有项目可见。**不运行它就不会改动任何项目**；运行后才在目标项目写 `openspec/config.yaml` 等文件。全新项目首次运行时，命令会按需把仓库 clone 到缓存目录 `~/.agentic-workflow/repo`，无需手输路径。

卸载：删除上述三项（`~/.claude/commands/wf-install.md`、`~/.codex/skills/wf-install/`、`~/.agentic-workflow/`）即可，对已安装项目无影响。

### 方式一：通过 Dashboard 安装（推荐）

先启动本地 Dashboard：

```bash
cd dashboard
npm install
npm run dev
```

然后在页面中选择“安装工作流”，按检测、选择、预览、确认的顺序完成安装。Dashboard 会把选择权交给用户：AI 只做检测和推荐，不会在未确认预览前写入目标项目。

### 方式二：让 AI 帮你装

把这个仓库地址丢给 AI，说一句话：

```text
帮我安装一下这个工作流：https://github.com/ArkanZen/agentic-workflow
```

AI 会：

1. 读取本文件了解档位规则
2. 分析你的项目结构，推断最匹配的档位
3. 展示置信度推荐，等待你确认
4. 自动执行安装，写入 `openspec/config.yaml`、宿主命令和 manifest
5. 提示缺失的 GStack / Superpowers 增强项，以及缺失后哪些流程会降级或卡住

### 方式三：手动安装

```bash
# 克隆本仓库（选一个本地目录）
git clone https://github.com/ArkanZen/agentic-workflow ~/agentic-workflow

# 进入你的项目目录
cd /path/to/your/project

# 运行安装脚本（会有交互式菜单引导你选择档位和工具链）
bash ~/agentic-workflow/install.sh
```

### 方式四：非交互安装（CI / AI 程序化调用）

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
| `--global` | 把 `/wf-install` 引导命令装到宿主全局（不针对任何项目） |
| `--uninstall` | 卸载当前项目的工作流（保留全局 `/wf-install`、保留 openspec 内容） |
| `--no-backup` | 配合 `--uninstall`：跳过卸载前备份 |
| `--version` | 输出当前 agentic-workflow 模板版本 |

### 安装模式怎么选

| 你要做什么 | 推荐方式 |
|------------|----------|
| 首次给一个项目接入工作流 | 优先启动 Dashboard，在“安装工作流”页检测、选择档位、预览后确认安装 |
| 在脚本或 AI 自动化中安装 | `install.sh --type <档位> --target <目录> --no-interactive` |
| 已安装项目升级模板 | 优先在 Dashboard 中选择 upgrade；命令行场景可在目标项目中运行 `/wf-install` |
| 项目类型变化，需要换档位 | 优先在 Dashboard 中选择 switch tier；命令行场景可用 `/wf-install` 或 `install.sh --switch` |

### 卸载

在目标项目中运行 `/wf-uninstall`，或命令行直接执行：

```bash
bash <agentic-workflow-path>/install.sh --uninstall --target <目标项目> --no-interactive
```

- **删除**：wf-* 命令/skill、`openspec/config.yaml`、`.agentic-workflow/manifest.json`、`.wf-active`。
- **仅剥离工作流块、保留其余内容**：`.claude/CLAUDE.md`、`AGENTS.md`。
- **完整保留**：`openspec/changes`、`openspec/specs`、`openspec/archive` 等你的内容。
- **不受影响**：全局 `/wf-install`（`~/.claude`、`~/.codex`、`~/.agentic-workflow`）——卸载只操作目标项目目录。
- 默认卸载前备份到 `.agentic-workflow/uninstall-backup-<时间>/`，加 `--no-backup` 可跳过。

---

## 版本与升级

仓库根目录的 `VERSION` 是工作流模板版本的唯一来源，`CHANGELOG.md` 记录每次发布的行为变化。模板文件使用 `__WORKFLOW_VERSION__` 占位符，由 `install.sh` 在安装或升级时渲染，避免多个文件手动维护版本号。

安装后的项目会在 `openspec/config.yaml` 写入：

```yaml
# agentic-workflow-tier: backend
# agentic-workflow-version: <VERSION>
```

同时在 `.agentic-workflow/manifest.json` 记录 `sourceRepo`（安装时从 git remote 自动检测的 GitHub URL）。

**升级检测方式：**
- 若 manifest 中 `sourceRepo` 非空：运行 `/wf-install` 时自动通过 `git ls-remote` 检查 GitHub 最新 release tag，无需本地仓库路径，无需手动比对版本号。
- 若 `sourceRepo` 为空（旧版本 manifest 或本地无 remote）：退化为原有本地路径比对模式。
- 若远程检测失败或 GitHub 仓库暂无 release tag：`/wf-install` 会明确说明原因，再降级到本地路径模式。

### 发布新版本

开源发布时，其他项目通过 **GitHub Releases** 检测新版本。发布步骤：

1. 在 `CHANGELOG.md` 新增对应版本条目
2. 运行版本脚本，只更新唯一版本源 `VERSION`：
   ```bash
   ./scripts/bump-version.sh 1.8.0
   ```
3. 运行校验，确认模板没有硬编码版本号：
   ```bash
   ./validate-workflow.sh .
   ```
4. 提交并推送到 GitHub：
   ```bash
   git push origin master
   ```
5. 在 GitHub 上创建 Release，**tag 格式必须为 `v<semver>`**（例如 `v1.8.0`）：
   ```bash
   git tag v1.8.0
   git push origin v1.8.0
   ```
   或在 GitHub 网页 → Releases → "Create a new release" → 填写 tag `v1.8.0`

安装了此工作流的其他项目运行 `/wf-install` 时，将自动检测到新版本并提示升级。

### 维护者发布前检查

```bash
./scripts/bump-version.sh <next-version>
./validate-workflow.sh .
npm --prefix dashboard test
npm --prefix dashboard run build
git status --short
```

发布前重点确认：

- `VERSION` 和 `CHANGELOG.md` 已更新。
- `templates/openspec/config-*.yaml` 仍使用 `__WORKFLOW_VERSION__` 占位符。
- `validate-workflow.sh .` 没有失败项。
- `dashboard/node_modules/`、`dashboard/dist/`、`.playwright-mcp/`、`.DS_Store` 等本地依赖、构建产物和验证临时文件没有进入提交或发布包。
- GitHub Release tag 使用 `v<semver>` 格式，否则下游项目无法通过远程模式检测升级。

---

## 安装后的工作流

安装完成后，默认协作方式不变；只有在 Claude Code 或 Codex App 里显式输入 `/wf-*` 或 `/openspec-*` 命令时，才进入 OpenSpec + GStack 流程。

| 命令 | 适用场景 | 实际用到的工具 | 缺少增强项时的影响 |
|------|----------|----------------|--------------------|
| `/wf-quick` | 文案、样式、明确 bug，改动很小 | OpenSpec 快速通道，生成 proposal + tasks，跳过 gate；明确 bug 时加载 systematic-debugging | 明确 bug 且缺少 Superpowers 时需确认降级 |
| `/wf-small` | 新增字段、加指标、范围清晰的小需求 | OpenSpec 完整通道 + GStack gate | 缺少 GStack 时无法完成审查 gate |
| `/wf-complex` | 跨模块、架构变更、边界模糊 | Superpowers 探索/计划 + OpenSpec + GStack gate | 缺少 Superpowers 或 GStack 时需确认降级 |
| `/wf-debug` | 找 bug、补测试、重构 | Superpowers Debug / TDD / 重构边界确认 | 缺少 Superpowers 时需确认降级 |
| `/wf-plan` | 产品/架构方案，先判断值不值得做 | GStack 产品/工程评估 | 缺少 GStack 时需确认降级为普通讨论 |

### Codex App 适配

Codex 版 `/wf-quick`、`/wf-small` 和 `/wf-complex` 会在关键产物生成后暂停，让用户先确认再进入实现：proposal / design / tasks 会以本地绝对路径链接展示，并附带 gate 状态和任务摘要。存在选项时，Codex App 中优先使用 UI 交互工具；如果当前环境没有 UI 工具，才退化为明确的文本选项。

Codex 版 `/wf-*` 还会执行依赖自检：工作流文档中声明的 `required_skills`、`required_workflows`、`required_reviews` 和 `conditional_skills` 必须先加载或执行，不能只按方法论摘要推进。若依赖不可用，必须明确说明降级原因并等待确认；完成前会输出执行审计，列出已加载 skill、OpenSpec workflow、GStack gate 和验证结果。

Git checkpoint 也按 Codex App 交互优化：开始前发现脏工作区时优先给出「提交现有改动 / 跳过 / 取消」选项；结束时先完成归档决策和 spec sync，再进入最终提交，避免归档后又留下未提交的 spec 变更。

安装脚本会创建或更新 `AGENTS.md`，作为 Codex 的项目级入口。它还会写入 `.agentic-workflow/manifest.json`，记录当前模板版本、档位、启用宿主、受控文件哈希，以及探测到的 GStack 命名模式与命令映射（`gstackSkillMode` / `gstackCommandMap`）和工具可用性（`tooling` / `reviewFallback`）。后续 `/wf-install` 或 `validate-workflow.sh` 可用它发现 config 版本一致但 skill 文件漂移的情况。

### GStack gate 命令名

命令名取决于 GStack 的 **skill 命名模式**（`flat` / `namespaced`，由安装时的 `skill_prefix` 偏好决定），**与宿主无关**——Claude Code 和 Codex App 一视同仁：

| 审查动作 | flat 模式 | namespaced 模式 |
|----------|-------------|-----------|
| 工程审查 | `/plan-eng-review` | `/gstack-plan-eng-review` |
| UI/设计审查 | `/plan-design-review` | `/gstack-plan-design-review` |
| 安全审查 | `/cso` | `/gstack-cso` |
| 代码审查 | `/review` | `/gstack-review` |

安装时 `install.sh` 会探测本机命名模式并把**实际命令名**写入 `manifest.json` 的 `gstackCommandMap` / `gstackSkillMode`，wf-* 模板里的命令名只是占位、按本机模式归一化。

> ⚠️ `flat` 模式下 GStack 的 `/review` 与 Claude Code 内置 `/review`（审 GitHub PR）同名；做代码审查时确认调用的是 GStack 版本，或用 `/code-review` 审工作区 diff，`namespaced` 模式（`/gstack-review`）无此冲突。

### 审查降级链（GStack / Superpowers 为增强项，非硬依赖）

GStack 与 Superpowers 不是硬依赖，缺失时按降级链执行，任何降级都会显式说明：

| 审查 | 首选（GStack） | 兜底（无 GStack） |
|------|------|------|
| 代码审查 | `/review` / `/gstack-review` | Claude Code 内置 `/code-review`（Codex → 结构化自检清单） |
| 安全审查 | `/cso` / `/gstack-cso` | Claude Code 内置 `/security-review`（Codex → 自检清单） |
| 工程/设计审查 | `/plan-eng-review` 等 | 无原生等价 → 结构化自检清单，标注「未经 GStack 审查」 |

各工具本机可用性与兜底链记录在 `manifest.json` 的 `tooling` / `reviewFallback`。

### Agent 角色编排（wf-complex 内的临场提示）

`/wf-complex` 内有一句**可选**提示：阶段多、风险高时可酌情把探索/设计/实现/审查交给专职子 agent（Explore/Plan、tech-design、`subagent-driven-development`、code-reviewer、`dispatching-parallel-agents`）。它是**临场优化、非正式契约**，不进常驻的 CLAUDE.md/AGENTS.md 块（避免轻通道也常驻加载）；子 agent 内部过程不落盘，关键产出仍须写回 OpenSpec 工件以保持可追踪。轻通道（`/wf-quick` 等）不套用。

### 集成说明

这些是从常驻块下沉到此处的参考细节（不必每轮加载，用到时查）：

- **OpenSpec 命令名**：`openspec-propose/apply-change/archive-change/explore` 是 OpenSpec **skill 名**（`openspec init` 生成、当前版本仍可用），不是斜杠命令文件。新版斜杠命令门面改为 `/opsx:propose` 等；若 `/openspec-propose` 调不到，等价用 `/opsx:propose`（apply/archive/explore 同理）。
- **config.yaml 归属**：它是 OpenSpec 原生文件，`schema/context/rules` 会被 OpenSpec CLI 读取并注入工件指令；而 `risk_triggers/quick_change_criteria/commit_checkpoints` 是**本工作流私有键**，OpenSpec 不感知、不校验，仅由 wf-* 流程执行。
- **多方共写文件**：`AGENTS.md` / `.claude/CLAUDE.md` 由本工作流（`<!-- agentic-workflow:start/end -->` marker）与 `openspec update`/`init`（OpenSpec 自己的 marker）共同管理。两套 marker 不同、可共存，但跑 `openspec update` 后建议确认本工作流块未被影响。
- **GStack 安装方式**：见上方「推荐安装 GStack」的 `git clone … ./setup` 命令。

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

### 依赖加载与审计

Codex 版工作流会把依赖声明当成执行前置条件，而不是提示词里的装饰文本。只要 workflow 文档出现 `required_skills`、`required_workflows`、`required_reviews` 或 `conditional_skills`，执行者就必须先加载或执行对应 skill / workflow / review。

这带来三个约束：

- 开始时输出启动自检：当前工作流、强制依赖、已加载状态和降级原因。
- 关键节点暂停确认：proposal / design / tasks 生成后，先展示绝对路径、gate 状态和任务摘要。
- 完成前输出收尾审计：列出 OpenSpec workflow、GStack gate、Superpowers skill 和验证结果。

如果缺少 GStack 或 Superpowers，AI 不能假装已经审查或验证；必须说明影响，并等待用户确认是否降级继续。

### 命名规则

命名规则写入 `openspec/config.yaml` 的 `context:` 字段，确保 OpenSpec CLI 在生成 proposal、design、tasks 和 spec 时都能读取：

- `docs/` 下独立设计文档使用中文描述文件名，日期前缀保留 `YYYY-MM-DD`。
- API 名称、模型名、功能 key 和技术术语可以保留英文。
- `openspec/changes/<name>/` 目录继续使用 kebab-case 英文，保证 CLI 和文件系统兼容。

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
