function createAuthMiddlewares({
  verifyToken,
  checkArticleAccess,
  articleIdFromReq,
  getArticleMembershipRole,
}) {
  function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      return res.status(401).json({ ok: false, message: "未登录" });
    }
    const data = verifyToken(token);
    if (!data) {
      return res
        .status(401)
        .json({ ok: false, message: "登录已过期，请重新登录" });
    }
    req.user = { userId: data.userId, role: data.role };
    next();
  }

  function requireRole(...roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ ok: false, message: "未登录" });
      }
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ ok: false, message: "权限不足" });
      }
      next();
    };
  }

  async function requireArticleAccess(req, res, next) {
    const articleId = articleIdFromReq(req);
    if (!req.user) {
      return res.status(401).json({ ok: false, message: "未登录" });
    }
    try {
      const hasAccess = await checkArticleAccess(
        req.user.userId,
        articleId,
        req.user.role,
      );
      if (!hasAccess) {
        return res.status(403).json({ ok: false, message: "无权访问该文章" });
      }
      next();
    } catch (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }
  }

  function requireArticleCapability(resolveArticleId, ...allowedRoles) {
    return async (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ ok: false, message: "未登录" });
      }
      try {
        const articleId = await Promise.resolve(resolveArticleId(req));
        if (!articleId) {
          return res
            .status(404)
            .json({ ok: false, message: "未找到对应文章" });
        }
        const articleRole = await getArticleMembershipRole(
          req.user.userId,
          articleId,
          req.user.role,
        );
        if (!articleRole) {
          return res.status(403).json({ ok: false, message: "无权访问该文章" });
        }
        req.articleId = articleId;
        req.articleRole = articleRole;
        if (
          articleRole === "admin" ||
          !allowedRoles.length ||
          allowedRoles.includes(articleRole)
        ) {
          return next();
        }
        return res.status(403).json({ ok: false, message: "权限不足" });
      } catch (error) {
        return res.status(500).json({ ok: false, message: error.message });
      }
    };
  }

  return {
    requireAuth,
    requireRole,
    requireArticleAccess,
    requireArticleCapability,
  };
}

module.exports = {
  createAuthMiddlewares,
};
