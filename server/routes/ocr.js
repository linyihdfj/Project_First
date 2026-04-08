function registerOcrRoutes(app, deps) {
  const {
    sendError,
    requireAuth,
    getArticleMembershipRole,
    getProvider,
    getPageRow,
    cropImage,
    readImageBuffer,
    projectRoot,
  } = deps;

  async function ensureOcrAccess(req, pageId) {
    if (!pageId) {
      throw Object.assign(new Error("缺少 pageId"), { statusCode: 400 });
    }

    const page = await getPageRow(pageId);
    if (!page) {
      throw Object.assign(new Error("页面不存在"), { statusCode: 404 });
    }

    const articleRole = await getArticleMembershipRole(
      req.user.userId,
      page.article_id,
      req.user.role,
    );
    if (!articleRole) {
      throw Object.assign(new Error("无权访问该文章"), { statusCode: 403 });
    }
    if (articleRole !== "admin" && articleRole !== "editor") {
      throw Object.assign(new Error("权限不足"), { statusCode: 403 });
    }

    req.articleId = page.article_id;
    req.articleRole = articleRole;
    return page;
  }

  app.post("/api/ocr/recognize", requireAuth, async (req, res) => {
    try {
      const provider = getProvider();
      if (!provider) {
        return sendError(
          res,
          new Error(
            "OCR 服务未配置，请在 server/ocr-config.json 中设置 API 密钥",
          ),
        );
      }

      const { pageId, x, y, width, height } = req.body || {};
      const page = await ensureOcrAccess(req, pageId);

      const imagePath = require("path").join(
        projectRoot,
        page.src.replace(/^\//, ""),
      );
      let imageBuffer;
      if (x != null && y != null && width && height) {
        imageBuffer = await cropImage(imagePath, { x, y, width, height });
      } else {
        imageBuffer = await readImageBuffer(imagePath);
      }

      const results = await provider.recognizeRegion(imageBuffer);
      res.json({ ok: true, results });
    } catch (error) {
      if (error && error.statusCode) {
        return sendError(res, error, error.statusCode);
      }
      sendError(res, error);
    }
  });

  app.post("/api/ocr/layout-detect", requireAuth, async (req, res) => {
    try {
      const provider = getProvider();
      if (!provider) {
        return sendError(
          res,
          new Error(
            "OCR 服务未配置，请在 server/ocr-config.json 中设置 API 密钥",
          ),
        );
      }

      const { pageId, level, x, y, width, height } = req.body || {};
      const page = await ensureOcrAccess(req, pageId);

      const imagePath = require("path").join(
        projectRoot,
        page.src.replace(/^\//, ""),
      );
      let imageBuffer;
      if (x != null && y != null && width != null && height != null) {
        imageBuffer = await cropImage(imagePath, { x, y, width, height });
      } else {
        imageBuffer = await readImageBuffer(imagePath);
      }

      let regions = await provider.detectLayout(imageBuffer, level || "line");
      if (x != null && y != null) {
        regions = regions.map((region) => ({
          ...region,
          x: region.x + Math.round(x),
          y: region.y + Math.round(y),
        }));
      }

      res.json({ ok: true, regions });
    } catch (error) {
      if (error && error.statusCode) {
        return sendError(res, error, error.statusCode);
      }
      sendError(res, error);
    }
  });
}

module.exports = registerOcrRoutes;
