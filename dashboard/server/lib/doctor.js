import path from 'node:path';
import { runFile } from './exec.js';
import { parseDoctorItems, parseDoctorSummary } from './parse.js';
import { WORKFLOW_ROOT } from './paths.js';

/**
 * 运行工作流 doctor 并返回结构化结果。
 * @param {string} projectPath 项目路径。
 * @returns {Promise<{passCount: number, warnCount: number, failCount: number, items: object, rawOutput: string, exitCode: number}>} doctor 结果。
 */
export async function runDoctor(projectPath) {
  const scriptPath = path.join(WORKFLOW_ROOT, 'validate-workflow.sh');
  const result = await runFile('bash', [scriptPath, projectPath], {
    cwd: WORKFLOW_ROOT,
    timeout: 30000
  });
  const rawOutput = `${result.stdout}${result.stderr}`;
  return {
    ...parseDoctorSummary(rawOutput),
    items: parseDoctorItems(rawOutput),
    rawOutput,
    exitCode: result.exitCode
  };
}
