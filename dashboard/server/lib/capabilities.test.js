import { describe, expect, it } from 'vitest';
import { detectCapabilities } from './capabilities.js';

describe('detectCapabilities', () => {
  it('按 OpenSpec、GStack、Superpowers 工具维度返回能力', async () => {
    const result = await detectCapabilities();
    const toolTitles = result.tools.map((tool) => tool.title);

    expect(toolTitles).toEqual([
      'OpenSpec',
      'GStack',
      'Superpowers'
    ]);
    expect(result.tools.every((tool) => tool.aiSupport.length === 2)).toBe(true);
  });

  it('标记工作流定义的命令或 skill', async () => {
    const result = await detectCapabilities();
    const definedItems = result.tools.flatMap((tool) => tool.workflowSkills).map((skill) => skill.name);

    expect(definedItems).toContain('openspec-propose');
    expect(definedItems).toContain('/gstack-plan-eng-review');
    expect(definedItems).toContain('superpowers:verification-before-completion');
    expect(definedItems).toContain('superpowers:writing-plans');
  });

  it('返回版本和更新信息', async () => {
    const result = await detectCapabilities();
    const openspec = result.tools.find((tool) => tool.id === 'openspec');

    expect(result.summary.totalTools).toBe(3);
    expect(result.tools.every((tool) => tool.version)).toBe(true);
    expect(openspec.version.updateAction).toBe('update-openspec');
  });
});
