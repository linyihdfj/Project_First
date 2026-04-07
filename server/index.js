const http = require("http");
const express = require("express");
const { PORT, PROJECT_ROOT } = require("./config");
const { createSocketLayer } = require("./socket");
const { bootstrapServer } = require("./bootstrap");
const { sendError } = require("./http/response");
const { registerStaticRoutes } = require("./http/static");
const { articleIdFromReq } = require("./http/request");
const { createAuthMiddlewares } = require("./middleware/auth");
const { registerAllRoutes } = require("./routes");
const { generateXmlFromSnapshot } = require("./xml");
const { convertToSimplified } = require("./text-convert");

const { getProvider, cropImage, readImageBuffer } = require("./ocr");

const {
  initDatabase,
  ensureArticle,
  upsertArticle,
  createPages,
  clearPagesByArticle,
  getPageRow,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  addAnnotationRegion,
  getAnnotationsForPage,
  getRegionsByPage,
  getRegionsByAnnotation,
  getAnnotationRegion,
  deleteAnnotationRegion,
  updateAnnotationRegion,
  reorderAnnotationRegions,
  getHeadingById,
  createHeading,
  updateHeadingParent,
  reorderHeadings,
  deleteHeading,
  getGlyphsByArticle,
  createGlyph,
  importGlyph,
  deleteGlyph,
  getPageSrcsByArticle,
  getSnapshot,

  verifyPassword,
  createToken,
  verifyToken,
  getUserByUsername,
  getUserById,
  listUsers,
  createUser,
  updateUser,
  deleteUser,

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
const { broadcastToPage } = createSocketLayer({
  httpServer,
  verifyToken,
  getUserById,
  checkArticleAccess,
});

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
const { requireAuth, requireRole, requireArticleAccess } =
  createAuthMiddlewares({
    verifyToken,
    checkArticleAccess,
    articleIdFromReq,
  });

registerAllRoutes(app, {
  sendError,
  articleIdFromReq,
  requireAuth,
  requireRole,
  requireArticleAccess,
  getUserByUsername,
  verifyPassword,
  createToken,
  getUserById,
  createUser,
  listUsers,
  updateUser,
  deleteUser,
  listArticlesForUser,
  createArticleRecord,
  assignArticleAccess,
  deleteArticle,
  getArticleAccessUsers,
  removeArticleAccess,
  ensureArticle,
  upsertArticle,
  getPageSrcsByArticle,
  getSnapshot,
  generateXmlFromSnapshot,
  createPages,
  clearPagesByArticle,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  getAnnotationsForPage,
  broadcastToPage,
  addAnnotationRegion,
  getRegionsByAnnotation,
  getRegionsByPage,
  getAnnotationRegion,
  deleteAnnotationRegion,
  updateAnnotationRegion,
  reorderAnnotationRegions,
  getProvider,
  getPageRow,
  cropImage,
  readImageBuffer,
  projectRoot: PROJECT_ROOT,
  getGlyphsByArticle,
  createGlyph,
  importGlyph,
  deleteGlyph,
  createHeading,
  getHeadingById,
  updateHeadingParent,
  reorderHeadings,
  deleteHeading,
  convertToSimplified,
});

registerStaticRoutes(app, PROJECT_ROOT);

bootstrapServer({
  initDatabase,
  ensureArticle,
  httpServer,
  port: PORT,
}).catch((error) => {
  console.error("服务启动失败:", error);
  process.exit(1);
});
