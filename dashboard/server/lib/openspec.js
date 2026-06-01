import fs from 'node:fs/promises';
import path from 'node:path';
import { runFile } from './exec.js';

/**
 * 列出本仓库所有已归档变更。
 * @param {string} [repoRoot=process.cwd()] 仓库根目录。
 * @returns {Promise<{available: boolean, changes: Array<{id: string, title: string, date: string}>}>}
 */
export async function listChanges(repoRoot = process.cwd()) {
  const archiveDir = path.join(repoRoot, 'openspec', 'changes', 'archive');
  try {
    const entries = await fs.readdir(archiveDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());
    if (dirs.length === 0) return { available: false, changes: [] };

    const changes = await Promise.all(
      dirs.map(async (entry) => {
        const id = entry.name;
        const proposalPath = path.join(archiveDir, id, 'proposal.md');
        let title = id;
        try {
          const content = await fs.readFile(proposalPath, 'utf8');
          const h1 = content.split('\n').find((line) => line.startsWith('# '));
          if (h1) title = h1.slice(2).trim();
        } catch {
          // proposal.md 不存在时使用目录名作标题
        }
        const stat = await fs.stat(path.join(archiveDir, id)).catch(() => null);
        return { id, title, date: stat ? stat.mtime.toISOString().slice(0, 10) : '' };
      })
    );

    return { available: true, changes };
  } catch {
    return { available: false, changes: [] };
  }
}

/**
 * 读取归档变更的 proposal.md 内容。
 * @param {string} changeId 变更目录名（仅允许 [0-9a-z-]）。
 * @param {string} [repoRoot=process.cwd()] 仓库根目录。
 * @returns {Promise<string | null>} proposal 内容，或 null（不存在/安全拒绝）。
 */
export async function readProposalContent(changeId, repoRoot = process.cwd()) {
  if (!/^[0-9a-z-]+$/.test(changeId)) return null;
  const archiveDir = path.join(repoRoot, 'openspec', 'changes', 'archive');
  const resolved = path.resolve(archiveDir, changeId, 'proposal.md');
  if (!resolved.startsWith(archiveDir + path.sep)) return null;
  try {
    return await fs.readFile(resolved, 'utf8');
  } catch {
    return null;
  }
}

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
