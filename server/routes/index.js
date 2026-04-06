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
const registerHealthRoute = require("./health");

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
    listArticlesForUser: deps.listArticlesForUser,
    createArticleRecord: deps.createArticleRecord,
    assignArticleAccess: deps.assignArticleAccess,
    deleteArticle: deps.deleteArticle,
    getArticleAccessUsers: deps.getArticleAccessUsers,
    removeArticleAccess: deps.removeArticleAccess,
    ensureArticle: deps.ensureArticle,
    upsertArticle: deps.upsertArticle,
    getPageSrcsByArticle: deps.getPageSrcsByArticle,
    getSnapshot: deps.getSnapshot,
  });

  registerArticlePageRoutes(app, {
    sendError: deps.sendError,
    articleIdFromReq: deps.articleIdFromReq,
    requireAuth: deps.requireAuth,
    requireRole: deps.requireRole,
    requireArticleAccess: deps.requireArticleAccess,
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
    requireRole: deps.requireRole,
    createAnnotation: deps.createAnnotation,
    updateAnnotation: deps.updateAnnotation,
    deleteAnnotation: deps.deleteAnnotation,
    getAnnotationsForPage: deps.getAnnotationsForPage,
    broadcastToPage: deps.broadcastToPage,
  });

  registerAnnotationRegionRoutes(app, {
    sendError: deps.sendError,
    requireAuth: deps.requireAuth,
    requireRole: deps.requireRole,
    addAnnotationRegion: deps.addAnnotationRegion,
    getRegionsByAnnotation: deps.getRegionsByAnnotation,
    getRegionsByPage: deps.getRegionsByPage,
    deleteAnnotationRegion: deps.deleteAnnotationRegion,
    updateAnnotationRegion: deps.updateAnnotationRegion,
    reorderAnnotationRegions: deps.reorderAnnotationRegions,
  });

  registerOcrRoutes(app, {
    sendError: deps.sendError,
    requireAuth: deps.requireAuth,
    requireRole: deps.requireRole,
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
    requireRole: deps.requireRole,
    requireArticleAccess: deps.requireArticleAccess,
    getGlyphsByArticle: deps.getGlyphsByArticle,
    createGlyph: deps.createGlyph,
    importGlyph: deps.importGlyph,
    deleteGlyph: deps.deleteGlyph,
    broadcastToPage: deps.broadcastToPage,
  });

  registerHeadingRoutes(app, {
    sendError: deps.sendError,
    articleIdFromReq: deps.articleIdFromReq,
    requireAuth: deps.requireAuth,
    requireRole: deps.requireRole,
    requireArticleAccess: deps.requireArticleAccess,
    createHeading: deps.createHeading,
    updateHeadingParent: deps.updateHeadingParent,
    reorderHeadings: deps.reorderHeadings,
    deleteHeading: deps.deleteHeading,
  });

  registerHealthRoute(app, {
    ensureArticle: deps.ensureArticle,
    sendError: deps.sendError,
  });
}

module.exports = {
  registerAllRoutes,
};
