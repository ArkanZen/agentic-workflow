/**
 * 移除终端颜色控制字符，便于解析 doctor 输出。
 * @param {string} value 原始终端输出。
 * @returns {string} 去除 ANSI 控制符后的文本。
 */
export function stripAnsi(value) {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

/**
 * 从 openspec/config.yaml 内容中读取工作流标记。
 * @param {string} content 配置文件内容。
 * @returns {{tier: string | null, version: string | null}} 档位和版本标记。
 */
export function parseConfigMarkers(content) {
  const tier = content.match(/agentic-workflow-tier:\s*([^\s]+)/)?.[1] ?? null;
  const version = content.match(/agentic-workflow-version:\s*([^\s]+)/)?.[1] ?? null;
  return { tier, version };
}

/**
 * 从 doctor 输出中解析通过、警告和失败数量。
 * @param {string} output doctor 原始输出。
 * @returns {{passCount: number, warnCount: number, failCount: number}} 结构化统计。
 */
export function parseDoctorSummary(output) {
  const clean = stripAnsi(output);
  const summary = clean.match(/通过：(\d+)\s+警告：(\d+)\s+失败：(\d+)/);
  if (summary) {
    return {
      passCount: Number(summary[1]),
      warnCount: Number(summary[2]),
      failCount: Number(summary[3])
    };
  }
  return {
    passCount: (clean.match(/✓/g) ?? []).length,
    warnCount: (clean.match(/⚠/g) ?? []).length,
    failCount: (clean.match(/✗/g) ?? []).length
  };
}

/**
 * 从 doctor 输出中提取每条检查项，供前端按 tab 展示。
 * @param {string} output doctor 原始输出。
 * @returns {{pass: string[], warn: string[], fail: string[]}} 按状态分组的检查项。
 */
export function parseDoctorItems(output) {
  const clean = stripAnsi(output);
  const items = {
    pass: [],
    warn: [],
    fail: []
  };

  for (const line of clean.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.includes('✓')) {
      items.pass.push(trimmed.replace(/^✓\s*/, ''));
    } else if (trimmed.includes('⚠')) {
      items.warn.push(trimmed.replace(/^⚠\s*/, ''));
    } else if (trimmed.includes('✗')) {
      items.fail.push(trimmed.replace(/^✗\s*/, ''));
    }
  }

  return items;
}
