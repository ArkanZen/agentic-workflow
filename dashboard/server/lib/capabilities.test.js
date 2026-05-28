import { beforeAll, describe, expect, it } from 'vitest';
import { detectCapabilities } from './capabilities.js';

describe('detectCapabilities', () => {
  let result;

  beforeAll(async () => {
    result = await detectCapabilities();
  }, 30000);

  it('按 OpenSpec、GStack、Superpowers 工具维度返回能力', async () => {
    const toolTitles = result.tools.map((tool) => tool.title);

    expect(toolTitles).toEqual([
      'OpenSpec',
      'GStack',
      'Superpowers'
    ]);
    expect(result.tools.every((tool) => tool.aiSupport.length === 2)).toBe(true);
  });

  it('标记工作流定义的命令或 skill', async () => {
    const definedItems = result.tools.flatMap((tool) => tool.workflowSkills).map((skill) => skill.name);

    expect(definedItems).toContain('openspec-propose');
    expect(definedItems).toContain('/gstack-plan-eng-review');
    expect(definedItems).toContain('superpowers:verification-before-completion');
    expect(definedItems).toContain('superpowers:writing-plans');
  });

  it('仅返回版本检测信息，不提供更新动作', async () => {
    const openspec = result.tools.find((tool) => tool.id === 'openspec');
    const allSupports = result.tools.flatMap((tool) => tool.aiSupport);

    expect(result.summary.totalTools).toBe(3);
    expect(result.tools.every((tool) => tool.version)).toBe(true);
    expect(openspec.version.current).toBeTruthy();
    expect(openspec.version.updateAction).toBeUndefined();
    expect(openspec.version.updateHint).toBeUndefined();
    expect(allSupports.every((support) => support.updateAction === undefined)).toBe(true);
    expect(allSupports.every((support) => support.updateHint === undefined)).toBe(true);
  });

  it('根据官方技能来源生成更完整的技能手册', async () => {
    const openspec = result.tools.find((tool) => tool.id === 'openspec');
    const gstack = result.tools.find((tool) => tool.id === 'gstack');
    const superpowers = result.tools.find((tool) => tool.id === 'superpowers');
    const gstackNames = gstack.officialSkills.map((skill) => skill.name);
    const superpowersNames = superpowers.officialSkills.map((skill) => skill.name);

    expect(openspec.officialSkills.map((skill) => skill.name)).toContain('openspec validate');
    expect(gstack.officialSkills.length).toBeGreaterThan(20);
    expect(gstackNames).toContain('/plan-eng-review');
    expect(gstackNames).toContain('/ship');
    expect(superpowersNames).toContain('superpowers:using-superpowers');
    expect(superpowersNames).toContain('superpowers:writing-skills');
    expect(result.tools.flatMap((tool) => tool.officialSkills).every((skill) => skill.category)).toBe(true);
    expect(result.tools.flatMap((tool) => tool.officialSkills).every((skill) => typeof skill.available === 'boolean')).toBe(true);
  });
});
