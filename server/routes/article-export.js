function registerArticleExportRoutes(app, deps) {
  const {
    sendError,
    articleIdFromReq,
    requireAuth,
    requireArticleAccess,
    getSnapshot,
    generateXmlFromSnapshot,
  } = deps;

  app.get(
    "/api/articles/:articleId/export-xml",
    requireAuth,
    requireArticleAccess,
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const snapshot = await getSnapshot(articleId);
        const xml = generateXmlFromSnapshot(snapshot);
        const fileName = `${snapshot.article.title || articleId}.xml`;
        res.setHeader("Content-Type", "application/xml; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        );
        res.send(xml);
      } catch (error) {
        sendError(res, error, 500);
      }
    },
  );
}

module.exports = registerArticleExportRoutes;
