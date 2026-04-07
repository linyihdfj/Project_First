(function exposeAppUtils(global) {
  /**
   * @description 生成带前缀的简易唯一 ID。
   * @param {string} prefix 前缀。
   * @returns {string} 生成的 ID。
   */
  function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  /**
   * @description 将数值限制在给定区间内。
   * @param {number} value 原始值。
   * @param {number} min 最小值。
   * @param {number} max 最大值。
   * @returns {number} 夹取后的值。
   */
  function clampValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * @description 规范化文章 ID，空值时回退默认值。
   * @param {string} value 原始文章 ID。
   * @returns {string} 规范化后的文章 ID。
   */
  function normalizeArticleId(value) {
    return String(value || "").trim() || "article-1";
  }

  /**
   * @description 对 HTML 特殊字符进行转义，防止注入。
   * @param {string} value 原始文本。
   * @returns {string} 转义后的安全文本。
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
   * @param {string} apiBase API 基础前缀。
   * @returns {(pathname:string)=>string} 路径拼接函数。
   */
  function createApiPath(apiBase) {
    return function apiPath(pathname) {
      return `${apiBase}${pathname}`;
    };
  }

  /**
   * @description 创建通用工具集合。
   * @returns {{uid:Function,clampValue:Function,normalizeArticleId:Function,escapeHtml:Function,createApiPath:Function}} 工具对象。
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
