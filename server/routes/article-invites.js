function canCreateInvite(globalRole, articleRole, inviteRole) {
  if (globalRole === "admin" || articleRole === "admin") {
    return inviteRole === "editor" || inviteRole === "reviewer";
  }
  if (articleRole === "editor") {
    return inviteRole === "editor";
  }
  if (articleRole === "reviewer") {
    return inviteRole === "reviewer";
  }
  return false;
}

function registerArticleInviteRoutes(app, deps) {
  const {
    sendError,
    articleIdFromReq,
    requireAuth,
    requireArticleCapability,
    createArticleInvite,
    listArticleInvites,
    getArticleInviteById,
    deactivateArticleInvite,
    resolveArticleInvite,
    acceptArticleInvite,
  } = deps;

  app.get("/api/article-invites/resolve", async (req, res) => {
    try {
      const token = String(req.query.token || "").trim();
      if (!token) {
        return sendError(res, new Error("缺少邀请令牌。"));
      }
      const invite = await resolveArticleInvite(token);
      if (!invite) {
        return sendError(res, new Error("邀请链接无效。"), 404);
      }
      res.json({ ok: true, invite });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post("/api/article-invites/accept", requireAuth, async (req, res) => {
    try {
      const token = String((req.body && req.body.token) || "").trim();
      if (!token) {
        return sendError(res, new Error("缺少邀请令牌。"));
      }
      const invite = await acceptArticleInvite(token, req.user.userId);
      res.json({ ok: true, invite });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get(
    "/api/articles/:articleId/invites",
    requireAuth,
    requireArticleCapability((req) => articleIdFromReq(req)),
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const invites = await listArticleInvites(
          articleId,
          req.user.userId,
          req.user.role,
        );
        res.json({ ok: true, invites });
      } catch (error) {
        sendError(res, error, 500);
      }
    },
  );

  app.post(
    "/api/articles/:articleId/invites",
    requireAuth,
    requireArticleCapability((req) => articleIdFromReq(req), "editor", "reviewer"),
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const inviteRole =
          String((req.body && req.body.role) || "editor").trim() || "editor";
        if (!canCreateInvite(req.user.role, req.articleRole, inviteRole)) {
          return sendError(
            res,
            new Error("你不能为该文章角色创建邀请。"),
            403,
          );
        }
        const invite = await createArticleInvite(
          articleId,
          inviteRole,
          req.user.userId,
        );
        res.json({ ok: true, invite });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.delete("/api/article-invites/:inviteId", requireAuth, async (req, res) => {
    try {
      const invite = await getArticleInviteById(req.params.inviteId);
      if (!invite) {
        return sendError(res, new Error("邀请不存在。"), 404);
      }
      const isAdmin = req.user.role === "admin";
      const isOwner = invite.created_by === req.user.userId;
      if (!isAdmin && !isOwner) {
        return sendError(res, new Error("权限不足。"), 403);
      }
      await deactivateArticleInvite(invite.id);
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error);
    }
  });
}

module.exports = registerArticleInviteRoutes;
