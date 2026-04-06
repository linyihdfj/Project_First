function registerArticleRoutes(app, deps) {
  const {
    sendError,
    articleIdFromReq,
    requireAuth,
    requireRole,
    requireArticleAccess,
    listArticlesForUser,
    createArticleRecord,
    assignArticleAccess,
    deleteArticle,
    getArticleAccessUsers,
    removeArticleAccess,
    ensureArticle,
    upsertArticle,
    getPageSrcsByArticle,
    getSnapshot,
  } = deps;

  app.get("/api/articles", requireAuth, async (req, res) => {
    try {
      const articles = await listArticlesForUser(
        req.user.userId,
        req.user.role,
      );
      res.json({ ok: true, articles });
    } catch (error) {
      sendError(res, error, 500);
    }
  });

  app.post(
    "/api/articles",
    requireAuth,
    requireRole("admin", "editor"),
    async (req, res) => {
      try {
        const payload = req.body || {};
        const article = await createArticleRecord(payload);
        await assignArticleAccess(req.user.userId, article.id);
        res.json({ ok: true, article });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.delete(
    "/api/articles/:articleId",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        await deleteArticle(articleId);
        res.json({ ok: true });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.get(
    "/api/articles/:articleId/access",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const users = await getArticleAccessUsers(articleId);
        res.json({ ok: true, users });
      } catch (error) {
        sendError(res, error, 500);
      }
    },
  );

  app.post(
    "/api/articles/:articleId/access",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const { userId } = req.body || {};
        if (!userId) {
          return sendError(res, new Error("请指定用户"));
        }
        await assignArticleAccess(userId, articleId);
        res.json({ ok: true });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.delete(
    "/api/articles/:articleId/access/:userId",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        await removeArticleAccess(req.params.userId, articleId);
        res.json({ ok: true });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.get(
    "/api/articles/:articleId",
    requireAuth,
    requireArticleAccess,
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const article = await ensureArticle(articleId);
        res.json({ ok: true, article });
      } catch (error) {
        sendError(res, error, 500);
      }
    },
  );

  app.put(
    "/api/articles/:articleId",
    requireAuth,
    requireArticleAccess,
    requireRole("admin", "editor"),
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const payload = req.body || {};
        const article = await upsertArticle({
          id: articleId,
          type: payload.type || "1",
          version: payload.version || "1.0",
          title: payload.title || "",
          subtitle: payload.subtitle || "",
          author: payload.author || "",
          book: payload.book || "",
          volume: payload.volume || "",
          publishYear: payload.publishYear || "",
          writingYear: payload.writingYear || "",
        });
        res.json({ ok: true, article });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.get(
    "/api/articles/:articleId/page-srcs",
    requireAuth,
    requireArticleAccess,
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const limit = Math.min(parseInt(req.query.limit, 10) || 3, 50);
        const srcs = await getPageSrcsByArticle(articleId, limit);
        res.json({ ok: true, srcs });
      } catch (error) {
        sendError(res, error, 500);
      }
    },
  );

  app.get(
    "/api/articles/:articleId/snapshot",
    requireAuth,
    requireArticleAccess,
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const snapshot = await getSnapshot(articleId);
        res.json({ ok: true, ...snapshot });
      } catch (error) {
        sendError(res, error, 500);
      }
    },
  );
}

module.exports = registerArticleRoutes;
