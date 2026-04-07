function registerAnnotationRegionRoutes(app, deps) {
  const {
    sendError,
    requireAuth,
    requireRole,
    addAnnotationRegion,
    getRegionsByAnnotation,
    getRegionsByPage,
    getAnnotationRegion,
    deleteAnnotationRegion,
    updateAnnotationRegion,
    reorderAnnotationRegions,
    broadcastToPage,
  } = deps;

  app.post(
    "/api/annotations/:annotationId/regions",
    requireAuth,
    requireRole("admin", "editor"),
    async (req, res) => {
      try {
        const { annotationId } = req.params;
        const { pageId, x, y, width, height } = req.body || {};
        if (
          !pageId ||
          x == null ||
          y == null ||
          width == null ||
          height == null
        ) {
          return sendError(res, new Error("缺少 pageId, x, y, width, height"));
        }
        const region = await addAnnotationRegion(
          annotationId,
          pageId,
          x,
          y,
          width,
          height,
        );
        res.json({ ok: true, region });
        broadcastToPage(req, `page:${pageId}`, "annotation-region:created", {
          annotationId,
          pageId,
          region,
        });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.get(
    "/api/annotations/:annotationId/regions",
    requireAuth,
    async (req, res) => {
      try {
        const regions = await getRegionsByAnnotation(req.params.annotationId);
        res.json({ ok: true, regions });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.get(
    "/api/pages/:pageId/cross-page-annotations",
    requireAuth,
    async (req, res) => {
      try {
        const annotations = await getRegionsByPage(req.params.pageId);
        res.json({ ok: true, annotations });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.delete(
    "/api/annotation-regions/:regionId",
    requireAuth,
    requireRole("admin", "editor"),
    async (req, res) => {
      try {
        const existingRegion = await getAnnotationRegion(req.params.regionId);
        if (!existingRegion) {
          throw new Error("区域不存在");
        }
        await deleteAnnotationRegion(req.params.regionId);
        res.json({ ok: true });
        broadcastToPage(
          req,
          `page:${existingRegion.pageId}`,
          "annotation-region:deleted",
          {
            regionId: existingRegion.id,
            annotationId: existingRegion.annotationId,
            pageId: existingRegion.pageId,
          },
        );
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.put(
    "/api/annotation-regions/:regionId",
    requireAuth,
    requireRole("admin", "editor"),
    async (req, res) => {
      try {
        const { regionId } = req.params;
        const { x, y, width, height } = req.body || {};
        if (x == null || y == null || width == null || height == null) {
          return sendError(res, new Error("缺少 x, y, width, height"));
        }
        const region = await updateAnnotationRegion(regionId, {
          x,
          y,
          width,
          height,
        });
        res.json({ ok: true, region });
        broadcastToPage(
          req,
          `page:${region.pageId}`,
          "annotation-region:updated",
          {
            pageId: region.pageId,
            region,
          },
        );
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.put(
    "/api/annotations/:annotationId/regions/reorder",
    requireAuth,
    requireRole("admin", "editor"),
    async (req, res) => {
      try {
        const { annotationId } = req.params;
        const { regionIds } = req.body || {};
        if (!Array.isArray(regionIds)) {
          return sendError(res, new Error("缺少 regionIds 数组"));
        }
        await reorderAnnotationRegions(annotationId, regionIds);
        res.json({ ok: true });
        const regions = await getRegionsByAnnotation(annotationId);
        if (regions.length) {
          broadcastToPage(
            req,
            `page:${regions[0].pageId}`,
            "annotation-region:reordered",
            {
              annotationId,
              regionIds,
              pageId: regions[0].pageId,
            },
          );
        }
      } catch (error) {
        sendError(res, error);
      }
    },
  );
}

module.exports = registerAnnotationRegionRoutes;
