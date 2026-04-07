/**
 * @description 注册标题相关路由，并在创建/更新/重排/删除后广播 heading 协作事件。
 * @param {import("express").Express} app Express 应用实例。
 * @param {object} deps 路由依赖集合。
 * @returns {void}
 */
function registerHeadingRoutes(app, deps) {
  const {
    sendError,
    articleIdFromReq,
    requireAuth,
    requireRole,
    requireArticleAccess,
    createHeading,
    getHeadingById,
    updateHeadingParent,
    reorderHeadings,
    deleteHeading,
    broadcastToPage,
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
    requireRole("admin", "editor"),
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
