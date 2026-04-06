function registerArticlePageRoutes(app, deps) {
  const {
    sendError,
    articleIdFromReq,
    requireAuth,
    requireRole,
    requireArticleAccess,
    createPages,
    clearPagesByArticle,
  } = deps;

  app.post(
    "/api/articles/:articleId/pages/bulk",
    requireAuth,
    requireArticleAccess,
    requireRole("admin", "editor"),
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
    requireArticleAccess,
    requireRole("admin", "editor"),
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
