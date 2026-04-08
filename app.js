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
  hideLoginOverlay,
  showAppShell,
  hideAppShell,
  doLogin,
  doInviteRegister,
  showInviteLoginMode,
  showInviteRegisterMode,
  doLogout,
  checkAuth,
  updateUserBar,
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
  preloadImage,
  getCachedImageUrl,
  waitForImage,
  preloadAdjacentPages,
  preloadArticleFirstPages,
} = window.createImageCache(apiRequest);
const {
  showUserManageDialog,
  hideUserManageDialog,
  loadUserList,
  createNewUser,
  changeUserRole,
  resetUserPassword,
  deleteUserById,
} = window.createUserManagement({
  refs,
  apiRequest,
  escapeHtml,
});

let appStateTools = null;

function syncMetaInputsFromState() {
  return appStateTools.syncMetaInputsFromState();
}

function updateArticleMetaFromForm() {
  return appStateTools.updateArticleMetaFromForm();
}

async function saveArticleMeta() {
  return appStateTools.saveArticleMeta();
}

function scheduleSaveArticleMeta() {
  return appStateTools.scheduleSaveArticleMeta();
}

async function loadSnapshot(articleId) {
  return appStateTools.loadSnapshot(articleId);
}

function setActiveTab(tabName) {
  return appStateTools.setActiveTab(tabName);
}

function createPageFromImage(src, name, width, height) {
  return appStateTools.createPageFromImage(src, name, width, height);
}

const {
  isPdfFile,
  isImageFile,
  readFileAsDataUrl,
  imageUrlToDataUrl,
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

function loadImageBySrc(src) {
  return pageImportTools.loadImageBySrc(src);
}

async function persistNewPages(importedPages) {
  return pageImportTools.persistNewPages(importedPages);
}

async function handleImageUpload(event) {
  return pageImportTools.handleImageUpload(event);
}

async function clearAllPages() {
  return pageImportTools.clearAllPages();
}

const {
  getCurrentPage,
  switchPage,
  getCanvasViewBounds,
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
  getResizeCursorByHandle,
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
  updateRegionMove,
  updateRegionResize,
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

function scheduleAnnotationPersist(ann) {
  return annotationSelectionTools.scheduleAnnotationPersist(ann);
}

async function removeSelectedAnnotation() {
  return annotationSelectionTools.removeSelectedAnnotation();
}

function getSelectedAnnotation() {
  return annotationSelectionTools.getSelectedAnnotation();
}

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

function levelLabel(level) {
  return headingTools.levelLabel(level);
}

async function addHeadingFromSelection() {
  return headingTools.addHeadingFromSelection();
}

function renderHeadingIndex() {
  return headingTools.renderHeadingIndex();
}

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

function buildAnnotationList() {
  return annotationHierarchyTools.buildAnnotationList();
}

async function reparentAnnotation(childId, newParentId) {
  return annotationHierarchyTools.reparentAnnotation(childId, newParentId);
}

async function reorderAnnotation(draggedId, targetId, position) {
  return annotationHierarchyTools.reorderAnnotation(
    draggedId,
    targetId,
    position,
  );
}

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

function getGlyphById(glyphId) {
  return glyphPickerTools.getGlyphById(glyphId);
}

function glyphDisplayText(glyph) {
  return glyphPickerTools.glyphDisplayText(glyph);
}

function fillGlyphRefControl(fragment, glyphRefEl, ann) {
  glyphPickerTools.fillGlyphRefControl(fragment, glyphRefEl, ann);
}

function openGlyphPickerForAnnotation(annotationId) {
  glyphPickerTools.openGlyphPickerForAnnotation(annotationId);
}

function hideGlyphPicker() {
  glyphPickerTools.hideGlyphPicker();
}

function clearGlyphRefForAnnotation(annotationId) {
  glyphPickerTools.clearGlyphRefForAnnotation(annotationId);
}

function applyGlyphToCurrentAnnotation(glyphId) {
  glyphPickerTools.applyGlyphToCurrentAnnotation(glyphId);
}

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

function buildShapeElement(ann, page, selected) {
  return overlayRenderTools.buildShapeElement(ann, page, selected);
}

function buildResizeHandles(annotationId, region, page) {
  return overlayRenderTools.buildResizeHandles(annotationId, region, page);
}

function getVisibleAnnotationIds() {
  return overlayRenderTools.getVisibleAnnotationIds();
}

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

async function reloadPageAnnotations(page) {
  return pageRenderTools.reloadPageAnnotations(page);
}

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

function setGlyphCaptureImage(dataUrl, tipText) {
  return glyphLibraryTools.setGlyphCaptureImage(dataUrl, tipText);
}

async function captureGlyphFromSelection() {
  return glyphLibraryTools.captureGlyphFromSelection();
}

function renderGlyphList() {
  return glyphLibraryTools.renderGlyphList();
}

async function deleteGlyph(glyph) {
  return glyphLibraryTools.deleteGlyph(glyph);
}

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

function showArticleSelect() {
  articleSelectTools.showArticleSelect();
}

function hideArticleSelect() {
  articleSelectTools.hideArticleSelect();
}

async function loadArticleList() {
  await articleSelectTools.loadArticleList();
}

function renderArticleGrid() {
  articleSelectTools.renderArticleGrid();
}

async function openArticle(articleId) {
  await articleSelectTools.openArticle(articleId);
}

function backToArticleSelect() {
  articleSelectTools.backToArticleSelect();
}

async function createNewArticle() {
  await articleSelectTools.createNewArticle();
}

async function exportArticleXml(articleId, title) {
  await articleSelectTools.exportArticleXml(articleId, title);
}

async function showAccessDialog(articleId, title) {
  await articleAccessTools.showAccessDialog(articleId, title);
}

function hideAccessDialog() {
  articleAccessTools.hideAccessDialog();
}

async function loadAccessList(articleId) {
  await articleAccessTools.loadAccessList(articleId);
}

function renderAccessList(users) {
  articleAccessTools.renderAccessList(users);
}

async function grantAccess() {
  await articleAccessTools.grantAccess();
}

async function createInvite() {
  await articleAccessTools.createInvite();
}

async function revokeAccess(userId) {
  await articleAccessTools.revokeAccess(userId);
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

function renderReviewStatus() {
  return reviewStatusTools.renderReviewStatus();
}

async function setReviewStatus(annotationIdOrStatus, statusArg) {
  return reviewStatusTools.setReviewStatus(annotationIdOrStatus, statusArg);
}

function exportGlyphJson() {
  return glyphLibraryTools.exportGlyphJson();
}

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

function bindMetaInputs() {
  return uiEventBindingsTools.bindMetaInputs();
}

function bindEvents() {
  return uiEventBindingsTools.bindEvents();
}

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

function initSocket() {
  socketCollab.initSocket();
}

function joinCurrentArticleRoom() {
  socketCollab.joinCurrentArticleRoom();
}

function joinCurrentPageRoom() {
  socketCollab.joinCurrentPageRoom();
}

async function refreshCurrentPageAnnotations() {
  await socketCollab.refreshCurrentPageAnnotations();
}

function handleRemoteAnnotationCreated(payload) {
  socketCollab.handleRemoteAnnotationCreated(payload);
}

function handleRemoteAnnotationUpdated(payload) {
  socketCollab.handleRemoteAnnotationUpdated(payload);
}

function handleRemoteAnnotationDeleted(payload) {
  socketCollab.handleRemoteAnnotationDeleted(payload);
}

function handleRemoteGlyphCreated(payload) {
  socketCollab.handleRemoteGlyphCreated(payload);
}

function handleRemoteGlyphDeleted(payload) {
  socketCollab.handleRemoteGlyphDeleted(payload);
}

function handleRemoteGlyphImported(payload) {
  socketCollab.handleRemoteGlyphImported(payload);
}

function handlePresenceJoin(payload) {
  socketCollab.handlePresenceJoin(payload);
}

function handlePresenceLeave(payload) {
  socketCollab.handlePresenceLeave(payload);
}

function handlePresenceMembers(payload) {
  socketCollab.handlePresenceMembers(payload);
}

function renderPresenceBar() {
  socketCollab.renderPresenceBar();
}

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
