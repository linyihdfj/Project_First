window.createPageImportTools = function createPageImportTools(deps) {
  const {
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
  } = deps;

  /**
   * @description 预加载图片并读取其自然尺寸。
   * @param {string} src 图片地址。
   * @returns {Promise<{src:string,width:number,height:number}>}
   */
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

  /**
   * @description 将导入页面批量持久化到后端。
   * @param {Array<object>} importedPages 待保存页面数组。
   * @returns {Promise<Array<object>>} 已保存页面数组。
   */
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

  /**
   * @description 处理页面文件上传（图片/PDF），并替换当前文章页面。
   * @param {Event} event 文件选择事件。
   * @returns {Promise<void>}
   */
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

    if (state.pages.length > 0) {
      await apiRequest(
        `/articles/${encodeURIComponent(state.article.id)}/pages`,
        {
          method: "DELETE",
        },
      );
    }

    state.pages = [];
    state.headings = [];
    state.currentPageIndex = -1;
    state.selectedAnnotationId = null;
    state.selectedHeadingId = null;
    resetCanvasView();

    const savedPages = await persistNewPages(importedPages);
    state.pages = savedPages;
    state.currentPageIndex = state.pages.length ? 0 : -1;
    state.selectedAnnotationId = null;

    event.target.value = "";
    renderAll();
  }

  /**
   * @description 清空当前文章全部页面与标注。
   * @returns {Promise<void>}
   */
  async function clearAllPages() {
    if (!state.pages.length) {
      return;
    }
    if (!window.confirm("确定清空所有页面与标注吗？")) {
      return;
    }
    await apiRequest(
      `/articles/${encodeURIComponent(state.article.id)}/pages`,
      {
        method: "DELETE",
      },
    );
    state.pages = [];
    state.headings = [];
    state.currentPageIndex = -1;
    state.selectedAnnotationId = null;
    state.selectedHeadingId = null;
    resetCanvasView();
    renderAll();
  }

  return {
    loadImageBySrc,
    persistNewPages,
    handleImageUpload,
    clearAllPages,
  };
};
