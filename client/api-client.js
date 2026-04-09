/**
 * @description apiclient相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 处理exposeapiclientfactory相关逻辑。
 * @param {*} global global参数。
 * @returns {*} apiclientfactory结果。
 */
(function exposeApiClientFactory(global) {
  /**
   * @description 创建统一的 API 请求函数，自动注入鉴权与协作上下文并处理错误。
   * @param {object} deps 依赖注入对象。
   * @param {(pathname:string)=>string} deps.apiPath 路径拼接函数。
   * @param {()=>string} deps.getAuthToken 获取当前 token。
   * @param {()=>void} deps.removeAuthToken 清除 token。
   * @param {()=>string} deps.getSocketId 获取当前 socket id。
   * @param {()=>void} [deps.onUnauthorized] 401 时回调。
   * @returns {(pathname:string, options?:{method?:string,body?:any})=>Promise<any>} 请求函数。
   */
  function createApiRequest({
    apiPath,
    getAuthToken,
    removeAuthToken,
    getSocketId,
    onUnauthorized,
  }) {
    /**
     * @description 发送 API 请求并返回 JSON 载荷；失败时抛出 Error。
     * @param {string} pathname 接口路径。
     * @param {{method?:string, body?:any}} [options={}] 请求选项。
     * @returns {Promise<any>} 后端返回的 payload。
     */
    return async function apiRequest(pathname, options = {}) {
      const method = options.method || "GET";
      const init = {
        method,
        headers: {},
      };

      const token = getAuthToken();
      if (token) {
        init.headers["Authorization"] = `Bearer ${token}`;
      }

      const socketId = getSocketId();
      if (socketId) {
        init.headers["X-Socket-Id"] = socketId;
      }

      if (options.body !== undefined) {
        init.headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(options.body);
      }

      const response = await fetch(apiPath(pathname), init);
      let payload = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      if (response.status === 401) {
        removeAuthToken();
        if (onUnauthorized) {
          onUnauthorized();
        }
        throw new Error(
          payload && payload.message ? payload.message : "未登录",
        );
      }

      if (!response.ok || !payload || payload.ok === false) {
        const message =
          payload && payload.message
            ? payload.message
            : `请求失败: ${response.status}`;
        throw new Error(message);
      }

      return payload;
    };
  }

  global.createApiRequest = createApiRequest;
})(window);

