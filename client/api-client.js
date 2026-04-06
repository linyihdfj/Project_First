(function exposeApiClientFactory(global) {

  function createApiRequest({
    apiPath,
    getAuthToken,
    removeAuthToken,
    getSocketId,
    onUnauthorized,
  }) {
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
