/**
 * @description articlepages路由模块，负责注册对应的 HTTP 接口。
 */
/**
 * @description 注册articlepageroutes。
 * @param {*} app Express 应用实例。
 * @param {*} deps 模块依赖集合。
 * @returns {void} 无返回值。
 */
function registerArticlePageRoutes(app, deps) {
  const {
    sendError,
    articleIdFromReq,
    requireAuth,
    requireArticleCapability,
    createPages,
    clearPagesByArticle,
  } = deps;

  app.post(
    "/api/articles/:articleId/pages/bulk",
    requireAuth,
    requireArticleCapability((req) => articleIdFromReq(req), "editor"),
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const pages = Array.isArray(req.body && req.body.pages)
          ? req.body.pages
          : [];
        const created = await createPages(articleId, pages);
        res.json({ ok: true, pages: created });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.delete(
    "/api/articles/:articleId/pages",
    requireAuth,
    requireArticleCapability((req) => articleIdFromReq(req), "editor"),
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        await clearPagesByArticle(articleId);
        res.json({ ok: true });
      } catch (error) {
        sendError(res, error);
      }
    },
  );
}

module.exports = registerArticlePageRoutes;

