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
   * @description 将 state.article 同步到元数据表单输入框。
   * @returns {void}
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
   * @description 从元数据表单读取值并写回 state.article。
   * @returns {void}
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
   * @description 立即保存文章元数据到后端并刷新本地状态。
   * @returns {Promise<void>}
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
   * @description 防抖触发文章元数据保存。
   * @returns {void}
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
   * @description 加载文章快照并重置页面级选择与视图状态。
   * @param {string} articleId 文章 ID。
   * @returns {Promise<void>}
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
   * @description 切换顶部标签页并更新对应面板可见性。
   * @param {string} tabName 目标标签名。
   * @returns {void}
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
   * @description 基于上传图片信息构造页面对象。
   * @param {string} src 图片地址。
   * @param {string} name 页面名称。
   * @param {number} width 图片宽度。
   * @param {number} height 图片高度。
   * @returns {object} 页面数据对象。
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
