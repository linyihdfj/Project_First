function registerHeadingRoutes(app, deps) {
  const {
    sendError,
    articleIdFromReq,
    requireAuth,
    requireArticleCapability,
    createHeading,
    getHeadingById,
    getHeadingArticleId,
    updateHeadingParent,
    reorderHeadings,
    deleteHeading,
    broadcastToPage,
  } = deps;

  app.post(
    "/api/articles/:articleId/headings",
    requireAuth,
    requireArticleCapability((req) => articleIdFromReq(req), "editor"),
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const heading = await createHeading(articleId, req.body || {});
        res.json({ ok: true, heading });
        broadcastToPage(req, `article:${articleId}`, "heading:created", {
          articleId,
          heading,
        });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.patch(
    "/api/articles/:articleId/headings/:headingId",
    requireAuth,
    requireArticleCapability((req) => articleIdFromReq(req), "editor"),
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
        broadcastToPage(req, `article:${articleId}`, "heading:updated", {
          articleId,
          heading,
        });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.post(
    "/api/articles/:articleId/headings/reorder",
    requireAuth,
    requireArticleCapability((req) => articleIdFromReq(req), "editor"),
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const { parentId, orderedIds } = req.body || {};
        if (!Array.isArray(orderedIds)) {
          return res
            .status(400)
            .json({ ok: false, error: "orderedIds 必须是数组" });
        }
        await reorderHeadings(articleId, parentId || null, orderedIds);
        res.json({ ok: true });
        broadcastToPage(req, `article:${articleId}`, "heading:reordered", {
          articleId,
          parentId: parentId || null,
          orderedIds,
        });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.delete(
    "/api/headings/:headingId",
    requireAuth,
    requireArticleCapability(
      (req) => getHeadingArticleId(req.params.headingId),
      "editor",
    ),
    async (req, res) => {
      try {
        const headingId = req.params.headingId;
        const existingHeading = await getHeadingById(headingId);
        if (!existingHeading) {
          throw new Error("标题不存在");
        }
        await deleteHeading(headingId);
        res.json({ ok: true });
        broadcastToPage(
          req,
          `article:${existingHeading.articleId}`,
          "heading:deleted",
          {
            articleId: existingHeading.articleId,
            headingId,
          },
        );
      } catch (error) {
        sendError(res, error);
      }
    },
  );
}

module.exports = registerHeadingRoutes;
