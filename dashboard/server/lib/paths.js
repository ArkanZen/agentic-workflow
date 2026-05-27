import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// 工作流仓库根目录，用于定位 install.sh 与 validate-workflow.sh。
export const WORKFLOW_ROOT = path.resolve(process.cwd(), '..');

// 默认扫描根目录只包含工作流仓库本身，避免开源工具绑定个人目录。
export const DEFAULT_SCAN_ROOTS = [
  WORKFLOW_ROOT
];

/**
 * 展开用户输入路径中的 home 前缀并转成绝对路径。
 * @param {string} input 用户输入的目录路径。
 * @returns {string} 规范化后的绝对路径。
 * @throws {TypeError} 当路径不是字符串时抛出。
 */
export function normalizePath(input) {
  if (typeof input !== 'string') {
    throw new TypeError('路径必须是字符串');
  }
  const trimmed = input.trim();
  const expanded = trimmed === '~' ? os.homedir() : trimmed.replace(/^~(?=$|\/)/, os.homedir());
  return path.resolve(expanded);
}

/**
 * 去重并规范化扫描根目录。
 * @param {string[]} roots 用户指定或默认的扫描根目录。
 * @returns {string[]} 去重后的绝对路径列表。
 */
export function normalizeScanRoots(roots = DEFAULT_SCAN_ROOTS) {
  return [...new Set(roots.filter(Boolean).map(normalizePath))];
}

/**
 * 判断路径是否存在且为目录。
 * @param {string} directory 待检查目录。
 * @returns {Promise<boolean>} 存在且为目录时返回 true。
 */
export async function directoryExists(directory) {
  try {
    const stat = await fs.stat(directory);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * 判断目标项目是否位于任一扫描根目录内。
 * @param {string} projectPath 项目绝对路径。
 * @param {string[]} scanRoots 扫描根目录列表。
 * @returns {boolean} 项目位于扫描根内时返回 true。
 */
export function isInsideScanRoots(projectPath, scanRoots) {
  const normalizedProject = normalizePath(projectPath);
  return normalizeScanRoots(scanRoots).some((root) => {
    const relative = path.relative(root, normalizedProject);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  });
}
