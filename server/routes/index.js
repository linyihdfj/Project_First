/**
 * @description index路由模块，负责注册对应的 HTTP 接口。
 */
const registerAuthRoutes = require("./auth");
const registerUserRoutes = require("./users");
const registerArticleRoutes = require("./articles");
const registerArticlePageRoutes = require("./article-pages");
const registerArticleExportRoutes = require("./article-export");
const registerAnnotationRoutes = require("./annotations");
const registerAnnotationRegionRoutes = require("./annotation-regions");
const registerOcrRoutes = require("./ocr");
const registerGlyphRoutes = require("./glyphs");
const registerHeadingRoutes = require("./headings");
const registerArticleInviteRoutes = require("./article-invites");
const registerTextConvertRoutes = require("./text-convert");

/**
 * @description 注册全部业务路由模块。
 * @param {*} app Express 应用实例。
 * @param {*} deps 模块依赖集合。
 * @returns {void} 无返回值。
 */
function registerAllRoutes(app, deps) {
  registerAuthRoutes(app, {
    sendError: deps.sendError,
    requireAuth: deps.requireAuth,
    requireRole: deps.requireRole,
    getUserByUsername: deps.getUserByUsername,
    verifyPassword: deps.verifyPassword,
    createToken: deps.createToken,
    getUserById: deps.getUserById,
    createUser: deps.createUser,
    resolveArticleInvite: deps.resolveArticleInvite,
    acceptArticleInvite: deps.acceptArticleInvite,
  });

  registerUserRoutes(app, {
    sendError: deps.sendError,
    requireAuth: deps.requireAuth,
    requireRole: deps.requireRole,
    listUsers: deps.listUsers,
    updateUser: deps.updateUser,
    deleteUser: deps.deleteUser,
  });

  registerArticleRoutes(app, {
    sendError: deps.sendError,
    articleIdFromReq: deps.articleIdFromReq,
    requireAuth: deps.requireAuth,
    requireRole: deps.requireRole,
    requireArticleAccess: deps.requireArticleAccess,
    requireArticleCapability: deps.requireArticleCapability,
    listArticlesForUser: deps.listArticlesForUser,
    createArticleRecord: deps.createArticleRecord,
    assignArticleAccess: deps.assignArticleAccess,
    deleteArticle: deps.deleteArticle,
    getArticleAccessUsers: deps.getArticleAccessUsers,
    removeArticleAccess: deps.removeArticleAccess,
    getArticleMembershipRole: deps.getArticleMembershipRole,
    ensureArticle: deps.ensureArticle,
    upsertArticle: deps.upsertArticle,
    getPageSrcsByArticle: deps.getPageSrcsByArticle,
    getSnapshot: deps.getSnapshot,
  });

  registerArticleInviteRoutes(app, {
    sendError: deps.sendError,
    articleIdFromReq: deps.articleIdFromReq,
    requireAuth: deps.requireAuth,
    requireArticleCapability: deps.requireArticleCapability,
    createArticleInvite: deps.createArticleInvite,
    listArticleInvites: deps.listArticleInvites,
    getArticleInviteById: deps.getArticleInviteById,
    deactivateArticleInvite: deps.deactivateArticleInvite,
    resolveArticleInvite: deps.resolveArticleInvite,
    acceptArticleInvite: deps.acceptArticleInvite,
  });

  registerArticlePageRoutes(app, {
    sendError: deps.sendError,
    articleIdFromReq: deps.articleIdFromReq,
    requireAuth: deps.requireAuth,
    requireArticleCapability: deps.requireArticleCapability,
    createPages: deps.createPages,
    clearPagesByArticle: deps.clearPagesByArticle,
  });

  registerArticleExportRoutes(app, {
    sendError: deps.sendError,
    articleIdFromReq: deps.articleIdFromReq,
    requireAuth: deps.requireAuth,
    requireArticleAccess: deps.requireArticleAccess,
    getSnapshot: deps.getSnapshot,
    generateXmlFromSnapshot: deps.generateXmlFromSnapshot,
  });

  registerAnnotationRoutes(app, {
    sendError: deps.sendError,
    requireAuth: deps.requireAuth,
    requireArticleCapability: deps.requireArticleCapability,
    getPageArticleId: deps.getPageArticleId,
    getAnnotationArticleId: deps.getAnnotationArticleId,
    createAnnotation: deps.createAnnotation,
    updateAnnotation: deps.updateAnnotation,
    deleteAnnotation: deps.deleteAnnotation,
    getAnnotationsForPage: deps.getAnnotationsForPage,
    broadcastToPage: deps.broadcastToPage,
  });

  registerAnnotationRegionRoutes(app, {
    sendError: deps.sendError,
    requireAuth: deps.requireAuth,
    requireArticleCapability: deps.requireArticleCapability,
    getAnnotationArticleId: deps.getAnnotationArticleId,
    getRegionArticleId: deps.getRegionArticleId,
    getPageArticleId: deps.getPageArticleId,
    addAnnotationRegion: deps.addAnnotationRegion,
    getRegionsByAnnotation: deps.getRegionsByAnnotation,
    getRegionsByPage: deps.getRegionsByPage,
    getAnnotationRegion: deps.getAnnotationRegion,
    deleteAnnotationRegion: deps.deleteAnnotationRegion,
    updateAnnotationRegion: deps.updateAnnotationRegion,
    reorderAnnotationRegions: deps.reorderAnnotationRegions,
    broadcastToPage: deps.broadcastToPage,
  });

  registerOcrRoutes(app, {
    sendError: deps.sendError,
    requireAuth: deps.requireAuth,
    getArticleMembershipRole: deps.getArticleMembershipRole,
    getProvider: deps.getProvider,
    getPageRow: deps.getPageRow,
    cropImage: deps.cropImage,
    readImageBuffer: deps.readImageBuffer,
    projectRoot: deps.projectRoot,
  });

  registerGlyphRoutes(app, {
    sendError: deps.sendError,
    articleIdFromReq: deps.articleIdFromReq,
    requireAuth: deps.requireAuth,
    requireArticleCapability: deps.requireArticleCapability,
    getGlyphsByArticle: deps.getGlyphsByArticle,
    getGlyphArticleId: deps.getGlyphArticleId,
    createGlyph: deps.createGlyph,
    importGlyph: deps.importGlyph,
    deleteGlyph: deps.deleteGlyph,
    broadcastToPage: deps.broadcastToPage,
  });

  registerHeadingRoutes(app, {
    sendError: deps.sendError,
    articleIdFromReq: deps.articleIdFromReq,
    requireAuth: deps.requireAuth,
    requireArticleCapability: deps.requireArticleCapability,
    createHeading: deps.createHeading,
    getHeadingById: deps.getHeadingById,
    getHeadingArticleId: deps.getHeadingArticleId,
    updateHeadingParent: deps.updateHeadingParent,
    reorderHeadings: deps.reorderHeadings,
    deleteHeading: deps.deleteHeading,
    broadcastToPage: deps.broadcastToPage,
  });

  registerTextConvertRoutes(app, {
    sendError: deps.sendError,
    requireAuth: deps.requireAuth,
    convertToSimplified: deps.convertToSimplified,
  });
}

module.exports = {
  registerAllRoutes,
};

