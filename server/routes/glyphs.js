function registerGlyphRoutes(app, deps) {
  const {
    sendError,
    articleIdFromReq,
    requireAuth,
    requireArticleCapability,
    getGlyphsByArticle,
    getGlyphArticleId,
    createGlyph,
    importGlyph,
    deleteGlyph,
    broadcastToPage,
  } = deps;

  app.get(
    "/api/articles/:articleId/glyphs",
    requireAuth,
    requireArticleCapability((req) => articleIdFromReq(req)),
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const glyphs = await getGlyphsByArticle(articleId);
        res.json({ ok: true, glyphs });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.post(
    "/api/articles/:articleId/glyphs",
    requireAuth,
    requireArticleCapability((req) => articleIdFromReq(req), "editor"),
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const glyph = await createGlyph(articleId, req.body || {});
        broadcastToPage(req, `article:${articleId}`, "glyph:created", {
          articleId,
          glyph,
        });
        res.json({ ok: true, glyph });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.delete(
    "/api/glyphs/:glyphId",
    requireAuth,
    requireArticleCapability((req) => getGlyphArticleId(req.params.glyphId), "editor"),
    async (req, res) => {
      try {
        const glyph = await deleteGlyph(req.params.glyphId);
        if (glyph && glyph.articleId) {
          broadcastToPage(req, `article:${glyph.articleId}`, "glyph:deleted", {
            articleId: glyph.articleId,
            glyphId: glyph.id,
          });
        }
        res.json({ ok: true, glyph });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.post(
    "/api/articles/:articleId/glyphs/import",
    requireAuth,
    requireArticleCapability((req) => articleIdFromReq(req), "editor"),
    async (req, res) => {
      try {
        const articleId = articleIdFromReq(req);
        const glyphs = Array.isArray(req.body && req.body.glyphs)
          ? req.body.glyphs
          : [];
        if (!glyphs.length) {
          return sendError(res, new Error("导入数据为空"));
        }
        const results = [];
        for (const g of glyphs) {
          try {
            const glyph = await importGlyph(articleId, {
              code: g.code,
              name: g.name || "",
              note: g.note || "",
              imgDataUrl: g.imgDataUrl || "",
            });
            results.push(glyph);
          } catch (e) {

          }
        }
        if (results.length) {
          broadcastToPage(req, `article:${articleId}`, "glyph:imported", {
            articleId,
            glyphs: results,
          });
        }
        res.json({ ok: true, imported: results.length, glyphs: results });
      } catch (error) {
        sendError(res, error);
      }
    },
  );
}

module.exports = registerGlyphRoutes;
