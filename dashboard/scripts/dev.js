import { spawn } from 'node:child_process';
import net from 'node:net';

// 本地 API 默认端口，启动前检查占用，避免前端连到旧 API 进程。
const API_PORT = Number(process.env.DASHBOARD_PORT ?? 4317);

// 本地开发进程清单，用于统一启动 API 与 Vite。
const processes = [
  ['api', 'node', ['server/index.js']],
  ['ui', 'npx', ['vite', '--host', '127.0.0.1']]
];

/**
 * 检查本地端口是否已被占用。
 * @param {number} port 需要检查的端口。
 * @returns {Promise<boolean>} 端口被占用时返回 true。
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * 启动一个子进程并继承当前终端输出。
 * @param {string} label 进程标签，用于退出时定位来源。
 * @param {string} command 可执行命令。
 * @param {string[]} args 命令参数。
 * @returns {import('node:child_process').ChildProcess} 已启动的子进程。
 * @throws {Error} 当系统无法启动命令时由 child_process 抛出。
 */
function startProcess(label, command, args) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env
  });

  child.on('exit', (code) => {
    if (code && !shuttingDown) {
      console.error(`[${label}] exited with code ${code}`);
      shutdown(code);
    }
  });

  return child;
}

// 退出状态标记，避免多个子进程同时触发重复清理。
let shuttingDown = false;

if (await isPortInUse(API_PORT)) {
  console.error(`API 端口 ${API_PORT} 已被占用，可能仍有旧 dashboard API 进程。`);
  console.error(`可运行：lsof -ti tcp:${API_PORT} | xargs kill`);
  process.exit(1);
}

// 已启动的子进程集合，用于收到退出信号时统一关闭。
const children = processes.map(([label, command, args]) => startProcess(label, command, args));

/**
 * 关闭所有开发子进程并退出当前进程。
 * @param {number} code 退出码。
 * @returns {void}
 */
function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
