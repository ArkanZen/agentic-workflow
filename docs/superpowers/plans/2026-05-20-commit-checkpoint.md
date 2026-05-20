# Commit Checkpoint 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 /wf-quick、/wf-small、/wf-complex 三个工作流命令的关键节点插入 commit 提示，帮助非专业开发者养成及时提交代码的习惯。

**Architecture:** 规则集中写入 `openspec/config.yaml`（及 5 个模板 config），各 `/wf-*` 命令只在对应位置插入一行"读取并执行 commit_checkpoints 规则"，不重复写逻辑。wf-small / wf-complex 有 start + end 两个 checkpoint，wf-quick 只有 end checkpoint。

**Tech Stack:** YAML、Markdown（无编程语言，纯配置 + 指令文本改动）

**Spec:** `docs/superpowers/specs/2026-05-20-commit-checkpoint-design.md`

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
| `templates/claude/commands/wf-quick.md` | 插入 end checkpoint，步骤重新编号 |
| `templates/claude/commands/wf-small.md` | 插入 start + end checkpoint，步骤重新编号 |
| `templates/claude/commands/wf-complex.md` | 插入 start + end checkpoint，步骤重新编号 |
| `templates/codex/skills/wf-quick/SKILL.md` | 镜像 Claude 版改动 |
| `templates/codex/skills/wf-small/SKILL.md` | 镜像 Claude 版改动 |
| `templates/codex/skills/wf-complex/SKILL.md` | 镜像 Claude 版改动 |

---

## Task 1：给所有 config YAML 新增 commit_checkpoints 块

> 实现 spec §Config Schema

**Files:**
- Modify: `openspec/config.yaml`
- Modify: `templates/openspec/config-backend.yaml`
- Modify: `templates/openspec/config-frontend.yaml`
- Modify: `templates/openspec/config-fullstack.yaml`
- Modify: `templates/openspec/config-python-data.yaml`
- Modify: `templates/openspec/config-vibe.yaml`

- [ ] **Step 1：在 `openspec/config.yaml` 末尾追加以下内容**

在文件最后一行（当前末尾是 `- 每个任务须注明它实现的是哪个 spec 章节。`）之后追加：

```yaml

commit_checkpoints:
  start:
    enabled_for: [wf-small, wf-complex]
    behavior: |
      运行 git status --short。若无未提交文件，静默继续。
      若有未提交文件：
        展示文件列表，提示"检测到 N 个文件未提交（上次变更遗留），建议先提交再开始新需求"。
        询问用户：请输入 commit message（或输入 'ai' 让 AI 帮你生成，输入 's' 跳过）。
        用户输入 message：执行 git add -A && git commit -m "<message>"。
        用户输入 'ai'：读取 git diff，生成 message，展示给用户确认后执行 git commit。
        用户输入 's' 或直接回车：直接进入工作流，不再追问。

  end:
    enabled_for: [wf-quick, wf-small, wf-complex]
    behavior: |
      验证通过后，基于当前会话已有的 proposal 标题和 tasks 列表（无需额外读取文件）
      生成 conventional commit message（类型从 feat/fix/docs/refactor 中选择）。
      message body 包含本次 tasks 的摘要列表。
      展示给用户，询问 [Y/编辑/跳过]。
      用户选 Y：执行 git add -A && git commit -m "<message>"，输出 commit hash，进入归档询问。
      用户选编辑：用用户提供的 message 执行提交，进入归档询问。
      用户跳过：直接进入归档询问，不再追问。
      注意：此步骤不读取 git diff，所有 message 素材来自会话上下文，避免额外 token 开销。
```

- [ ] **Step 2：验证 openspec/config.yaml**

运行：
```bash
grep -n "commit_checkpoints" openspec/config.yaml
```
预期输出：出现 `commit_checkpoints:`、`start:`、`end:` 等行。

- [ ] **Step 3：对 5 个模板 config 文件执行相同追加**

每个文件末尾（当前末尾均为 `- 每个任务须注明它实现的是哪个 spec 章节。`）追加完全相同的内容：

```
templates/openspec/config-backend.yaml
templates/openspec/config-frontend.yaml
templates/openspec/config-fullstack.yaml
templates/openspec/config-python-data.yaml
templates/openspec/config-vibe.yaml
```

追加内容与 Step 1 完全一致（同一段 YAML）。

- [ ] **Step 4：验证 5 个模板 config 都包含新块**

运行：
```bash
grep -l "commit_checkpoints" templates/openspec/config-*.yaml | wc -l
```
预期输出：`5`

- [ ] **Step 5：提交**

```bash
git add openspec/config.yaml templates/openspec/config-*.yaml
git commit -m "feat: add commit_checkpoints config block to all openspec configs"
```

---

## Task 2：更新 Claude 命令模板

> 实现 spec §各档工作流改动

**Files:**
- Modify: `templates/claude/commands/wf-quick.md`
- Modify: `templates/claude/commands/wf-small.md`
- Modify: `templates/claude/commands/wf-complex.md`

- [ ] **Step 1：更新 wf-quick.md**

将现有步骤 8-10 替换为（在步骤 8 后插入 end checkpoint，将原 9-10 顺延为 10-11）：

原文（步骤 8 之后）：
```
9. 询问用户是否归档；用户确认后再执行 /openspec-archive-change
10. 归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑；若第 8 步已确认全部任务完成，归档不应因任务未勾选再次打断
```

改为：
```
9. 读取 openspec/config.yaml 中 commit_checkpoints.end 规则并执行。
10. 询问用户是否归档；用户确认后再执行 /openspec-archive-change
11. 归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑；若第 8 步已确认全部任务完成，归档不应因任务未勾选再次打断
```

- [ ] **Step 2：验证 wf-quick.md**

运行：
```bash
grep -n "commit_checkpoints" templates/claude/commands/wf-quick.md
```
预期输出：出现包含 `commit_checkpoints.end` 的行。

- [ ] **Step 3：更新 wf-small.md**

将现有全部步骤替换为以下内容（在开头插入 start checkpoint，在步骤 5 后插入 end checkpoint）：

```
执行以下步骤：
1. 读取 openspec/config.yaml 中 commit_checkpoints.start 规则并执行。
2. 将用户输入作为需求背景，不重复询问已说明的信息
3. 执行 /openspec-propose，生成 proposal、design gate 和 tasks
4. 若 gate 阻断，先根据审查意见修改 proposal/design，再继续
5. tasks 明确后，执行 /openspec-apply-change 实现
6. 实现完成后运行必要验证或 review，并在结果中说明已验证项
7. 读取 openspec/config.yaml 中 commit_checkpoints.end 规则并执行。
8. 询问用户是否归档；用户确认后再执行 /openspec-archive-change
9. 归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑
```

- [ ] **Step 4：验证 wf-small.md**

运行：
```bash
grep -n "commit_checkpoints" templates/claude/commands/wf-small.md
```
预期输出：出现两行，分别包含 `commit_checkpoints.start` 和 `commit_checkpoints.end`。

- [ ] **Step 5：更新 wf-complex.md**

将现有全部步骤替换为以下内容（在开头插入 start checkpoint，在步骤 5 验收后插入 end checkpoint）：

```
执行以下步骤：
1. 读取 openspec/config.yaml 中 commit_checkpoints.start 规则并执行。
2. 调用 brainstorming skill（superpowers:brainstorming）探索需求、边界、风险和替代方案
3. 设计确认后，执行 /openspec-propose（含 GStack design gate）
4. apply 前调用 superpowers:writing-plans 细化任务分解
5. 执行 /openspec-apply-change 实现
6. 完成后调用 superpowers:verification-before-completion 验收
7. 读取 openspec/config.yaml 中 commit_checkpoints.end 规则并执行。
8. 验收通过后询问用户是否归档；用户确认后再执行 /openspec-archive-change
9. 归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑
```

- [ ] **Step 6：验证 wf-complex.md**

运行：
```bash
grep -n "commit_checkpoints" templates/claude/commands/wf-complex.md
```
预期输出：出现两行，分别包含 `commit_checkpoints.start` 和 `commit_checkpoints.end`。

- [ ] **Step 7：提交**

```bash
git add templates/claude/commands/wf-quick.md templates/claude/commands/wf-small.md templates/claude/commands/wf-complex.md
git commit -m "feat: add commit checkpoints to Claude wf-* command templates"
```

---

## Task 3：同步 Codex SKILL.md 模板

> 镜像 Task 2，保持 Claude / Codex 一致

**Files:**
- Modify: `templates/codex/skills/wf-quick/SKILL.md`
- Modify: `templates/codex/skills/wf-small/SKILL.md`
- Modify: `templates/codex/skills/wf-complex/SKILL.md`

- [ ] **Step 1：更新 wf-quick SKILL.md**

在步骤 8 后插入 end checkpoint，将原 9-10 顺延为 10-11（与 Task 2 Step 1 完全对应）：

原文（步骤 8 之后）：
```
9. 询问用户是否归档；用户确认后再执行 /openspec-archive-change
10. 归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑；若第 8 步已确认全部任务完成，归档不应因任务未勾选再次打断
```

改为：
```
9. 读取 openspec/config.yaml 中 commit_checkpoints.end 规则并执行。
10. 询问用户是否归档；用户确认后再执行 /openspec-archive-change
11. 归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑；若第 8 步已确认全部任务完成，归档不应因任务未勾选再次打断
```

- [ ] **Step 2：更新 wf-small SKILL.md**

将现有全部步骤替换为（与 Task 2 Step 3 对应，保留 SKILL.md 原有 frontmatter 不变）：

```
执行以下步骤：
1. 读取 openspec/config.yaml 中 commit_checkpoints.start 规则并执行。
2. 将用户输入作为需求背景，不重复询问已说明的信息
3. 执行 /openspec-propose，生成 proposal、design gate 和 tasks
4. 若 gate 阻断，先根据审查意见修改 proposal/design，再继续
5. tasks 明确后，执行 /openspec-apply-change 实现
6. 实现完成后运行必要验证或 review，并在结果中说明已验证项
7. 读取 openspec/config.yaml 中 commit_checkpoints.end 规则并执行。
8. 询问用户是否归档；用户确认后再执行 /openspec-archive-change
9. 归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑
```

- [ ] **Step 3：更新 wf-complex SKILL.md**

将现有全部步骤替换为（与 Task 2 Step 5 对应，保留 Codex 版原有措辞风格，frontmatter 不变）：

```
执行以下步骤：
1. 读取 openspec/config.yaml 中 commit_checkpoints.start 规则并执行。
2. 调用 brainstorming skill 探索需求、边界、风险和替代方案
3. 设计确认后，执行 /openspec-propose（含 /gstack-plan-eng-review gate）
4. apply 前按 writing-plans 风格细化任务分解
5. 执行 /openspec-apply-change 实现
6. 完成后执行 verification-before-completion 验收
7. 读取 openspec/config.yaml 中 commit_checkpoints.end 规则并执行。
8. 验收通过后询问用户是否归档；用户确认后再执行 /openspec-archive-change
9. 归档时保留 /openspec-archive-change 的选择、未完成任务和 delta spec 同步确认逻辑
```

- [ ] **Step 4：验证三个 SKILL.md 都包含 commit_checkpoints**

运行：
```bash
grep -rl "commit_checkpoints" templates/codex/skills/ | wc -l
```
预期输出：`3`

- [ ] **Step 5：提交**

```bash
git add templates/codex/skills/wf-quick/SKILL.md templates/codex/skills/wf-small/SKILL.md templates/codex/skills/wf-complex/SKILL.md
git commit -m "feat: sync commit checkpoints to Codex wf-* skill templates"
```

---

## 完成后验证

运行以下命令确认所有改动都已落地：

```bash
# 确认 6 个 config 文件都有 commit_checkpoints
grep -l "commit_checkpoints" openspec/config.yaml templates/openspec/config-*.yaml | wc -l
# 预期：6

# 确认 3 个 Claude 命令文件都有引用
grep -l "commit_checkpoints" templates/claude/commands/wf-*.md | wc -l
# 预期：3

# 确认 3 个 Codex skill 文件都有引用
grep -l "commit_checkpoints" templates/codex/skills/wf-*/SKILL.md | wc -l
# 预期：3

# 确认 wf-small 和 wf-complex 各有 start + end 两处引用
grep -c "commit_checkpoints" templates/claude/commands/wf-small.md
# 预期：2
grep -c "commit_checkpoints" templates/claude/commands/wf-complex.md
# 预期：2

# 确认 wf-quick 只有 end 一处引用
grep -c "commit_checkpoints" templates/claude/commands/wf-quick.md
# 预期：1
```
