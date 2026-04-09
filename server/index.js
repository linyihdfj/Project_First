/**
 * @description index服务端模块，负责对应领域能力的实现。
 */
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
  getArticleMembershipRole,
  assignArticleAccess,
  removeArticleAccess,
  getArticleAccessUsers,
  createArticleRecord,
  deleteArticle,
  getPageArticleId,
  getAnnotationArticleId,
  getRegionArticleId,
  getGlyphArticleId,
  getHeadingArticleId,
  createArticleInvite,
  listArticleInvites,
  getArticleInviteById,
  deactivateArticleInvite,
  resolveArticleInvite,
  acceptArticleInvite,
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
const {
  requireAuth,
  requireRole,
  requireArticleAccess,
  requireArticleCapability,
} =
  createAuthMiddlewares({
    verifyToken,
    checkArticleAccess,
    articleIdFromReq,
    getArticleMembershipRole,
  });

registerAllRoutes(app, {
  sendError,
  articleIdFromReq,
  requireAuth,
  requireRole,
  requireArticleAccess,
  requireArticleCapability,
  getUserByUsername,
  verifyPassword,
  createToken,
  getUserById,
  createUser,
  resolveArticleInvite,
  acceptArticleInvite,
  listUsers,
  updateUser,
  deleteUser,
  listArticlesForUser,
  createArticleRecord,
  assignArticleAccess,
  deleteArticle,
  getArticleAccessUsers,
  removeArticleAccess,
  getArticleMembershipRole,
  ensureArticle,
  upsertArticle,
  getPageSrcsByArticle,
  getSnapshot,
  createArticleInvite,
  listArticleInvites,
  getArticleInviteById,
  deactivateArticleInvite,
  generateXmlFromSnapshot,
  createPages,
  clearPagesByArticle,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  getPageArticleId,
  getAnnotationArticleId,
  getAnnotationsForPage,
  broadcastToPage,
  addAnnotationRegion,
  getRegionsByAnnotation,
  getRegionsByPage,
  getRegionArticleId,
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
  getGlyphArticleId,
  createGlyph,
  importGlyph,
  deleteGlyph,
  createHeading,
  getHeadingById,
  getHeadingArticleId,
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

