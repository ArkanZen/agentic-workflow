---
name: wf-plan
description: |
  产品/架构方案：还不确定是否值得做，先评估价值、范围和可行性。
  仅当用户显式输入 /wf-plan 时使用；不要因“产品方案、架构方案、方案讨论、值不值得做”等自然语言自动触发。
---

产品 / 架构方案通道。

**状态行规则**：在本工作流执行期间，每次回复开头输出一行：
`> wf-plan · 步骤 N/5`
N 为当前正在执行的步骤编号。

**切换与退出规则**：
- 收到超出当前范围的独立任务请求时，先宣告「wf-[name] 已暂停/切换，原因：[一句话]」，再处理新请求，不得静默切换
- 用户调用 `/wf-finish` 显式关闭；调用其他 `/wf-*` 命令时自动切换

适用于想法尚不确定、需要先判断是否值得做或如何收敛范围的任务。

## 强制依赖清单

必须执行指定审查命令，不得用普通方案讨论替代。

```yaml
required_reviews:
  engineering_assessment:
    - /gstack-plan-eng-review
conditional_reviews:
  product_assessment:
    - /gstack-plan-ceo-review
    - /gstack-office-hours
```

若宿主环境没有 `/gstack-plan-eng-review`，必须先明确说明缺失项和影响，再等待用户确认是否降级为普通方案讨论；不得声称已完成 GStack 审查。

## Host 命令映射

- Codex App：工程审查使用 `/gstack-plan-eng-review`；产品取舍可使用 `/gstack-plan-ceo-review` 或 `/gstack-office-hours`。
- Claude CLI：工程审查使用 `/plan-eng-review`；产品取舍可使用 `/plan-ceo-review` 或 `/office-hours`。
- 产品审查不可用时，可以明确降级为普通产品分析；工程审查不可用时，必须等待用户确认后才可降级继续。

## Codex App 交互规则

- 有选项的地方，优先使用 Codex App 提供的 UI 交互工具（如 `request_user_input` 或当前宿主暴露的等价工具）。
- 只有 UI 交互工具不可用时，才退化为文本选项；文本选项必须短且明确。
- 完成方案评估后，必须展示推荐路径和备选项，再询问是否进入 `/wf-small` 或 `/wf-complex`。

## 启动自检

开始执行时必须先展示或内部完成以下自检，并在首条进展中说明依赖状态：

- 当前工作流：`wf-plan`
- 必须执行的审查：`/gstack-plan-eng-review`
- 可选产品审查：`/gstack-plan-ceo-review` 或 `/gstack-office-hours`（可用时优先用于价值、范围和取舍判断）
- 已加载状态：已可用 / 未加载并说明降级原因
- 下一步：工程可行性审查

执行以下步骤：
1. 先从产品视角梳理：值得做？用户价值？替代方案？更小路径？
2. 若 `/gstack-plan-ceo-review` 或 `/gstack-office-hours` 可用，执行其中一个补充产品取舍审查；不可用时说明降级原因。
3. 执行 `/gstack-plan-eng-review` 从工程视角评估可行性、复杂度和风险；不得用普通分析替代。
4. 对照 `risk_triggers` 输出建议路径：不做 / `/wf-quick` / `/wf-small` / `/wf-complex` / `/wf-debug`。
5. 完成后询问：「决定做了吗？用哪个 workflow 继续？」

## 收尾审计

完成前必须输出执行审计：

- `wf-plan`：已执行
- 产品审查：列出执行的产品审查能力或降级原因
- GStack 审查：列出 `/gstack-plan-eng-review` 状态或降级原因
- 推荐路径：列出推荐进入 `/wf-small`、`/wf-complex` 或暂不实现的理由
