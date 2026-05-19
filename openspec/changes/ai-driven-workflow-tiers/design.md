## 关卡：工程审查
状态：通过
审查者：gstack/plan-eng-review
问题清单：
- （警告）`/wf-install` 的检测信号需明确优先级顺序，避免 Python 项目含 HTML 模板被误判为 frontend
- （警告）切换档位时未归档变更的警告逻辑需在 design 中具体描述，不能仅在 proposal 中提及

---

## Context

arkan-workflow 目前提供 backend / frontend 两个档位，安装入口为交互式 `install.sh`。现有架构存在两个问题：

1. **档位不足**：Python 数据报表、全栈 monorepo、轻量原型无对应档位，用户只能选一个"最近似"的
2. **Bootstrap 悖论**：`/wf-install` 作为安装命令无法自举——slash command 需先安装才能使用，无法实现"一句话安装"

## Goals / Non-Goals

**Goals:**
- 5 个标准档位，覆盖主流项目类型
- AI 可无需预装命令，通过 README 指引 + `install.sh --no-interactive` 完成 Bootstrap
- `/wf-install` 作为已安装后的管理命令，支持切换/升级
- 档位描述面向非技术用户，用项目功能描述而非 gate 术语

**Non-Goals:**
- 不修改 OpenSpec 状态机核心
- 不支持多 config.yaml 并存
- 不自动回滚 openspec/changes/ 历史

## Decisions

### D1：Bootstrap 分层——install.sh 是唯一自举入口

**决策**：AI 安装通过读 README → 运行 `install.sh --type <档位> --no-interactive` 完成。`/wf-install` 仅用于安装后的切换/升级。

**为什么不把检测逻辑放进 `/wf-install`**：slash command 需要先安装才能运行，存在鸡蛋问题。`install.sh` 是纯 bash 脚本，AI 可以直接调用，无需预装。

**备选方案**：在 README 里写详细步骤让 AI 手动复制文件 → 脆弱，文件列表会变化，维护成本高。

---

### D2：Fullstack 使用单一 config.yaml，rules 取并集

**决策**：`config-fullstack.yaml` 合并 frontend + backend 的所有 gate 规则。`openspec/specs/` 下建 `frontend/` 和 `backend/` 子目录分别存放专属 spec。

**为什么不拆两个 config**：openspec 每个项目只支持一个 config.yaml；拆分需要引入 config 选择机制，复杂度高。

**Gate 合并规则**：工程审查（必须）+ UI 设计审查（必须）+ 安全审查（条件触发）。

---

### D3：Vibe 是档位，不是 flag

**决策**：vibe 是独立的 `config-vibe.yaml`，切换 vibe = 替换 config.yaml。不引入 `mode: vibe` flag 或 overlay 机制。

**为什么不做 overlay**：overlay 需要 config 合并逻辑，增加 openspec 核心复杂度。替换 config.yaml 更简单，行为更可预测。git 可以随时 revert。

---

### D4：检测信号优先级顺序

AI 分析项目时按以下优先级判断（高优先级信号可覆盖低优先级）：

```
优先级 1（决定性信号）
  requirements.txt 含 pandas/sqlalchemy/pymysql/openpyxl  → python-data
  package.json 含 react/next + express/nest 双向依赖       → fullstack
  README 含 prototype/poc/demo/vibe 关键词                 → vibe 权重+3

优先级 2（强信号）
  pyproject.toml + notebooks/ 目录                         → python-data
  package.json 含 react/vue/next                           → frontend
  package.json 含 express/nest/koa（无前端依赖）            → backend
  pom.xml / go.mod / Cargo.toml                            → backend

优先级 3（弱信号，辅助）
  app/dao/ + app/service/ 目录                             → backend 权重+1
  src/components/ 目录                                     → frontend 权重+1
  无 tests/ 目录 + 文件数 <50                              → vibe 权重+1
  无 CI 配置（.github/workflows/ 不存在）                  → vibe 权重+1

冲突解决规则
  优先级 1 信号存在 → 直接输出，不受低优先级影响
  Python 项目含 HTML/Jinja2 模板 → 不算 frontend 信号（server-side render）
  仅有 index.html/static/ 无 package.json → 不算 frontend
```

---

### D5：切换时的未归档变更警告

切换档位前，`/wf-install` 检查 `openspec/changes/` 下是否存在未归档（无 `.archived` 标记）的变更目录。若存在，展示警告：

```
⚠  检测到 N 个未归档变更：change-name-1, change-name-2
   这些变更在「旧档位」下创建，切换后新变更将适用「新档位」gate 规则。
   建议先归档或评估这些变更，再切换档位。

   继续切换？[y/N]
```

检测方式：`ls openspec/changes/` 中不含 `.archived` 文件的子目录即为未归档。

---

### D6：`/wf-install` 的三种操作模式

```
检测 openspec/config.yaml 是否存在
    │
    ├── 不存在 → INSTALL 模式：AI 检测 + 推荐 + 全量安装
    │
    └── 存在
            ├── 读取当前档位
            ├── 比对模板版本（config header 中的 version 字段）
            │       ├── 版本落后 → UPGRADE 模式：提示升级，保留自定义内容
            │       └── 版本相同 → SWITCH 模式：展示所有档位供选择
            └── 用户也可强制 SWITCH：直接输入目标档位名
```

## Risks / Trade-offs

**检测误判** → 明确优先级规则（见 D4），展示置信度，用户可覆盖
**Vibe 项目切回正式档位时缺少 gate 历史** → 属预期行为，README 说明；git log 保留完整记录
**config-fullstack.yaml gate 过重** → 条件安全审查（涉及 auth/外部 API 才触发）降低日常摩擦
**install.sh 非交互模式下无用户确认** → `--no-interactive` 只在 AI 已获得用户确认后调用，命令本身不跳过确认逻辑，由 AI 层保证

## Migration Plan

1. 新增 3 个 config 模板（无破坏性）
2. 修改 `install.sh` 加参数（无参数时行为不变）
3. 新增 `/wf-install` 命令文件
4. 新增 README AI 安装指南章节
5. 现有已安装工作流的项目：无需变更，切换档位时用 `/wf-install` 即可

## Open Questions

- 无
