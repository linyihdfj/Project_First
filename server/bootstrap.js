async function bootstrapServer({
  initDatabase,
  ensureArticle,
  httpServer,
  port,
}) {
  await initDatabase();
  await ensureArticle("article-1");
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`SDUDOC server listening on http://0.0.0.0:${port}`);
  });
}

module.exports = {
  bootstrapServer,
};
