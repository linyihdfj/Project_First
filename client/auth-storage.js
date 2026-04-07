(function exposeAuthStorage(global) {
  /**
   * @description 创建 token 存储工具，统一封装 localStorage 读写。
   * @param {string} storageKey 本地存储键名。
   * @returns {{getAuthToken:()=>string,setAuthToken:(token:string)=>void,removeAuthToken:()=>void}} token 存储 API。
   */
  function createAuthStorage(storageKey) {
    /**
     * @description 读取已保存的鉴权 token。
     * @returns {string} token 字符串，不存在时返回空串。
     */
    function getAuthToken() {
      return localStorage.getItem(storageKey) || "";
    }

    /**
     * @description 写入鉴权 token 到本地存储。
     * @param {string} token 要保存的 token。
     * @returns {void}
     */
    function setAuthToken(token) {
      localStorage.setItem(storageKey, token);
    }

    /**
     * @description 删除本地存储中的鉴权 token。
     * @returns {void}
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
