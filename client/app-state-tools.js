window.createAppStateTools = function createAppStateTools(deps) {
  const {
    state,
    refs,
    normalizeArticleId,
    apiRequest,
    resetCanvasView,
    renderAll,
    joinCurrentArticleRoom,
    joinCurrentPageRoom,
    preloadAdjacentPages,
    uid,
  } = deps;

  let metaSaveTimer = null;

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
