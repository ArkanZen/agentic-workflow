---
description: 工作流档位安装/切换/升级。AI 分析项目信号推荐档位，支持全新安装、档位切换和版本升级。
  仅当用户显式输入 /wf-install 时使用；不要因"安装工作流、切换档位、install workflow"等自然语言自动触发。
---

# /wf-install

工作流档位安装与切换。

## 用户决策原则

/wf-install 只负责检测、推荐、预览和执行用户确认过的动作。不得因为检测结果“明显”就自动选择模式、档位或直接执行安装脚本。

必须遵守：
- 状态检测完成后，先展示当前状态、推荐动作和可选动作，让用户选择 INSTALL / SWITCH / UPGRADE / 取消。
- 档位推荐只能作为建议；最终档位必须由用户选择或确认。
- 执行任何写入前，必须展示命令、目标目录、档位、变更文件范围和风险提示，并等待用户确认。
- 如果用户选择与推荐不同的模式或档位，按用户选择执行，不反复劝阻；只在明显危险时提示影响。

## 第一步：检测当前状态，生成建议但不自动执行

用 Bash 工具检查 `openspec/config.yaml` 是否存在，并读取版本标记和 manifest：

```bash
test -f openspec/config.yaml && echo "EXISTS" || echo "NOT_FOUND"
grep "agentic-workflow-version:" openspec/config.yaml 2>/dev/null || echo "NO_VERSION"
cat .agentic-workflow/manifest.json 2>/dev/null || echo "NO_MANIFEST"
```

建议规则：
- 若文件**不存在** → 推荐 **INSTALL 模式**
- 若文件**存在** AND **不含**工作流版本注释 → 推荐 **UPGRADE 模式**（版本未知）
- 若文件**存在** AND 含工作流版本注释：
  1. 读取 manifest.json 中的 `sourceRepo` 和 `workflowVersion`。
  2. **若 `sourceRepo` 非空**（远程模式）：
     - 执行 `git ls-remote --tags --refs "<sourceRepo>" 'v[0-9]*' 2>/dev/null | awk '{print $2}' | sed 's|refs/tags/||' | sort -V | tail -1` 获取最新 tag
     - 成功且返回 tag：去掉 `v` 前缀，与 `workflowVersion` 按语义版本比较
       - 最新版本 > 已安装版本 → 推荐 **UPGRADE 模式（远程）**
       - 最新版本 = 已安装版本 → 推荐 **SWITCH 模式**
     - 成功但无 tag：提示「GitHub 仓库暂无 release tag，无法远程检测」，降级为本地路径模式
     - 命令失败：提示「远程版本检测失败（网络或权限问题）」，降级为本地路径模式
  3. **若 `sourceRepo` 为空**（本地模式，向后兼容）：
     - 询问或确认 agentic-workflow 仓库路径
     - 读取 `<agentic-workflow-path>/VERSION`，与 `workflowVersion` 比较
     - 低于仓库版本 → 推荐 **UPGRADE 模式（本地）**；相等 → 推荐 **SWITCH 模式**；高于 → 提示并询问

检测完成后必须展示选择面板，不得直接进入某个模式：

```
检测完成。

当前状态：<未安装 / 已安装 / 版本未知 / 有新版本>
当前档位：<tier-or-unknown>
当前版本：<version-or-unknown>
推荐动作：<INSTALL / SWITCH / UPGRADE>，原因：<简要说明>

请选择下一步：
1. 按推荐动作继续（<recommended-mode>）
2. 全新安装 / 重新安装（INSTALL）
3. 切换档位（SWITCH）
4. 升级模板（UPGRADE）
5. 只查看状态，不修改文件
6. 取消
```

用户选择后才进入对应模式。若用户选择“只查看状态”，输出检测摘要和建议，不执行写入。

---

## UPGRADE 模式（升级模板版本）

进入原因包括：
- `openspec/config.yaml` 存在但缺少版本标记。
- 远程或本地检测到有新版本可用。

**远程 UPGRADE（sourceRepo 非空）时展示**（用 AskUserQuestion）：
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

若用户选择「更新本地仓库并升级」，必须先展示最终执行预览：
```
即将执行：
git -C "<workflowPath>" pull --ff-only
bash "<workflowPath>/install.sh" --type <tier> --target <current-dir> --no-interactive --upgrade

将更新：openspec/config.yaml、AGENTS.md、.codex/skills/wf-*、可选 .claude/commands/wf-*
请选择：确认执行 / 返回选择 / 取消
```

用户确认后：
- 若 `workflowPath`（manifest 中记录的本地路径）有效：
  ```bash
  git -C "<workflowPath>" pull --ff-only
  bash "<workflowPath>/install.sh" --type <tier> --target <current-dir> --no-interactive --upgrade
  ```
- 若 `workflowPath` 无效（路径不存在）：
  提示用户先 clone：`git clone <sourceRepo> <path>` 后重新运行 `/wf-install`

**本地 UPGRADE（sourceRepo 为空）时展示**（用 AskUserQuestion）：
```
检测到可升级的工作流配置。

当前版本：<installed-version-or-unknown>
仓库版本：<repo-version>

选项：
1. 升级配置 — 重新运行 install.sh 安装当前档位的最新模板（推荐）
2. 切换档位 — 直接切换到其他档位（跳过升级，进入 SWITCH 模式）
3. 取消
```

若用户选择「升级配置」，必须先展示最终执行预览并等待确认：
- 询问 agentic-workflow 仓库路径（用 AskUserQuestion），然后执行：
  ```bash
  bash "<agentic-workflow-path>/install.sh" --type <detected-or-asked-tier> --target <current-dir> --no-interactive --upgrade
  ```
  其中档位通过 `grep "agentic-workflow-tier:" openspec/config.yaml` 读取当前档位。

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

### 步骤 3：展示推荐结果，让用户选择档位

展示所有 5 个档位。推荐档位排在第一位并标注“推荐”，但用户必须显式选择最终档位：

```
检测完成，以下是档位推荐（按置信度排序）：

★ python-data   Python 数据项目 🐍  （置信度 85%）
  vibe          轻量快速模式   ⚡  （置信度 30%）

检测依据：[简要说明触发了哪些信号，如「requirements.txt 含 pandas、sqlalchemy」]

请选择最终安装档位：
1. python-data（推荐，置信度 85%）— Python 数据项目
2. backend — 后端服务
3. frontend — 前端应用
4. fullstack — 前后端合体
5. vibe — 轻量快速模式
6. 取消
```

### 步骤 4：执行安装

确认档位后，用 AskUserQuestion 询问 agentic-workflow 仓库路径（若用户未提供）。执行前必须展示最终预览：

```
请输入 agentic-workflow 仓库的本地路径（例如：~/workspace/agentic-workflow）：
```

在执行前验证路径：test -f "<agentic-workflow-path>/install.sh"
若文件不存在，告知用户「路径无效，未找到 install.sh」，重新询问路径。
确保路径在 bash 命令中用引号包裹，以处理含空格的路径。

```bash
bash "<agentic-workflow-path>/install.sh" --type <tier> --target <current-dir> --no-interactive
```

其中 `<current-dir>` 为当前工作目录的绝对路径，用 `pwd` 获取。
展示：

```
即将安装：
目标项目：<current-dir>
选择档位：<tier>
执行命令：bash "<agentic-workflow-path>/install.sh" --type <tier> --target <current-dir> --no-interactive
将写入：openspec/config.yaml、AGENTS.md、.agentic-workflow/manifest.json、.codex/skills/wf-*、可选 .claude/commands/wf-*

请选择：确认安装 / 返回选择档位 / 取消
```

用户确认后执行安装。

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

若存在未归档变更（设数量为 N，名称列表为 names），用 AskUserQuestion 显示警告：

```
⚠ 检测到 N 个未归档变更：[names]。切换档位不影响历史记录，但建议先归档完成的变更。

选项：
A. 继续切换（忽略未归档变更）
B. 取消（先归档再切换）
```

若用户选择 B，中止操作，提示：
```
已取消。请先运行 /openspec-archive-change 归档完成的变更。
```

### 步骤 2：读取当前档位

用 grep 读取 openspec/config.yaml 第2行的工作流档位注释：
  grep "agentic-workflow-tier:" openspec/config.yaml
  例如输出：# agentic-workflow-tier: backend → 当前档位为 backend
  若该注释不存在，显示「当前档位：未知」

### 步骤 3：获取 agentic-workflow 路径

优先使用 manifest.json 中的 `workflowPath`（若路径有效）。
若 `workflowPath` 无效或无 manifest，用 AskUserQuestion 询问用户：
「agentic-workflow 仓库在哪里？（输入路径，例：~/projects/agentic-workflow）」
在执行前用 `test -f <path>/install.sh` 验证路径有效，若无效则再次用 UI 工具提示重新输入。

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

用户选择目标档位后，必须先展示最终预览：

```
即将切换档位：
目标项目：<current-dir>
当前档位：<current-tier-name>
目标档位：<tier>
执行命令：bash "<agentic-workflow-path>/install.sh" --switch --type <tier> --target <current-dir> --no-interactive
将备份：openspec/config.yaml -> openspec/config.yaml.bak
将更新：openspec/config.yaml、.agentic-workflow/manifest.json

请选择：确认切换 / 返回选择档位 / 取消
```

用户确认后：

1. 用 Bash 工具执行安装脚本的 switch 模式，由脚本备份当前配置并渲染 VERSION 占位符：
   ```bash
   bash "<agentic-workflow-path>/install.sh" --switch --type <tier> --target <current-dir> --no-interactive
   ```
2. 输出：
   ```
   ✓ 已切换到 <tier-name> 档位。原配置已备份为 openspec/config.yaml.bak。
   ⚠ 注意：config.yaml 已更新，如有自定义规则请手动迁移。
   ```

若用户选择的与当前档位相同，输出：
```
当前已经是 <tier-name> 档位，无需切换。
```
