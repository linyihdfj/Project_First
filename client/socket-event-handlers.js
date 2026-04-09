/**
 * @description socketeventhandlers相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 创建socketeventhandlers。
 * @param {*} deps 模块依赖集合。
 * @returns {*} socketeventhandlers结果。
 */
window.createSocketEventHandlers = function createSocketEventHandlers(deps) {
  const {
    state,
    escapeHtml,
    getCurrentPage,
    apiRequest,
    drawOverlay,
    buildAnnotationList,
    renderAnnotationForm,
    renderReviewStatus,
    renderAll,
    renderHeadingIndex,
    renderHeadingAddTip,
    annotationSaveTimers,
  } = deps;

  /**
   * @description 处理eachannotationcopy相关逻辑。
   * @param {*} annotationId 标注 ID。
   * @param {*} callback 回调函数。
   * @returns {*} eachannotationcopy结果。
   */
  function forEachAnnotationCopy(annotationId, callback) {
    let changed = false;
    state.pages.forEach((page) => {
      page.annotations.forEach((annotation) => {
        if (annotation.id !== annotationId) {
          return;
        }
        callback(annotation, page);
        changed = true;
      });
    });
    return changed;
  }

  /**
   * @description 渲染regionchange。
   * @param {*} pageId 页面 ID。
   * @param {*} annotationId 标注 ID。
   * @returns {void} 无返回值。
   */
  function renderRegionChange(pageId, annotationId) {
    const currentPage = getCurrentPage();
    if (!currentPage || currentPage.id !== pageId) {
      return;
    }
    drawOverlay();
    if (state.selectedAnnotationId === annotationId) {
      renderAnnotationForm();
      renderReviewStatus();
    }
  }

  /**
   * @description 渲染headingchange。
   * @returns {void} 无返回值。
   */
  function renderHeadingChange() {
    renderHeadingAddTip();
    renderHeadingIndex();
  }

  /**
   * @description 渲染presencebar。
   * @returns {void} 无返回值。
   */
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
    bar.innerHTML = `<span class="presence-label">在线:</span> ${avatars}`;
  }

  /**
   * @description 处理refreshcurrentpageannotations相关逻辑。
   * @returns {*} currentpageannotations结果。
   */
  async function refreshCurrentPageAnnotations() {
    const page = getCurrentPage();
    if (!page || !state.article) return;
    try {
      const snapshot = await apiRequest(
        `/articles/${encodeURIComponent(state.article.id)}/snapshot`,
      );
      const freshPage = (snapshot.pages || []).find((p) => p.id === page.id);
      if (!freshPage) return;
      page.annotations = freshPage.annotations;
      drawOverlay();
      buildAnnotationList();
      if (state.selectedAnnotationId) {
        renderAnnotationForm();
        renderReviewStatus();
      }
    } catch (error) {}
  }

  /**
   * @description 处理remoteannotationcreated。
   * @param {*} { annotation {annotation参数。
   * @param {*} pageId } pageid}参数。
   * @returns {void} 无返回值。
   */
  function handleRemoteAnnotationCreated({ annotation, pageId }) {
    const page = state.pages.find((p) => p.id === pageId);
    if (!page || page.annotations.some((a) => a.id === annotation.id)) return;
    page.annotations.push(annotation);
    if (getCurrentPage() && getCurrentPage().id === pageId) {
      drawOverlay();
      buildAnnotationList();
    }
  }

  /**
   * @description 处理remoteannotationupdated。
   * @param {*} { annotation } {annotation}参数。
   * @returns {void} 无返回值。
   */
  function handleRemoteAnnotationUpdated({ annotation }) {
    const protectedFields = [
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
        protectedFields.forEach((field) => {
          if (Object.prototype.hasOwnProperty.call(localCopy, field)) {
            merged[field] = localCopy[field];
          }
        });
      }
      p.annotations[index] = merged;
      updated = true;
    }

    if (!updated || !getCurrentPage()) return;
    drawOverlay();
    buildAnnotationList();
    if (state.selectedAnnotationId === annotation.id) {
      renderAnnotationForm();
      renderReviewStatus();
    }
  }

  /**
   * @description 处理remoteannotationdeleted。
   * @param {*} { annotationId {annotation ID。
   * @param {*} pageId } pageid}参数。
   * @returns {void} 无返回值。
   */
  function handleRemoteAnnotationDeleted({ annotationId, pageId }) {
    state.pages.forEach((p) => {
      p.annotations = p.annotations.filter((a) => a.id !== annotationId);
    });
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

  /**
   * @description 处理remoteregioncreated。
   * @param {*} { annotationId {annotation ID。
   * @param {*} pageId 页面 ID。
   * @param {*} region } region}参数。
   * @returns {void} 无返回值。
   */
  function handleRemoteRegionCreated({ annotationId, pageId, region }) {
    if (!region || !annotationId) {
      return;
    }
    const updated = forEachAnnotationCopy(annotationId, (annotation) => {
      if (!Array.isArray(annotation.regions)) {
        annotation.regions = [];
      }
      if (annotation.regions.some((item) => item.id === region.id)) {
        return;
      }
      annotation.regions.push({ ...region });
    });
    if (updated) {
      renderRegionChange(pageId, annotationId);
    }
  }

  /**
   * @description 处理remoteregionupdated。
   * @param {*} { region {region参数。
   * @param {*} pageId } pageid}参数。
   * @returns {void} 无返回值。
   */
  function handleRemoteRegionUpdated({ region, pageId }) {
    if (!region || !region.annotationId) {
      return;
    }
    const updated = forEachAnnotationCopy(region.annotationId, (annotation) => {
      if (!Array.isArray(annotation.regions)) {
        return;
      }
      const index = annotation.regions.findIndex((item) => item.id === region.id);
      if (index === -1) {
        return;
      }
      annotation.regions[index] = {
        ...annotation.regions[index],
        ...region,
      };
    });
    if (updated) {
      renderRegionChange(pageId, region.annotationId);
    }
  }

  /**
   * @description 处理remoteregiondeleted。
   * @param {*} { regionId {region ID。
   * @param {*} annotationId 标注 ID。
   * @param {*} pageId } pageid}参数。
   * @returns {void} 无返回值。
   */
  function handleRemoteRegionDeleted({ regionId, annotationId, pageId }) {
    if (!regionId || !annotationId) {
      return;
    }
    const updated = forEachAnnotationCopy(annotationId, (annotation) => {
      if (!Array.isArray(annotation.regions)) {
        return;
      }
      annotation.regions = annotation.regions.filter((item) => item.id !== regionId);
    });
    if (!updated) {
      return;
    }
    if (state.selectedRegionId === regionId) {
      state.selectedRegionId = null;
    }
    renderRegionChange(pageId, annotationId);
  }

  /**
   * @description 处理remoteregionreordered。
   * @param {*} { annotationId {annotation ID。
   * @param {*} regionIds region ID 列表。
   * @param {*} pageId } pageid}参数。
   * @returns {void} 无返回值。
   */
  function handleRemoteRegionReordered({ annotationId, regionIds, pageId }) {
    if (!annotationId || !Array.isArray(regionIds)) {
      return;
    }
    const orderMap = new Map(regionIds.map((regionId, index) => [regionId, index]));
    const updated = forEachAnnotationCopy(annotationId, (annotation) => {
      if (!Array.isArray(annotation.regions)) {
        return;
      }
      annotation.regions.sort((left, right) => {
        const leftIndex = orderMap.has(left.id)
          ? orderMap.get(left.id)
          : Number.MAX_SAFE_INTEGER;
        const rightIndex = orderMap.has(right.id)
          ? orderMap.get(right.id)
          : Number.MAX_SAFE_INTEGER;
        return leftIndex - rightIndex;
      });
    });
    if (updated) {
      renderRegionChange(pageId, annotationId);
    }
  }

  /**
   * @description 处理remoteheadingcreated。
   * @param {*} { articleId {article ID。
   * @param {*} heading } heading}参数。
   * @returns {void} 无返回值。
   */
  function handleRemoteHeadingCreated({ articleId, heading }) {
    if (!state.article || state.article.id !== articleId || !heading) {
      return;
    }
    if (state.headings.some((item) => item.id === heading.id)) {
      return;
    }
    state.headings.push(heading);
    renderHeadingChange();
  }

  /**
   * @description 处理remoteheadingupdated。
   * @param {*} { articleId {article ID。
   * @param {*} heading } heading}参数。
   * @returns {void} 无返回值。
   */
  function handleRemoteHeadingUpdated({ articleId, heading }) {
    if (!state.article || state.article.id !== articleId || !heading) {
      return;
    }
    const index = state.headings.findIndex((item) => item.id === heading.id);
    if (index === -1) {
      return;
    }
    state.headings[index] = {
      ...state.headings[index],
      ...heading,
    };
    renderHeadingChange();
  }

  /**
   * @description 处理remoteheadingreordered。
   * @param {*} { articleId {article ID。
   * @param {*} parentId 父级 ID。
   * @param {*} orderedIds } orderedids}参数。
   * @returns {void} 无返回值。
   */
  function handleRemoteHeadingReordered({ articleId, parentId, orderedIds }) {
    if (
      !state.article ||
      state.article.id !== articleId ||
      !Array.isArray(orderedIds)
    ) {
      return;
    }

    const normalizedParentId = parentId || null;
    const orderMap = new Map(orderedIds.map((headingId, index) => [headingId, index]));
    let changed = false;

    state.headings.forEach((heading) => {
      if ((heading.parentId || null) !== normalizedParentId) {
        return;
      }
      if (!orderMap.has(heading.id)) {
        return;
      }
      const nextOrderIndex = orderMap.get(heading.id);
      if (heading.orderIndex !== nextOrderIndex) {
        heading.orderIndex = nextOrderIndex;
        changed = true;
      }
    });

    if (changed) {
      renderHeadingChange();
    }
  }

  /**
   * @description 处理remoteheadingdeleted。
   * @param {*} { articleId {article ID。
   * @param {*} headingId } headingid}参数。
   * @returns {void} 无返回值。
   */
  function handleRemoteHeadingDeleted({ articleId, headingId }) {
    if (!state.article || state.article.id !== articleId || !headingId) {
      return;
    }
    const beforeCount = state.headings.length;
    state.headings = state.headings.filter((item) => item.id !== headingId);
    if (state.headings.length === beforeCount) {
      return;
    }
    if (state.selectedHeadingId === headingId) {
      state.selectedHeadingId = null;
    }
    renderHeadingChange();
  }

  /**
   * @description 处理remoteglyphcreated。
   * @param {*} { articleId {article ID。
   * @param {*} glyph } glyph}参数。
   * @returns {void} 无返回值。
   */
  function handleRemoteGlyphCreated({ articleId, glyph }) {
    if (!state.article || state.article.id !== articleId || !glyph) return;
    if (state.glyphs.some((item) => item.id === glyph.id)) return;
    state.glyphs.unshift(glyph);
    renderAll();
  }

  /**
   * @description 处理remoteglyphdeleted。
   * @param {*} { articleId {article ID。
   * @param {*} glyphId } glyphid}参数。
   * @returns {void} 无返回值。
   */
  function handleRemoteGlyphDeleted({ articleId, glyphId }) {
    if (!state.article || state.article.id !== articleId || !glyphId) return;
    const beforeCount = state.glyphs.length;
    state.glyphs = state.glyphs.filter((item) => item.id !== glyphId);
    if (state.glyphs.length === beforeCount) return;
    state.pages.forEach((page) => {
      page.annotations.forEach((ann) => {
        if (ann.glyphRef === glyphId) ann.glyphRef = "";
      });
    });
    renderAll();
  }

  /**
   * @description 处理remoteglyphimported。
   * @param {*} { articleId {article ID。
   * @param {*} glyphs } glyphs}参数。
   * @returns {void} 无返回值。
   */
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
      if (
        !glyph ||
        !glyph.id ||
        state.glyphs.some((item) => item.id === glyph.id)
      ) {
        return;
      }
      state.glyphs.unshift(glyph);
      changed = true;
    });
    if (changed) renderAll();
  }

  /**
   * @description 处理presencejoin。
   * @param {*} { userId {user ID。
   * @param {*} displayName displayname参数。
   * @param {*} role } role}参数。
   * @returns {void} 无返回值。
   */
  function handlePresenceJoin({ userId, displayName, role }) {
    if (state.currentUser && userId === state.currentUser.id) return;
    if (!state.presenceUsers.some((u) => u.userId === userId)) {
      state.presenceUsers.push({ userId, displayName, role });
    }
    renderPresenceBar();
  }

  /**
   * @description 处理presenceleave。
   * @param {*} { userId } {userid}参数。
   * @returns {void} 无返回值。
   */
  function handlePresenceLeave({ userId }) {
    state.presenceUsers = state.presenceUsers.filter(
      (u) => u.userId !== userId,
    );
    renderPresenceBar();
  }

  /**
   * @description 处理presencemembers。
   * @param {*} { members } {members}参数。
   * @returns {void} 无返回值。
   */
  function handlePresenceMembers({ members }) {
    state.presenceUsers = members.filter(
      (m) => !state.currentUser || m.userId !== state.currentUser.id,
    );
    renderPresenceBar();
  }

  return {
    renderPresenceBar,
    refreshCurrentPageAnnotations,
    handleRemoteAnnotationCreated,
    handleRemoteAnnotationUpdated,
    handleRemoteAnnotationDeleted,
    handleRemoteRegionCreated,
    handleRemoteRegionUpdated,
    handleRemoteRegionDeleted,
    handleRemoteRegionReordered,
    handleRemoteHeadingCreated,
    handleRemoteHeadingUpdated,
    handleRemoteHeadingReordered,
    handleRemoteHeadingDeleted,
    handleRemoteGlyphCreated,
    handleRemoteGlyphDeleted,
    handleRemoteGlyphImported,
    handlePresenceJoin,
    handlePresenceLeave,
    handlePresenceMembers,
  };
};

