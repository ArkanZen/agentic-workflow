---
description: 工作流档位安装/切换/升级。AI 分析项目信号推荐档位，支持全新安装、档位切换和版本升级。
  仅当用户显式输入 /wf-install 时使用；不要因“安装工作流、切换档位、install workflow”等自然语言自动触发。
---

# /wf-install

工作流档位安装与切换。

## 第一步：检测当前状态，路由到对应模式

用 Bash 工具检查 `openspec/config.yaml` 是否存在，并读取版本标记：

```bash
test -f openspec/config.yaml && echo "EXISTS" || echo "NOT_FOUND"
grep "arkan-workflow-version:" openspec/config.yaml 2>/dev/null || echo "NO_VERSION"
```

路由规则：
- 若文件**不存在** → 进入 **INSTALL 模式**
- 若文件**存在** AND **不含** `arkan-workflow-version:` 注释 → 进入 **UPGRADE 模式**
- 若文件**存在** AND 含 `arkan-workflow-version:` 注释：
  1. 询问或确认 arkan-workflow 仓库路径。
  2. 读取 `<arkan-workflow-path>/VERSION`，作为可安装的最新版本。
  3. 将 `openspec/config.yaml` 中的当前版本与仓库版本按语义版本号比较。
  4. 若当前版本低于仓库版本 → 进入 **UPGRADE 模式**。
  5. 若当前版本等于仓库版本 → 进入 **SWITCH 模式**。
  6. 若当前版本高于仓库版本 → 提醒用户本地仓库可能落后，询问是否继续切换档位。

---

## UPGRADE 模式（升级模板版本）

进入原因包括：
- `openspec/config.yaml` 存在但缺少版本标记，说明工作流是在引入版本跟踪之前安装的。
- 已安装版本低于 arkan-workflow 仓库 `VERSION` 中记录的版本。

展示以下提示（用 AskUserQuestion）：
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
- 询问 arkan-workflow 仓库路径（同 INSTALL 模式步骤 4），然后执行：
  ```bash
  bash "<arkan-workflow-path>/install.sh" --type <detected-or-asked-tier> --target <current-dir> --no-interactive --upgrade
  ```
  其中档位通过 `grep "arkan-workflow-tier:" openspec/config.yaml` 读取当前档位。

若用户选择「切换档位」：进入 **SWITCH 模式**。

---

## INSTALL 模式（全新安装）

### 步骤 1：扫描项目信号

用 Bash 工具依次执行以下检测命令，收集原始信号：

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

展示所有置信度 > 0 的候选档位，按置信度降序排列，用 AskUserQuestion 展示（★ 标记仅用于顶级推荐）：

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

确认档位后，询问 arkan-workflow 仓库路径（若用户未提供）：

```
请输入 arkan-workflow 仓库的本地路径（例如：~/workspace/arkan-workflow）：
```

然后执行安装：

在执行前验证路径：test -f "<arkan-workflow-path>/install.sh"
若文件不存在，告知用户「路径无效，未找到 install.sh」，重新询问路径。
确保路径在 bash 命令中用引号包裹，以处理含空格的路径。

```bash
bash "<arkan-workflow-path>/install.sh" --type <tier> --target <current-dir> --no-interactive
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

用 Bash 工具检查 `openspec/changes/` 下是否有未归档变更：

```bash
# 列出 openspec/changes/ 下所有子目录，筛选出不含 .archived 文件的
for d in openspec/changes/*/; do
  [ -d "$d" ] && [ ! -f "${d}.archived" ] && echo "$d"
done
```

若存在未归档变更（设数量为 N，名称列表为 names），显示警告：

```
⚠ 检测到 N 个未归档变更：[names]。切换档位不影响历史记录，但建议先归档完成的变更。继续切换？[y/N]
```

用 AskUserQuestion 等待用户回复。若用户回复 `n` 或 `N` 或直接回车，中止操作，提示：
```
已取消。请先运行 /openspec-archive-change 归档完成的变更。
```

### 步骤 2：读取当前档位

用 grep 读取 openspec/config.yaml 第2行的 arkan-workflow-tier 注释：
  grep "arkan-workflow-tier:" openspec/config.yaml
  例如输出：# arkan-workflow-tier: backend → 当前档位为 backend
  若该注释不存在，显示「当前档位：未知」

### 步骤 3：获取 arkan-workflow 路径

若尚未知道 arkan-workflow 的本地路径，询问用户：
「arkan-workflow 仓库在哪里？（输入路径，例：~/projects/arkan-workflow）」
在执行前用 `test -f <path>/install.sh` 验证路径有效，若无效则提示重新输入。

### 步骤 4：展示档位选择

用 AskUserQuestion 展示所有 5 个档位：

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

1. 定位对应模板文件：`<arkan-workflow-path>/templates/openspec/config-<tier>.yaml`
2. 用 Bash 工具备份当前配置：
   ```bash
   cp openspec/config.yaml openspec/config.yaml.bak
   ```
3. 用 Bash 工具复制新配置：
   ```bash
   cp <arkan-workflow-path>/templates/openspec/config-<tier>.yaml openspec/config.yaml
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
