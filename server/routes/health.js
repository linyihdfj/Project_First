function registerHealthRoute(app, deps) {
  const { ensureArticle, sendError } = deps;

  app.get("/api/health", async (req, res) => {
    try {
      await ensureArticle("article-1");
      res.json({
        ok: true,
        service: "sdudoc-api",
        time: new Date().toISOString(),
      });
    } catch (error) {
      sendError(res, error, 500);
    }
  });
}

module.exports = registerHealthRoute;
