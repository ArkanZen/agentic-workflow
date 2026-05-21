---
name: wf-install
description: |
  工作流档位安装/切换/升级。AI 分析项目信号推荐档位，支持全新安装、档位切换和版本升级。
  3 种模式：INSTALL（全新安装）/ SWITCH（切换档位）/ UPGRADE（升级模板版本）。
  仅当用户显式输入 /wf-install 时使用；不要因“安装工作流、切换档位、install workflow”等自然语言自动触发。
---

工作流档位安装与切换。

## Codex App 交互规则

- 有选项的地方，优先使用 Codex App 提供的 UI 交互工具（如 `request_user_input` 或当前宿主暴露的等价工具）。
- 只有 UI 交互工具不可用时，才退化为文本选项；文本选项必须短且明确。
- 安装、升级或切换前必须展示将变更的文件范围，并等待用户确认。
- 安装或升级完成后，提示用户重新打开/刷新 Codex 会话以加载新的 skill 模板。

## 第一步：检测当前状态，路由到对应模式

运行 shell 命令检查 `openspec/config.yaml` 是否存在，并读取版本标记和 manifest：

```bash
test -f openspec/config.yaml && echo "EXISTS" || echo "NOT_FOUND"
grep "agentic-workflow-version:" openspec/config.yaml 2>/dev/null || echo "NO_VERSION"
cat .agentic-workflow/manifest.json 2>/dev/null || echo "NO_MANIFEST"
```

路由规则：
- 若文件**不存在** → 进入 **INSTALL 模式**
- 若文件**存在** AND **不含**工作流版本注释 → 进入 **UPGRADE 模式**（版本未知）
- 若文件**存在** AND 含工作流版本注释：
  1. 读取 manifest.json 中的 `sourceRepo` 和 `workflowVersion`。
  2. **若 `sourceRepo` 非空**（远程模式）：
     - 运行 `git ls-remote --tags --refs "<sourceRepo>" 'v[0-9]*' 2>/dev/null | awk '{print $2}' | sed 's|refs/tags/||' | sort -V | tail -1` 获取最新 tag
     - 成功且有 tag：去掉 `v` 前缀后与 `workflowVersion` 比较
       - 最新版本 > 已安装版本 → 进入 **UPGRADE 模式（远程）**
       - 最新版本 = 已安装版本 → 进入 **SWITCH 模式**
     - 成功但无 tag：用 UI 工具提示「GitHub 仓库暂无 release tag，无法远程检测」，降级本地路径模式
     - 命令失败：用 UI 工具提示「远程版本检测失败」，降级本地路径模式
  3. **若 `sourceRepo` 为空**（本地模式，向后兼容）：
     - 询问或确认 agentic-workflow 仓库路径（用 UI 交互工具）
     - 读取 `<agentic-workflow-path>/VERSION`，与 `workflowVersion` 比较
     - 低于仓库版本 → **UPGRADE 模式（本地）**；相等 → **SWITCH 模式**；高于 → UI 提示并询问

> Codex 注意：使用 shell 工具执行命令；读取文件用文件读取工具；向用户提问用 AskUserQuestion 或等价的交互工具。

---

## UPGRADE 模式（升级模板版本）

进入原因包括：
- `openspec/config.yaml` 存在但缺少版本标记。
- 远程或本地检测到有新版本可用。

**远程 UPGRADE（sourceRepo 非空）时**，用 AskUserQuestion 展示：
```
检测到新版本可用！

已安装版本：<workflowVersion>
最新版本：<latest-tag>（来自 GitHub Releases）
源仓库：<sourceRepo>
本地仓库路径：<workflowPath>（来自 manifest）

选项：
1. 更新本地仓库并升级 — git pull + 重新安装（推荐）
2. 切换档位 — 跳过升级，直接切换档位
3. 取消
```

若用户选择「更新本地仓库并升级」：
- 若 `workflowPath` 有效：
  ```bash
  git -C "<workflowPath>" pull --ff-only
  bash "<workflowPath>/install.sh" --type <tier> --target <current-dir> --no-interactive --upgrade
  ```
- 若 `workflowPath` 无效，提示：`git clone <sourceRepo> <path>` 后重新运行 `/wf-install`

**本地 UPGRADE（sourceRepo 为空）时**，用 AskUserQuestion 展示：
```
检测到可升级的工作流配置。

当前版本：<installed-version-or-unknown>
仓库版本：<repo-version>

选项：
1. 升级配置 — 重新运行 install.sh 安装当前档位的最新模板（推荐）
2. 切换档位 — 直接切换到其他档位（跳过升级，进入 SWITCH 模式）
3. 取消
```

若用户选择「升级配置」：
- 用 AskUserQuestion 询问 agentic-workflow 仓库路径，然后执行：
  ```bash
  bash "<agentic-workflow-path>/install.sh" --type <detected-or-asked-tier> --target <current-dir> --no-interactive --upgrade
  ```
  其中档位通过 `grep "agentic-workflow-tier:" openspec/config.yaml` 读取当前档位。

若用户选择「切换档位」：进入 **SWITCH 模式**。

---

## INSTALL 模式（全新安装）

### 步骤 1：扫描项目信号

依次执行以下检测命令，收集原始信号：

```bash
# 检查关键文件是否存在
ls requirements.txt pyproject.toml package.json pom.xml go.mod Cargo.toml 2>/dev/null

# 检查目录结构
ls -d notebooks/ app/dao/ app/service/ tests/ templates/ static/ .github/workflows/ 2>/dev/null

# 统计文件数量（用于 vibe 判断）
find . -type f -not -path './.git/*' | wc -l

# 读取 requirements.txt（若存在）
cat requirements.txt 2>/dev/null | head -40

# 读取 package.json（若存在）
cat package.json 2>/dev/null

# 读取 README（前 30 行，判断是否有 prototype/poc/demo/vibe 关键词）
head -30 README.md 2>/dev/null || head -30 README 2>/dev/null
```

### 步骤 2：按优先级规则推算置信度

根据扫描结果，按以下规则打分，计算每个档位的权重。**高优先级规则可覆盖低优先级结果。**

#### 优先级 1（决定性信号）

| 条件 | 结果 |
|------|------|
| `requirements.txt` 中含 `pandas`/`sqlalchemy`/`pymysql`/`openpyxl` | python-data 权重 +5 |
| `package.json` 中同时含前端依赖（react/vue/next）AND 后端依赖（express/nest/koa） | fullstack 权重 +5 |
| README 含 `prototype`/`poc`/`demo`/`vibe`（不区分大小写） | vibe 权重 +3 |

#### 优先级 2（强信号）

| 条件 | 结果 |
|------|------|
| `pyproject.toml` 存在 AND `notebooks/` 目录存在 | python-data 权重 +3 |
| `package.json` 含 react/vue/next，且**无**后端依赖（express/nest/koa） | frontend 权重 +3 |
| `pom.xml` / `go.mod` / `Cargo.toml` 存在 | backend 权重 +3 |

#### 优先级 3（弱信号，辅助）

| 条件 | 结果 |
|------|------|
| `app/dao/` AND `app/service/` 目录存在 | backend 权重 +1 |
| `src/components/` 目录存在 | frontend 权重 +1 |
| `tests/` 目录**不存在** AND 文件总数 < 50 | vibe 权重 +1 |
| `.github/workflows/` 目录**不存在** | vibe 权重 +1 |

#### 冲突规则

Python 项目（含 `requirements.txt` 或 `pyproject.toml`）如果同时有 `templates/` 或 `static/` 目录，**不计为前端信号**，这是 Jinja2/Flask 项目的标准结构。

#### 置信度换算

若最高权重档位得分 ≥ 5，置信度 ≥ 80%；得分 3–4，置信度约 60%；得分 1–2，置信度约 40%。无任何强信号时，vibe 作为兜底候选（置信度 30%）。

### 步骤 3：展示推荐结果，请用户确认

用 AskUserQuestion（或等价 UI 交互工具）展示所有置信度 > 0 的候选档位，按置信度降序排列（★ 标记仅用于顶级推荐）：

```
检测完成，以下是档位推荐（按置信度排序）：

★ python-data   Python 数据项目 🐍  （置信度 85%）
  vibe          轻量快速模式   ⚡  （置信度 30%）

检测依据：[简要说明触发了哪些信号，如「requirements.txt 含 pandas、sqlalchemy」]

请选择：
1. 接受推荐（python-data）
2. 查看全部 5 个档位
3. 取消
```

若用户选择"查看全部 5 个档位"，展示完整列表（同 SWITCH 模式步骤 4）。

### 步骤 4：执行安装

确认档位后，用 AskUserQuestion（或等价 UI 交互工具）询问 agentic-workflow 仓库路径（若用户未提供）：

```
请输入 agentic-workflow 仓库的本地路径（例如：~/workspace/agentic-workflow）：
```

然后执行安装：

在执行前验证路径：test -f "<agentic-workflow-path>/install.sh"
若文件不存在，告知用户「路径无效，未找到 install.sh」，重新询问路径。
确保路径在 bash 命令中用引号包裹，以处理含空格的路径。

```bash
bash "<agentic-workflow-path>/install.sh" --type <tier> --target <current-dir> --no-interactive
```

其中 `<current-dir>` 为当前工作目录的绝对路径，用 `pwd` 获取。

安装完成后输出：
```
✓ 已安装 <tier> 档位。openspec/config.yaml 已生成。
运行 /openspec-propose 开始第一个变更。
```

---

## SWITCH 模式（切换档位）

### 步骤 1：检查未归档变更

运行 shell 命令检查 `openspec/changes/` 下是否有未归档变更：

```bash
for d in openspec/changes/*/; do
  [ -d "$d" ] && [ ! -f "${d}.archived" ] && echo "$d"
done
```

若存在未归档变更（设数量为 N，名称列表为 names），用 AskUserQuestion（或等价 UI 交互工具）展示警告并询问：

```
⚠ 检测到 N 个未归档变更：[names]。切换档位不影响历史记录，但建议先归档完成的变更。

选项：
A. 继续切换（忽略未归档变更）
B. 取消（先归档再切换）
```

若用户选择 B 或取消，中止操作，提示：
```
已取消。请先运行 /openspec-archive-change 归档完成的变更。
```

### 步骤 2：读取当前档位

用 grep 读取 openspec/config.yaml 第2行的工作流档位注释：
  grep "agentic-workflow-tier:" openspec/config.yaml
  例如输出：# agentic-workflow-tier: backend → 当前档位为 backend
  若该注释不存在，显示「当前档位：未知」

### 步骤 3：获取 agentic-workflow 路径

若尚未知道 agentic-workflow 的本地路径，用 AskUserQuestion（或等价 UI 交互工具）询问用户：
「agentic-workflow 仓库在哪里？（输入路径，例：~/projects/agentic-workflow）」
在执行前用 `test -f <path>/install.sh` 验证路径有效，若无效则再次用 UI 工具提示重新输入。

### 步骤 4：展示档位选择

用 AskUserQuestion（或等价 UI 交互工具）展示所有 5 个档位供选择：

```
当前档位：<current-tier-name>

请选择目标档位：

1. 📦 backend      后端服务       — 服务器 API、业务逻辑、数据库操作
2. 🐍 python-data  Python 数据项目 — 数据分析、自动报表、数据处理脚本
3. 🎨 frontend     前端应用       — 网页界面、H5、React/Vue/小程序
4. 🔗 fullstack    前后端合体     — 同一个仓库里既有前端界面又有后端服务
5. ⚡ vibe         轻量快速模式   — 个人项目、快速验证想法、不需要严格审查流程
6. 取消

（当前：<current-tier-name>，再次选择当前档位不会修改文件）
```

### 步骤 5：替换 config.yaml

用户选择目标档位后：

1. 定位对应模板文件：`<agentic-workflow-path>/templates/openspec/config-<tier>.yaml`
2. 备份当前配置：
   ```bash
   cp openspec/config.yaml openspec/config.yaml.bak
   ```
3. 复制新配置：
   ```bash
   cp <agentic-workflow-path>/templates/openspec/config-<tier>.yaml openspec/config.yaml
   ```
4. 若目标档位为 `fullstack`，额外创建目录：
   ```bash
   mkdir -p openspec/specs/frontend openspec/specs/backend
   ```
5. 输出：
   ```
   ✓ 已切换到 <tier-name> 档位。原配置已备份为 openspec/config.yaml.bak。
   ⚠ 注意：config.yaml 已更新，如有自定义规则请手动迁移。
   ```

若用户选择的与当前档位相同，输出：
```
当前已经是 <tier-name> 档位，无需切换。
```
