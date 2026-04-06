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
    annotationSaveTimers,
  } = deps;

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

  function handleRemoteAnnotationCreated({ annotation, pageId }) {
    const page = state.pages.find((p) => p.id === pageId);
    if (!page || page.annotations.some((a) => a.id === annotation.id)) return;
    page.annotations.push(annotation);
    if (getCurrentPage() && getCurrentPage().id === pageId) {
      drawOverlay();
      buildAnnotationList();
    }
  }

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
          if (Object.prototype.hasOwnProperty.call(localCopy, field))
            merged[field] = localCopy[field];
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

  function handleRemoteAnnotationDeleted({ annotationId, pageId }) {
    state.pages.forEach((p) => {
      p.annotations = p.annotations.filter((a) => a.id !== annotationId);
    });
    if (annotationSaveTimers.has(annotationId)) {
      clearTimeout(annotationSaveTimers.get(annotationId));
      annotationSaveTimers.delete(annotationId);
    }
    if (state.selectedAnnotationId === annotationId)
      state.selectedAnnotationId = null;
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
        if (ann.glyphRef === glyphId) ann.glyphRef = "";
      });
    });
    renderAll();
  }

  function handleRemoteGlyphImported({ articleId, glyphs }) {
    if (
      !state.article ||
      state.article.id !== articleId ||
      !Array.isArray(glyphs)
    )
      return;
    let changed = false;
    glyphs.forEach((glyph) => {
      if (
        !glyph ||
        !glyph.id ||
        state.glyphs.some((item) => item.id === glyph.id)
      )
        return;
      state.glyphs.unshift(glyph);
      changed = true;
    });
    if (changed) renderAll();
  }

  function handlePresenceJoin({ userId, displayName, role }) {
    if (state.currentUser && userId === state.currentUser.id) return;
    if (!state.presenceUsers.some((u) => u.userId === userId)) {
      state.presenceUsers.push({ userId, displayName, role });
    }
    renderPresenceBar();
  }

  function handlePresenceLeave({ userId }) {
    state.presenceUsers = state.presenceUsers.filter(
      (u) => u.userId !== userId,
    );
    renderPresenceBar();
  }

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
    handleRemoteGlyphCreated,
    handleRemoteGlyphDeleted,
    handleRemoteGlyphImported,
    handlePresenceJoin,
    handlePresenceLeave,
    handlePresenceMembers,
  };
};
