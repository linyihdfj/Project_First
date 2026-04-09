/**
 * @description auth路由模块，负责注册对应的 HTTP 接口。
 */
/**
 * @description 注册authroutes。
 * @param {*} app Express 应用实例。
 * @param {*} deps 模块依赖集合。
 * @returns {void} 无返回值。
 */
function registerAuthRoutes(app, deps) {
  const {
    sendError,
    requireAuth,
    requireRole,
    getUserByUsername,
    verifyPassword,
    createToken,
    getUserById,
    createUser,
    resolveArticleInvite,
    acceptArticleInvite,
  } = deps;

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return sendError(res, new Error("请输入用户名和密码。"));
      }
      const user = await getUserByUsername(username);
      if (!user) {
        return sendError(res, new Error("用户名或密码错误"), 401);
      }
      if (!verifyPassword(password, user.password_hash)) {
        return sendError(res, new Error("用户名或密码错误"), 401);
      }
      const resolvedUser = await getUserById(user.id);
      const authUser = resolvedUser || {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
      };
      const authRole = authUser.role || "user";
      const token = createToken(authUser.id, authRole);
      res.json({
        ok: true,
        token,
        user: authUser,
      });
    } catch (error) {
      sendError(res, error, 500);
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await getUserById(req.user.userId);
      if (!user) {
        return sendError(res, new Error("用户不存在"), 404);
      }
      res.json({ ok: true, user });
    } catch (error) {
      sendError(res, error, 500);
    }
  });

  app.post(
    "/api/auth/register",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const { username, password, displayName, role } = req.body || {};
        if (!username || !password) {
          return sendError(res, new Error("用户名和密码不能为空"));
        }
        const user = await createUser(username, password, displayName, role);
        res.json({ ok: true, user });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.post("/api/auth/register-by-invite", async (req, res) => {
    try {
      const { username, password, displayName, token } = req.body || {};
      if (!username || !password || !token) {
        return sendError(
          res,
          new Error("缺少用户名、密码或邀请令牌。"),
        );
      }
      const invite = await resolveArticleInvite(token);
      if (!invite) {
        return sendError(res, new Error("邀请链接无效。"), 404);
      }
      const user = await createUser(username, password, displayName, "user");
      await acceptArticleInvite(token, user.id);
      const loginUser = await getUserById(user.id);
      const authUser = loginUser || user;
      const authRole = authUser.role || "user";
      const resolvedUser = {
        id: authUser.id,
        username: authUser.username,
        displayName: authUser.displayName || authUser.display_name,
        role: authRole,
      };
      res.json({
        ok: true,
        token: createToken(authUser.id, authRole),
        user: resolvedUser,
        invite,
      });
    } catch (error) {
      sendError(res, error);
    }
  });
}

module.exports = registerAuthRoutes;

