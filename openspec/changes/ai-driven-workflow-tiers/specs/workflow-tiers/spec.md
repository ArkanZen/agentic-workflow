## ADDED Requirements

### Requirement: 五档位定义
系统 SHALL 提供 5 个标准工作流档位，每个档位有唯一标识符、用户语言描述、gate 规则和检测信号。

档位列表：

| 标识符 | 用户语言名称 | emoji | Gate 规则 |
|--------|-------------|-------|-----------|
| `backend` | 后端服务 | 📦 | 工程审查 + 安全审查（条件）|
| `python-data` | Python 数据项目 | 🐍 | 工程审查 + SQL口径审查 + 安全审查（条件）|
| `frontend` | 前端应用 | 🎨 | 工程审查 + UI设计审查 + 安全审查（条件）|
| `fullstack` | 前后端合体 | 🔗 | 工程审查 + UI设计审查 + 安全审查（条件）|
| `vibe` | 轻量快速模式 | ⚡ | 无（直通 proposal → tasks）|

"条件"安全审查 = 变更涉及认证鉴权、外部 API 调用、凭证处理或部署配置时触发。

#### Scenario: 用户查看档位选项
- **WHEN** 用户执行 `/wf-install` 或运行 `install.sh`
- **THEN** 系统展示所有 5 个档位，以用户语言描述为主要文案，gate 规则作为补充说明

---

### Requirement: Fullstack 目录结构规范
系统 SHALL 在 fullstack 项目中使用单一 `openspec/config.yaml`（合并前后端 gate），并在 `openspec/specs/` 下建立 `frontend/` 和 `backend/` 子目录分别存放专属 spec。

#### Scenario: Fullstack 项目安装
- **WHEN** 用户选择 `fullstack` 档位
- **THEN** 安装 `config-fullstack.yaml`，同时创建 `openspec/specs/frontend/` 和 `openspec/specs/backend/` 目录 stub

---

### Requirement: 档位检测信号规则
系统 SHALL 按优先级规则从项目文件结构推断最匹配档位，高优先级信号覆盖低优先级。

优先级 1（决定性）：
- `requirements.txt` 含 `pandas`/`sqlalchemy`/`pymysql`/`openpyxl` → `python-data`
- `package.json` 同时含前端框架（react/vue/next）和后端框架（express/nest/koa）依赖 → `fullstack`
- README 含 `prototype`/`poc`/`demo`/`vibe` → vibe 权重 +3

优先级 2（强信号）：
- `pyproject.toml` + `notebooks/` 目录 → `python-data`
- `package.json` 含 react/vue/next（无后端依赖）→ `frontend`
- `pom.xml` / `go.mod` / `Cargo.toml` → `backend`

优先级 3（弱信号）：
- `app/dao/` + `app/service/` 目录 → backend 权重 +1
- 无 `tests/` 目录 且文件数 <50 → vibe 权重 +1

冲突规则：Python 项目含 HTML/Jinja2 模板不算 frontend 信号。

#### Scenario: Python 数据项目检测
- **WHEN** 项目含 `requirements.txt`（内有 pandas + sqlalchemy）且无 `package.json`
- **THEN** 推荐档位为 `python-data`，置信度 ≥ 85%

#### Scenario: 前端模板误判规避
- **WHEN** Python 项目含 `templates/` 或 `static/` 目录（Jinja2 服务端渲染）
- **THEN** 不将其识别为 frontend 信号，档位推荐不受影响

---

### Requirement: 置信度展示
系统 SHALL 在展示推荐档位时同时显示置信度百分比，最高置信度档位置顶并标记星号。

#### Scenario: 推荐展示格式
- **WHEN** AI 分析完成项目信号
- **THEN** 输出格式为：`★ <档位名> <用户描述> （置信度 XX%）`，其余选项按置信度降序排列
