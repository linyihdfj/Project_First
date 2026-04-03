const NS_SVG = "http://www.w3.org/2000/svg";
const API_BASE = "/api";
const MIN_REGION_SIZE = 8;

const state = {
  currentUser: null,
  article: {
    id: "article-1",
    type: "1",
    version: "1.0",
    title: "周易注",
    subtitle: "卷一",
    author: "王弼",
    book: "周易注",
    volume: "卷一",
    publishYear: "AD249",
    writingYear: "AD240",
  },
  pages: [],
  currentPageIndex: -1,
  selectedAnnotationId: null,
  selectedHeadingId: null,
  drawing: null,
  canvasView: {
    zoom: 1,
    minZoom: 1,
    maxZoom: 4,
    offsetX: 0,
    offsetY: 0,
    isPanning: false,
    panStartClientX: 0,
    panStartClientY: 0,
    panOriginX: 0,
    panOriginY: 0,
  },
  glyphs: [],
  headings: [],
  headingExpandedState: {}, // 记录标题的展开/折叠状态: { headingId: true/false }
  headingDragState: {
    draggedHeadingId: null,
  },
  glyphCaptureDataUrl: "",
  articleList: [],
  accessArticleId: null,
  presenceUsers: [],
  addingRegionForAnnotation: null, // annotationId when in add-region draw mode
  selectedRegionId: null, // 选中的区域ID，仅显示该区域
  regionResize: null,
  glyphPicker: {
    annotationId: null,
    query: "",
  },
};

// ── 图片预加载缓存 ──
// 使用 Blob URL 在内存中缓存图片，切换页面时无需重新请求网络
const imageCache = new Map(); // src -> blobUrl
const imageCacheLoading = new Map(); // src -> Promise<blobUrl>

function preloadImage(src) {
  if (!src || imageCache.has(src) || imageCacheLoading.has(src)) return;
  const promise = fetch(src)
    .then((res) => res.blob())
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      imageCache.set(src, blobUrl);
      imageCacheLoading.delete(src);
      return blobUrl;
    })
    .catch(() => {
      imageCacheLoading.delete(src);
      return null;
    });
  imageCacheLoading.set(src, promise);
}

function getCachedImageUrl(src) {
  return imageCache.get(src) || src;
}

async function waitForImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  if (imageCacheLoading.has(src)) return await imageCacheLoading.get(src);
  return src;
}

function preloadAdjacentPages(currentIndex, pages, range = 3) {
  const start = Math.max(0, currentIndex - range);
  const end = Math.min(pages.length - 1, currentIndex + range);
  for (let i = start; i <= end; i++) {
    if (pages[i] && pages[i].src) {
      preloadImage(pages[i].src);
    }
  }
}

async function preloadArticleFirstPages(articles) {
  for (const article of articles) {
    try {
      const data = await apiRequest(
        `/articles/${encodeURIComponent(article.id)}/page-srcs?limit=3`,
      );
      (data.srcs || []).forEach(preloadImage);
    } catch (e) {
      // 预加载失败时静默忽略
    }
  }
}

const refs = {
  // Login
  loginOverlay: document.getElementById("login-overlay"),
  loginUsername: document.getElementById("login-username"),
  loginPassword: document.getElementById("login-password"),
  loginError: document.getElementById("login-error"),
  btnLogin: document.getElementById("btn-login"),
  // User bar
  userBar: document.getElementById("user-bar"),
  userDisplayName: document.getElementById("user-display-name"),
  userRoleBadge: document.getElementById("user-role-badge"),
  btnUserManage: document.getElementById("btn-user-manage"),
  btnLogout: document.getElementById("btn-logout"),
  // User management dialog
  userManageDialog: document.getElementById("user-manage-dialog"),
  btnCloseUserDialog: document.getElementById("btn-close-user-dialog"),
  glyphPickerDialog: document.getElementById("glyph-picker-dialog"),
  btnCloseGlyphPicker: document.getElementById("btn-close-glyph-picker"),
  glyphPickerSearch: document.getElementById("glyph-picker-search"),
  glyphPickerList: document.getElementById("glyph-picker-list"),
  newUserUsername: document.getElementById("new-user-username"),
  newUserPassword: document.getElementById("new-user-password"),
  newUserDisplayName: document.getElementById("new-user-display-name"),
  newUserRole: document.getElementById("new-user-role"),
  btnCreateUser: document.getElementById("btn-create-user"),
  userList: document.getElementById("user-list"),
  // Review
  reviewStatusSection: document.getElementById("review-status-section"),
  reviewStatusDisplay: document.getElementById("review-status-display"),
  // Edit controls (for permission hiding)
  toolbarEditControls: document.getElementById("toolbar-edit-controls"),
  toolbarAnnotationControls: document.getElementById(
    "toolbar-annotation-controls",
  ),
  headingAddSection: document.getElementById("heading-add-section"),
  metaForm: document.getElementById("meta-form"),
  // Tabs and panes
  tabs: Array.from(document.querySelectorAll(".tab")),
  panes: {
    editor: document.getElementById("tab-editor"),
    article: document.getElementById("tab-article"),
    glyph: document.getElementById("tab-glyph"),
  },
  imageUpload: document.getElementById("image-upload"),
  btnClearPages: document.getElementById("btn-clear-pages"),
  btnPrevPage: document.getElementById("btn-prev-page"),
  btnNextPage: document.getElementById("btn-next-page"),
  headingTitleInput: document.getElementById("heading-title-input"),
  headingDropRootZone: document.getElementById("heading-drop-root-zone"),
  btnAddHeading: document.getElementById("btn-add-heading"),
  headingAddTip: document.getElementById("heading-add-tip"),
  headingIndexList: document.getElementById("heading-index-list"),
  btnZoomOut: document.getElementById("btn-zoom-out"),
  btnZoomReset: document.getElementById("btn-zoom-reset"),
  btnZoomIn: document.getElementById("btn-zoom-in"),
  pageIndicator: document.getElementById("page-indicator"),
  canvasMeta: document.getElementById("canvas-meta"),
  canvasViewport: document.getElementById("canvas-viewport"),
  pageImage: document.getElementById("page-image"),
  canvasStage: document.getElementById("canvas-stage"),
  annotationSvg: document.getElementById("annotation-svg"),
  annotationLevel: document.getElementById("annotation-level"),
  annotationForm: document.getElementById("annotation-form"),
  annotationFormTemplate: document.getElementById("annotation-form-template"),
  annotationList: document.getElementById("annotation-list"),
  btnExportGlyph: document.getElementById("btn-export-glyph"),
  glyphImportFile: document.getElementById("glyph-import-file"),
  glyphCode: document.getElementById("glyph-code"),
  glyphName: document.getElementById("glyph-name"),
  glyphNote: document.getElementById("glyph-note"),
  glyphImage: document.getElementById("glyph-image"),
  btnCaptureGlyph: document.getElementById("btn-capture-glyph"),
  btnClearCapturedGlyph: document.getElementById("btn-clear-captured-glyph"),
  glyphCaptureTip: document.getElementById("glyph-capture-tip"),
  glyphCapturePreviewWrap: document.getElementById(
    "glyph-capture-preview-wrap",
  ),
  glyphCapturePreview: document.getElementById("glyph-capture-preview"),
  btnAddGlyph: document.getElementById("btn-add-glyph"),
  glyphList: document.getElementById("glyph-list"),
  metaArticleId: document.getElementById("meta-article-id"),
  metaTitle: document.getElementById("meta-title"),
  metaSubtitle: document.getElementById("meta-subtitle"),
  metaAuthor: document.getElementById("meta-author"),
  metaBook: document.getElementById("meta-book"),
  metaVolume: document.getElementById("meta-volume"),
  metaPublishYear: document.getElementById("meta-publish-year"),
  metaWritingYear: document.getElementById("meta-writing-year"),
  btnExportXml: document.getElementById("btn-export-xml"),
  // Article select
  articleSelectOverlay: document.getElementById("article-select-overlay"),
  articleGrid: document.getElementById("article-grid"),
  articleCreateSection: document.getElementById("article-create-section"),
  newArticleTitle: document.getElementById("new-article-title"),
  newArticleSubtitle: document.getElementById("new-article-subtitle"),
  newArticleAuthor: document.getElementById("new-article-author"),
  btnCreateArticle: document.getElementById("btn-create-article"),
  btnBackToSelect: document.getElementById("btn-back-to-select"),
  selectUserDisplayName: document.getElementById("select-user-display-name"),
  selectUserRoleBadge: document.getElementById("select-user-role-badge"),
  btnSelectUserManage: document.getElementById("btn-select-user-manage"),
  btnSelectLogout: document.getElementById("btn-select-logout"),
  // Article access dialog
  articleAccessDialog: document.getElementById("article-access-dialog"),
  btnCloseAccessDialog: document.getElementById("btn-close-access-dialog"),
  accessArticleTitle: document.getElementById("access-article-title"),
  accessUserSelect: document.getElementById("access-user-select"),
  btnGrantAccess: document.getElementById("btn-grant-access"),
  accessUserList: document.getElementById("access-user-list"),
  // AI controls
  btnAiOcrRegion: document.getElementById("btn-ai-ocr-region"),
};

const PDF_JS_SOURCES = [
  {
    lib: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    worker:
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  },
  {
    lib: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
    worker:
      "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
  },
  {
    lib: "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js",
    worker: "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
  },
];

let pdfJsLoadingPromise = null;
let activePdfWorkerSrc = PDF_JS_SOURCES[0].worker;
let metaSaveTimer = null;
const annotationSaveTimers = new Map();
let socket = null;

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeArticleId(value) {
  return String(value || "").trim() || "article-1";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function apiPath(pathname) {
  return `${API_BASE}${pathname}`;
}

function getAuthToken() {
  return localStorage.getItem("sdudoc_token") || "";
}

function setAuthToken(token) {
  localStorage.setItem("sdudoc_token", token);
}

function removeAuthToken() {
  localStorage.removeItem("sdudoc_token");
}

async function apiRequest(pathname, options = {}) {
  const method = options.method || "GET";
  const init = {
    method,
    headers: {},
  };

  const token = getAuthToken();
  if (token) {
    init.headers["Authorization"] = `Bearer ${token}`;
  }
  if (socket && socket.id) {
    init.headers["X-Socket-Id"] = socket.id;
  }

  if (options.body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(apiPath(pathname), init);
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (response.status === 401) {
    removeAuthToken();
    state.currentUser = null;
    showLoginOverlay();
    throw new Error(payload && payload.message ? payload.message : "未登录");
  }

  if (!response.ok || !payload || payload.ok === false) {
    const message =
      payload && payload.message
        ? payload.message
        : `请求失败: ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function syncMetaInputsFromState() {
  refs.metaArticleId.value = state.article.id;
  refs.metaTitle.value = state.article.title;
  refs.metaSubtitle.value = state.article.subtitle;
  refs.metaAuthor.value = state.article.author;
  refs.metaBook.value = state.article.book;
  refs.metaVolume.value = state.article.volume;
  refs.metaPublishYear.value = state.article.publishYear;
  refs.metaWritingYear.value = state.article.writingYear;
}

function updateArticleMetaFromForm() {
  state.article.id = normalizeArticleId(refs.metaArticleId.value);
  state.article.title = refs.metaTitle.value.trim();
  state.article.subtitle = refs.metaSubtitle.value.trim();
  state.article.author = refs.metaAuthor.value.trim();
  state.article.book = refs.metaBook.value.trim();
  state.article.volume = refs.metaVolume.value.trim();
  state.article.publishYear = refs.metaPublishYear.value.trim();
  state.article.writingYear = refs.metaWritingYear.value.trim();
}

async function saveArticleMeta() {
  updateArticleMetaFromForm();
  const articleId = normalizeArticleId(state.article.id);
  state.article.id = articleId;
  const payload = await apiRequest(
    `/articles/${encodeURIComponent(articleId)}`,
    {
      method: "PUT",
      body: state.article,
    },
  );
  state.article = payload.article;
  syncMetaInputsFromState();
}

function scheduleSaveArticleMeta() {
  if (metaSaveTimer) {
    clearTimeout(metaSaveTimer);
  }
  metaSaveTimer = window.setTimeout(() => {
    saveArticleMeta().catch((error) => alert(error.message));
  }, 450);
}

async function loadSnapshot(articleId) {
  const payload = await apiRequest(
    `/articles/${encodeURIComponent(articleId)}/snapshot`,
  );
  state.article = payload.article;
  state.pages = payload.pages || [];
  state.glyphs = payload.glyphs || [];
  state.headings = payload.headings || [];
  state.currentPageIndex = state.pages.length ? 0 : -1;
  state.selectedAnnotationId = null;
  state.selectedHeadingId = null;
  resetCanvasView();
  syncMetaInputsFromState();
  renderAll();
  joinCurrentArticleRoom();
  joinCurrentPageRoom();
  // 预加载当前页附近的页面图片
  if (state.pages.length > 0) {
    preloadAdjacentPages(0, state.pages);
  }
}

function setActiveTab(tabName) {
  refs.tabs.forEach((tab) => {
    const active = tab.dataset.tab === tabName;
    tab.classList.toggle("active", active);
  });
  Object.entries(refs.panes).forEach(([name, pane]) => {
    pane.classList.toggle("active", name === tabName);
  });
}

function createPageFromImage(src, name, width, height) {
  return {
    id: uid("page"),
    pageNo: 0,
    name,
    src,
    width,
    height,
    annotations: [],
  };
}

function isPdfFile(file) {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  return name.endsWith(".pdf") || type === "application/pdf";
}

function isImageFile(file) {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return (
    type.startsWith("image/") || /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(name)
  );
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("读取文件失败"));
    reader.readAsArrayBuffer(file);
  });
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("读取文件失败"));
    reader.readAsDataURL(blob);
  });
}

async function imageUrlToDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`示例图片读取失败: ${url}`);
  }
  const blob = await response.blob();
  return readBlobAsDataUrl(blob);
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const exists = document.querySelector(`script[data-src="${src}"]`);
    if (exists) {
      if (exists.dataset.loaded === "1") {
        resolve();
      } else {
        exists.addEventListener("load", () => resolve(), { once: true });
        exists.addEventListener(
          "error",
          () => reject(new Error(`脚本加载失败: ${src}`)),
          { once: true },
        );
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.src = src;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "1";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => reject(new Error(`脚本加载失败: ${src}`)),
      { once: true },
    );
    document.head.appendChild(script);
  });
}

async function loadPdfJsFromAnyCdn() {
  let lastError = null;

  for (const source of PDF_JS_SOURCES) {
    try {
      await loadScriptOnce(source.lib);
      activePdfWorkerSrc = source.worker;
      return;
    } catch (error) {
      lastError = error;
      console.warn(`PDF 引擎 CDN 加载失败: ${source.lib}`);
    }
  }

  throw lastError || new Error("PDF 引擎脚本加载失败");
}

function isWorkerLikelyBlocked(error) {
  const message = String((error && error.message) || error || "");
  return /worker|cross-origin|origin|Failed to construct 'Worker'|Cannot load script/i.test(
    message,
  );
}

async function loadPdfDocument(pdfjsLib, buffer) {
  const data = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;

  if (window.location.protocol === "file:") {
    return pdfjsLib.getDocument({ data, disableWorker: true }).promise;
  }

  try {
    return await pdfjsLib.getDocument({ data }).promise;
  } catch (error) {
    if (!isWorkerLikelyBlocked(error)) {
      throw error;
    }
    console.warn("PDF Worker 不可用，回退为主线程解析。", error);
    return pdfjsLib.getDocument({ data, disableWorker: true }).promise;
  }
}

async function ensurePdfJsLoaded() {
  if (window.pdfjsLib && window.pdfjsLib.getDocument) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = activePdfWorkerSrc;
    return window.pdfjsLib;
  }

  if (!pdfJsLoadingPromise) {
    pdfJsLoadingPromise = loadPdfJsFromAnyCdn()
      .then(() => {
        if (!window.pdfjsLib || !window.pdfjsLib.getDocument) {
          throw new Error("PDF 引擎初始化失败");
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = activePdfWorkerSrc;
        return window.pdfjsLib;
      })
      .finally(() => {
        pdfJsLoadingPromise = null;
      });
  }

  return pdfJsLoadingPromise;
}

async function extractPdfPagesAsImages(file, options = {}) {
  const { onProgress } = options;
  const pdfjsLib = await ensurePdfJsLoaded();
  const buffer = await readFileAsArrayBuffer(file);
  const pdf = await loadPdfDocument(pdfjsLib, buffer);
  const pages = [];
  const total = pdf.numPages;

  for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.8 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    const src = canvas.toDataURL("image/png");
    pages.push(
      createPageFromImage(
        src,
        `${file.name} - 第${pageNumber}页`,
        canvas.width,
        canvas.height,
      ),
    );

    if (typeof onProgress === "function") {
      onProgress({
        fileName: file.name,
        current: pageNumber,
        total,
      });
    }
  }

  return pages;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImageBySrc(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        src,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    img.onerror = () => reject(new Error(`无法加载图片: ${src}`));
    img.src = src;
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`无法加载图片: ${src}`));
    img.src = src;
  });
}

function setGlyphCaptureImage(dataUrl, tipText) {
  state.glyphCaptureDataUrl = dataUrl || "";

  if (refs.glyphCaptureTip) {
    refs.glyphCaptureTip.textContent =
      tipText ||
      "先在编辑器页框选并选中一个“字”，再点击“从当前标注截取字样图”。";
  }

  if (!refs.glyphCapturePreviewWrap || !refs.glyphCapturePreview) {
    return;
  }

  if (state.glyphCaptureDataUrl) {
    refs.glyphCapturePreview.src = state.glyphCaptureDataUrl;
    refs.glyphCapturePreviewWrap.hidden = false;
  } else {
    refs.glyphCapturePreview.removeAttribute("src");
    refs.glyphCapturePreviewWrap.hidden = true;
  }
}

async function captureGlyphFromSelection() {
  const page = getCurrentPage();
  const ann = getSelectedAnnotation();

  if (!page || !ann) {
    throw new Error("请先在编辑器中框选并选中一个标注，再执行截取");
  }

  const region = (ann.regions || [])[0];
  if (!region || Number(region.width) < 2 || Number(region.height) < 2) {
    throw new Error("当前标注范围过小，无法截取字样图");
  }

  const image = await loadImageElement(page.src);
  const maxW = image.naturalWidth || page.width;
  const maxH = image.naturalHeight || page.height;

  const sx = clampValue(Math.round(region.x), 0, Math.max(0, maxW - 1));
  const sy = clampValue(Math.round(region.y), 0, Math.max(0, maxH - 1));
  const sw = clampValue(Math.round(region.width), 1, Math.max(1, maxW - sx));
  const sh = clampValue(Math.round(region.height), 1, Math.max(1, maxH - sy));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("浏览器不支持画布裁剪");
  }

  context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  const captured = canvas.toDataURL("image/png");

  setGlyphCaptureImage(
    captured,
    `已截取字样图 (${sw}x${sh})，可直接点击“加入造字库”保存`,
  );
  setActiveTab("glyph");
}

async function persistNewPages(importedPages) {
  if (!importedPages.length) {
    return [];
  }
  await saveArticleMeta();
  const articleId = normalizeArticleId(state.article.id);
  const payload = importedPages.map((page) => ({
    name: page.name,
    width: page.width,
    height: page.height,
    srcDataUrl: page.src,
  }));
  const result = await apiRequest(
    `/articles/${encodeURIComponent(articleId)}/pages/bulk`,
    {
      method: "POST",
      body: { pages: payload },
    },
  );
  return result.pages || [];
}

async function handleImageUpload(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) {
    return;
  }

  const importedPages = [];
  for (const file of files) {
    if (isPdfFile(file)) {
      refs.pageIndicator.textContent = "页码: 导入中...";
      refs.canvasMeta.textContent = `正在解析 PDF：${file.name}（准备中）`;

      const pdfPages = await extractPdfPagesAsImages(file, {
        onProgress: ({ fileName, current, total }) => {
          refs.canvasMeta.textContent = `正在解析 PDF：${fileName}（${current}/${total}）`;
        },
      });
      importedPages.push(...pdfPages);
      continue;
    }

    if (isImageFile(file)) {
      const src = await readFileAsDataUrl(file);
      const info = await loadImageBySrc(src);
      importedPages.push(
        createPageFromImage(info.src, file.name, info.width, info.height),
      );
      continue;
    }

    alert(`跳过不支持的文件: ${file.name}`);
  }

  if (!importedPages.length) {
    event.target.value = "";
    return;
  }

  // 清空旧文件的所有页面和关联数据（不删除整个文章）
  if (state.pages.length > 0) {
    // 删除数据库中的所有页面、标注、标题
    await apiRequest(
      `/articles/${encodeURIComponent(state.article.id)}/pages`,
      {
        method: "DELETE",
      },
    );
  }

  // 清空内存中的旧数据
  state.pages = [];
  state.headings = [];
  state.currentPageIndex = -1;
  state.selectedAnnotationId = null;
  state.selectedHeadingId = null;
  resetCanvasView();

  // 导入新文件
  const savedPages = await persistNewPages(importedPages);
  state.pages = savedPages;
  state.currentPageIndex = state.pages.length ? 0 : -1;
  state.selectedAnnotationId = null;

  event.target.value = "";
  renderAll();
}

async function clearAllPages() {
  if (!state.pages.length) {
    return;
  }
  if (!window.confirm("确定清空所有页面与标注吗？")) {
    return;
  }
  await apiRequest(`/articles/${encodeURIComponent(state.article.id)}/pages`, {
    method: "DELETE",
  });
  state.pages = [];
  state.headings = [];
  state.currentPageIndex = -1;
  state.selectedAnnotationId = null;
  state.selectedHeadingId = null;
  resetCanvasView();
  renderAll();
}

function getCurrentPage() {
  if (
    state.currentPageIndex < 0 ||
    state.currentPageIndex >= state.pages.length
  ) {
    return null;
  }
  return state.pages[state.currentPageIndex];
}

function switchPage(step) {
  if (!state.pages.length) {
    return;
  }
  state.currentPageIndex = clampValue(
    state.currentPageIndex + step,
    0,
    state.pages.length - 1,
  );
  state.selectedAnnotationId = null;
  state.selectedHeadingId = null;
  resetCanvasView();
  renderAll();
  joinCurrentPageRoom();
}

function getCanvasViewBounds(zoomValue = state.canvasView.zoom) {
  const stageWidth = refs.canvasStage ? refs.canvasStage.clientWidth : 0;
  const stageHeight = refs.canvasStage ? refs.canvasStage.clientHeight : 0;

  const scaledWidth = stageWidth * zoomValue;
  const scaledHeight = stageHeight * zoomValue;

  return {
    stageWidth,
    stageHeight,
    minX: Math.min(0, stageWidth - scaledWidth),
    maxX: 0,
    minY: Math.min(0, stageHeight - scaledHeight),
    maxY: 0,
  };
}

function clampCanvasView(offsetX, offsetY, zoomValue = state.canvasView.zoom) {
  const bounds = getCanvasViewBounds(zoomValue);
  return {
    x: clampValue(offsetX, bounds.minX, bounds.maxX),
    y: clampValue(offsetY, bounds.minY, bounds.maxY),
  };
}

function applyCanvasView() {
  if (refs.canvasViewport) {
    refs.canvasViewport.style.transform = `translate(${state.canvasView.offsetX}px, ${state.canvasView.offsetY}px) scale(${state.canvasView.zoom})`;
  }
  if (refs.btnZoomReset) {
    refs.btnZoomReset.textContent = `${Math.round(state.canvasView.zoom * 100)}%`;
  }
}

function resetCanvasView() {
  state.canvasView.zoom = 1;
  state.canvasView.offsetX = 0;
  state.canvasView.offsetY = 0;
  state.canvasView.isPanning = false;
  if (refs.canvasStage) {
    refs.canvasStage.classList.remove("is-panning");
  }
  applyCanvasView();
}

function setCanvasZoom(nextZoom, anchorClientX, anchorClientY) {
  const oldZoom = state.canvasView.zoom;
  const zoom = clampValue(
    nextZoom,
    state.canvasView.minZoom,
    state.canvasView.maxZoom,
  );
  if (Math.abs(zoom - oldZoom) < 0.001) {
    return;
  }

  const rect = refs.canvasStage.getBoundingClientRect();
  const anchorX =
    Number.isFinite(anchorClientX) && rect.width > 0
      ? anchorClientX - rect.left
      : rect.width / 2;
  const anchorY =
    Number.isFinite(anchorClientY) && rect.height > 0
      ? anchorClientY - rect.top
      : rect.height / 2;

  const contentX = (anchorX - state.canvasView.offsetX) / oldZoom;
  const contentY = (anchorY - state.canvasView.offsetY) / oldZoom;

  const nextOffsetX = anchorX - contentX * zoom;
  const nextOffsetY = anchorY - contentY * zoom;
  const clamped = clampCanvasView(nextOffsetX, nextOffsetY, zoom);

  state.canvasView.zoom = zoom;
  state.canvasView.offsetX = clamped.x;
  state.canvasView.offsetY = clamped.y;
  applyCanvasView();
}

function panCanvasBy(deltaX, deltaY) {
  const clamped = clampCanvasView(
    state.canvasView.offsetX + deltaX,
    state.canvasView.offsetY + deltaY,
  );
  state.canvasView.offsetX = clamped.x;
  state.canvasView.offsetY = clamped.y;
  applyCanvasView();
}

function shouldStartPanning(evt) {
  return !!evt && (evt.shiftKey || evt.button === 1);
}

function beginCanvasPan(evt) {
  state.canvasView.isPanning = true;
  state.canvasView.panStartClientX = evt.clientX;
  state.canvasView.panStartClientY = evt.clientY;
  state.canvasView.panOriginX = state.canvasView.offsetX;
  state.canvasView.panOriginY = state.canvasView.offsetY;
  refs.canvasStage.classList.add("is-panning");
  evt.preventDefault();
}

function moveCanvasPan(evt) {
  if (!state.canvasView.isPanning) {
    return;
  }
  const deltaX = evt.clientX - state.canvasView.panStartClientX;
  const deltaY = evt.clientY - state.canvasView.panStartClientY;
  const clamped = clampCanvasView(
    state.canvasView.panOriginX + deltaX,
    state.canvasView.panOriginY + deltaY,
  );
  state.canvasView.offsetX = clamped.x;
  state.canvasView.offsetY = clamped.y;
  applyCanvasView();
  evt.preventDefault();
}

function endCanvasPan() {
  if (!state.canvasView.isPanning) {
    return;
  }
  state.canvasView.isPanning = false;
  refs.canvasStage.classList.remove("is-panning");
}

function handleCanvasWheel(evt) {
  if (!getCurrentPage()) {
    return;
  }

  evt.preventDefault();
  if (evt.shiftKey) {
    const deltaX = evt.deltaX !== 0 ? evt.deltaX : evt.deltaY;
    panCanvasBy(-deltaX, 0);
    return;
  }

  const factor = evt.deltaY < 0 ? 1.12 : 1 / 1.12;
  setCanvasZoom(state.canvasView.zoom * factor, evt.clientX, evt.clientY);
}

function getPointerPoint(evt) {
  const rect = refs.annotationSvg.getBoundingClientRect();
  const page = getCurrentPage();
  if (!page || rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 };
  }

  const x = ((evt.clientX - rect.left) / rect.width) * page.width;
  const y = ((evt.clientY - rect.top) / rect.height) * page.height;
  return {
    x: clampValue(x, 0, page.width),
    y: clampValue(y, 0, page.height),
  };
}

function getRegionFromAnnotation(annotationId, regionId) {
  const ann = getAnnotationById(annotationId);
  if (!ann || !Array.isArray(ann.regions)) {
    return null;
  }
  return ann.regions.find((region) => region.id === regionId) || null;
}

function syncRegionAcrossPages(annotationId, regionId, rect) {
  state.pages.forEach((page) => {
    page.annotations
      .filter((ann) => ann.id === annotationId && Array.isArray(ann.regions))
      .forEach((ann) => {
        const region = ann.regions.find((item) => item.id === regionId);
        if (!region) {
          return;
        }
        region.x = rect.x;
        region.y = rect.y;
        region.width = rect.width;
        region.height = rect.height;
      });
  });
}

function startRegionResize(evt, annotationId, regionId, handle) {
  if (!isEditor()) {
    return;
  }
  const page = getCurrentPage();
  if (!page) {
    return;
  }
  const region = getRegionFromAnnotation(annotationId, regionId);
  if (!region) {
    return;
  }

  const pt = getPointerPoint(evt);
  state.regionResize = {
    annotationId,
    regionId,
    handle,
    startX: pt.x,
    startY: pt.y,
    origin: {
      x: Number(region.x),
      y: Number(region.y),
      width: Number(region.width),
      height: Number(region.height),
    },
  };

  state.selectedAnnotationId = annotationId;
  state.selectedRegionId = regionId;
  state.selectedHeadingId = null;
  evt.preventDefault();
  evt.stopPropagation();
}

function updateRegionResize(evt) {
  if (!state.regionResize) {
    return;
  }
  const page = getCurrentPage();
  if (!page) {
    return;
  }
  const pt = getPointerPoint(evt);
  const { startX, startY, origin, handle, annotationId, regionId } =
    state.regionResize;
  const dx = pt.x - startX;
  const dy = pt.y - startY;

  let left = origin.x;
  let top = origin.y;
  let right = origin.x + origin.width;
  let bottom = origin.y + origin.height;

  if (handle.includes("w")) {
    const maxLeft = right - MIN_REGION_SIZE;
    left = clampValue(origin.x + dx, 0, maxLeft);
  }
  if (handle.includes("e")) {
    const minRight = left + MIN_REGION_SIZE;
    right = clampValue(origin.x + origin.width + dx, minRight, page.width);
  }
  if (handle.includes("n")) {
    const maxTop = bottom - MIN_REGION_SIZE;
    top = clampValue(origin.y + dy, 0, maxTop);
  }
  if (handle.includes("s")) {
    const minBottom = top + MIN_REGION_SIZE;
    bottom = clampValue(origin.y + origin.height + dy, minBottom, page.height);
  }

  const nextRect = {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top),
  };

  syncRegionAcrossPages(annotationId, regionId, nextRect);
}

function beginDraw(evt) {
  if (shouldStartPanning(evt)) {
    beginCanvasPan(evt);
    return;
  }
  if (evt.button !== 0) {
    return;
  }

  // 点击空白区域取消选择
  if (state.selectedAnnotationId || state.selectedHeadingId) {
    state.selectedAnnotationId = null;
    state.selectedHeadingId = null;
    renderAll();
  }

  if (!isEditor()) {
    return;
  }

  const page = getCurrentPage();
  if (!page) {
    return;
  }
  const pt = getPointerPoint(evt);
  state.drawing = {
    startX: pt.x,
    startY: pt.y,
    endX: pt.x,
    endY: pt.y,
  };
  drawOverlay();
}

function moveDraw(evt) {
  if (state.canvasView.isPanning) {
    moveCanvasPan(evt);
    return;
  }

  if (state.regionResize) {
    updateRegionResize(evt);
    drawOverlay();
    return;
  }

  if (!state.drawing) {
    return;
  }
  const pt = getPointerPoint(evt);
  state.drawing.endX = pt.x;
  state.drawing.endY = pt.y;
  drawOverlay();
}

async function finishDraw() {
  if (state.canvasView.isPanning) {
    endCanvasPan();
    return;
  }

  if (state.regionResize) {
    const resizeState = state.regionResize;
    state.regionResize = null;
    const region = getRegionFromAnnotation(
      resizeState.annotationId,
      resizeState.regionId,
    );
    if (!region) {
      drawOverlay();
      return;
    }

    const nextRect = {
      x: Math.round(Number(region.x)),
      y: Math.round(Number(region.y)),
      width: Math.round(Number(region.width)),
      height: Math.round(Number(region.height)),
    };
    const origin = resizeState.origin;
    const changed =
      nextRect.x !== Math.round(origin.x) ||
      nextRect.y !== Math.round(origin.y) ||
      nextRect.width !== Math.round(origin.width) ||
      nextRect.height !== Math.round(origin.height);

    if (!changed) {
      drawOverlay();
      return;
    }

    try {
      await apiRequest(
        `/annotation-regions/${encodeURIComponent(resizeState.regionId)}`,
        {
          method: "PUT",
          body: nextRect,
        },
      );
      renderAll();
    } catch (error) {
      syncRegionAcrossPages(
        resizeState.annotationId,
        resizeState.regionId,
        resizeState.origin,
      );
      drawOverlay();
      alert("调整区域失败：" + error.message);
    }
    return;
  }

  const page = getCurrentPage();
  if (!page || !state.drawing) {
    return;
  }

  const x = Math.min(state.drawing.startX, state.drawing.endX);
  const y = Math.min(state.drawing.startY, state.drawing.endY);
  const width = Math.abs(state.drawing.endX - state.drawing.startX);
  const height = Math.abs(state.drawing.endY - state.drawing.startY);
  state.drawing = null;

  if (width < 8 || height < 8) {
    drawOverlay();
    return;
  }

  // Add region mode
  if (state.addingRegionForAnnotation) {
    try {
      await apiRequest(
        `/annotations/${encodeURIComponent(state.addingRegionForAnnotation)}/regions`,
        {
          method: "POST",
          body: {
            pageId: page.id,
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(width),
            height: Math.round(height),
          },
        },
      );
      state.addingRegionForAnnotation = null;
      // 重新加载当前页的标注列表（以获取新添加的跨页标注）
      await reloadPageAnnotations(page);
      renderAll();
    } catch (error) {
      alert("添加区域失败：" + error.message);
    }
    return;
  }

  const draft = {
    id: uid("ann"),
    charId: uid("char"),
    level: refs.annotationLevel.value,
    style: "highlight",
    color: "#d5533f",
    originalText: "",
    simplifiedText: "",
    note: "",
    noteType: "1",
    charCode: "",
    glyphRef: "",
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };

  const payload = await apiRequest(
    `/pages/${encodeURIComponent(page.id)}/annotations`,
    {
      method: "POST",
      body: draft,
    },
  );
  const ann = payload.annotation;
  page.annotations.push(ann);
  state.selectedAnnotationId = ann.id;
  state.selectedHeadingId = null;
  renderAll();
}

function scheduleAnnotationPersist(ann) {
  if (!ann || !ann.id) {
    return;
  }

  const annotationId = ann.id;

  if (annotationSaveTimers.has(annotationId)) {
    clearTimeout(annotationSaveTimers.get(annotationId));
  }

  const timer = window.setTimeout(async () => {
    annotationSaveTimers.delete(annotationId);
    try {
      const latestAnn =
        state.selectedAnnotationId === annotationId
          ? getSelectedAnnotation() || getAnnotationById(annotationId)
          : getAnnotationById(annotationId);
      if (!latestAnn) {
        return;
      }
      await apiRequest(`/annotations/${encodeURIComponent(annotationId)}`, {
        method: "PUT",
        body: latestAnn,
      });
    } catch (error) {
      alert(error.message);
    }
  }, 300);

  annotationSaveTimers.set(annotationId, timer);
}

async function removeSelectedAnnotation() {
  const page = getCurrentPage();
  if (!page || !state.selectedAnnotationId) {
    return;
  }
  const removedAnnotationId = state.selectedAnnotationId;
  // 记录被删除标注的 parentId，用于删除后更新父标注文本
  const removedAnn = page.annotations.find((a) => a.id === removedAnnotationId);
  const parentId = removedAnn ? removedAnn.parentId : null;

  await apiRequest(
    `/annotations/${encodeURIComponent(state.selectedAnnotationId)}`,
    {
      method: "DELETE",
    },
  );
  // 同一标注可能因跨页父子关系出现在多个页面副本中，删除时需全局移除
  for (const p of state.pages) {
    p.annotations = p.annotations.filter(
      (ann) => ann.id !== removedAnnotationId,
    );
  }
  if (annotationSaveTimers.has(removedAnnotationId)) {
    clearTimeout(annotationSaveTimers.get(removedAnnotationId));
    annotationSaveTimers.delete(removedAnnotationId);
  }
  state.headings.forEach((heading) => {
    if (heading.annotationId === removedAnnotationId) {
      heading.annotationId = null;
    }
  });
  // 删除后自动选中父标注（而非清空选择）
  state.selectedAnnotationId = parentId || null;
  if (
    state.selectedHeadingId &&
    !state.headings.some((heading) => heading.id === state.selectedHeadingId)
  ) {
    state.selectedHeadingId = null;
  }
  // 删除子标注后更新父标注的文本（字→句→段，recalc 内部会递归向上传播）
  if (parentId) {
    recalcParentTextFromChildren(parentId);
    // 立即 flush 所有 pending persist，避免 reloadPageAnnotations 拿到旧数据
    const idsToFlush = [parentId];
    // 找到句的父段（如果有）
    let cur = null;
    for (const p of state.pages) {
      cur = p.annotations.find((a) => a.id === parentId);
      if (cur) break;
    }
    if (cur && cur.parentId) idsToFlush.push(cur.parentId);
    for (const flushId of idsToFlush) {
      if (annotationSaveTimers.has(flushId)) {
        clearTimeout(annotationSaveTimers.get(flushId));
        annotationSaveTimers.delete(flushId);
      }
      let flushAnn = null;
      for (const p of state.pages) {
        flushAnn = p.annotations.find((a) => a.id === flushId);
        if (flushAnn) break;
      }
      if (flushAnn) {
        await apiRequest(`/annotations/${encodeURIComponent(flushId)}`, {
          method: "PUT",
          body: flushAnn,
        });
      }
    }
  }
  renderAll();
}

function getSelectedAnnotation() {
  const page = getCurrentPage();
  if (!page || !state.selectedAnnotationId) {
    return null;
  }
  return (
    page.annotations.find((ann) => ann.id === state.selectedAnnotationId) ||
    null
  );
}

function getAnnotationById(annotationId) {
  if (!annotationId) {
    return null;
  }
  const currentPage = getCurrentPage();
  if (currentPage) {
    const currentPageAnn = currentPage.annotations.find(
      (item) => item.id === annotationId,
    );
    if (currentPageAnn) {
      return currentPageAnn;
    }
  }
  for (const page of state.pages) {
    const ann = page.annotations.find((item) => item.id === annotationId);
    if (ann) {
      return ann;
    }
  }
  return null;
}

function buildAnnotationList() {
  const page = getCurrentPage();
  refs.annotationList.innerHTML = "";

  if (!page) {
    return;
  }

  const statusLabels = { pending: "待审", approved: "通过", rejected: "驳回" };

  function makeReviewBadge(ann) {
    const st = ann.reviewStatus || "pending";
    return `<span class="review-badge-sm ${st}">${statusLabels[st] || st}</span>`;
  }

  // Build tree structure
  const allAnnotations = [...page.annotations];

  const topLevel = [];
  const childMap = new Map(); // parentId -> children[]

  allAnnotations.forEach((ann) => {
    if (ann.parentId) {
      if (!childMap.has(ann.parentId)) childMap.set(ann.parentId, []);
      childMap.get(ann.parentId).push(ann);
    } else {
      topLevel.push(ann);
    }
  });

  // Sort by orderIndex
  topLevel.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  for (const [, children] of childMap) {
    children.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  // Track expand/collapse state
  if (!state.annotationExpandedState) state.annotationExpandedState = {};

  function renderAnnotationItem(ann, depth) {
    const item = document.createElement("li");
    item.className = "annotation-list-item";
    if (ann.id === state.selectedAnnotationId) {
      item.classList.add("active");
    }
    if (depth > 0) {
      item.style.paddingLeft = `${depth * 16 + 8}px`;
    }

    // Drag-and-drop: 仅编辑者可拖拽
    item.draggable = isEditor();
    item.dataset.annId = ann.id;
    if (isEditor()) {
      item.addEventListener("dragstart", (evt) => {
        evt.dataTransfer.setData("text/plain", ann.id);
        evt.dataTransfer.effectAllowed = "move";
        item.classList.add("dragging");
      });
      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
      });
      item.addEventListener("dragover", (evt) => {
        evt.preventDefault();
        evt.dataTransfer.dropEffect = "move";
        const rect = item.getBoundingClientRect();
        const relY = evt.clientY - rect.top;
        const h = rect.height;
        item.classList.remove("drop-before", "drop-after", "drag-over");
        if (relY < h * 0.25) {
          item.classList.add("drop-before");
        } else if (relY > h * 0.75) {
          item.classList.add("drop-after");
        } else {
          item.classList.add("drag-over");
        }
      });
      item.addEventListener("dragleave", () => {
        item.classList.remove("drop-before", "drop-after", "drag-over");
      });
      item.addEventListener("drop", (evt) => {
        evt.preventDefault();
        const draggedId = evt.dataTransfer.getData("text/plain");
        if (!draggedId || draggedId === ann.id) {
          item.classList.remove("drop-before", "drop-after", "drag-over");
          return;
        }
        if (item.classList.contains("drop-before")) {
          reorderAnnotation(draggedId, ann.id, "before");
        } else if (item.classList.contains("drop-after")) {
          reorderAnnotation(draggedId, ann.id, "after");
        } else {
          reparentAnnotation(draggedId, ann.id).catch((e) => alert(e.message));
        }
        item.classList.remove("drop-before", "drop-after", "drag-over");
      });
    }

    const brief = ann.originalText || ann.simplifiedText || "(未填文本)";
    const badge = makeReviewBadge(ann);
    const hasChildren = childMap.has(ann.id) && childMap.get(ann.id).length > 0;
    const isExpanded = state.annotationExpandedState[ann.id] === true;
    const expandIcon = hasChildren ? (isExpanded ? "▼" : "▶") : "  ";

    item.innerHTML = `<span class="ann-expand">${expandIcon}</span><span class="ann-text-wrap">[${levelLabel(ann.level)}] ${escapeHtml(brief)}</span>${badge}`;

    if (hasChildren) {
      item.querySelector(".ann-expand").style.cursor = "pointer";
      item.querySelector(".ann-expand").addEventListener("click", (evt) => {
        evt.stopPropagation();
        state.annotationExpandedState[ann.id] = !isExpanded;
        buildAnnotationList();
      });
    }

    // 审核标识点击切换（仅有审核权限的用户）
    if (canReview()) {
      const badgeEl = item.querySelector(".review-badge-sm");
      if (badgeEl) {
        badgeEl.classList.add("clickable");
        badgeEl.addEventListener("click", (evt) => {
          evt.stopPropagation();
          const cycle = {
            pending: "approved",
            approved: "rejected",
            rejected: "pending",
          };
          const next = cycle[ann.reviewStatus || "pending"];
          setReviewStatus(ann.id, next);
        });
      }
    }

    item.addEventListener("click", () => {
      let pageChanged = false;
      if (state.selectedAnnotationId === ann.id) {
        state.selectedAnnotationId = null;
      } else {
        state.selectedAnnotationId = ann.id;
        // 如果该标注在当前页没有 regions，跳转到有 regions 的页面
        if (!ann.regions || !ann.regions.length) {
          for (let i = 0; i < state.pages.length; i++) {
            const found = state.pages[i].annotations.find(
              (a) => a.id === ann.id && a.regions && a.regions.length > 0,
            );
            if (found && i !== state.currentPageIndex) {
              state.currentPageIndex = i;
              pageChanged = true;
              break;
            }
          }
        }
      }
      state.selectedHeadingId = null;
      state.selectedRegionId = null;
      // 跨页跳转时先跳过表单重建（避免闪烁），renderPage 加载完成后再重建
      if (pageChanged) {
        renderAll({ skipFormRebuild: true });
      } else {
        renderAll();
      }
    });
    refs.annotationList.appendChild(item);

    // Render children if expanded
    if (hasChildren && isExpanded) {
      for (const child of childMap.get(ann.id)) {
        renderAnnotationItem(child, depth + 1);
      }
    }
  }

  topLevel.forEach((ann) => renderAnnotationItem(ann, 0));
}

async function reparentAnnotation(childId, newParentId) {
  const page = getCurrentPage();
  if (!page) return;

  const child = getAnnotationById(childId);
  const parent = getAnnotationById(newParentId);
  if (!child || !parent) return;

  // Prevent circular: can't drop parent onto its own child
  if (parent.parentId === childId) return;
  // Can't drop onto itself
  if (childId === newParentId) return;

  // Count existing children of new parent globally (dedupe by annotation id)
  const siblingIds = new Set();
  for (const p of state.pages) {
    for (const a of p.annotations) {
      if (a.parentId === newParentId && a.id !== childId) {
        siblingIds.add(a.id);
      }
    }
  }

  const oldParentId = child.parentId;
  const nextOrderIndex = siblingIds.size;

  // 同步 child 在所有页面副本上的 parent/order，避免后续重算读到旧副本
  for (const p of state.pages) {
    for (const a of p.annotations) {
      if (a.id === childId) {
        a.parentId = newParentId;
        a.orderIndex = nextOrderIndex;
      }
    }
  }
  child.parentId = newParentId;
  child.orderIndex = nextOrderIndex;

  try {
    await apiRequest(`/annotations/${encodeURIComponent(childId)}`, {
      method: "PUT",
      body: { parentId: newParentId, orderIndex: nextOrderIndex },
    });
    // 新父级若是可聚合层级（句/段），更新其文本
    recalcParentTextFromChildren(newParentId);
    // 旧父级若是可聚合层级（句/段），也更新其文本
    if (oldParentId && oldParentId !== newParentId) {
      recalcParentTextFromChildren(oldParentId);
    }

    // flush recalc 产生的 pending persist，保证 renderAll 前父文本已落库
    const flushIds = new Set([newParentId]);
    if (oldParentId) flushIds.add(oldParentId);
    for (const fid of flushIds) {
      if (!fid) continue;
      if (annotationSaveTimers.has(fid)) {
        clearTimeout(annotationSaveTimers.get(fid));
        annotationSaveTimers.delete(fid);
      }
      const flushAnn = getAnnotationById(fid);
      if (flushAnn) {
        await apiRequest(`/annotations/${encodeURIComponent(fid)}`, {
          method: "PUT",
          body: flushAnn,
        });
      }
    }

    renderAll();
  } catch (error) {
    alert("设置父子关系失败：" + error.message);
  }
}

async function reorderAnnotation(draggedId, targetId, position) {
  const page = getCurrentPage();
  if (!page) return;
  const dragged = page.annotations.find((a) => a.id === draggedId);
  const target = page.annotations.find((a) => a.id === targetId);
  if (!dragged || !target) return;

  // 将拖拽项移到与目标相同的父级
  const oldParentId = dragged.parentId;
  dragged.parentId = target.parentId;

  // 获取同级兄弟（排除拖拽项自身），按orderIndex排序
  const siblings = page.annotations
    .filter((a) => a.parentId === target.parentId && a.id !== draggedId)
    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

  const targetIdx = siblings.findIndex((a) => a.id === targetId);
  if (position === "before") {
    siblings.splice(targetIdx, 0, dragged);
  } else {
    siblings.splice(targetIdx + 1, 0, dragged);
  }

  // 重新分配orderIndex并立即持久化（避免 reloadPageAnnotations 拿到旧顺序）
  for (let i = 0; i < siblings.length; i++) {
    siblings[i].orderIndex = i;
    if (annotationSaveTimers.has(siblings[i].id)) {
      clearTimeout(annotationSaveTimers.get(siblings[i].id));
      annotationSaveTimers.delete(siblings[i].id);
    }
    await apiRequest(`/annotations/${encodeURIComponent(siblings[i].id)}`, {
      method: "PUT",
      body: siblings[i],
    });
  }

  // 如果旧父级是句/段，更新其文本
  if (oldParentId) {
    recalcParentTextFromChildren(oldParentId);
  }
  // 如果新父级是句/段，更新其文本
  if (target.parentId && target.parentId !== oldParentId) {
    recalcParentTextFromChildren(target.parentId);
  }

  // flush recalc 产生的 pending persist
  const flushIds = new Set();
  if (oldParentId) flushIds.add(oldParentId);
  if (target.parentId) flushIds.add(target.parentId);
  for (const fid of flushIds) {
    if (annotationSaveTimers.has(fid)) {
      clearTimeout(annotationSaveTimers.get(fid));
      annotationSaveTimers.delete(fid);
    }
    let fAnn = null;
    for (const p of state.pages) {
      fAnn = p.annotations.find((a) => a.id === fid);
      if (fAnn) break;
    }
    if (fAnn) {
      await apiRequest(`/annotations/${encodeURIComponent(fid)}`, {
        method: "PUT",
        body: fAnn,
      });
    }
  }

  renderAll();
}

function recalcParentTextFromChildren(parentId) {
  if (!parentId) return;
  const currentPage = getCurrentPage();
  const currentPageId = currentPage ? currentPage.id : null;

  // 收集父标注在各页的副本，并优先使用当前页副本作为基准
  const parentCopies = [];
  for (const p of state.pages) {
    for (const a of p.annotations) {
      if (a.id === parentId) {
        parentCopies.push({ pageId: p.id, ann: a });
      }
    }
  }
  if (!parentCopies.length) return;

  const parentEntry =
    parentCopies.find((item) => item.pageId === currentPageId) ||
    parentCopies[0];
  const parent = parentEntry.ann;
  if (parent.level !== "paragraph" && parent.level !== "sentence") return;

  // 从所有页面收集子标注（按 ID 去重）；同 ID 有多个副本时优先当前页，再优先文本更完整的副本
  const childrenMap = new Map();
  function scoreTextCompleteness(ann) {
    return (
      String(ann.originalText || "").length +
      String(ann.simplifiedText || "").length
    );
  }
  for (const p of state.pages) {
    for (const a of p.annotations) {
      if (a.parentId !== parentId) continue;
      const existing = childrenMap.get(a.id);
      if (!existing) {
        childrenMap.set(a.id, { pageId: p.id, ann: a });
        continue;
      }
      const existingIsCurrent = existing.pageId === currentPageId;
      const candidateIsCurrent = p.id === currentPageId;
      const existingScore = scoreTextCompleteness(existing.ann);
      const candidateScore = scoreTextCompleteness(a);
      if (
        (!existingIsCurrent && candidateIsCurrent) ||
        (existingIsCurrent === candidateIsCurrent &&
          candidateScore > existingScore)
      ) {
        childrenMap.set(a.id, { pageId: p.id, ann: a });
      }
    }
  }
  const children = [...childrenMap.values()].map((item) => item.ann);
  children.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

  // 先清空再拼接，确保删除的子标注不残留；并同步到父标注的所有副本
  const nextOriginalText = children.map((c) => c.originalText || "").join("");
  const nextSimplifiedText = children
    .map((c) => c.simplifiedText || "")
    .join("");
  for (const item of parentCopies) {
    item.ann.originalText = nextOriginalText;
    item.ann.simplifiedText = nextSimplifiedText;
  }
  scheduleAnnotationPersist(parent);
  // 递归向上传播（句→段）
  if (parent.parentId) {
    recalcParentTextFromChildren(parent.parentId);
  }
}

function levelLabel(level) {
  if (level === "char") {
    return "字";
  }
  if (level === "sentence") {
    return "句";
  }
  if (level === "image") {
    return "图";
  }
  return "段";
}

function headingLevelLabel(level) {
  if (level === 1) {
    return "大标题";
  }
  if (level === 2) {
    return "子标题";
  }
  if (level === 3) {
    return "子子标题";
  }
  return "四级标题";
}

function findPageIndexById(pageId) {
  return state.pages.findIndex((page) => page.id === pageId);
}

async function addHeadingFromSelection() {
  const page = getCurrentPage();
  if (!page) {
    alert("请先导入并选择页面");
    return;
  }

  const selectedAnn = getSelectedAnnotation();
  const level = 1;

  let titleText = refs.headingTitleInput
    ? refs.headingTitleInput.value.trim()
    : "";
  if (!titleText && selectedAnn) {
    titleText = (
      selectedAnn.originalText ||
      selectedAnn.simplifiedText ||
      ""
    ).trim();
  }
  if (!titleText) {
    alert("请输入标题文本，或先选中一个含文本的标注");
    return;
  }

  await saveArticleMeta();
  const payload = await apiRequest(
    `/articles/${encodeURIComponent(state.article.id)}/headings`,
    {
      method: "POST",
      body: {
        pageId: page.id,
        annotationId: selectedAnn ? selectedAnn.id : null,
        titleText,
        level,
        y: selectedAnn
          ? Number(((selectedAnn.regions || [])[0] || {}).y || 0)
          : 0,
      },
    },
  );

  if (payload && payload.heading) {
    state.headings.push(payload.heading);
    state.selectedHeadingId = payload.heading.id;
  }

  if (refs.headingTitleInput) {
    refs.headingTitleInput.value = "";
  }
  renderAll();
}

async function deleteHeadingById(headingId) {
  if (!window.confirm("确定删除该标题吗？")) {
    return;
  }
  await apiRequest(`/headings/${encodeURIComponent(headingId)}`, {
    method: "DELETE",
  });
  state.headings = state.headings.filter((heading) => heading.id !== headingId);
  if (state.selectedHeadingId === headingId) {
    state.selectedHeadingId = null;
  }
  renderAll();
}

function calcHeadingDepth(headingId) {
  let depth = 0;
  let currentId = headingId;
  const visited = new Set();
  while (currentId) {
    const h = state.headings.find((item) => item.id === currentId);
    if (!h || !h.parentId || visited.has(currentId)) break;
    visited.add(currentId);
    currentId = h.parentId;
    depth++;
  }
  return depth;
}

function updateChildLevels(parentId) {
  state.headings.forEach((h) => {
    if (h.parentId === parentId) {
      h.level = calcHeadingDepth(h.id) + 1;
      updateChildLevels(h.id);
    }
  });
}

function isDescendantOf(headingId, ancestorId) {
  let currentId = headingId;
  const visited = new Set();
  while (currentId) {
    if (currentId === ancestorId) return true;
    const h = state.headings.find((item) => item.id === currentId);
    if (!h || !h.parentId || visited.has(currentId)) return false;
    visited.add(currentId);
    currentId = h.parentId;
  }
  return false;
}

async function moveHeading(headingId, newParentId, newOrderIndex) {
  const articleId = normalizeArticleId(state.article.id);
  const newLevel = newParentId ? calcHeadingDepth(newParentId) + 2 : 1;

  await apiRequest(
    `/articles/${encodeURIComponent(articleId)}/headings/${encodeURIComponent(headingId)}`,
    {
      method: "PATCH",
      body: {
        parentId: newParentId || null,
        orderIndex: newOrderIndex,
        level: newLevel,
      },
    },
  );

  const heading = state.headings.find((h) => h.id === headingId);
  if (heading) {
    heading.parentId = newParentId || null;
    heading.orderIndex = newOrderIndex;
    heading.level = newLevel;
    updateChildLevels(heading.id);
  }

  // Reorder siblings
  const siblings = state.headings
    .filter(
      (h) =>
        (h.parentId || null) === (newParentId || null) && h.id !== headingId,
    )
    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

  siblings.splice(newOrderIndex, 0, heading);
  const orderedIds = siblings.filter(Boolean).map((h, i) => {
    h.orderIndex = i;
    return h.id;
  });

  await apiRequest(
    `/articles/${encodeURIComponent(articleId)}/headings/reorder`,
    {
      method: "POST",
      body: {
        parentId: newParentId || null,
        orderedIds,
      },
    },
  ).catch(() => {});

  renderHeadingIndex();
}

function jumpToHeading(heading) {
  const pageIndex = findPageIndexById(heading.pageId);
  if (pageIndex < 0) {
    alert("标题关联页面不存在");
    return;
  }

  if (state.currentPageIndex !== pageIndex) {
    state.currentPageIndex = pageIndex;
    resetCanvasView();
    joinCurrentPageRoom();
  }
  state.selectedHeadingId = heading.id;

  if (heading.annotationId) {
    const page = state.pages[pageIndex];
    const ann = page.annotations.find(
      (item) => item.id === heading.annotationId,
    );
    state.selectedAnnotationId = ann ? ann.id : null;
  } else {
    state.selectedAnnotationId = null;
  }

  renderAll();
}

function renderHeadingIndex() {
  if (!refs.headingIndexList) {
    return;
  }

  refs.headingIndexList.innerHTML = "";
  const pageNoMap = new Map(
    state.pages.map((page) => [page.id, page.pageNo || 0]),
  );

  // 构建父子关系的树形结构
  const tree = {};
  const headingsById = {};

  state.headings.forEach((heading) => {
    headingsById[heading.id] = heading;
    const parentId = heading.parentId || "root";
    if (!tree[parentId]) {
      tree[parentId] = [];
    }
    tree[parentId].push(heading);
  });

  // 对每个父级下的子标题按 orderIndex 排序
  Object.keys(tree).forEach((parentId) => {
    tree[parentId].sort((a, b) => {
      const orderA = Number(a.orderIndex || 0);
      const orderB = Number(b.orderIndex || 0);
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });
  });

  // 根级拖放区域 - 仅编辑者可用
  if (refs.headingDropRootZone && !refs.headingDropRootZone._dragBound) {
    refs.headingDropRootZone._dragBound = true;
    refs.headingDropRootZone.addEventListener("dragover", (evt) => {
      if (!isEditor()) return;
      evt.preventDefault();
      evt.dataTransfer.dropEffect = "move";
      refs.headingDropRootZone.classList.add("drag-over");
    });
    refs.headingDropRootZone.addEventListener("dragleave", () => {
      refs.headingDropRootZone.classList.remove("drag-over");
    });
    refs.headingDropRootZone.addEventListener("drop", (evt) => {
      if (!isEditor()) return;
      evt.preventDefault();
      refs.headingDropRootZone.classList.remove("drag-over");
      if (state.headingDragState.draggedHeadingId) {
        const draggedId = state.headingDragState.draggedHeadingId;
        const rootChildren = state.headings.filter((h) => !h.parentId).length;
        moveHeading(draggedId, null, rootChildren).catch((error) =>
          alert(error.message),
        );
      }
    });
  }

  // 递归渲染树形结构
  function renderHeadingTree(parentId, depth = 0) {
    const children = tree[parentId] || [];
    if (children.length === 0) {
      return;
    }

    children.forEach((heading, index) => {
      const hasChildren = !!(tree[heading.id] && tree[heading.id].length > 0);
      const isExpanded = state.headingExpandedState[heading.id] !== false;

      const item = document.createElement("li");
      item.className = `index-list-item heading-item level-${heading.level}`;
      item.style.marginLeft = `${depth * 20}px`;
      item.dataset.headingId = heading.id;
      item.dataset.parentId = parentId;
      item.dataset.index = index;
      if (heading.id === state.selectedHeadingId) {
        item.classList.add("active");
      }
      if (state.headingDragState.draggedHeadingId === heading.id) {
        item.classList.add("dragging");
      }

      const wrapper = document.createElement("div");
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";
      wrapper.style.width = "100%";
      wrapper.style.gap = "4px";

      // 展开/折叠按钮
      if (hasChildren) {
        const expandBtn = document.createElement("button");
        expandBtn.type = "button";
        expandBtn.className = "heading-expand-btn";
        expandBtn.style.flex = "0 0 24px";
        expandBtn.style.padding = "2px 4px";
        expandBtn.style.minWidth = "24px";
        expandBtn.style.cursor = "pointer";
        expandBtn.style.border = "none";
        expandBtn.style.background = "transparent";
        expandBtn.style.fontSize = "12px";
        expandBtn.textContent = isExpanded ? "▼" : "▶";
        expandBtn.title = isExpanded ? "折叠" : "展开";
        expandBtn.addEventListener("click", (evt) => {
          evt.stopPropagation();
          state.headingExpandedState[heading.id] =
            !state.headingExpandedState[heading.id];
          renderHeadingIndex();
        });
        wrapper.appendChild(expandBtn);
      } else {
        const spacer = document.createElement("div");
        spacer.style.width = "24px";
        wrapper.appendChild(spacer);
      }

      // 标题链接
      const pageNo = pageNoMap.get(heading.pageId) || "?";
      const depthLabel = headingLevelLabel(calcHeadingDepth(heading.id) + 1);
      const link = document.createElement("button");
      link.type = "button";
      link.className = "index-link";
      link.style.flex = "1";
      link.draggable = isEditor();
      link.innerHTML = `<span>${escapeHtml(heading.titleText)}</span><small>P${pageNo} · ${depthLabel}</small>`;
      link.addEventListener("click", () => {
        jumpToHeading(heading);
      });
      if (isEditor()) {
        link.addEventListener("dragstart", (evt) => {
          evt.dataTransfer.effectAllowed = "move";
          state.headingDragState.draggedHeadingId = heading.id;
          item.classList.add("dragging");
        });
        link.addEventListener("dragend", () => {
          state.headingDragState.draggedHeadingId = null;
          document
            .querySelectorAll(".drop-before,.drop-after,.drop-child")
            .forEach((el) => {
              el.classList.remove("drop-before", "drop-after", "drop-child");
            });
          item.classList.remove("dragging");
        });

        // Drop zone logic on item
        item.addEventListener("dragover", (evt) => {
          evt.preventDefault();
          evt.dataTransfer.dropEffect = "move";

          if (
            !state.headingDragState.draggedHeadingId ||
            state.headingDragState.draggedHeadingId === heading.id
          )
            return;

          document
            .querySelectorAll(".drop-before,.drop-after,.drop-child")
            .forEach((el) => {
              el.classList.remove("drop-before", "drop-after", "drop-child");
            });

          const rect = item.getBoundingClientRect();
          const ratio = (evt.clientY - rect.top) / rect.height;
          if (ratio < 0.25) {
            item.classList.add("drop-before");
          } else if (ratio > 0.75) {
            item.classList.add("drop-after");
          } else {
            item.classList.add("drop-child");
          }
        });

        item.addEventListener("dragleave", () => {
          item.classList.remove("drop-before", "drop-after", "drop-child");
        });

        item.addEventListener("drop", (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          item.classList.remove("drop-before", "drop-after", "drop-child");

          const draggedId = state.headingDragState.draggedHeadingId;
          if (!draggedId || draggedId === heading.id) return;

          if (isDescendantOf(heading.id, draggedId)) return;

          const rect = item.getBoundingClientRect();
          const ratio = (evt.clientY - rect.top) / rect.height;
          const targetParentId = heading.parentId || null;

          if (ratio < 0.25) {
            moveHeading(draggedId, targetParentId, index).catch((error) =>
              alert(error.message),
            );
          } else if (ratio > 0.75) {
            moveHeading(draggedId, targetParentId, index + 1).catch((error) =>
              alert(error.message),
            );
          } else {
            const childCount = (tree[heading.id] || []).length;
            moveHeading(draggedId, heading.id, childCount).catch((error) =>
              alert(error.message),
            );
          }
        });
      }

      wrapper.appendChild(link);

      // 删除按钮
      const del = document.createElement("button");
      del.type = "button";
      del.className = "heading-delete";
      del.style.flex = "0 0 24px";
      del.textContent = "×";
      del.title = "删除标题";
      del.addEventListener("click", (evt) => {
        evt.stopPropagation();
        deleteHeadingById(heading.id).catch((error) => alert(error.message));
      });
      wrapper.appendChild(del);

      item.appendChild(wrapper);
      refs.headingIndexList.appendChild(item);

      if (isExpanded && hasChildren) {
        renderHeadingTree(heading.id, depth + 1);
      }
    });
  }

  if (!state.headings.length) {
    const empty = document.createElement("li");
    empty.className = "index-list-item";
    empty.innerHTML =
      '<button type="button" class="index-link" disabled>暂无标题</button>';
    refs.headingIndexList.appendChild(empty);
    return;
  }

  renderHeadingTree("root");
}

function renderHeadingAddTip() {
  if (!refs.headingAddTip) {
    return;
  }
  const page = getCurrentPage();
  const ann = getSelectedAnnotation();

  if (!page) {
    refs.headingAddTip.textContent = "请先导入页面，再添加标题。";
    return;
  }

  if (ann) {
    const r = (ann.regions || [])[0];
    const posText = r ? `(x:${r.x}, y:${r.y})` : "";
    refs.headingAddTip.textContent = `已关联当前标注 ${posText}，添加后可精准跳转。`;
    return;
  }

  refs.headingAddTip.textContent = "当前未选标注，添加后将按页面顶部位置跳转。";
}

function renderAnnotationForm() {
  refs.annotationForm.innerHTML = "";
  const ann = getSelectedAnnotation();
  if (!ann) {
    const p = document.createElement("p");
    p.className = "empty-tip";
    p.textContent = "当前未选中标注。";
    refs.annotationForm.appendChild(p);
    return;
  }

  const fragment = refs.annotationFormTemplate.content.cloneNode(true);

  // 根据标注级别移除不需要的字段
  const hideFields = {
    paragraph: [
      "id",
      "charCode",
      "glyphRef",
      "x",
      "y",
      "width",
      "height",
      "style",
      "color",
    ],
    sentence: [
      "id",
      "charCode",
      "glyphRef",
      "x",
      "y",
      "width",
      "height",
      "style",
      "color",
    ],
    char: ["id", "charCode", "x", "y", "width", "height", "style", "color"],
    image: [
      "id",
      "charCode",
      "glyphRef",
      "originalText",
      "simplifiedText",
      "x",
      "y",
      "width",
      "height",
      "style",
      "color",
    ],
  };
  const toHide = new Set(hideFields[ann.level] || []);
  fragment.querySelectorAll("[data-field]").forEach((el) => {
    if (toHide.has(el.dataset.field)) el.closest("label").remove();
  });
  // 段/句标注的原文/简体为自动拼接，设为只读
  if (ann.level === "paragraph" || ann.level === "sentence") {
    fragment
      .querySelectorAll(
        '[data-field="originalText"], [data-field="simplifiedText"]',
      )
      .forEach((el) => {
        el.disabled = true;
      });
  }

  const fieldElements = fragment.querySelectorAll("[data-field]");
  fieldElements.forEach((el) => {
    const field = el.dataset.field;
    if (field === "glyphRef") {
      fillGlyphRefControl(fragment, el, ann);
      return;
    }
    el.value = ann[field] ?? "";
    if (!el.disabled) {
      el.addEventListener("input", () => {
        ann[field] = el.value;
        drawOverlay();
        scheduleAnnotationPersist(ann);
        // 子标注文本变化时，自动更新父标注的文本（字→句、句→段）
        if (
          ann.parentId &&
          (field === "originalText" || field === "simplifiedText")
        ) {
          recalcParentTextFromChildren(ann.parentId);
        }
        // 在 recalc 之后重建列表，确保父标注文本已更新
        buildAnnotationList();
      });
    }
  });

  const deleteBtn = fragment.querySelector("[data-action=delete]");
  if (isEditor()) {
    deleteBtn.addEventListener("click", () => {
      removeSelectedAnnotation().catch((error) => alert(error.message));
    });
  } else {
    deleteBtn.style.display = "none";
  }

  // Disable form fields for reviewer
  if (!isEditor()) {
    fragment.querySelectorAll("input:not([disabled]), select").forEach((el) => {
      el.disabled = true;
    });
    fragment
      .querySelectorAll(
        'button[data-action="open-glyph-picker"], button[data-action="clear-glyph-ref"]',
      )
      .forEach((el) => {
        el.disabled = true;
      });
  }

  refs.annotationForm.appendChild(fragment);

  // Region controls (for paragraph/sentence level — editors can add/delete, reviewers read-only)
  if (ann.level === "paragraph" || ann.level === "sentence") {
    const crossDiv = document.createElement("div");
    crossDiv.className = "region-controls";

    if (isEditor()) {
      const btnAdd = document.createElement("button");
      btnAdd.type = "button";
      btnAdd.className = "btn-add-region";
      if (state.addingRegionForAnnotation === ann.id) {
        btnAdd.textContent = "取消画框";
        btnAdd.classList.add("active");
      } else {
        btnAdd.textContent = "添加区域";
      }
      btnAdd.addEventListener("click", () => {
        if (state.addingRegionForAnnotation === ann.id) {
          state.addingRegionForAnnotation = null;
        } else {
          state.addingRegionForAnnotation = ann.id;
        }
        renderAnnotationForm();
      });
      crossDiv.appendChild(btnAdd);

      if (state.addingRegionForAnnotation === ann.id) {
        const tip = document.createElement("p");
        tip.className = "region-tip";
        tip.textContent =
          "请在当前页面或切换到目标页面后，在 canvas 上画框标记该标注的区域。";
        crossDiv.appendChild(tip);
      }
    }

    // List existing regions
    const regionList = document.createElement("div");
    regionList.className = "region-list";
    regionList.id = "region-list";
    crossDiv.appendChild(regionList);
    refs.annotationForm.appendChild(crossDiv);

    // Load regions async
    loadAnnotationRegions(ann.id, regionList);
  }
}

async function loadAnnotationRegions(annotationId, container) {
  try {
    const payload = await apiRequest(
      `/annotations/${encodeURIComponent(annotationId)}/regions`,
    );
    const regions = payload.regions || [];
    if (!regions.length) {
      container.innerHTML = "<p class='empty-tip'>无区域</p>";
      return;
    }
    container.innerHTML = "";
    const currentPage = getCurrentPage();
    const editable = isEditor();

    regions.forEach((r, idx) => {
      const div = document.createElement("div");
      const isSelected = state.selectedRegionId === r.id;
      div.className =
        "region-item" +
        (currentPage && r.pageId === currentPage.id ? " current-page" : "") +
        (isSelected ? " region-selected" : "");
      div.draggable = editable;
      div.dataset.regionId = r.id;
      div.dataset.regionIdx = idx;

      const pageName = state.pages.find((p) => p.id === r.pageId);
      const label = pageName ? pageName.name : r.pageId;
      const isCurrent = currentPage && r.pageId === currentPage.id;
      const handleHtml = editable
        ? '<span class="region-drag-handle">⠿</span>'
        : "";
      const deleteHtml = editable
        ? `<button class="ai-btn-sm reject" data-region-id="${escapeHtml(r.id)}">×</button>`
        : "";
      div.innerHTML = `${handleHtml}
        <span class="region-label">${escapeHtml(label)} (${r.x},${r.y} ${r.width}x${r.height})${isCurrent ? " ★" : ""}</span>
        ${deleteHtml}`;

      // 点击区域项：选中该区域并跳转到对应页面（编辑者和审阅者都可）
      div.addEventListener("click", (evt) => {
        if (
          evt.target.closest("button[data-region-id]") ||
          evt.target.closest(".region-drag-handle")
        )
          return;
        if (state.selectedRegionId === r.id) {
          state.selectedRegionId = null;
        } else {
          state.selectedRegionId = r.id;
          const pageIdx = state.pages.findIndex((p) => p.id === r.pageId);
          if (pageIdx >= 0 && pageIdx !== state.currentPageIndex) {
            state.currentPageIndex = pageIdx;
          }
        }
        container.querySelectorAll(".region-item").forEach((el) => {
          el.classList.toggle(
            "region-selected",
            el.dataset.regionId === state.selectedRegionId,
          );
        });
        renderAll({ skipFormRebuild: true });
      });

      if (editable) {
        // Drag events (editors only)
        div.addEventListener("dragstart", (evt) => {
          evt.dataTransfer.setData("text/region-id", r.id);
          evt.dataTransfer.effectAllowed = "move";
          div.classList.add("dragging");
        });
        div.addEventListener("dragend", () => div.classList.remove("dragging"));
        div.addEventListener("dragover", (evt) => {
          evt.preventDefault();
          evt.dataTransfer.dropEffect = "move";
          const rect = div.getBoundingClientRect();
          const relY = evt.clientY - rect.top;
          div.classList.remove("drop-before", "drop-after");
          if (relY < rect.height / 2) {
            div.classList.add("drop-before");
          } else {
            div.classList.add("drop-after");
          }
        });
        div.addEventListener("dragleave", () =>
          div.classList.remove("drop-before", "drop-after"),
        );
        div.addEventListener("drop", (evt) => {
          evt.preventDefault();
          div.classList.remove("drop-before", "drop-after");
          const draggedId = evt.dataTransfer.getData("text/region-id");
          if (!draggedId || draggedId === r.id) return;
          const rect = div.getBoundingClientRect();
          const relY = evt.clientY - rect.top;
          const position = relY < rect.height / 2 ? "before" : "after";
          reorderRegions(
            annotationId,
            regions,
            draggedId,
            r.id,
            position,
            container,
          );
        });

        // Delete button (editors only)
        div
          .querySelector("button[data-region-id]")
          .addEventListener("click", async () => {
            await apiRequest(
              `/annotation-regions/${encodeURIComponent(r.id)}`,
              { method: "DELETE" },
            );
            const ann = getSelectedAnnotation();
            if (ann && ann.regions) {
              ann.regions = ann.regions.filter((reg) => reg.id !== r.id);
            }
            renderAnnotationForm();
            drawOverlay();
          });
      }

      container.appendChild(div);
    });
  } catch (e) {
    container.innerHTML = "<p class='empty-tip'>加载失败</p>";
  }
}

async function reorderRegions(
  annotationId,
  regions,
  draggedId,
  targetId,
  position,
  container,
) {
  const ids = regions.map((r) => r.id).filter((id) => id !== draggedId);
  const targetIdx = ids.indexOf(targetId);
  if (position === "before") {
    ids.splice(targetIdx, 0, draggedId);
  } else {
    ids.splice(targetIdx + 1, 0, draggedId);
  }
  try {
    await apiRequest(
      `/annotations/${encodeURIComponent(annotationId)}/regions/reorder`,
      {
        method: "PUT",
        body: { regionIds: ids },
      },
    );
    // 更新本地 regions 顺序
    const ann = getSelectedAnnotation();
    if (ann && ann.regions) {
      ann.regions.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    }
    loadAnnotationRegions(annotationId, container);
    drawOverlay();
  } catch (e) {
    alert("排序失败：" + e.message);
  }
}

function getGlyphById(glyphId) {
  if (!glyphId) return null;
  return state.glyphs.find((item) => item.id === glyphId) || null;
}

function glyphDisplayText(glyph) {
  if (!glyph) return "未关联造字";
  return `${glyph.code} - ${glyph.name || "未命名"}`;
}

function fillGlyphRefControl(fragment, glyphRefEl, ann) {
  glyphRefEl.value = ann.glyphRef || "";
  const displayEl = fragment.querySelector('[data-role="glyph-display"]');
  const openBtn = fragment.querySelector('[data-action="open-glyph-picker"]');
  const clearBtn = fragment.querySelector('[data-action="clear-glyph-ref"]');
  const linkedGlyph = getGlyphById(ann.glyphRef);

  if (displayEl) {
    displayEl.value = glyphDisplayText(linkedGlyph);
  }

  if (openBtn) {
    openBtn.disabled = !isEditor();
    openBtn.addEventListener("click", () => {
      openGlyphPickerForAnnotation(ann.id);
    });
  }

  if (clearBtn) {
    clearBtn.disabled = !isEditor() || !ann.glyphRef;
    clearBtn.addEventListener("click", () => {
      clearGlyphRefForAnnotation(ann.id);
    });
  }
}

function openGlyphPickerForAnnotation(annotationId) {
  if (!annotationId || !refs.glyphPickerDialog) return;
  const ann = getAnnotationById(annotationId);
  if (!ann) return;
  state.glyphPicker.annotationId = annotationId;
  state.glyphPicker.query = "";
  refs.glyphPickerDialog.hidden = false;
  if (refs.glyphPickerSearch) {
    refs.glyphPickerSearch.value = "";
  }
  renderGlyphPickerList();
  if (refs.glyphPickerSearch) {
    refs.glyphPickerSearch.focus();
  }
}

function hideGlyphPicker() {
  if (refs.glyphPickerDialog) {
    refs.glyphPickerDialog.hidden = true;
  }
  state.glyphPicker.annotationId = null;
  state.glyphPicker.query = "";
}

function clearGlyphRefForAnnotation(annotationId) {
  const ann = getAnnotationById(annotationId);
  if (!ann) return;
  ann.glyphRef = "";
  ann.charCode = "";
  renderAnnotationForm();
  drawOverlay();
  scheduleAnnotationPersist(ann);
}

function applyGlyphToCurrentAnnotation(glyphId) {
  const ann = getAnnotationById(
    state.glyphPicker.annotationId || state.selectedAnnotationId,
  );
  if (!ann) return;
  ann.glyphRef = glyphId || "";
  const glyph = getGlyphById(glyphId);
  ann.charCode = glyph ? glyph.code : "";
  hideGlyphPicker();
  renderAnnotationForm();
  drawOverlay();
  scheduleAnnotationPersist(ann);
}

function renderGlyphPickerList() {
  if (!refs.glyphPickerList) return;

  const query = String(state.glyphPicker.query || "")
    .trim()
    .toLowerCase();
  const filtered = state.glyphs.filter((glyph) => {
    if (!query) return true;
    const haystack =
      `${glyph.code || ""} ${glyph.name || ""} ${glyph.note || ""}`.toLowerCase();
    return haystack.includes(query);
  });

  refs.glyphPickerList.innerHTML = "";
  if (!filtered.length) {
    const tip = document.createElement("p");
    tip.className = "empty-tip";
    tip.textContent = state.glyphs.length
      ? "没有匹配结果，请调整搜索词。"
      : "造字库为空，请先在造字库页添加造字。";
    refs.glyphPickerList.appendChild(tip);
    return;
  }

  filtered.forEach((glyph) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "glyph-picker-item";
    const imagePart = glyph.imgDataUrl
      ? `<img src="${glyph.imgDataUrl}" alt="${escapeHtml(glyph.code)}">`
      : '<div class="no-image">无图</div>';
    item.innerHTML = `${imagePart}
      <div class="glyph-picker-item-text">
        <strong>${escapeHtml(glyph.code || "")}</strong>
        <span>${escapeHtml(glyph.name || "未命名")}</span>
        <small>${escapeHtml(glyph.note || "")}</small>
      </div>`;
    item.addEventListener("click", () => {
      applyGlyphToCurrentAnnotation(glyph.id);
    });
    refs.glyphPickerList.appendChild(item);
  });
}

function buildShapeElement(ann, page, selected) {
  const scaleX = refs.annotationSvg.clientWidth / page.width;
  const scaleY = refs.annotationSvg.clientHeight / page.height;
  const x = ann.x * scaleX;
  const y = ann.y * scaleY;
  const width = ann.width * scaleX;
  const height = ann.height * scaleY;
  const strokeWidth = selected ? 3 : 2;

  const isApproved = ann.reviewStatus === "approved";
  const isRejected = ann.reviewStatus === "rejected";

  const rect = document.createElementNS(NS_SVG, "rect");
  rect.setAttribute("x", String(x));
  rect.setAttribute("y", String(y));
  rect.setAttribute("width", String(width));
  rect.setAttribute("height", String(height));
  rect.setAttribute("rx", "3");
  rect.setAttribute("ry", "3");

  if (isApproved) {
    rect.setAttribute("stroke", "#1e7e34");
    rect.setAttribute("fill", "#28a74555");
  } else if (isRejected) {
    rect.setAttribute("stroke", "#dc3545");
    rect.setAttribute("fill", "#dc354555");
  } else {
    rect.setAttribute("stroke", "#d5533f");
    rect.setAttribute("fill", "#d5533f55");
  }
  rect.setAttribute("stroke-width", String(strokeWidth));
  return rect;
}

function buildResizeHandles(annotationId, region, page) {
  const scaleX = refs.annotationSvg.clientWidth / page.width;
  const scaleY = refs.annotationSvg.clientHeight / page.height;
  const x = region.x * scaleX;
  const y = region.y * scaleY;
  const width = region.width * scaleX;
  const height = region.height * scaleY;

  const handles = [
    { key: "nw", x, y, cursor: "nwse-resize" },
    { key: "n", x: x + width / 2, y, cursor: "ns-resize" },
    { key: "ne", x: x + width, y, cursor: "nesw-resize" },
    { key: "e", x: x + width, y: y + height / 2, cursor: "ew-resize" },
    { key: "se", x: x + width, y: y + height, cursor: "nwse-resize" },
    { key: "s", x: x + width / 2, y: y + height, cursor: "ns-resize" },
    { key: "sw", x, y: y + height, cursor: "nesw-resize" },
    { key: "w", x, y: y + height / 2, cursor: "ew-resize" },
  ];

  const fragment = document.createDocumentFragment();
  handles.forEach((item) => {
    const node = document.createElementNS(NS_SVG, "circle");
    node.setAttribute("cx", String(item.x));
    node.setAttribute("cy", String(item.y));
    node.setAttribute("r", "5");
    node.setAttribute("fill", "#fff");
    node.setAttribute("stroke", "#d5533f");
    node.setAttribute("stroke-width", "2");
    node.style.cursor = item.cursor;
    node.addEventListener("mousedown", (evt) => {
      startRegionResize(evt, annotationId, region.id, item.key);
    });
    fragment.appendChild(node);
  });
  return fragment;
}

function getVisibleAnnotationIds() {
  const page = getCurrentPage();
  if (!page) return new Set();
  if (!state.selectedAnnotationId) return new Set();
  return new Set([state.selectedAnnotationId]);
}

function drawOverlay() {
  const page = getCurrentPage();
  refs.annotationSvg.innerHTML = "";
  if (!page) {
    return;
  }

  const visibleIds = getVisibleAnnotationIds();

  // Render annotations via their regions on this page
  page.annotations
    .filter((ann) => visibleIds.has(ann.id))
    .forEach((ann) => {
      const selected = ann.id === state.selectedAnnotationId;
      const regions = ann.regions || [];
      regions.forEach((region) => {
        // 如果选中了某个区域，只显示该区域
        if (state.selectedRegionId && region.id !== state.selectedRegionId)
          return;
        const regionAnn = {
          ...ann,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
        };
        const shape = buildShapeElement(regionAnn, page, selected);
        shape.dataset.annId = ann.id;
        shape.dataset.regionId = region.id;
        shape.style.cursor = "pointer";
        shape.addEventListener("mousedown", (evt) => {
          evt.stopPropagation();
        });
        shape.addEventListener("click", (evt) => {
          evt.stopPropagation();
          state.selectedAnnotationId = ann.id;
          state.selectedHeadingId = null;
          state.selectedRegionId = region.id;
          renderAll({ skipFormRebuild: true });
          renderAnnotationForm();
        });
        refs.annotationSvg.appendChild(shape);

        if (
          isEditor() &&
          selected &&
          state.selectedRegionId === region.id &&
          !state.addingRegionForAnnotation
        ) {
          refs.annotationSvg.appendChild(
            buildResizeHandles(ann.id, region, page),
          );
        }
      });
    });

  if (state.drawing) {
    const tempAnn = {
      x: Math.min(state.drawing.startX, state.drawing.endX),
      y: Math.min(state.drawing.startY, state.drawing.endY),
      width: Math.abs(state.drawing.endX - state.drawing.startX),
      height: Math.abs(state.drawing.endY - state.drawing.startY),
      style: "highlight",
      color: "#d5533f",
    };
    const shape = buildShapeElement(tempAnn, page, true);
    shape.setAttribute("stroke-dasharray", "8 4");
    refs.annotationSvg.appendChild(shape);
  }
}

// 重新加载指定页面的标注列表（从服务器获取最新数据）
async function reloadPageAnnotations(page) {
  if (!page) return;
  try {
    const payload = await apiRequest(
      `/pages/${encodeURIComponent(page.id)}/annotations`,
    );
    page.annotations = payload.annotations || [];
  } catch (e) {
    // 加载失败时保留现有数据
  }
}

function renderPage() {
  const page = getCurrentPage();
  if (!page) {
    resetCanvasView();
    refs.pageImage.removeAttribute("src");
    refs.pageImage.style.display = "none";
    refs.canvasStage.style.height = "420px";
    refs.pageIndicator.textContent = "页码: 0 / 0";
    refs.canvasMeta.textContent = "未加载页面";
    drawOverlay();
    return;
  }

  refs.pageImage.style.display = "block";
  // 优先使用内存缓存的 Blob URL，秒切页面
  refs.pageImage.src = getCachedImageUrl(page.src);
  // 如果还没缓存完成，等待加载后再替换
  if (!imageCache.has(page.src)) {
    waitForImage(page.src).then((url) => {
      if (url && getCurrentPage() === page) {
        refs.pageImage.src = url;
      }
    });
  }
  preloadAdjacentPages(state.currentPageIndex, state.pages);
  refs.pageIndicator.textContent = `页码: ${state.currentPageIndex + 1} / ${state.pages.length}`;
  refs.canvasMeta.textContent = `${page.name} (${page.width}x${page.height})`;

  // 每次切换页面时刷新该页的标注数据（确保跨页标注可见）
  reloadPageAnnotations(page).then(() => {
    buildAnnotationList();
    drawOverlay();
    // 页面数据加载完成后重建表单（确保跨页跳转后属性栏正确显示）
    if (state.selectedAnnotationId) {
      renderAnnotationForm();
      renderReviewStatus();
    }
  });

  const onImageLoad = () => {
    refs.canvasStage.style.height = `${refs.pageImage.clientHeight}px`;
    const clamped = clampCanvasView(
      state.canvasView.offsetX,
      state.canvasView.offsetY,
    );
    state.canvasView.offsetX = clamped.x;
    state.canvasView.offsetY = clamped.y;
    applyCanvasView();
    drawOverlay();
  };

  if (refs.pageImage.complete) {
    onImageLoad();
  } else {
    refs.pageImage.onload = onImageLoad;
  }
}

function renderGlyphList() {
  refs.glyphList.innerHTML = "";
  if (!state.glyphs.length) {
    refs.glyphList.innerHTML =
      "<p>造字库为空。可录入没有简体对应的古汉字编码与字样图片。</p>";
    return;
  }

  state.glyphs.forEach((glyph) => {
    const card = document.createElement("article");
    card.className = "glyph-item";
    const imagePart = glyph.imgDataUrl
      ? `<img src="${glyph.imgDataUrl}" alt="${escapeHtml(glyph.code)}">`
      : '<div class="no-image">无图</div>';
    card.innerHTML = `${imagePart}
      <div>
        <strong>${escapeHtml(glyph.code)}</strong><br>
        <span>${escapeHtml(glyph.name || "未命名")}</span><br>
        <small>${escapeHtml(glyph.note || "")}</small>
      </div>
      <button type="button">删除</button>`;

    const deleteBtn = card.querySelector("button");
    deleteBtn.addEventListener("click", () => {
      deleteGlyph(glyph).catch((error) => alert(error.message));
    });
    refs.glyphList.appendChild(card);
  });
}

async function deleteGlyph(glyph) {
  await apiRequest(`/glyphs/${encodeURIComponent(glyph.id)}`, {
    method: "DELETE",
  });
  state.glyphs = state.glyphs.filter((item) => item.id !== glyph.id);
  state.pages.forEach((page) => {
    page.annotations.forEach((ann) => {
      if (ann.glyphRef === glyph.id) {
        ann.glyphRef = "";
      }
    });
  });
  renderAll();
}

async function addGlyph() {
  const code = refs.glyphCode.value.trim().toUpperCase();
  const name = refs.glyphName.value.trim();
  const note = refs.glyphNote.value.trim();

  if (!/^U\+[0-9A-F]{4,6}$/.test(code)) {
    alert("编码格式不正确，请输入形如 U+E001 的值。");
    return;
  }

  let imgDataUrl = "";
  const file = refs.glyphImage.files?.[0];
  if (file) {
    imgDataUrl = await readFileAsDataUrl(file);
  } else if (state.glyphCaptureDataUrl) {
    imgDataUrl = state.glyphCaptureDataUrl;
  }

  await saveArticleMeta();
  const result = await apiRequest(
    `/articles/${encodeURIComponent(state.article.id)}/glyphs`,
    {
      method: "POST",
      body: {
        code,
        name,
        note,
        imgDataUrl,
      },
    },
  );
  state.glyphs.unshift(result.glyph);

  refs.glyphCode.value = "";
  refs.glyphName.value = "";
  refs.glyphNote.value = "";
  refs.glyphImage.value = "";
  setGlyphCaptureImage("");
  renderAll();
}

// ── 文章选择 ──

function showArticleSelect() {
  if (refs.articleSelectOverlay) refs.articleSelectOverlay.hidden = false;
  if (refs.btnBackToSelect) refs.btnBackToSelect.hidden = true;
  // Update user info on select page
  if (state.currentUser) {
    if (refs.selectUserDisplayName) {
      refs.selectUserDisplayName.textContent =
        state.currentUser.displayName || state.currentUser.username;
    }
    if (refs.selectUserRoleBadge) {
      const roleLabels = {
        admin: "管理员",
        editor: "编辑者",
        reviewer: "审校者",
      };
      refs.selectUserRoleBadge.textContent =
        roleLabels[state.currentUser.role] || state.currentUser.role;
      refs.selectUserRoleBadge.className = `role-badge ${state.currentUser.role}`;
    }
  }
  // Show create section for admin/editor
  if (refs.articleCreateSection) {
    refs.articleCreateSection.hidden = !(
      state.currentUser &&
      (state.currentUser.role === "admin" ||
        state.currentUser.role === "editor")
    );
  }
  if (refs.btnSelectUserManage) {
    refs.btnSelectUserManage.hidden = !(
      state.currentUser && state.currentUser.role === "admin"
    );
  }
  loadArticleList().catch((e) => alert(e.message));
}

function hideArticleSelect() {
  if (refs.articleSelectOverlay) refs.articleSelectOverlay.hidden = true;
}

async function loadArticleList() {
  try {
    const data = await apiRequest("/articles");
    state.articleList = data.articles || [];
    renderArticleGrid();
    // 后台预加载每本古籍的前3页图片
    preloadArticleFirstPages(state.articleList);
  } catch (e) {
    state.articleList = [];
    renderArticleGrid();
  }
}

function renderArticleGrid() {
  if (!refs.articleGrid) return;
  refs.articleGrid.innerHTML = "";

  if (!state.articleList.length) {
    refs.articleGrid.innerHTML =
      '<p style="color:#7f6348;grid-column:1/-1">暂无可访问的文章</p>';
    return;
  }

  state.articleList.forEach((article) => {
    const card = document.createElement("div");
    card.className = "article-card";

    card.innerHTML = `
      <h3>${escapeHtml(article.title || "未命名文章")}</h3>
      <p>${escapeHtml(article.subtitle || "")}</p>
      <p>作者: ${escapeHtml(article.author || "未知")}</p>
      <p style="font-size:11px;color:#a08060">${escapeHtml(article.id)}</p>
      <div class="article-card-actions"></div>
    `;

    card.addEventListener("click", (evt) => {
      if (evt.target.closest(".article-card-actions")) return;
      openArticle(article.id);
    });

    const actions = card.querySelector(".article-card-actions");

    const exportBtn = document.createElement("button");
    exportBtn.textContent = "导出XML";
    exportBtn.addEventListener("click", (evt) => {
      evt.stopPropagation();
      exportArticleXml(article.id, article.title);
    });
    actions.appendChild(exportBtn);

    if (isAdmin()) {
      const accessBtn = document.createElement("button");
      accessBtn.textContent = "权限管理";
      accessBtn.addEventListener("click", (evt) => {
        evt.stopPropagation();
        showAccessDialog(article.id, article.title);
      });
      actions.appendChild(accessBtn);

      const delBtn = document.createElement("button");
      delBtn.textContent = "删除";
      delBtn.className = "danger";
      delBtn.addEventListener("click", (evt) => {
        evt.stopPropagation();
        deleteArticleById(article.id, article.title);
      });
      actions.appendChild(delBtn);
    }

    refs.articleGrid.appendChild(card);
  });
}

async function openArticle(articleId) {
  hideArticleSelect();
  if (refs.btnBackToSelect) refs.btnBackToSelect.hidden = false;
  await loadSnapshot(articleId);
}

function backToArticleSelect() {
  if (refs.btnBackToSelect) refs.btnBackToSelect.hidden = true;
  showArticleSelect();
}

async function createNewArticle() {
  const title = refs.newArticleTitle ? refs.newArticleTitle.value.trim() : "";
  const subtitle = refs.newArticleSubtitle
    ? refs.newArticleSubtitle.value.trim()
    : "";
  const author = refs.newArticleAuthor
    ? refs.newArticleAuthor.value.trim()
    : "";
  if (!title) {
    alert("请输入文章标题");
    return;
  }
  try {
    await apiRequest("/articles", {
      method: "POST",
      body: { title, subtitle, author, book: title, volume: subtitle },
    });
    if (refs.newArticleTitle) refs.newArticleTitle.value = "";
    if (refs.newArticleSubtitle) refs.newArticleSubtitle.value = "";
    if (refs.newArticleAuthor) refs.newArticleAuthor.value = "";
    await loadArticleList();
  } catch (e) {
    alert(e.message);
  }
}

async function deleteArticleById(articleId, title) {
  if (!confirm(`确定删除文章「${title || articleId}」？此操作不可恢复。`))
    return;
  try {
    await apiRequest(`/articles/${encodeURIComponent(articleId)}`, {
      method: "DELETE",
    });
    await loadArticleList();
  } catch (e) {
    alert(e.message);
  }
}

async function exportArticleXml(articleId, title) {
  try {
    const token = getAuthToken();
    const response = await fetch(
      apiPath(`/articles/${encodeURIComponent(articleId)}/export-xml`),
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data && data.message ? data.message : "导出失败");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || articleId}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    alert(e.message);
  }
}

// ── 权限管理弹窗 ──

async function showAccessDialog(articleId, title) {
  state.accessArticleId = articleId;
  if (refs.accessArticleTitle)
    refs.accessArticleTitle.textContent = title || articleId;
  if (refs.articleAccessDialog) refs.articleAccessDialog.hidden = false;

  // Load all users for the dropdown
  try {
    const data = await apiRequest("/users");
    if (refs.accessUserSelect) {
      refs.accessUserSelect.innerHTML = "";
      (data.users || []).forEach((user) => {
        const opt = document.createElement("option");
        opt.value = user.id;
        opt.textContent = `${user.displayName || user.username} (${user.username})`;
        refs.accessUserSelect.appendChild(opt);
      });
    }
  } catch (e) {
    alert(e.message);
  }

  await loadAccessList(articleId);
}

function hideAccessDialog() {
  if (refs.articleAccessDialog) refs.articleAccessDialog.hidden = true;
  state.accessArticleId = null;
}

async function loadAccessList(articleId) {
  try {
    const data = await apiRequest(
      `/articles/${encodeURIComponent(articleId)}/access`,
    );
    renderAccessList(data.users || []);
  } catch (e) {
    renderAccessList([]);
  }
}

function renderAccessList(users) {
  if (!refs.accessUserList) return;
  refs.accessUserList.innerHTML = "";

  if (!users.length) {
    refs.accessUserList.innerHTML =
      '<p style="color:#7f6348;font-size:13px">暂无已授权用户</p>';
    return;
  }

  const roleLabels = { admin: "管理员", editor: "编辑者", reviewer: "审校者" };
  users.forEach((user) => {
    const div = document.createElement("div");
    div.className = "user-item";
    div.innerHTML = `
      <div class="user-item-info">
        <strong>${escapeHtml(user.displayName || user.username)}</strong>
        <span class="role-badge ${user.role}">${roleLabels[user.role] || user.role}</span>
      </div>
      <div class="user-item-actions"></div>
    `;
    const actions = div.querySelector(".user-item-actions");
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "移除";
    removeBtn.className = "danger";
    removeBtn.addEventListener("click", () => revokeAccess(user.id));
    actions.appendChild(removeBtn);
    refs.accessUserList.appendChild(div);
  });
}

async function grantAccess() {
  if (!state.accessArticleId || !refs.accessUserSelect) return;
  const userId = refs.accessUserSelect.value;
  if (!userId) return;
  try {
    await apiRequest(
      `/articles/${encodeURIComponent(state.accessArticleId)}/access`,
      {
        method: "POST",
        body: { userId },
      },
    );
    await loadAccessList(state.accessArticleId);
  } catch (e) {
    alert(e.message);
  }
}

async function revokeAccess(userId) {
  if (!state.accessArticleId) return;
  try {
    await apiRequest(
      `/articles/${encodeURIComponent(state.accessArticleId)}/access/${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
      },
    );
    await loadAccessList(state.accessArticleId);
  } catch (e) {
    alert(e.message);
  }
}

// ── 认证 ──

function showLoginOverlay() {
  if (refs.loginOverlay) refs.loginOverlay.hidden = false;
}

function hideLoginOverlay() {
  if (refs.loginOverlay) refs.loginOverlay.hidden = true;
}

async function doLogin() {
  const username = refs.loginUsername.value.trim();
  const password = refs.loginPassword.value;
  if (!username || !password) {
    refs.loginError.textContent = "请输入用户名和密码";
    refs.loginError.hidden = false;
    return;
  }
  refs.loginError.hidden = true;

  try {
    const response = await fetch(apiPath("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      refs.loginError.textContent = data.message || "登录失败";
      refs.loginError.hidden = false;
      return;
    }
    setAuthToken(data.token);
    state.currentUser = data.user;
    hideLoginOverlay();
    applyPermissions();
    updateUserBar();
    showArticleSelect();
    initSocket();
  } catch (error) {
    refs.loginError.textContent = error.message;
    refs.loginError.hidden = false;
  }
}

function doLogout() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  removeAuthToken();
  state.currentUser = null;
  hideArticleSelect();
  if (refs.btnBackToSelect) refs.btnBackToSelect.hidden = true;
  showLoginOverlay();
  updateUserBar();
}

async function checkAuth() {
  const token = getAuthToken();
  if (!token) {
    showLoginOverlay();
    return false;
  }
  try {
    const data = await apiRequest("/auth/me");
    state.currentUser = data.user;
    hideLoginOverlay();
    applyPermissions();
    updateUserBar();
    showArticleSelect();
    initSocket();
    return true;
  } catch (e) {
    showLoginOverlay();
    return false;
  }
}

function updateUserBar() {
  if (!refs.userBar) return;
  if (!state.currentUser) {
    refs.userBar.hidden = true;
    return;
  }
  refs.userBar.hidden = false;
  refs.userDisplayName.textContent =
    state.currentUser.displayName || state.currentUser.username;
  const roleLabels = { admin: "管理员", editor: "编辑者", reviewer: "审校者" };
  refs.userRoleBadge.textContent =
    roleLabels[state.currentUser.role] || state.currentUser.role;
  refs.userRoleBadge.className = `role-badge ${state.currentUser.role}`;
  if (refs.btnUserManage) {
    refs.btnUserManage.hidden = state.currentUser.role !== "admin";
  }
}

// ── 权限控制 ──

function isEditor() {
  return (
    state.currentUser &&
    (state.currentUser.role === "admin" || state.currentUser.role === "editor")
  );
}

function isAdmin() {
  return state.currentUser && state.currentUser.role === "admin";
}

function canReview() {
  return (
    state.currentUser &&
    (state.currentUser.role === "admin" ||
      state.currentUser.role === "reviewer")
  );
}

function applyPermissions() {
  const editable = isEditor();
  if (refs.toolbarEditControls)
    refs.toolbarEditControls.style.display = editable ? "" : "none";
  if (refs.toolbarAnnotationControls)
    refs.toolbarAnnotationControls.style.display = editable ? "" : "none";
  const aiControls = document.getElementById("toolbar-ai-controls");
  if (aiControls) aiControls.style.display = editable ? "" : "none";
  if (refs.headingAddSection)
    refs.headingAddSection.style.display = editable ? "" : "none";
  if (refs.metaForm) {
    refs.metaForm.querySelectorAll("input").forEach((input) => {
      input.disabled = !editable;
    });
  }
  if (refs.annotationSvg) {
    refs.annotationSvg.style.cursor = editable ? "crosshair" : "default";
  }
}

// ── 审批状态 ──

function renderReviewStatus() {
  const ann = getSelectedAnnotation();
  if (!refs.reviewStatusSection) return;

  if (!ann) {
    refs.reviewStatusSection.hidden = true;
    return;
  }

  refs.reviewStatusSection.hidden = false;
  const status = ann.reviewStatus || "pending";
  const labels = { pending: "待审", approved: "通过", rejected: "驳回" };
  refs.reviewStatusDisplay.innerHTML = `<span class="review-badge ${status}">${labels[status] || status}</span>`;
  if (ann.reviewedBy) {
    refs.reviewStatusDisplay.innerHTML += `<span style="font-size:12px;color:#7f6348"> 审校者: ${escapeHtml(ann.reviewedBy)}</span>`;
  }
}

async function setReviewStatus(annotationIdOrStatus, statusArg) {
  let annId, status;
  if (statusArg !== undefined) {
    annId = annotationIdOrStatus;
    status = statusArg;
  } else {
    annId = state.selectedAnnotationId;
    status = annotationIdOrStatus;
  }
  if (!annId) return;

  // 在所有页面中查找该标注
  let ann = null;
  for (const p of state.pages) {
    ann = p.annotations.find((a) => a.id === annId);
    if (ann) break;
  }
  if (!ann) return;

  try {
    const data = await apiRequest(`/annotations/${encodeURIComponent(annId)}`, {
      method: "PATCH",
      body: {
        reviewStatus: status,
        reviewedBy: state.currentUser ? state.currentUser.displayName : "",
      },
    });
    // 更新所有页面中同 ID 标注的审核状态（同一标注可能作为后代出现在多个页面）
    for (const p of state.pages) {
      const copy = p.annotations.find((a) => a.id === annId);
      if (copy) {
        copy.reviewStatus = data.annotation.reviewStatus;
        copy.reviewedBy = data.annotation.reviewedBy;
      }
    }
    renderReviewStatus();
    drawOverlay();
    buildAnnotationList();
  } catch (e) {
    alert(e.message);
  }
}

// ── 用户管理 ──

function showUserManageDialog() {
  if (refs.userManageDialog) {
    refs.userManageDialog.hidden = false;
    loadUserList();
  }
}

function hideUserManageDialog() {
  if (refs.userManageDialog) refs.userManageDialog.hidden = true;
}

async function loadUserList() {
  if (!refs.userList) return;
  try {
    const data = await apiRequest("/users");
    refs.userList.innerHTML = "";
    (data.users || []).forEach((user) => {
      const div = document.createElement("div");
      div.className = "user-item";
      const roleLabels = {
        admin: "管理员",
        editor: "编辑者",
        reviewer: "审校者",
      };
      div.innerHTML = `
        <div class="user-item-info">
          <strong>${escapeHtml(user.displayName || user.username)}</strong>
          <span class="role-badge ${user.role}">${roleLabels[user.role] || user.role}</span>
          <small>(${escapeHtml(user.username)})</small>
        </div>
        <div class="user-item-actions"></div>
      `;
      const actions = div.querySelector(".user-item-actions");

      const roleSelect = document.createElement("select");
      ["admin", "editor", "reviewer"].forEach((r) => {
        const opt = document.createElement("option");
        opt.value = r;
        opt.textContent = roleLabels[r];
        if (r === user.role) opt.selected = true;
        roleSelect.appendChild(opt);
      });
      roleSelect.addEventListener("change", () => {
        changeUserRole(user.id, roleSelect.value);
      });
      actions.appendChild(roleSelect);

      const resetBtn = document.createElement("button");
      resetBtn.textContent = "重置密码";
      resetBtn.addEventListener("click", () => {
        const newPw = prompt("输入新密码：");
        if (newPw) resetUserPassword(user.id, newPw);
      });
      actions.appendChild(resetBtn);

      if (user.username !== "admin") {
        const delBtn = document.createElement("button");
        delBtn.textContent = "删除";
        delBtn.className = "danger";
        delBtn.addEventListener("click", () => {
          if (confirm(`确定删除用户 ${user.username}？`))
            deleteUserById(user.id);
        });
        actions.appendChild(delBtn);
      }

      refs.userList.appendChild(div);
    });
  } catch (e) {
    alert(e.message);
  }
}

async function createNewUser() {
  const username = refs.newUserUsername.value.trim();
  const password = refs.newUserPassword.value;
  const displayName = refs.newUserDisplayName.value.trim();
  const role = refs.newUserRole.value;
  if (!username || !password) {
    alert("用户名和密码不能为空");
    return;
  }
  try {
    await apiRequest("/auth/register", {
      method: "POST",
      body: { username, password, displayName, role },
    });
    refs.newUserUsername.value = "";
    refs.newUserPassword.value = "";
    refs.newUserDisplayName.value = "";
    loadUserList();
  } catch (e) {
    alert(e.message);
  }
}

async function changeUserRole(userId, role) {
  try {
    await apiRequest(`/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: { role },
    });
    loadUserList();
  } catch (e) {
    alert(e.message);
  }
}

async function resetUserPassword(userId, password) {
  try {
    await apiRequest(`/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: { password },
    });
    alert("密码已重置");
  } catch (e) {
    alert(e.message);
  }
}

async function deleteUserById(userId) {
  try {
    await apiRequest(`/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    loadUserList();
  } catch (e) {
    alert(e.message);
  }
}

function exportGlyphJson() {
  const payload = JSON.stringify(
    {
      count: state.glyphs.length,
      glyphs: state.glyphs,
    },
    null,
    2,
  );
  const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "glyph-mapping.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function importGlyphJson(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const glyphs = Array.isArray(data.glyphs)
      ? data.glyphs
      : Array.isArray(data)
        ? data
        : [];
    if (!glyphs.length) {
      alert("导入文件中没有造字数据");
      return;
    }
    await saveArticleMeta();
    const articleId = normalizeArticleId(state.article.id);
    const result = await apiRequest(
      `/articles/${encodeURIComponent(articleId)}/glyphs/import`,
      {
        method: "POST",
        body: { glyphs },
      },
    );
    const imported = result.imported || 0;
    if (result.glyphs && result.glyphs.length) {
      result.glyphs.forEach((g) => state.glyphs.unshift(g));
    }
    renderGlyphList();
    alert(`成功导入 ${imported} 个造字（重复编码已跳过）`);
  } catch (e) {
    alert(`导入失败: ${e.message}`);
  } finally {
    event.target.value = "";
  }
}

function bindMetaInputs() {
  const textInputs = [
    refs.metaTitle,
    refs.metaSubtitle,
    refs.metaAuthor,
    refs.metaBook,
    refs.metaVolume,
    refs.metaPublishYear,
    refs.metaWritingYear,
  ];

  textInputs.forEach((input) => {
    input.addEventListener("input", () => {
      updateArticleMetaFromForm();
      scheduleSaveArticleMeta();
    });
  });

  refs.metaArticleId.addEventListener("change", () => {
    const targetId = normalizeArticleId(refs.metaArticleId.value);
    loadSnapshot(targetId).catch((error) => alert(error.message));
  });
}

function bindEvents() {
  // Login events
  if (refs.btnLogin) {
    refs.btnLogin.addEventListener("click", () => doLogin());
  }
  if (refs.loginPassword) {
    refs.loginPassword.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") doLogin();
    });
  }
  if (refs.loginUsername) {
    refs.loginUsername.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") refs.loginPassword.focus();
    });
  }
  if (refs.btnLogout) {
    refs.btnLogout.addEventListener("click", doLogout);
  }

  // Article select events
  if (refs.btnBackToSelect) {
    refs.btnBackToSelect.addEventListener("click", backToArticleSelect);
  }
  if (refs.btnCreateArticle) {
    refs.btnCreateArticle.addEventListener("click", () => createNewArticle());
  }
  if (refs.btnSelectLogout) {
    refs.btnSelectLogout.addEventListener("click", doLogout);
  }
  if (refs.btnSelectUserManage) {
    refs.btnSelectUserManage.addEventListener("click", showUserManageDialog);
  }
  // Article access dialog events
  if (refs.btnCloseAccessDialog) {
    refs.btnCloseAccessDialog.addEventListener("click", hideAccessDialog);
  }
  if (refs.btnGrantAccess) {
    refs.btnGrantAccess.addEventListener("click", () => grantAccess());
  }

  // User management events
  if (refs.btnUserManage) {
    refs.btnUserManage.addEventListener("click", showUserManageDialog);
  }
  if (refs.btnCloseUserDialog) {
    refs.btnCloseUserDialog.addEventListener("click", hideUserManageDialog);
  }
  if (refs.btnCloseGlyphPicker) {
    refs.btnCloseGlyphPicker.addEventListener("click", hideGlyphPicker);
  }
  if (refs.glyphPickerDialog) {
    refs.glyphPickerDialog.addEventListener("click", (evt) => {
      if (evt.target === refs.glyphPickerDialog) {
        hideGlyphPicker();
      }
    });
  }
  if (refs.glyphPickerSearch) {
    refs.glyphPickerSearch.addEventListener("input", () => {
      state.glyphPicker.query = refs.glyphPickerSearch.value || "";
      renderGlyphPickerList();
    });
  }
  if (refs.btnCreateUser) {
    refs.btnCreateUser.addEventListener("click", () => createNewUser());
  }

  // AI events
  if (refs.btnAiOcrRegion) {
    refs.btnAiOcrRegion.addEventListener("click", () => aiRecognizeSelected());
  }

  refs.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActiveTab(tab.dataset.tab);
    });
  });

  if (refs.btnAddHeading) {
    refs.btnAddHeading.addEventListener("click", () => {
      addHeadingFromSelection().catch((error) => alert(error.message));
    });
  }

  if (refs.headingTitleInput) {
    refs.headingTitleInput.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        addHeadingFromSelection().catch((error) => alert(error.message));
      }
    });
  }

  refs.imageUpload.addEventListener("change", (evt) => {
    handleImageUpload(evt).catch((error) => {
      const message = error && error.message ? error.message : String(error);
      alert(`导入失败：${message}`);
    });
  });

  refs.btnClearPages.addEventListener("click", () => {
    clearAllPages().catch((error) => alert(error.message));
  });

  if (refs.btnExportXml) {
    refs.btnExportXml.addEventListener("click", () => {
      exportArticleXml(state.article.id, state.article.title);
    });
  }

  refs.btnPrevPage.addEventListener("click", () => switchPage(-1));
  refs.btnNextPage.addEventListener("click", () => switchPage(1));

  if (refs.btnZoomOut) {
    refs.btnZoomOut.addEventListener("click", () => {
      setCanvasZoom(state.canvasView.zoom / 1.2);
    });
  }

  if (refs.btnZoomIn) {
    refs.btnZoomIn.addEventListener("click", () => {
      setCanvasZoom(state.canvasView.zoom * 1.2);
    });
  }

  if (refs.btnZoomReset) {
    refs.btnZoomReset.addEventListener("click", () => {
      resetCanvasView();
    });
  }

  refs.canvasStage.addEventListener("wheel", handleCanvasWheel, {
    passive: false,
  });

  refs.annotationSvg.addEventListener("mousedown", beginDraw);
  refs.annotationSvg.addEventListener("mousemove", moveDraw);
  refs.annotationSvg.addEventListener("mouseup", () => {
    finishDraw().catch((error) => alert(error.message));
  });
  refs.annotationSvg.addEventListener("mouseleave", () => {
    if (state.canvasView.isPanning) {
      endCanvasPan();
      return;
    }
    if (state.drawing) {
      finishDraw().catch((error) => alert(error.message));
    }
  });

  window.addEventListener("mouseup", () => {
    if (state.canvasView.isPanning) {
      endCanvasPan();
    }
  });

  refs.btnAddGlyph.addEventListener("click", () => {
    addGlyph().catch((error) => alert(error.message));
  });

  if (refs.btnCaptureGlyph) {
    refs.btnCaptureGlyph.addEventListener("click", () => {
      captureGlyphFromSelection().catch((error) => alert(error.message));
    });
  }

  if (refs.btnClearCapturedGlyph) {
    refs.btnClearCapturedGlyph.addEventListener("click", () => {
      setGlyphCaptureImage("");
    });
  }

  refs.btnExportGlyph.addEventListener("click", exportGlyphJson);

  if (refs.glyphImportFile) {
    refs.glyphImportFile.addEventListener("change", (evt) => {
      importGlyphJson(evt).catch((e) => alert(e.message));
    });
  }

  bindMetaInputs();
  window.addEventListener("resize", () => {
    if (refs.pageImage.style.display !== "none") {
      refs.canvasStage.style.height = `${refs.pageImage.clientHeight}px`;
      const clamped = clampCanvasView(
        state.canvasView.offsetX,
        state.canvasView.offsetY,
      );
      state.canvasView.offsetX = clamped.x;
      state.canvasView.offsetY = clamped.y;
    }
    applyCanvasView();
    drawOverlay();
  });

  window.addEventListener("keydown", (evt) => {
    if (
      evt.key === "Escape" &&
      refs.glyphPickerDialog &&
      !refs.glyphPickerDialog.hidden
    ) {
      hideGlyphPicker();
    }
  });
}

// ── AI 识别功能 ──

function updateAiButtonStates() {
  if (refs.btnAiOcrRegion) {
    refs.btnAiOcrRegion.disabled = !state.selectedAnnotationId;
  }
}

async function aiRecognizeSelected() {
  const page = getCurrentPage();
  const ann = getSelectedAnnotation();
  if (!page || !ann) return;

  let allRegions = ann.regions || [];
  // 对于句/段级别，从 API 获取完整的跨页区域列表
  if (ann.level === "sentence" || ann.level === "paragraph") {
    try {
      const regionPayload = await apiRequest(
        `/annotations/${encodeURIComponent(ann.id)}/regions`,
      );
      allRegions = regionPayload.regions || allRegions;
    } catch (e) {
      // 获取失败则回退到本地 regions
    }
  }
  if (!allRegions.length) {
    alert("该标注没有区域，无法识别");
    return;
  }

  refs.btnAiOcrRegion.disabled = true;
  refs.btnAiOcrRegion.textContent = "识别中...";
  try {
    if (ann.level === "char") {
      // Char level: just recognize text and fill in (use first region)
      const region = allRegions[0];
      const payload = await apiRequest("/ocr/recognize", {
        method: "POST",
        body: {
          pageId: region.pageId || page.id,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
        },
      });
      const texts = (payload.results || []).map((r) => r.text).join("");
      if (texts) {
        ann.originalText = texts;
        ann.simplifiedText = texts;
        renderAnnotationForm();
        scheduleAnnotationPersist(ann);
      }
    } else {
      // Sentence/Paragraph level: iterate all regions in order, OCR each, concatenate

      // 对于句级别，先删除所有已有的"字"子标注
      if (ann.level === "sentence") {
        const childChars = [];
        for (const p of state.pages) {
          for (const a of p.annotations) {
            if (a.parentId === ann.id && a.level === "char") {
              childChars.push({ annotation: a, page: p });
            }
          }
        }
        for (const { annotation: child, page: childPage } of childChars) {
          await apiRequest(`/annotations/${encodeURIComponent(child.id)}`, {
            method: "DELETE",
          });
          childPage.annotations = childPage.annotations.filter(
            (a) => a.id !== child.id,
          );
        }
      }

      let allOriginalText = "";
      let orderCounter = 0;

      for (const region of allRegions) {
        const regionPageId = region.pageId || page.id;
        const payload = await apiRequest("/ocr/layout-detect", {
          method: "POST",
          body: {
            pageId: regionPageId,
            level: "char",
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
          },
        });
        const detectedRegions = payload.regions || [];
        if (detectedRegions.length > 0) {
          const regionPage =
            state.pages.find((p) => p.id === regionPageId) || page;
          const annotations = detectedRegions.map((r) => ({
            id: uid("ann"),
            charId: uid("char"),
            level: "char",
            style: "highlight",
            color: "#d5533f",
            originalText: r.text || "",
            simplifiedText: r.text || "",
            note: "",
            noteType: "1",
            charCode: "",
            glyphRef: "",
            x: Math.round(r.x),
            y: Math.round(r.y),
            width: Math.round(r.width),
            height: Math.round(r.height),
            parentId: ann.id,
            orderIndex: orderCounter++,
          }));
          const batchPayload = await apiRequest(
            `/pages/${encodeURIComponent(regionPageId)}/annotations/batch`,
            { method: "POST", body: { annotations } },
          );
          (batchPayload.annotations || []).forEach((a) =>
            regionPage.annotations.push(a),
          );
          allOriginalText += detectedRegions.map((r) => r.text || "").join("");
        }
      }

      if (allOriginalText) {
        ann.originalText = allOriginalText;
        ann.simplifiedText = allOriginalText;
        // 立即持久化（不用 debounce），确保后续 reloadPageAnnotations 能拿到最新数据
        if (annotationSaveTimers.has(ann.id)) {
          clearTimeout(annotationSaveTimers.get(ann.id));
          annotationSaveTimers.delete(ann.id);
        }
        await apiRequest(`/annotations/${encodeURIComponent(ann.id)}`, {
          method: "PUT",
          body: ann,
        });
        // 如果该句属于段，更新段的文本并立即持久化
        if (ann.parentId) {
          recalcParentTextFromChildren(ann.parentId);
          if (annotationSaveTimers.has(ann.parentId)) {
            clearTimeout(annotationSaveTimers.get(ann.parentId));
            annotationSaveTimers.delete(ann.parentId);
          }
          let parent = null;
          for (const p of state.pages) {
            parent = p.annotations.find((a) => a.id === ann.parentId);
            if (parent) break;
          }
          if (parent) {
            await apiRequest(`/annotations/${encodeURIComponent(parent.id)}`, {
              method: "PUT",
              body: parent,
            });
          }
        }
      }
      // 无论是否识别到文字，都刷新整个界面（含表单和标注列表）
      renderAll();
    }
  } catch (error) {
    alert("识别失败：" + error.message);
  } finally {
    refs.btnAiOcrRegion.textContent = "识别文字";
    updateAiButtonStates();
  }
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

// ── Socket.IO 实时协作 ──

function initSocket() {
  if (socket) return;
  const token = getAuthToken();
  if (!token) return;

  socket = io({
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect", () => {
    joinCurrentArticleRoom();
    joinCurrentPageRoom();
    refreshCurrentPageAnnotations();
  });

  socket.on("connect_error", (err) => {
    if (err.message === "登录已过期") {
      socket.disconnect();
      socket = null;
      removeAuthToken();
      state.currentUser = null;
      showLoginOverlay();
    }
  });

  socket.on("annotation:created", handleRemoteAnnotationCreated);
  socket.on("annotation:updated", handleRemoteAnnotationUpdated);
  socket.on("annotation:deleted", handleRemoteAnnotationDeleted);
  socket.on("glyph:created", handleRemoteGlyphCreated);
  socket.on("glyph:deleted", handleRemoteGlyphDeleted);
  socket.on("glyph:imported", handleRemoteGlyphImported);
  socket.on("presence:join", handlePresenceJoin);
  socket.on("presence:leave", handlePresenceLeave);
  socket.on("presence:members", handlePresenceMembers);
}

function joinCurrentArticleRoom() {
  if (!socket || !socket.connected || !state.article || !state.article.id)
    return;
  socket.emit("join-article", { articleId: state.article.id });
}

function joinCurrentPageRoom() {
  if (!socket || !socket.connected) return;
  state.presenceUsers = [];
  renderPresenceBar();
  const page = getCurrentPage();
  socket.emit("join-page", { pageId: page ? page.id : null });
}

async function refreshCurrentPageAnnotations() {
  const page = getCurrentPage();
  if (!page || !state.article) return;
  try {
    const snapshot = await apiRequest(
      `/articles/${encodeURIComponent(state.article.id)}/snapshot`,
    );
    const freshPage = (snapshot.pages || []).find((p) => p.id === page.id);
    if (freshPage) {
      page.annotations = freshPage.annotations;
      drawOverlay();
      buildAnnotationList();
      if (state.selectedAnnotationId) {
        renderAnnotationForm();
        renderReviewStatus();
      }
    }
  } catch (e) {
    // Silently ignore refresh failures
  }
}

function handleRemoteAnnotationCreated({ annotation, pageId }) {
  const page = state.pages.find((p) => p.id === pageId);
  if (!page) return;
  if (page.annotations.some((a) => a.id === annotation.id)) return;
  page.annotations.push(annotation);
  if (getCurrentPage() && getCurrentPage().id === pageId) {
    drawOverlay();
    buildAnnotationList();
  }
}

function handleRemoteAnnotationUpdated({ annotation, pageId }) {
  // 本地防抖编辑期间，保留可编辑字段，但始终同步审核字段，避免跨页审核状态不同步。
  const protectedFieldsWhenLocalEditing = [
    "level",
    "style",
    "color",
    "originalText",
    "simplifiedText",
    "note",
    "noteType",
    "charCode",
    "glyphRef",
    "parentId",
    "orderIndex",
    "x",
    "y",
    "width",
    "height",
  ];
  const isLocalEditing =
    state.selectedAnnotationId === annotation.id &&
    annotationSaveTimers.has(annotation.id);
  let updated = false;
  for (const p of state.pages) {
    const index = p.annotations.findIndex((a) => a.id === annotation.id);
    if (index === -1) continue;

    const localCopy = p.annotations[index];
    const merged = {
      ...localCopy,
      ...annotation,
      regions: localCopy.regions,
    };

    if (isLocalEditing) {
      protectedFieldsWhenLocalEditing.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(localCopy, field)) {
          merged[field] = localCopy[field];
        }
      });
    }

    p.annotations[index] = merged;
    updated = true;
  }
  if (!updated) return;
  if (getCurrentPage()) {
    drawOverlay();
    buildAnnotationList();
    if (state.selectedAnnotationId === annotation.id) {
      renderAnnotationForm();
      renderReviewStatus();
    }
  }
}

function handleRemoteAnnotationDeleted({ annotationId, pageId }) {
  // 远端删除时同样全局清理，避免某些页面副本残留导致父文本重算错误
  for (const p of state.pages) {
    p.annotations = p.annotations.filter((a) => a.id !== annotationId);
  }
  if (annotationSaveTimers.has(annotationId)) {
    clearTimeout(annotationSaveTimers.get(annotationId));
    annotationSaveTimers.delete(annotationId);
  }
  if (state.selectedAnnotationId === annotationId) {
    state.selectedAnnotationId = null;
  }
  state.headings.forEach((h) => {
    if (h.annotationId === annotationId) h.annotationId = null;
  });
  if (getCurrentPage() && getCurrentPage().id === pageId) {
    drawOverlay();
    buildAnnotationList();
    renderAnnotationForm();
    renderReviewStatus();
  }
}

function handleRemoteGlyphCreated({ articleId, glyph }) {
  if (!state.article || state.article.id !== articleId || !glyph) return;
  if (state.glyphs.some((item) => item.id === glyph.id)) return;
  state.glyphs.unshift(glyph);
  renderAll();
}

function handleRemoteGlyphDeleted({ articleId, glyphId }) {
  if (!state.article || state.article.id !== articleId || !glyphId) return;
  const beforeCount = state.glyphs.length;
  state.glyphs = state.glyphs.filter((item) => item.id !== glyphId);
  if (state.glyphs.length === beforeCount) return;

  state.pages.forEach((page) => {
    page.annotations.forEach((ann) => {
      if (ann.glyphRef === glyphId) {
        ann.glyphRef = "";
      }
    });
  });
  renderAll();
}

function handleRemoteGlyphImported({ articleId, glyphs }) {
  if (
    !state.article ||
    state.article.id !== articleId ||
    !Array.isArray(glyphs)
  ) {
    return;
  }
  let changed = false;
  glyphs.forEach((glyph) => {
    if (!glyph || !glyph.id) return;
    if (state.glyphs.some((item) => item.id === glyph.id)) return;
    state.glyphs.unshift(glyph);
    changed = true;
  });
  if (changed) {
    renderAll();
  }
}

function handlePresenceJoin({ userId, displayName, role }) {
  if (state.currentUser && userId === state.currentUser.id) return;
  if (!state.presenceUsers.some((u) => u.userId === userId)) {
    state.presenceUsers.push({ userId, displayName, role });
  }
  renderPresenceBar();
}

function handlePresenceLeave({ userId }) {
  state.presenceUsers = state.presenceUsers.filter((u) => u.userId !== userId);
  renderPresenceBar();
}

function handlePresenceMembers({ members }) {
  state.presenceUsers = members.filter(
    (m) => !state.currentUser || m.userId !== state.currentUser.id,
  );
  renderPresenceBar();
}

function renderPresenceBar() {
  const bar = document.getElementById("presence-bar");
  if (!bar) return;
  if (!state.presenceUsers.length) {
    bar.innerHTML = "";
    return;
  }
  const avatars = state.presenceUsers
    .map(
      (u) =>
        `<span class="presence-avatar" title="${escapeHtml(u.displayName)}">${escapeHtml((u.displayName || "?").charAt(0))}</span>`,
    )
    .join("");
  bar.innerHTML = `<span class="presence-label">\u5728\u7EBF:</span> ${avatars}`;
}

async function bootstrap() {
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
