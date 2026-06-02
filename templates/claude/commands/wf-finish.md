---
description: 显式关闭当前工作流，宣告完成或切换。
  仅当用户显式输入 /wf-finish 时使用。
---

# /wf-finish

关闭当前活跃工作流。

执行以下步骤：

1. 检查 `.wf-active` 是否存在：
   ```bash
   cat .wf-active 2>/dev/null || echo "NOT_FOUND"
   ```

2. **若不存在**：提示「当前没有活跃的工作流」，结束。

3. **若存在**，读取工作流类型并处理：

   **wf-plan / wf-debug**（无 OpenSpec change）：
   - 用一句话总结本次讨论或调试的结论
   - 宣告：「wf-[name] 已关闭」
   - 删除 `.wf-active`：`rm -f .wf-active`

   **wf-quick / wf-small / wf-complex**（有 OpenSpec change）：
   - 运行 `openspec list --json 2>/dev/null` 查看 change 当前状态
   - 若 change 已归档（end checkpoint 完成）：直接删除 `.wf-active`，宣告完成
   - 若 change 仍 in-progress：用 AskUserQuestion 询问：
     - 选项 A：保留 in-progress（下次继续，.wf-active 保留）
     - 选项 B：放弃此 change（运行 `openspec abandon <change-name>`，再删除 `.wf-active`）
   - 按用户选择执行，宣告结果

4. 宣告工作流已关闭。若用户有后续意图，提示可直接输入下一个 `/wf-*` 命令。
