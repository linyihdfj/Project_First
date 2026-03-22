const path = require("path");
const http = require("http");
const express = require("express");
const { Server: SocketServer } = require("socket.io");
const { generateXmlFromSnapshot } = require("./xml");

const { getProvider, cropImage, readImageBuffer } = require("./ocr");

const {
  initDatabase,
  getArticle,
  ensureArticle,
  upsertArticle,
  createPages,
  clearPagesByArticle,
  getPageRow,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  getChildAnnotations,
  addAnnotationRegion,
  getAnnotationsForPage,
  getRegionsByPage,
  getRegionsByAnnotation,
  deleteAnnotationRegion,
  reorderAnnotationRegions,
  createHeading,
  updateHeadingParent,
  reorderHeadings,
  deleteHeading,
  getHeadingsByArticle,
  getPageIdsByArticle,
  getGlyphsByArticle,
  createGlyph,
  importGlyph,
  deleteGlyph,
  getSnapshot,
  // Auth
  verifyPassword,
  createToken,
  verifyToken,
  getUserByUsername,
  getUserById,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  // Article access
  listArticlesForUser,
  checkArticleAccess,
  assignArticleAccess,
  removeArticleAccess,
  getArticleAccessUsers,
  createArticleRecord,
  deleteArticle,
} = require("./db");

const app = express();
const httpServer = http.createServer(app);
const io = new SocketServer(httpServer, { cors: { origin: "*" } });
const PORT = Number(process.env.PORT || 3000);
const PROJECT_ROOT = path.resolve(__dirname, "..");

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

function articleIdFromReq(req) {
  return String(req.params.articleId || "article-1").trim() || "article-1";
}

function sendError(res, error, statusCode = 400) {
  res.status(statusCode).json({
    ok: false,
    message: error && error.message ? error.message : String(error),
  });
}

// ── 认证中间件 ──

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return res.status(401).json({ ok: false, message: "未登录" });
  }
  const data = verifyToken(token);
  if (!data) {
    return res.status(401).json({ ok: false, message: "登录已过期，请重新登录" });
  }
  req.user = { userId: data.userId, role: data.role };
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, message: "未登录" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, message: "权限不足" });
    }
    next();
  };
}

async function requireArticleAccess(req, res, next) {
  const articleId = articleIdFromReq(req);
  if (!req.user) {
    return res.status(401).json({ ok: false, message: "未登录" });
  }
  try {
    const hasAccess = await checkArticleAccess(req.user.userId, articleId, req.user.role);
    if (!hasAccess) {
      return res.status(403).json({ ok: false, message: "无权访问该文章" });
    }
    next();
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
}

// ── 公开端点 ──

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

// ── 认证端点 ──

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return sendError(res, new Error("请输入用户名和密码"));
    }
    const user = await getUserByUsername(username);
    if (!user) {
      return sendError(res, new Error("用户名或密码错误"), 401);
    }
    if (!verifyPassword(password, user.password_hash)) {
      return sendError(res, new Error("用户名或密码错误"), 401);
    }
    const token = createToken(user.id, user.role);
    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
      },
    });
  } catch (error) {
    sendError(res, error, 500);
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);
    if (!user) {
      return sendError(res, new Error("用户不存在"), 404);
    }
    res.json({ ok: true, user });
  } catch (error) {
    sendError(res, error, 500);
  }
});

// ── 用户管理端点（仅管理员） ──

app.post("/api/auth/register", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { username, password, displayName, role } = req.body || {};
    if (!username || !password) {
      return sendError(res, new Error("用户名和密码不能为空"));
    }
    const user = await createUser(username, password, displayName, role);
    res.json({ ok: true, user });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/users", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const users = await listUsers();
    res.json({ ok: true, users });
  } catch (error) {
    sendError(res, error, 500);
  }
});

app.patch("/api/users/:userId", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const user = await updateUser(req.params.userId, req.body || {});
    res.json({ ok: true, user });
  } catch (error) {
    sendError(res, error);
  }
});

app.delete("/api/users/:userId", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    await deleteUser(req.params.userId);
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
});

// ── 以下端点均需登录 ──

// ── 文章列表与管理 ──

app.get("/api/articles", requireAuth, async (req, res) => {
  try {
    const articles = await listArticlesForUser(req.user.userId, req.user.role);
    res.json({ ok: true, articles });
  } catch (error) {
    sendError(res, error, 500);
  }
});

app.post("/api/articles", requireAuth, requireRole("admin", "editor"), async (req, res) => {
  try {
    const payload = req.body || {};
    const article = await createArticleRecord(payload);
    // Auto-assign access to creator
    await assignArticleAccess(req.user.userId, article.id);
    res.json({ ok: true, article });
  } catch (error) {
    sendError(res, error);
  }
});

app.delete("/api/articles/:articleId", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const articleId = articleIdFromReq(req);
    await deleteArticle(articleId);
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
});

// ── 文章权限管理 ──

app.get("/api/articles/:articleId/access", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const articleId = articleIdFromReq(req);
    const users = await getArticleAccessUsers(articleId);
    res.json({ ok: true, users });
  } catch (error) {
    sendError(res, error, 500);
  }
});

app.post("/api/articles/:articleId/access", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const articleId = articleIdFromReq(req);
    const { userId } = req.body || {};
    if (!userId) {
      return sendError(res, new Error("请指定用户"));
    }
    await assignArticleAccess(userId, articleId);
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
});

app.delete("/api/articles/:articleId/access/:userId", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const articleId = articleIdFromReq(req);
    await removeArticleAccess(req.params.userId, articleId);
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
});

// ── 文章数据端点 ──

app.get("/api/articles/:articleId", requireAuth, requireArticleAccess, async (req, res) => {
  try {
    const articleId = articleIdFromReq(req);
    const article = await ensureArticle(articleId);
    res.json({ ok: true, article });
  } catch (error) {
    sendError(res, error, 500);
  }
});

app.put("/api/articles/:articleId", requireAuth, requireArticleAccess, requireRole("admin", "editor"), async (req, res) => {
  try {
    const articleId = articleIdFromReq(req);
    const payload = req.body || {};
    const article = await upsertArticle({
      id: articleId,
      type: payload.type || "1",
      version: payload.version || "1.0",
      title: payload.title || "",
      subtitle: payload.subtitle || "",
      author: payload.author || "",
      book: payload.book || "",
      volume: payload.volume || "",
      publishYear: payload.publishYear || "",
      writingYear: payload.writingYear || "",
    });
    res.json({ ok: true, article });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/articles/:articleId/snapshot", requireAuth, requireArticleAccess, async (req, res) => {
  try {
    const articleId = articleIdFromReq(req);
    const snapshot = await getSnapshot(articleId);
    res.json({ ok: true, ...snapshot });
  } catch (error) {
    sendError(res, error, 500);
  }
});

app.get("/api/articles/:articleId/export-xml", requireAuth, requireArticleAccess, async (req, res) => {
  try {
    const articleId = articleIdFromReq(req);
    const snapshot = await getSnapshot(articleId);
    const xml = generateXmlFromSnapshot(snapshot);
    const fileName = `${snapshot.article.title || articleId}.xml`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(xml);
  } catch (error) {
    sendError(res, error, 500);
  }
});

app.post("/api/articles/:articleId/pages/bulk", requireAuth, requireArticleAccess, requireRole("admin", "editor"), async (req, res) => {
  try {
    const articleId = articleIdFromReq(req);
    const pages = Array.isArray(req.body && req.body.pages)
      ? req.body.pages
      : [];
    const created = await createPages(articleId, pages);
    res.json({ ok: true, pages: created });
  } catch (error) {
    sendError(res, error);
  }
});

app.delete("/api/articles/:articleId/pages", requireAuth, requireArticleAccess, requireRole("admin", "editor"), async (req, res) => {
  try {
    const articleId = articleIdFromReq(req);
    await clearPagesByArticle(articleId);
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/pages/:pageId/annotations", requireAuth, requireRole("admin", "editor"), async (req, res) => {
  try {
    const annotation = await createAnnotation(
      req.params.pageId,
      req.body || {},
    );
    res.json({ ok: true, annotation });
    broadcastToPage(req, `page:${annotation.pageId}`, "annotation:created", { annotation, pageId: annotation.pageId });
  } catch (error) {
    sendError(res, error);
  }
});

app.put("/api/annotations/:annotationId", requireAuth, requireRole("admin", "editor"), async (req, res) => {
  try {
    const annotation = await updateAnnotation(
      req.params.annotationId,
      req.body || {},
    );
    res.json({ ok: true, annotation });
    // 广播到所有相关页面（跨页标注可能出现在多个页面）
    const allPageIds = new Set([annotation.pageId, ...(annotation.pageIds || [])]);
    for (const pid of allPageIds) {
      broadcastToPage(req, `page:${pid}`, "annotation:updated", { annotation, pageId: pid });
    }
  } catch (error) {
    sendError(res, error);
  }
});

// PATCH for review status (admin + reviewer)
app.patch("/api/annotations/:annotationId", requireAuth, requireRole("admin", "reviewer"), async (req, res) => {
  try {
    const { reviewStatus, reviewedBy } = req.body || {};
    const annotation = await updateAnnotation(
      req.params.annotationId,
      { reviewStatus, reviewedBy },
    );
    res.json({ ok: true, annotation });
    const allPageIds = new Set([annotation.pageId, ...(annotation.pageIds || [])]);
    for (const pid of allPageIds) {
      broadcastToPage(req, `page:${pid}`, "annotation:updated", { annotation, pageId: pid });
    }
  } catch (error) {
    sendError(res, error);
  }
});

app.delete("/api/annotations/:annotationId", requireAuth, requireRole("admin", "editor"), async (req, res) => {
  try {
    const result = await deleteAnnotation(req.params.annotationId);
    res.json({ ok: true });
    if (result) {
      const allPageIds = new Set([result.pageId, ...(result.pageIds || [])].filter(Boolean));
      for (const pid of allPageIds) {
        broadcastToPage(req, `page:${pid}`, "annotation:deleted", { annotationId: req.params.annotationId, pageId: pid });
      }
    }
  } catch (error) {
    sendError(res, error);
  }
});

// ── OCR / AI 识别端点 ──

app.post("/api/ocr/recognize", requireAuth, requireRole("admin", "editor"), async (req, res) => {
  try {
    const provider = getProvider();
    if (!provider) {
      return sendError(res, new Error("OCR 服务未配置，请在 server/ocr-config.json 中设置 API 密钥"));
    }
    const { pageId, x, y, width, height } = req.body || {};
    if (!pageId) {
      return sendError(res, new Error("缺少 pageId"));
    }
    const page = await getPageRow(pageId);
    if (!page) {
      return sendError(res, new Error("页面不存在"), 404);
    }
    const imagePath = path.join(PROJECT_ROOT, page.src.replace(/^\//, ""));
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
});

app.post("/api/ocr/layout-detect", requireAuth, requireRole("admin", "editor"), async (req, res) => {
  try {
    const provider = getProvider();
    if (!provider) {
      return sendError(res, new Error("OCR 服务未配置，请在 server/ocr-config.json 中设置 API 密钥"));
    }
    const { pageId, level, x, y, width, height } = req.body || {};
    if (!pageId) {
      return sendError(res, new Error("缺少 pageId"));
    }
    const page = await getPageRow(pageId);
    if (!page) {
      return sendError(res, new Error("页面不存在"), 404);
    }
    const imagePath = path.join(PROJECT_ROOT, page.src.replace(/^\//, ""));
    let imageBuffer;
    if (x != null && y != null && width != null && height != null) {
      imageBuffer = await cropImage(imagePath, { x, y, width, height });
    } else {
      imageBuffer = await readImageBuffer(imagePath);
    }
    let regions = await provider.detectLayout(imageBuffer, level || "line");
    // If cropped, offset coordinates back to page space
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
});

app.post("/api/pages/:pageId/annotations/batch", requireAuth, requireRole("admin", "editor"), async (req, res) => {
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
      broadcastToPage(req, `page:${annotation.pageId}`, "annotation:created", { annotation, pageId: annotation.pageId });
    }
    res.json({ ok: true, annotations: created, count: created.length });
  } catch (error) {
    sendError(res, error);
  }
});

// ── 标注跨页区域 ──

app.post("/api/annotations/:annotationId/regions", requireAuth, requireRole("admin", "editor"), async (req, res) => {
  try {
    const { annotationId } = req.params;
    const { pageId, x, y, width, height } = req.body || {};
    if (!pageId || x == null || y == null || width == null || height == null) {
      return sendError(res, new Error("缺少 pageId, x, y, width, height"));
    }
    const region = await addAnnotationRegion(annotationId, pageId, x, y, width, height);
    res.json({ ok: true, region });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/annotations/:annotationId/regions", requireAuth, async (req, res) => {
  try {
    const regions = await getRegionsByAnnotation(req.params.annotationId);
    res.json({ ok: true, regions });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/pages/:pageId/cross-page-annotations", requireAuth, async (req, res) => {
  try {
    const annotations = await getRegionsByPage(req.params.pageId);
    res.json({ ok: true, annotations });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/pages/:pageId/annotations", requireAuth, async (req, res) => {
  try {
    const annotations = await getAnnotationsForPage(req.params.pageId);
    res.json({ ok: true, annotations });
  } catch (error) {
    sendError(res, error);
  }
});

app.delete("/api/annotation-regions/:regionId", requireAuth, requireRole("admin", "editor"), async (req, res) => {
  try {
    await deleteAnnotationRegion(req.params.regionId);
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
});

app.put("/api/annotations/:annotationId/regions/reorder", requireAuth, requireRole("admin", "editor"), async (req, res) => {
  try {
    const { annotationId } = req.params;
    const { regionIds } = req.body || {};
    if (!Array.isArray(regionIds)) {
      return sendError(res, new Error("缺少 regionIds 数组"));
    }
    await reorderAnnotationRegions(annotationId, regionIds);
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/api/articles/:articleId/glyphs", requireAuth, requireArticleAccess, async (req, res) => {
  try {
    const articleId = articleIdFromReq(req);
    const glyphs = await getGlyphsByArticle(articleId);
    res.json({ ok: true, glyphs });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/articles/:articleId/glyphs", requireAuth, requireArticleAccess, requireRole("admin", "editor"), async (req, res) => {
  try {
    const articleId = articleIdFromReq(req);
    const glyph = await createGlyph(articleId, req.body || {});
    res.json({ ok: true, glyph });
  } catch (error) {
    sendError(res, error);
  }
});

app.delete("/api/glyphs/:glyphId", requireAuth, requireRole("admin", "editor"), async (req, res) => {
  try {
    await deleteGlyph(req.params.glyphId);
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/articles/:articleId/headings", requireAuth, requireArticleAccess, requireRole("admin", "editor"), async (req, res) => {
  try {
    const articleId = articleIdFromReq(req);
    const heading = await createHeading(articleId, req.body || {});
    res.json({ ok: true, heading });
  } catch (error) {
    sendError(res, error);
  }
});

app.patch("/api/articles/:articleId/headings/:headingId", requireAuth, requireArticleAccess, requireRole("admin", "editor"), async (req, res) => {
  try {
    const articleId = articleIdFromReq(req);
    const headingId = req.params.headingId;
    const { parentId, orderIndex, level } = req.body || {};
    const heading = await updateHeadingParent(
      articleId,
      headingId,
      parentId || null,
      orderIndex || 0,
      level !== undefined ? level : null,
    );
    res.json({ ok: true, heading });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/articles/:articleId/headings/reorder", requireAuth, requireArticleAccess, requireRole("admin", "editor"), async (req, res) => {
  try {
    const articleId = articleIdFromReq(req);
    const { parentId, orderedIds } = req.body || {};
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ ok: false, error: "orderedIds must be an array" });
    }
    await reorderHeadings(articleId, parentId || null, orderedIds);
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
});

app.delete("/api/headings/:headingId", requireAuth, requireRole("admin", "editor"), async (req, res) => {
  try {
    await deleteHeading(req.params.headingId);
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
});

// ── 造字库批量导入 ──

app.post("/api/articles/:articleId/glyphs/import", requireAuth, requireArticleAccess, requireRole("admin", "editor"), async (req, res) => {
  try {
    const articleId = articleIdFromReq(req);
    const glyphs = Array.isArray(req.body && req.body.glyphs) ? req.body.glyphs : [];
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
        // Skip duplicates or invalid entries
      }
    }
    res.json({ ok: true, imported: results.length, glyphs: results });
  } catch (error) {
    sendError(res, error);
  }
});

// ── 静态文件 ──

app.use("/uploads", express.static(path.join(PROJECT_ROOT, "uploads")));
app.use(express.static(PROJECT_ROOT));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ ok: false, message: "接口不存在" });
    return;
  }
  next();
});

app.get("*", (req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, "index.html"));
});

// ── Socket.IO 广播辅助 ──

function broadcastToPage(req, roomName, event, data) {
  const senderSocketId = req.headers["x-socket-id"];
  if (senderSocketId) {
    io.to(roomName).except(senderSocketId).emit(event, data);
  } else {
    io.to(roomName).emit(event, data);
  }
}

// ── Socket.IO 认证与房间管理 ──

io.use((socket, next) => {
  const token = socket.handshake.auth.token || "";
  if (!token) return next(new Error("未登录"));
  const data = verifyToken(token);
  if (!data) return next(new Error("登录已过期"));
  socket.userId = data.userId;
  socket.userRole = data.role;
  next();
});

async function getRoomMembers(roomName) {
  const sockets = await io.in(roomName).fetchSockets();
  return sockets.map((s) => ({
    userId: s.userId,
    displayName: s.displayName || "",
    role: s.userRole,
  }));
}

io.on("connection", async (socket) => {
  try {
    const user = await getUserById(socket.userId);
    socket.displayName = user ? user.displayName : "Unknown";
  } catch { socket.displayName = "Unknown"; }

  socket.on("join-page", async ({ pageId }) => {
    // Leave all previous page rooms
    for (const room of socket.rooms) {
      if (room.startsWith("page:")) {
        socket.leave(room);
        io.to(room).emit("presence:leave", { userId: socket.userId, displayName: socket.displayName });
      }
    }
    if (!pageId) return;
    const roomName = `page:${pageId}`;
    socket.join(roomName);
    // Notify others
    socket.to(roomName).emit("presence:join", { userId: socket.userId, displayName: socket.displayName, role: socket.userRole });
    // Send current members to the joining user
    const members = await getRoomMembers(roomName);
    socket.emit("presence:members", { members });
  });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (room.startsWith("page:")) {
        socket.to(room).emit("presence:leave", { userId: socket.userId, displayName: socket.displayName });
      }
    }
  });
});

// ── 启动服务 ──

async function bootstrap() {
  await initDatabase();
  await ensureArticle("article-1");
  httpServer.listen(PORT, () => {
    console.log(`SDUDOC server listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("服务启动失败:", error);
  process.exit(1);
});
