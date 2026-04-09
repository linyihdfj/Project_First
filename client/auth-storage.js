/**
 * @description authstorage相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 处理exposeauthstorage相关逻辑。
 * @param {*} global global参数。
 * @returns {*} authstorage结果。
 */
(function exposeAuthStorage(global) {

  /**
   * @description 创建authstorage。
   * @param {*} storageKey storagekey参数。
   * @returns {*} authstorage结果。
   */
  function createAuthStorage(storageKey) {

    /**
     * @description 获取authtoken。
     * @returns {*} authtoken结果。
     */
    function getAuthToken() {
      return localStorage.getItem(storageKey) || "";
    }

    /**
     * @description 设置authtoken。
     * @param {*} token 认证令牌。
     * @returns {*} authtoken结果。
     */
    function setAuthToken(token) {
      localStorage.setItem(storageKey, token);
    }

    /**
     * @description 处理removeauthtoken相关逻辑。
     * @returns {void} 无返回值。
     */
    function removeAuthToken() {
      localStorage.removeItem(storageKey);
    }

    return {
      getAuthToken,
      setAuthToken,
      removeAuthToken,
    };
  }

  global.createAuthStorage = createAuthStorage;
})(window);

