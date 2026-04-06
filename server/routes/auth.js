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
  } = deps;

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return sendError(res, new Error("请输入用户名和密码"));
      }
      const user = await getUserByUsername(username);
      if (!user) {
        return sendError(res, new Error("用户名或密码错误"), 401);
      }
      if (!verifyPassword(password, user.password_hash)) {
        return sendError(res, new Error("用户名或密码错误"), 401);
      }
      const token = createToken(user.id, user.role);
      res.json({
        ok: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          role: user.role,
        },
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
}

module.exports = registerAuthRoutes;
