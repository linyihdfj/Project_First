/**
 * @description articleexport路由模块，负责注册对应的 HTTP 接口。
 */
/**
 * @description 注册articleexportroutes。
 * @param {*} app Express 应用实例。
 * @param {*} deps 模块依赖集合。
 * @returns {void} 无返回值。
 */
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

