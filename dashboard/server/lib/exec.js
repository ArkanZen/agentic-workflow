import { execFile } from 'node:child_process';

/**
 * 执行文件命令并返回 stdout/stderr。
 * @param {string} command 可执行文件。
 * @param {string[]} args 命令参数。
 * @param {{cwd?: string, timeout?: number}} options 执行选项。
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>} 命令执行结果。
 */
export function runFile(command, args = [], options = {}) {
  return new Promise((resolve) => {
    execFile(command, args, {
      cwd: options.cwd,
      timeout: options.timeout ?? 15000,
      maxBuffer: 1024 * 1024 * 4
    }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: error?.code ?? 0
      });
    });
  });
}
