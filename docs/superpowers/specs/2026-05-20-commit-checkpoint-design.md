# Commit Checkpoint 设计文档

**日期：** 2026-05-20
**状态：** 已确认，待实现

---

## 背景与问题

非专业开发者使用 AI 辅助开发时，容易忽略及时提交代码的习惯。变更积累过多后，一旦出现问题，AI 无法精确协助回滚，排查成本大幅上升。

本设计在现有 `/wf-*` 工作流的自然节点插入 commit 提示，以需求为维度建立提交习惯，不在工作流之外做任何侵入。

---

## 非目标

- 不在 `/wf-*` 命令之外（如普通编辑、`git`命令、其他工具）触发任何提示
- 不强制提交（用户始终可以跳过）
- 不替代 git hooks 或 CI 机制
- 不处理多人协作冲突、分支合并等场景

---

## 设计决定

| 维度 | 决定 |
|------|------|
| 提交模式 | AI 建议 + 用户确认后 AI 执行（非全自动，非纯提示） |
| 触发维度 | 以需求为单位，每次 `/wf-*` 调用触发一次开始、一次结束 |
| 规则存放 | `openspec/config.yaml`（单一事实来源） |
| wf-quick 宽松 | 跳过 start checkpoint，仅保留 end checkpoint |

---

## 架构

规则集中在 `openspec/config.yaml` 的 `commit_checkpoints` 块。各 `/wf-*` 命令在对应位置引用该配置执行，不重复写逻辑。

```
/wf-quick   ──────────────────────── END ✦
/wf-small   ── START ✦ ──────────── END ✦
/wf-complex ── START ✦ ──────────── END ✦
```

---

## Config Schema

在 `openspec/config.yaml` 及全部 5 个 `templates/openspec/config-*.yaml` 中新增：

```yaml
commit_checkpoints:
  start:
    enabled_for: [wf-small, wf-complex]
    behavior: |
      运行 git status --short。若无未提交文件，静默继续。
      若有未提交文件：
        展示文件列表，提示"检测到 N 个文件未提交（上次变更遗留），建议先提交再开始新需求"。
        询问用户 [Y/跳过]。
        用户选 Y：基于 git diff 内容生成 commit message，用户确认后执行 git commit。
        用户跳过：直接进入工作流，不再追问。

  end:
    enabled_for: [wf-quick, wf-small, wf-complex]
    behavior: |
      验证通过后，读取当前 change 的 proposal 标题和 tasks 列表，
      生成 conventional commit message（类型从 feat/fix/docs/refactor 中选择）。
      message body 包含本次 tasks 的摘要列表。
      展示给用户，询问 [Y/编辑/跳过]。
      用户选 Y：执行 git add -A，git commit -m "<message>"，输出 commit hash，进入归档询问。
      用户选编辑：用用户提供的 message 执行提交。
      用户跳过：直接进入归档询问，不再追问。
```

---

## 各档工作流改动

### /wf-quick

在步骤「验证通过后同步 tasks.md」之后、「询问用户是否归档」之前，插入：

> 读取 `openspec/config.yaml` 中 `commit_checkpoints.end` 规则并执行。

### /wf-small

- **开头**（步骤 1 之前）插入：
  > 读取 `openspec/config.yaml` 中 `commit_checkpoints.start` 规则并执行。

- **验证完成后**（归档询问之前）插入：
  > 读取 `openspec/config.yaml` 中 `commit_checkpoints.end` 规则并执行。

### /wf-complex

与 wf-small 相同：开头插 start，verification 验收后插 end。

---

## 文件改动清单

| 文件 | 类型 |
|------|------|
| `openspec/config.yaml` | 新增 `commit_checkpoints` 块 |
| `templates/openspec/config-backend.yaml` | 同上 |
| `templates/openspec/config-frontend.yaml` | 同上 |
| `templates/openspec/config-fullstack.yaml` | 同上 |
| `templates/openspec/config-python-data.yaml` | 同上 |
| `templates/openspec/config-vibe.yaml` | 同上 |
| `templates/claude/commands/wf-quick.md` | 插入 end checkpoint 引用 |
| `templates/claude/commands/wf-small.md` | 插入 start + end checkpoint 引用 |
| `templates/claude/commands/wf-complex.md` | 插入 start + end checkpoint 引用 |
| `templates/codex/skills/wf-quick/SKILL.md` | 同 claude 版 |
| `templates/codex/skills/wf-small/SKILL.md` | 同 claude 版 |
| `templates/codex/skills/wf-complex/SKILL.md` | 同 claude 版 |

共 **12 个文件**。

---

## 行为示例

### START checkpoint 触发时

```
⚠ 检测到 3 个文件未提交（上次变更遗留）：
  M src/api/user.ts
  M src/service/export.ts
  A src/types/export.d.ts

建议在开始新需求前先提交这些变更。是否现在提交？[Y/跳过]
```

用户选 Y → AI 读取 git diff 生成 message（如 `fix: 修复用户导出逻辑`）→ 确认 → `git commit`

### END checkpoint 触发时

```
✓ 验证通过。建议提交本次变更：

  feat: 新增用户数据导出接口

  实现内容：
  - 新增 /api/export 接口
  - 支持 CSV / Excel 格式
  - 补充单元测试覆盖

确认提交？[Y/编辑/跳过]
```

---

## 设计原则

习惯通过降低摩擦建立，而不是强制拦截。两个 checkpoint 都不是硬性门控，但每次都提供最低阻力路径（一键确认），让提交变成自然的工作节奏。
