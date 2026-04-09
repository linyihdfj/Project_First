/**
 * @description 前端应用主入口，负责装配浏览器端模块、建立共享依赖并启动页面。
 */
const NS_SVG = "http://www.w3.org/2000/svg";
const API_BASE = "/api";
const MIN_REGION_SIZE = 8;
const BORDER_HIT_TOLERANCE_PX = 8;
const MIN_HANDLE_SIZE_PX = 6;
const MAX_HANDLE_SIZE_PX = 9;
const HANDLE_HIT_PADDING_PX = 2;

const state = window.createInitialState();

const refs = window.createRefs();
const annotationSaveTimers = new Map();
let socket = null;
const { uid, clampValue, normalizeArticleId, escapeHtml, createApiPath } =
  window.createAppUtils();
const { getAuthToken, setAuthToken, removeAuthToken } =
  window.createAuthStorage("sdudoc_token");
const apiPath = createApiPath(API_BASE);
const apiRequest = window.createApiRequest({
  apiPath,
  getAuthToken,
  removeAuthToken,
  getSocketId: () => (socket && socket.id ? socket.id : ""),
  onUnauthorized: () => {
    state.currentUser = null;
    showLoginOverlay();
  },
});
const {
  showLoginOverlay,
  showAppShell,
  hideAppShell,
  doLogin,
  doInviteRegister,
  showInviteLoginMode,
  showInviteRegisterMode,
  doLogout,
  checkAuth,
  isEditor,
  isAdmin,
  canReview,
  applyPermissions,
} = window.createAuthPermissions({
  refs,
  state,
  apiPath,
  apiRequest,
  setAuthToken,
  removeAuthToken,
  getAuthToken,
  initSocket,
  getSocket: () => socket,
  setSocket: (value) => {
    socket = value;
  },
  showArticleSelect,
  hideArticleSelect,
  onInviteAccepted: (articleId) => {
    state.inviteTargetArticleId = articleId;
  },
});
const {
  getCachedImageUrl,
  waitForImage,
  preloadAdjacentPages,
  preloadArticleFirstPages,
} = window.createImageCache(apiRequest);
const {
  showUserManageDialog,
  hideUserManageDialog,
  createNewUser,
} = window.createUserManagement({
  refs,
  apiRequest,
  escapeHtml,
});

let appStateTools = null;

/**
 * @description 更新articlemetaform。
 * @returns {void} 无返回值。
 */
function updateArticleMetaFromForm() {
  return appStateTools.updateArticleMetaFromForm();
}

/**
 * @description 处理savearticlemeta相关逻辑。
 * @returns {*} articlemeta结果。
 */
async function saveArticleMeta() {
  return appStateTools.saveArticleMeta();
}

/**
 * @description 安排savearticlemeta。
 * @returns {void} 无返回值。
 */
function scheduleSaveArticleMeta() {
  return appStateTools.scheduleSaveArticleMeta();
}

/**
 * @description 加载snapshot。
 * @param {*} articleId 文章 ID。
 * @returns {*} snapshot结果。
 */
async function loadSnapshot(articleId) {
  return appStateTools.loadSnapshot(articleId);
}

/**
 * @description 设置activetab。
 * @param {*} tabName tabname参数。
 * @returns {*} activetab结果。
 */
function setActiveTab(tabName) {
  return appStateTools.setActiveTab(tabName);
}

/**
 * @description 创建pageimage。
 * @param {*} src src参数。
 * @param {*} name name参数。
 * @param {*} width width参数。
 * @param {*} height height参数。
 * @returns {*} pageimage结果。
 */
function createPageFromImage(src, name, width, height) {
  return appStateTools.createPageFromImage(src, name, width, height);
}

const {
  isPdfFile,
  isImageFile,
  readFileAsDataUrl,
  extractPdfPagesAsImages,
} = window.createFilePdfUtils(createPageFromImage);

appStateTools = window.createAppStateTools({
  state,
  refs,
  normalizeArticleId,
  apiRequest,
  applyPermissions,
  resetCanvasView: (...args) => resetCanvasView(...args),
  renderAll: (...args) => renderAll(...args),
  joinCurrentArticleRoom: (...args) => joinCurrentArticleRoom(...args),
  joinCurrentPageRoom: (...args) => joinCurrentPageRoom(...args),
  preloadAdjacentPages,
  uid,
});

let pageImportTools = null;
let glyphLibraryTools = null;

/**
 * @description 处理imageupload。
 * @param {*} event 浏览器事件对象。
 * @returns {void} 无返回值。
 */
async function handleImageUpload(event) {
  return pageImportTools.handleImageUpload(event);
}

/**
 * @description 清空allpages。
 * @returns {void} 无返回值。
 */
async function clearAllPages() {
  return pageImportTools.clearAllPages();
}

const {
  getCurrentPage,
  switchPage,
  clampCanvasView,
  applyCanvasView,
  resetCanvasView,
  setCanvasZoom,
  panCanvasBy,
  shouldStartPanning,
  beginCanvasPan,
  moveCanvasPan,
  endCanvasPan,
  handleCanvasWheel,
  getPointerPoint,
  getRegionFromAnnotation,
  syncRegionAcrossPages,
  getResizeHandleMetrics,
  getRegionBorderHit,
  updateSvgCursor,
} = window.createCanvasViewTools({
  state,
  refs,
  clampValue,
  isEditor,
  getAnnotationById,
  drawOverlay,
  renderAll,
  joinCurrentPageRoom,
  BORDER_HIT_TOLERANCE_PX,
  MIN_HANDLE_SIZE_PX,
  MAX_HANDLE_SIZE_PX,
  HANDLE_HIT_PADDING_PX,
});

pageImportTools = window.createPageImportTools({
  state,
  refs,
  isPdfFile,
  isImageFile,
  readFileAsDataUrl,
  extractPdfPagesAsImages,
  createPageFromImage,
  saveArticleMeta,
  normalizeArticleId,
  apiRequest,
  resetCanvasView,
  renderAll,
});

const {
  startRegionResize,
  startRegionMove,
  beginDraw,
  moveDraw,
  finishDraw,
  flushPendingRegionEdit,
} = window.createRegionDrawTools({
  state,
  refs,
  clampValue,
  uid,
  isEditor,
  apiRequest,
  renderAll,
  drawOverlay,
  reloadPageAnnotations,
  getCurrentPage,
  getPointerPoint,
  getRegionFromAnnotation,
  syncRegionAcrossPages,
  updateSvgCursor,
  shouldStartPanning,
  beginCanvasPan,
  moveCanvasPan,
  endCanvasPan,
  panCanvasBy,
  getRegionBorderHit,
  MIN_REGION_SIZE,
});

let annotationSelectionTools = null;

/**
 * @description 安排annotationpersist。
 * @param {*} ann 标注对象。
 * @returns {void} 无返回值。
 */
function scheduleAnnotationPersist(ann) {
  return annotationSelectionTools.scheduleAnnotationPersist(ann);
}

/**
 * @description 处理removeselectedannotation相关逻辑。
 * @returns {void} 无返回值。
 */
async function removeSelectedAnnotation() {
  return annotationSelectionTools.removeSelectedAnnotation();
}

/**
 * @description 获取selectedannotation。
 * @returns {*} selectedannotation结果。
 */
function getSelectedAnnotation() {
  return annotationSelectionTools.getSelectedAnnotation();
}

/**
 * @description 获取annotationid。
 * @param {*} annotationId 标注 ID。
 * @returns {*} annotationid结果。
 */
function getAnnotationById(annotationId) {
  return annotationSelectionTools.getAnnotationById(annotationId);
}

annotationSelectionTools = window.createAnnotationSelectionTools({
  state,
  annotationSaveTimers,
  apiRequest,
  getCurrentPage,
  recalcParentTextFromChildren: (...args) =>
    recalcParentTextFromChildren(...args),
  renderAll,
});

let annotationHierarchyTools = null;

const headingTools = window.createHeadingTools({
  state,
  refs,
  escapeHtml,
  isEditor,
  getCurrentPage,
  getSelectedAnnotation,
  saveArticleMeta,
  apiRequest,
  normalizeArticleId,
  renderAll,
  resetCanvasView,
  joinCurrentPageRoom,
});

/**
 * @description 处理levellabel相关逻辑。
 * @param {*} level level参数。
 * @returns {*} label结果。
 */
function levelLabel(level) {
  return headingTools.levelLabel(level);
}

/**
 * @description 处理addheadingselection相关逻辑。
 * @returns {*} headingselection结果。
 */
async function addHeadingFromSelection() {
  return headingTools.addHeadingFromSelection();
}

/**
 * @description 渲染headingindex。
 * @returns {void} 无返回值。
 */
function renderHeadingIndex() {
  return headingTools.renderHeadingIndex();
}

/**
 * @description 渲染headingaddtip。
 * @returns {void} 无返回值。
 */
function renderHeadingAddTip() {
  return headingTools.renderHeadingAddTip();
}

annotationHierarchyTools = window.createAnnotationHierarchyTools({
  state,
  refs,
  escapeHtml,
  isEditor,
  canReview,
  apiRequest,
  getCurrentPage,
  getAnnotationById,
  levelLabel,
  renderAll,
  scheduleAnnotationPersist,
  annotationSaveTimers,
  setReviewStatus: (...args) => setReviewStatus(...args),
});

/**
 * @description 构建annotationlist。
 * @returns {*} annotationlist结果。
 */
function buildAnnotationList() {
  return annotationHierarchyTools.buildAnnotationList();
}

/**
 * @description 处理reparentannotation相关逻辑。
 * @param {*} childId 子级 ID。
 * @param {*} newParentId newparent ID。
 * @returns {*} annotation结果。
 */
async function reparentAnnotation(childId, newParentId) {
  return annotationHierarchyTools.reparentAnnotation(childId, newParentId);
}

/**
 * @description 处理reorderannotation相关逻辑。
 * @param {*} draggedId dragged ID。
 * @param {*} targetId target ID。
 * @param {*} position position参数。
 * @returns {*} annotation结果。
 */
async function reorderAnnotation(draggedId, targetId, position) {
  return annotationHierarchyTools.reorderAnnotation(
    draggedId,
    targetId,
    position,
  );
}

/**
 * @description 处理recalcparenttextchildren相关逻辑。
 * @param {*} parentId 父级 ID。
 * @returns {*} parenttextchildren结果。
 */
function recalcParentTextFromChildren(parentId) {
  return annotationHierarchyTools.recalcParentTextFromChildren(parentId);
}

const annotationFormTools = window.createAnnotationFormTools({
  state,
  refs,
  escapeHtml,
  isEditor,
  getSelectedAnnotation,
  fillGlyphRefControl,
  drawOverlay,
  scheduleAnnotationPersist,
  recalcParentTextFromChildren,
  buildAnnotationList,
  removeSelectedAnnotation,
  apiRequest,
  getCurrentPage,
  renderAll,
});

/**
 * @description 渲染annotationform。
 * @returns {void} 无返回值。
 */
function renderAnnotationForm() {
  return annotationFormTools.renderAnnotationForm();
}

const glyphPickerTools = window.createGlyphPickerTools({
  state,
  refs,
  escapeHtml,
  isEditor,
  getAnnotationById,
  scheduleAnnotationPersist,
  renderAnnotationForm,
  drawOverlay,
});

/**
 * @description 处理fillglyphrefcontrol相关逻辑。
 * @param {*} fragment fragment参数。
 * @param {*} glyphRefEl glyphrefel参数。
 * @param {*} ann 标注对象。
 * @returns {*} glyphrefcontrol结果。
 */
function fillGlyphRefControl(fragment, glyphRefEl, ann) {
  glyphPickerTools.fillGlyphRefControl(fragment, glyphRefEl, ann);
}

/**
 * @description 隐藏glyphpicker。
 * @returns {void} 无返回值。
 */
function hideGlyphPicker() {
  glyphPickerTools.hideGlyphPicker();
}

/**
 * @description 渲染glyphpickerlist。
 * @returns {void} 无返回值。
 */
function renderGlyphPickerList() {
  glyphPickerTools.renderGlyphPickerList();
}

const overlayRenderTools = window.createOverlayRenderTools({
  NS_SVG,
  refs,
  state,
  isEditor,
  getCurrentPage,
  getResizeHandleMetrics,
  getRegionBorderHit,
  startRegionResize,
  startRegionMove,
  flushPendingRegionEdit,
  renderAll,
  renderAnnotationForm,
});

/**
 * @description 处理drawoverlay相关逻辑。
 * @returns {*} overlay结果。
 */
function drawOverlay() {
  return overlayRenderTools.drawOverlay();
}

const pageRenderTools = window.createPageRenderTools({
  refs,
  state,
  apiRequest,
  getCurrentPage,
  resetCanvasView,
  drawOverlay,
  getCachedImageUrl,
  waitForImage,
  preloadAdjacentPages,
  buildAnnotationList,
  renderAnnotationForm,
  renderReviewStatus,
  clampCanvasView,
  applyCanvasView,
});

/**
 * @description 处理reloadpageannotations相关逻辑。
 * @param {*} page 页面对象。
 * @returns {*} pageannotations结果。
 */
async function reloadPageAnnotations(page) {
  return pageRenderTools.reloadPageAnnotations(page);
}

/**
 * @description 渲染page。
 * @returns {void} 无返回值。
 */
function renderPage() {
  return pageRenderTools.renderPage();
}

glyphLibraryTools = window.createGlyphLibraryTools({
  state,
  refs,
  escapeHtml,
  apiRequest,
  readFileAsDataUrl,
  saveArticleMeta,
  normalizeArticleId,
  renderAll,
  getCurrentPage,
  getSelectedAnnotation,
  clampValue,
  setActiveTab,
});

/**
 * @description 设置glyphcaptureimage。
 * @param {*} dataUrl dataurl参数。
 * @param {*} tipText tiptext参数。
 * @returns {*} glyphcaptureimage结果。
 */
function setGlyphCaptureImage(dataUrl, tipText) {
  return glyphLibraryTools.setGlyphCaptureImage(dataUrl, tipText);
}

/**
 * @description 处理captureglyphselection相关逻辑。
 * @returns {*} glyphselection结果。
 */
async function captureGlyphFromSelection() {
  return glyphLibraryTools.captureGlyphFromSelection();
}

/**
 * @description 渲染glyphlist。
 * @returns {void} 无返回值。
 */
function renderGlyphList() {
  return glyphLibraryTools.renderGlyphList();
}

/**
 * @description 处理addglyph相关逻辑。
 * @returns {*} glyph结果。
 */
async function addGlyph() {
  return glyphLibraryTools.addGlyph();
}

let articleAccessTools = null;
let articleSelectTools = null;

articleAccessTools = window.createArticleAccessTools({
  refs,
  state,
  apiRequest,
  escapeHtml,
});

articleSelectTools = window.createArticleSelectTools({
  refs,
  state,
  apiRequest,
  apiPath,
  escapeHtml,
  isAdmin,
  getAuthToken,
  preloadArticleFirstPages,
  loadSnapshot,
  showAppShell,
  hideAppShell,
  onManageAccess: (articleId, title) => showAccessDialog(articleId, title),
});

/**
 * @description 显示articleselect。
 * @returns {void} 无返回值。
 */
function showArticleSelect() {
  articleSelectTools.showArticleSelect();
}

/**
 * @description 隐藏articleselect。
 * @returns {void} 无返回值。
 */
function hideArticleSelect() {
  articleSelectTools.hideArticleSelect();
}

/**
 * @description 处理backarticleselect相关逻辑。
 * @returns {*} articleselect结果。
 */
function backToArticleSelect() {
  articleSelectTools.backToArticleSelect();
}

/**
 * @description 创建newarticle。
 * @returns {*} newarticle结果。
 */
async function createNewArticle() {
  await articleSelectTools.createNewArticle();
}

/**
 * @description 处理exportarticlexml相关逻辑。
 * @param {*} articleId 文章 ID。
 * @param {*} title title参数。
 * @returns {*} articlexml结果。
 */
async function exportArticleXml(articleId, title) {
  await articleSelectTools.exportArticleXml(articleId, title);
}

/**
 * @description 显示accessdialog。
 * @param {*} articleId 文章 ID。
 * @param {*} title title参数。
 * @returns {void} 无返回值。
 */
async function showAccessDialog(articleId, title) {
  await articleAccessTools.showAccessDialog(articleId, title);
}

/**
 * @description 隐藏accessdialog。
 * @returns {void} 无返回值。
 */
function hideAccessDialog() {
  articleAccessTools.hideAccessDialog();
}

/**
 * @description 处理grantaccess相关逻辑。
 * @returns {*} access结果。
 */
async function grantAccess() {
  await articleAccessTools.grantAccess();
}

/**
 * @description 创建invite。
 * @returns {*} invite结果。
 */
async function createInvite() {
  await articleAccessTools.createInvite();
}

let reviewStatusTools = null;

reviewStatusTools = window.createReviewStatusTools({
  state,
  refs,
  escapeHtml,
  apiRequest,
  getSelectedAnnotation,
  drawOverlay,
  buildAnnotationList,
});

/**
 * @description 渲染reviewstatus。
 * @returns {void} 无返回值。
 */
function renderReviewStatus() {
  return reviewStatusTools.renderReviewStatus();
}

/**
 * @description 设置reviewstatus。
 * @param {*} annotationIdOrStatus annotationidstatus参数。
 * @param {*} statusArg statusarg参数。
 * @returns {*} reviewstatus结果。
 */
async function setReviewStatus(annotationIdOrStatus, statusArg) {
  return reviewStatusTools.setReviewStatus(annotationIdOrStatus, statusArg);
}

/**
 * @description 处理exportglyphjson相关逻辑。
 * @returns {*} glyphjson结果。
 */
function exportGlyphJson() {
  return glyphLibraryTools.exportGlyphJson();
}

/**
 * @description 处理importglyphjson相关逻辑。
 * @param {*} event 浏览器事件对象。
 * @returns {*} glyphjson结果。
 */
async function importGlyphJson(event) {
  return glyphLibraryTools.importGlyphJson(event);
}

const { updateAiButtonStates, aiRecognizeSelected } = window.createAiTools({
  refs,
  state,
  uid,
  apiRequest,
  getCurrentPage,
  getSelectedAnnotation,
  renderAnnotationForm,
  scheduleAnnotationPersist,
  recalcParentTextFromChildren,
  annotationSaveTimers,
  renderAll,
});

const uiEventBindingsTools = window.createUiEventBindingsTools({
  state,
  refs,
  normalizeArticleId,
  loadSnapshot,
  updateArticleMetaFromForm,
  scheduleSaveArticleMeta,
  doLogin,
  doInviteRegister,
  showInviteLoginMode,
  showInviteRegisterMode,
  doLogout,
  backToArticleSelect,
  createNewArticle,
  showUserManageDialog,
  hideAccessDialog,
  grantAccess,
  createInvite,
  hideUserManageDialog,
  hideGlyphPicker,
  renderGlyphPickerList,
  createNewUser,
  aiRecognizeSelected,
  setActiveTab,
  addHeadingFromSelection,
  handleImageUpload,
  clearAllPages,
  exportArticleXml,
  switchPage,
  jumpToPage,
  setCanvasZoom,
  resetCanvasView,
  handleCanvasWheel,
  beginDraw,
  moveDraw,
  finishDraw,
  updateSvgCursor,
  endCanvasPan,
  addGlyph,
  captureGlyphFromSelection,
  setGlyphCaptureImage,
  exportGlyphJson,
  importGlyphJson,
  clampCanvasView,
  applyCanvasView,
  drawOverlay,
});

/**
 * @description 绑定events。
 * @returns {void} 无返回值。
 */
function bindEvents() {
  return uiEventBindingsTools.bindEvents();
}

/**
 * @description 处理ensurepagejumpcontrols相关逻辑。
 * @returns {void} 无返回值。
 */
function ensurePageJumpControls() {
  if (refs.pageJumpInput && refs.btnPageJump) return;
  if (!refs.pageIndicator || !refs.pageIndicator.parentElement) return;

  const input = document.createElement("input");
  input.id = "page-jump-input";
  input.type = "number";
  input.min = "1";
  input.step = "1";
  input.placeholder = "页码";

  const button = document.createElement("button");
  button.id = "btn-page-jump";
  button.type = "button";
  button.textContent = "跳转";

  refs.pageIndicator.parentElement.appendChild(input);
  refs.pageIndicator.parentElement.appendChild(button);
  refs.pageJumpInput = input;
  refs.btnPageJump = button;
}

/**
 * @description 处理jumppage相关逻辑。
 * @param {*} pageNumber pagenumber参数。
 * @returns {*} page结果。
 */
function jumpToPage(pageNumber) {
  const targetIndex = Number(pageNumber) - 1;
  if (!Number.isInteger(targetIndex)) {
    alert("请输入有效的页码。");
    return;
  }
  if (targetIndex < 0 || targetIndex >= state.pages.length) {
    alert(`页码必须在 1 到 ${state.pages.length || 1} 之间。`);
    return;
  }
  const delta = targetIndex - state.currentPageIndex;
  if (delta === 0) return;
  switchPage(delta);
}

/**
 * @description 刷新当前页面相关的主要渲染区域。
 * @param {*} opts opts参数。
 * @returns {void} 无返回值。
 */
function renderAll(opts = {}) {
  renderPage();
  renderHeadingAddTip();
  renderHeadingIndex();
  if (!opts.skipFormRebuild) renderAnnotationForm();
  renderReviewStatus();
  buildAnnotationList();
  renderGlyphList();
  updateAiButtonStates();
}

let socketCollab = null;

socketCollab = window.createSocketCollabTools({
  refs,
  state,
  io,
  escapeHtml,
  getAuthToken,
  removeAuthToken,
  showLoginOverlay,
  getCurrentPage,
  apiRequest,
  drawOverlay,
  renderHeadingIndex,
  renderHeadingAddTip,
  buildAnnotationList,
  renderAnnotationForm,
  renderReviewStatus,
  renderAll,
  annotationSaveTimers,
  setSocket: (value) => {
    socket = value;
  },
  getSocket: () => socket,
});

/**
 * @description 处理initsocket相关逻辑。
 * @returns {*} socket结果。
 */
function initSocket() {
  socketCollab.initSocket();
}

/**
 * @description 加入currentarticleroom。
 * @returns {void} 无返回值。
 */
function joinCurrentArticleRoom() {
  socketCollab.joinCurrentArticleRoom();
}

/**
 * @description 加入currentpageroom。
 * @returns {void} 无返回值。
 */
function joinCurrentPageRoom() {
  socketCollab.joinCurrentPageRoom();
}

/**
 * @description 执行前端应用启动流程并完成模块装配。
 * @returns {*} 处理结果。
 */
async function bootstrap() {
  ensurePageJumpControls();
  bindEvents();
  setGlyphCaptureImage("");

  const authenticated = await checkAuth();
  if (!authenticated) {
    return;
  }

  renderAll();
}

bootstrap().catch((error) => {
  alert(`初始化失败：${error.message}`);
});

