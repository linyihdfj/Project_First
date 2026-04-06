(function exposeAppUtils(global) {

  function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  function clampValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeArticleId(value) {
    return String(value || "").trim() || "article-1";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createApiPath(apiBase) {
    return function apiPath(pathname) {
      return `${apiBase}${pathname}`;
    };
  }

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
