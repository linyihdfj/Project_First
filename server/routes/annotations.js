function registerAnnotationRoutes(app, deps) {
  const {
    sendError,
    requireAuth,
    requireRole,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    getAnnotationsForPage,
    broadcastToPage,
  } = deps;

  app.post(
    "/api/pages/:pageId/annotations",
    requireAuth,
    requireRole("admin", "editor"),
    async (req, res) => {
      try {
        const annotation = await createAnnotation(
          req.params.pageId,
          req.body || {},
        );
        res.json({ ok: true, annotation });
        broadcastToPage(
          req,
          `page:${annotation.pageId}`,
          "annotation:created",
          {
            annotation,
            pageId: annotation.pageId,
          },
        );
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.put(
    "/api/annotations/:annotationId",
    requireAuth,
    requireRole("admin", "editor"),
    async (req, res) => {
      try {
        const annotation = await updateAnnotation(
          req.params.annotationId,
          req.body || {},
        );
        res.json({ ok: true, annotation });
        const allPageIds = new Set([
          annotation.pageId,
          ...(annotation.pageIds || []),
        ]);
        for (const pid of allPageIds) {
          broadcastToPage(req, `page:${pid}`, "annotation:updated", {
            annotation,
            pageId: pid,
          });
        }
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.patch(
    "/api/annotations/:annotationId",
    requireAuth,
    requireRole("admin", "reviewer"),
    async (req, res) => {
      try {
        const { reviewStatus, reviewedBy } = req.body || {};
        const annotation = await updateAnnotation(req.params.annotationId, {
          reviewStatus,
          reviewedBy,
        });
        res.json({ ok: true, annotation });
        const allPageIds = new Set([
          annotation.pageId,
          ...(annotation.pageIds || []),
        ]);
        for (const pid of allPageIds) {
          broadcastToPage(req, `page:${pid}`, "annotation:updated", {
            annotation,
            pageId: pid,
          });
        }
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.delete(
    "/api/annotations/:annotationId",
    requireAuth,
    requireRole("admin", "editor"),
    async (req, res) => {
      try {
        const result = await deleteAnnotation(req.params.annotationId);
        res.json({ ok: true });
        if (result) {
          const allPageIds = new Set(
            [result.pageId, ...(result.pageIds || [])].filter(Boolean),
          );
          for (const pid of allPageIds) {
            broadcastToPage(req, `page:${pid}`, "annotation:deleted", {
              annotationId: req.params.annotationId,
              pageId: pid,
            });
          }
        }
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.post(
    "/api/pages/:pageId/annotations/batch",
    requireAuth,
    requireRole("admin", "editor"),
    async (req, res) => {
      try {
        const { annotations: items } = req.body || {};
        if (!Array.isArray(items) || !items.length) {
          return sendError(res, new Error("annotations 不能为空"));
        }
        const pageId = req.params.pageId;
        const created = [];
        for (const item of items) {
          const annotation = await createAnnotation(pageId, item);
          created.push(annotation);
          broadcastToPage(
            req,
            `page:${annotation.pageId}`,
            "annotation:created",
            {
              annotation,
              pageId: annotation.pageId,
            },
          );
        }
        res.json({ ok: true, annotations: created, count: created.length });
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  app.get("/api/pages/:pageId/annotations", requireAuth, async (req, res) => {
    try {
      const annotations = await getAnnotationsForPage(req.params.pageId);
      res.json({ ok: true, annotations });
    } catch (error) {
      sendError(res, error);
    }
  });
}

module.exports = registerAnnotationRoutes;
