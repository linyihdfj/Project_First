function registerOcrRoutes(app, deps) {
  const {
    sendError,
    requireAuth,
    requireRole,
    getProvider,
    getPageRow,
    cropImage,
    readImageBuffer,
    projectRoot,
  } = deps;

  app.post(
    "/api/ocr/recognize",
    requireAuth,
    requireRole("admin", "editor"),
    async (req, res) => {
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
        if (!pageId) {
          return sendError(res, new Error("缺少 pageId"));
        }
        const page = await getPageRow(pageId);
        if (!page) {
          return sendError(res, new Error("页面不存在"), 404);
        }
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
        sendError(res, error);
      }
    },
  );

  app.post(
    "/api/ocr/layout-detect",
    requireAuth,
    requireRole("admin", "editor"),
    async (req, res) => {
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
        if (!pageId) {
          return sendError(res, new Error("缺少 pageId"));
        }
        const page = await getPageRow(pageId);
        if (!page) {
          return sendError(res, new Error("页面不存在"), 404);
        }
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
          regions = regions.map((r) => ({
            ...r,
            x: r.x + Math.round(x),
            y: r.y + Math.round(y),
          }));
        }
        res.json({ ok: true, regions });
      } catch (error) {
        sendError(res, error);
      }
    },
  );
}

module.exports = registerOcrRoutes;
