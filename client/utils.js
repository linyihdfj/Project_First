/**
 * @description utils相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 处理exposeapputils相关逻辑。
 * @param {*} global global参数。
 * @returns {*} apputils结果。
 */
(function exposeAppUtils(global) {

  /**
   * @description 处理uid相关逻辑。
   * @param {*} prefix 唯一标识前缀。
   * @returns {*} 处理结果。
   */
  function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  /**
   * @description 处理clampvalue相关逻辑。
   * @param {*} value 待处理的值。
   * @param {*} min min参数。
   * @param {*} max max参数。
   * @returns {*} value结果。
   */
  function clampValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * @description 规范化articleid。
   * @param {*} value 待处理的值。
   * @returns {*} articleid结果。
   */
  function normalizeArticleId(value) {
    return String(value || "").trim() || "article-1";
  }

  /**
   * @description 转义html。
   * @param {*} value 待处理的值。
   * @returns {string} html后的字符串。
   */
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * @description 创建 API 路径拼接函数。
   * @param {*} apiBase API 基础路径。
   * @returns {*} apipath结果。
   */
  function createApiPath(apiBase) {
    /**
     * @description ?????
     * @param {*} pathname ?????
     */

    return function apiPath(pathname) {
      return `${apiBase}${pathname}`;
    };
  }

  /**
   * @description 创建apputils。
   * @returns {*} apputils结果。
   */
  global.createAppUtils = function createAppUtils() {
    return {
      uid,
      clampValue,
      normalizeArticleId,
      escapeHtml,
      createApiPath,
    };
  };
})(window);

