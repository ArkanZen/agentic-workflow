import { describe, expect, it } from 'vitest';
import { parseConfigMarkers, parseDoctorItems, parseDoctorSummary, stripAnsi } from './parse.js';

describe('parse helpers', () => {
  it('读取配置中的档位和版本标记', () => {
    const config = [
      '# agentic-workflow-tier: frontend',
      '# agentic-workflow-version: 1.2.3'
    ].join('\n');

    expect(parseConfigMarkers(config)).toEqual({
      tier: 'frontend',
      version: '1.2.3'
    });
  });

  it('解析 doctor 摘要行', () => {
    const output = '摘要\n  通过：12  警告：3  失败：1\n';

    expect(parseDoctorSummary(output)).toEqual({
      passCount: 12,
      warnCount: 3,
      failCount: 1
    });
  });

  it('移除终端颜色控制字符', () => {
    expect(stripAnsi('\u001b[32mOK\u001b[0m')).toBe('OK');
  });

  it('按状态提取 doctor 检查项', () => {
    const output = [
      '  ✓ openspec CLI 可用',
      '  ⚠  manifest 不存在',
      '  ✗  openspec/config.yaml 缺失'
    ].join('\n');

    expect(parseDoctorItems(output)).toEqual({
      pass: ['openspec CLI 可用'],
      warn: ['manifest 不存在'],
      fail: ['openspec/config.yaml 缺失']
    });
  });
});
