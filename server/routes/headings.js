function registerHeadingRoutes(app, deps) {
  const {
    sendError,
    articleIdFromReq,
    requireAuth,
    requireRole,
    requireArticleAccess,
    createHeading,
    updateHeadingParent,
    reorderHeadings,
    deleteHeading,
  } = deps;

  app.post(
    "/api/articles/:articleId/headings",
    requireAuth,
    requireArticleAccess,
    requireRole("admin", "editor"),
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const heading = await createHeading(articleId, req.body || {});
        res.json({ ok: true, heading });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.patch(
    "/api/articles/:articleId/headings/:headingId",
    requireAuth,
    requireArticleAccess,
    requireRole("admin", "editor"),
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const headingId = req.params.headingId;
        const { parentId, orderIndex, level } = req.body || {};
        const heading = await updateHeadingParent(
          articleId,
          headingId,
          parentId || null,
          orderIndex || 0,
          level !== undefined ? level : null,
        );
        res.json({ ok: true, heading });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.post(
    "/api/articles/:articleId/headings/reorder",
    requireAuth,
    requireArticleAccess,
    requireRole("admin", "editor"),
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const { parentId, orderedIds } = req.body || {};
        if (!Array.isArray(orderedIds)) {
          return res
            .status(400)
            .json({ ok: false, error: "orderedIds must be an array" });
        }
        await reorderHeadings(articleId, parentId || null, orderedIds);
        res.json({ ok: true });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.delete(
    "/api/headings/:headingId",
    requireAuth,
    requireRole("admin", "editor"),
    async (req, res) => {
      try {
        await deleteHeading(req.params.headingId);
        res.json({ ok: true });
      } catch (error) {
        sendError(res, error);
      }
    },
  );
}

module.exports = registerHeadingRoutes;
