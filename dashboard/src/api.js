/**
 * 调用本地 API 并处理错误响应。
 * @param {string} url API 路径。
 * @param {RequestInit} options fetch 参数。
 * @returns {Promise<any>} JSON 响应体。
 * @throws {Error} 当 API 返回错误状态时抛出。
 */
export async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? `请求失败：${response.status}`);
  }
  return data;
}

/**
 * 按扫描根加载项目列表。
 * @param {string[]} roots 扫描根目录。
 * @returns {Promise<{roots: string[], projects: object[]}>} 项目扫描结果。
 */
export function fetchProjects(roots) {
  const query = roots.length ? `?roots=${encodeURIComponent(roots.join(','))}` : '';
  return requestJson(`/api/projects${query}`);
}

/**
 * 运行项目 doctor。
 * @param {string} projectPath 项目路径。
 * @param {string[]} roots 扫描根目录。
 * @returns {Promise<object>} doctor 结果。
 */
export function runDoctor(projectPath, roots) {
  return requestJson('/api/doctor', {
    method: 'POST',
    body: JSON.stringify({ projectPath, roots })
  });
}

/**
 * 检测目标项目是否适合安装、升级或切换工作流。
 * @param {object} payload 检测请求。
 * @returns {Promise<object>} 检测结果。
 */
export function detectInstall(payload) {
  return requestJson('/api/install/detect', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * 预览受控维护动作。
 * @param {object} payload 动作请求。
 * @returns {Promise<object>} 动作摘要。
 */
export function previewAction(payload) {
  return requestJson('/api/actions/preview', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * 执行受控维护动作。
 * @param {object} payload 动作请求。
 * @returns {Promise<object>} 执行结果。
 */
export function runAction(payload) {
  return requestJson('/api/actions/run', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * 拉取项目的已归档变更列表。
 * @param {string} projectPath 项目路径。
 * @param {string[]} roots 扫描根目录。
 * @returns {Promise<{available: boolean, changes: object[]}>} 归档变更列表。
 */
export function fetchChanges(projectPath, roots) {
  const params = new URLSearchParams();
  if (projectPath) params.set('projectPath', projectPath);
  if (roots?.length) params.set('roots', roots.join(','));
  const qs = params.toString();
  return requestJson(`/api/changes${qs ? `?${qs}` : ''}`).catch(() => ({ available: false, changes: [] }));
}
