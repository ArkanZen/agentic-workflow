import { describe, expect, it } from 'vitest';
import { detectCapabilities } from './capabilities.js';

describe('detectCapabilities', () => {
  it('按 Shared、Codex App、Claude CLI 分组返回能力', async () => {
    const result = await detectCapabilities();
    const groupTitles = result.groups.map((group) => group.title);

    expect(groupTitles).toEqual(['Shared', 'Codex App', 'Claude CLI']);
    expect(result.groups.flatMap((group) => group.capabilities).map((capability) => capability.title)).toEqual([
      'OpenSpec CLI',
      'GStack',
      'Superpowers',
      'GStack',
      'Superpowers'
    ]);
  });

  it('标记工作流定义的命令或 skill', async () => {
    const result = await detectCapabilities();
    const definedItems = result.groups.flatMap((group) => group.capabilities).flatMap((capability) => capability.definedItems);

    expect(definedItems).toContain('openspec-propose');
    expect(definedItems).toContain('/gstack-plan-eng-review');
    expect(definedItems).toContain('superpowers:verification-before-completion');
    expect(definedItems).toContain('wf-complex: superpowers:writing-plans');
  });

  it('返回版本和更新信息', async () => {
    const result = await detectCapabilities();
    const capabilities = result.groups.flatMap((group) => group.capabilities);

    expect(result.summary.totalCapabilities).toBe(5);
    expect(capabilities.every((capability) => capability.version)).toBe(true);
    expect(capabilities.find((capability) => capability.id === 'openspec').version.updateAction).toBe('update-openspec');
  });
});
