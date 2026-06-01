---
description: 产品/架构方案：还不确定是否值得做，先评估价值、范围和可行性。
  仅当用户显式输入 /wf-plan 时使用；不要因“产品方案、架构方案、方案讨论、值不值得做”等自然语言自动触发。
---

# /wf-plan

产品 / 架构方案通道。

**状态行规则**：在本工作流执行期间，每次回复开头输出一行：
`> wf-plan · 步骤 N/5`
N 为当前正在执行的步骤编号。

适用于想法尚不确定、需要先判断是否值得做或如何收敛范围的任务。

## Host 命令映射

- Claude CLI：工程审查使用 /plan-eng-review；产品取舍可使用 /plan-ceo-review 或 /office-hours。
- Codex App：工程审查使用 /gstack-plan-eng-review；产品取舍可使用 /gstack-plan-ceo-review 或 /gstack-office-hours。
- 产品审查不可用时，可以明确降级为普通产品分析；工程审查不可用时，必须等待用户确认后才可降级继续。

执行以下步骤：
1. 先从产品视角梳理：值得做？用户价值？替代方案？更小路径？
2. 若 /plan-ceo-review 或 /office-hours 可用，执行其中一个补充产品取舍审查；不可用时说明降级原因
3. 调用 /plan-eng-review，评估工程可行性、复杂度和风险
4. 对照 `risk_triggers` 输出建议路径：不做 / /wf-quick / /wf-small / /wf-complex / /wf-debug
5. review 完成后询问：「决定做了吗？用哪个 workflow 继续？」
