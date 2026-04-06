function registerUserRoutes(app, deps) {
  const {
    sendError,
    requireAuth,
    requireRole,
    listUsers,
    updateUser,
    deleteUser,
  } = deps;

  app.get("/api/users", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const users = await listUsers();
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
