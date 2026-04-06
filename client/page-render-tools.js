window.createPageRenderTools = function createPageRenderTools(deps) {
  const {
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
  } = deps;

  async function reloadPageAnnotations(page) {
    if (!page) return;
    try {
      const payload = await apiRequest(
        `/pages/${encodeURIComponent(page.id)}/annotations`,
      );
      page.annotations = payload.annotations || [];
    } catch (error) {}
  }

  function renderEmptyPage() {
    resetCanvasView();
    refs.pageImage.removeAttribute("src");
    refs.pageImage.style.display = "none";
    refs.canvasStage.style.height = "420px";
    refs.pageIndicator.textContent = "页码: 0 / 0";
    refs.canvasMeta.textContent = "未加载页面";
    drawOverlay();
  }

  function syncStageByImage(page) {
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

    waitForImage(page.src).then((url) => {
      if (url && getCurrentPage() === page) refs.pageImage.src = url;
    });
  }

  function renderPage() {
    const page = getCurrentPage();
    if (!page) return renderEmptyPage();

    refs.pageImage.style.display = "block";
    refs.pageImage.src = getCachedImageUrl(page.src);
    preloadAdjacentPages(state.currentPageIndex, state.pages);
    refs.pageIndicator.textContent = `页码: ${state.currentPageIndex + 1} / ${state.pages.length}`;
    refs.canvasMeta.textContent = `${page.name} (${page.width}x${page.height})`;

    reloadPageAnnotations(page).then(() => {
      buildAnnotationList();
      drawOverlay();
      if (state.selectedAnnotationId) {
        renderAnnotationForm();
        renderReviewStatus();
      }
    });

    syncStageByImage(page);
  }

  return {
    reloadPageAnnotations,
    renderPage,
  };
};
