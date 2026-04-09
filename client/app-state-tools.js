/**
 * @description appstatetools相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 创建appstatetools。
 * @param {*} deps 模块依赖集合。
 * @returns {*} appstatetools结果。
 */
window.createAppStateTools = function createAppStateTools(deps) {
  const {
    state,
    refs,
    normalizeArticleId,
    apiRequest,
    applyPermissions,
    resetCanvasView,
    renderAll,
    joinCurrentArticleRoom,
    joinCurrentPageRoom,
    preloadAdjacentPages,
    uid,
  } = deps;

  let metaSaveTimer = null;

  /**
   * @description 同步metainputsstate。
   * @returns {void} 无返回值。
   */
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

  /**
   * @description 更新articlemetaform。
   * @returns {void} 无返回值。
   */
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

  /**
   * @description 处理savearticlemeta相关逻辑。
   * @returns {*} articlemeta结果。
   */
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

  /**
   * @description 安排savearticlemeta。
   * @returns {void} 无返回值。
   */
  function scheduleSaveArticleMeta() {
    if (metaSaveTimer) {
      clearTimeout(metaSaveTimer);
    }
    metaSaveTimer = window.setTimeout(() => {
      saveArticleMeta().catch((error) => alert(error.message));
    }, 450);
  }

  /**
   * @description 加载snapshot。
   * @param {*} articleId 文章 ID。
   * @returns {*} snapshot结果。
   */
  async function loadSnapshot(articleId) {
    const payload = await apiRequest(
      `/articles/${encodeURIComponent(articleId)}/snapshot`,
    );
    state.article = payload.article;
    state.currentArticleRole =
      payload.article && payload.article.articleRole
        ? payload.article.articleRole
        : "";
    state.pages = payload.pages || [];
    state.glyphs = payload.glyphs || [];
    state.headings = payload.headings || [];
    state.currentPageIndex = state.pages.length ? 0 : -1;
    state.selectedAnnotationId = null;
    state.selectedHeadingId = null;
    resetCanvasView();
    syncMetaInputsFromState();
    if (typeof applyPermissions === "function") {
      applyPermissions();
    }
    renderAll();
    joinCurrentArticleRoom();
    joinCurrentPageRoom();
    if (state.pages.length > 0) {
      preloadAdjacentPages(0, state.pages);
    }
  }

  /**
   * @description 设置activetab。
   * @param {*} tabName tabname参数。
   * @returns {*} activetab结果。
   */
  function setActiveTab(tabName) {
    refs.tabs.forEach((tab) => {
      const active = tab.dataset.tab === tabName;
      tab.classList.toggle("active", active);
    });
    Object.entries(refs.panes).forEach(([name, pane]) => {
      pane.classList.toggle("active", name === tabName);
    });
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

  return {
    syncMetaInputsFromState,
    updateArticleMetaFromForm,
    saveArticleMeta,
    scheduleSaveArticleMeta,
    loadSnapshot,
    setActiveTab,
    createPageFromImage,
  };
};

