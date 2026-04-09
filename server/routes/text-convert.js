/**
 * @description textconvert路由模块，负责注册对应的 HTTP 接口。
 */
/**
 * @description 注册textconvertroutes。
 * @param {*} app Express 应用实例。
 * @param {*} deps 模块依赖集合。
 * @returns {void} 无返回值。
 */
function registerTextConvertRoutes(app, deps) {
  const {
    sendError,
    requireAuth,
    convertToSimplified,
  } = deps;

  app.post(
    "/api/text/convert-simplified",
    requireAuth,
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

