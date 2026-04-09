/**
 * @description users路由模块，负责注册对应的 HTTP 接口。
 */
/**
 * @description 注册userroutes。
 * @param {*} app Express 应用实例。
 * @param {*} deps 模块依赖集合。
 * @returns {void} 无返回值。
 */
function registerUserRoutes(app, deps) {
  const {
    sendError,
    requireAuth,
    requireRole,
    listUsers,
    updateUser,
    deleteUser,
  } = deps;

  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const users = await listUsers(req.query.q || "");
      res.json({ ok: true, users });
    } catch (error) {
      sendError(res, error, 500);
    }
  });

  app.patch(
    "/api/users/:userId",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        const user = await updateUser(req.params.userId, req.body || {});
        res.json({ ok: true, user });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.delete(
    "/api/users/:userId",
    requireAuth,
    requireRole("admin"),
    async (req, res) => {
      try {
        await deleteUser(req.params.userId);
        res.json({ ok: true });
      } catch (error) {
        sendError(res, error);
      }
    },
  );
}

module.exports = registerUserRoutes;

