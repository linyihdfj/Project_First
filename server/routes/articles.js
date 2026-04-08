function registerArticleRoutes(app, deps) {
  const {
    sendError,
    articleIdFromReq,
    requireAuth,
    requireRole,
    requireArticleAccess,
    requireArticleCapability,
    listArticlesForUser,
    createArticleRecord,
    assignArticleAccess,
    deleteArticle,
    getArticleAccessUsers,
    removeArticleAccess,
    getArticleMembershipRole,
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
    async (req, res) => {
      try {
        const payload = req.body || {};
        const article = await createArticleRecord(payload);
        await assignArticleAccess(req.user.userId, article.id, "admin");
        res.json({ ok: true, article: { ...article, articleRole: "admin" } });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.delete(
    "/api/articles/:articleId",
    requireAuth,
    requireArticleCapability((req) => articleIdFromReq(req), "admin"),
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
    requireArticleAccess,
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
    requireArticleCapability((req) => articleIdFromReq(req), "admin"),
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const { userId, articleRole } = req.body || {};
        if (!userId) {
          return sendError(res, new Error("请指定用户"));
        }
        await assignArticleAccess(userId, articleId, articleRole || "editor");
        res.json({ ok: true });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.delete(
    "/api/articles/:articleId/access/:userId",
    requireAuth,
    requireArticleCapability((req) => articleIdFromReq(req), "admin"),
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
        const articleRole = await getArticleMembershipRole(
          req.user.userId,
          articleId,
          req.user.role,
        );
        res.json({ ok: true, article: { ...article, articleRole } });
      } catch (error) {
        sendError(res, error, 500);
      }
    },
  );

  app.put(
    "/api/articles/:articleId",
    requireAuth,
    requireArticleAccess,
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const articleRole = await getArticleMembershipRole(
          req.user.userId,
          articleId,
          req.user.role,
        );
        if (!["admin", "editor"].includes(articleRole)) {
          return sendError(res, new Error("鏉冮檺涓嶈冻"), 403);
        }
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
        const articleRole = await getArticleMembershipRole(
          req.user.userId,
          articleId,
          req.user.role,
        );
        if (snapshot.article) {
          snapshot.article.articleRole = articleRole;
        }
        res.json({ ok: true, ...snapshot });
      } catch (error) {
        sendError(res, error, 500);
      }
    },
  );
}

module.exports = registerArticleRoutes;
