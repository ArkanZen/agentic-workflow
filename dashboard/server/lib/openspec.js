import { runFile } from './exec.js';

/**
 * 读取项目 OpenSpec active change 统计。
 * @param {string} projectPath 项目目录。
 * @returns {Promise<{available: boolean, activeCount: number, completedTasks: number, totalTasks: number, latestModified: string | null, error: string | null}>} OpenSpec 统计。
 */
export async function readOpenSpecStats(projectPath) {
  const result = await runFile('openspec', ['list', '--json'], {
    cwd: projectPath,
    timeout: 10000
  });

  if (result.exitCode !== 0) {
    return {
      available: false,
      activeCount: 0,
      completedTasks: 0,
      totalTasks: 0,
      latestModified: null,
      error: result.stderr || result.stdout || 'openspec list 执行失败'
    };
  }

  try {
    const payload = JSON.parse(result.stdout);
    const changes = Array.isArray(payload.changes) ? payload.changes : [];
    return {
      available: true,
      activeCount: changes.length,
      completedTasks: changes.reduce((total, change) => total + (change.completedTasks ?? 0), 0),
      totalTasks: changes.reduce((total, change) => total + (change.totalTasks ?? 0), 0),
      latestModified: changes
        .map((change) => change.lastModified)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null,
      error: null
    };
  } catch (error) {
    return {
      available: false,
      activeCount: 0,
      completedTasks: 0,
      totalTasks: 0,
      latestModified: null,
      error: `OpenSpec JSON 解析失败：${error.message}`
    };
  }
}
