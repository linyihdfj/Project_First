/**
 * @description 注册文本转换接口，供前端在 OCR 后将原文自动转换为简体。
 * @param {import("express").Express} app Express 应用实例。
 * @param {object} deps 路由依赖集合。
 * @returns {void}
 */
function registerTextConvertRoutes(app, deps) {
  const {
    sendError,
    requireAuth,
    requireRole,
    convertToSimplified,
  } = deps;

  app.post(
    "/api/text/convert-simplified",
    requireAuth,
    requireRole("admin", "editor"),
    async (req, res) => {
      try {
        const text = String((req.body || {}).text || "");
        const simplifiedText = convertToSimplified(text);
        res.json({
          ok: true,
          originalText: text,
          simplifiedText,
        });
      } catch (error) {
        sendError(res, error);
      }
    },
  );
}

module.exports = registerTextConvertRoutes;
