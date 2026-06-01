---
description: 查看当前工作流状态，或恢复中断的工作流。
  仅当用户显式输入 /wf-status 时使用。
---

# /wf-status

查看当前活跃工作流状态。

执行以下步骤：
1. 检查项目根目录是否存在 `.wf-active` 文件：
   ```bash
   cat .wf-active 2>/dev/null || echo "NOT_FOUND"
   ```

2. **若文件不存在**：
   - 提示「当前没有活跃的工作流」
   - 运行 `openspec list --json 2>/dev/null` 查看是否有 in-progress 的变更
   - 若有 in-progress 变更，列出变更名和状态，提示可用 `/wf-small` 或 `/wf-quick` 继续

3. **若文件存在**，读取内容并展示：
   - 工作流名称（`workflow` 字段）
   - 变更名称（`change` 字段）
   - 开始时间（`started` 字段，换算为易读格式）
   - 运行 `openspec list --json 2>/dev/null` 补充变更当前状态

4. 询问下一步：
   - **继续**：提示「重新输入 /<workflow-name> 并描述从哪一步继续，AI 将从对话历史恢复上下文」
   - **放弃**：删除 `.wf-active`，并询问是否同时放弃 openspec change（若放弃则运行 `openspec abandon <change-name>`，若保留则保持 in-progress 状态）
