window.createGlyphPickerTools = function createGlyphPickerTools(deps) {
  const {
    state,
    refs,
    escapeHtml,
    isEditor,
    getAnnotationById,
    scheduleAnnotationPersist,
    renderAnnotationForm,
    drawOverlay,
  } = deps;

  function getGlyphById(glyphId) {
    if (!glyphId) return null;
    return state.glyphs.find((item) => item.id === glyphId) || null;
  }

  function glyphDisplayText(glyph) {
    if (!glyph) return "未关联造字";
    return `${glyph.code} - ${glyph.name || "未命名"}`;
  }

  function hideGlyphPicker() {
    if (refs.glyphPickerDialog) refs.glyphPickerDialog.hidden = true;
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
      item.addEventListener("click", () =>
        applyGlyphToCurrentAnnotation(glyph.id),
      );
      refs.glyphPickerList.appendChild(item);
    });
  }

  function openGlyphPickerForAnnotation(annotationId) {
    if (!annotationId || !refs.glyphPickerDialog) return;
    const ann = getAnnotationById(annotationId);
    if (!ann) return;
    state.glyphPicker.annotationId = annotationId;
    state.glyphPicker.query = "";
    refs.glyphPickerDialog.hidden = false;
    if (refs.glyphPickerSearch) refs.glyphPickerSearch.value = "";
    renderGlyphPickerList();
    if (refs.glyphPickerSearch) refs.glyphPickerSearch.focus();
  }

  function fillGlyphRefControl(fragment, glyphRefEl, ann) {
    glyphRefEl.value = ann.glyphRef || "";
    const displayEl = fragment.querySelector('[data-role="glyph-display"]');
    const openBtn = fragment.querySelector('[data-action="open-glyph-picker"]');
    const clearBtn = fragment.querySelector('[data-action="clear-glyph-ref"]');
    const linkedGlyph = getGlyphById(ann.glyphRef);

    if (displayEl) displayEl.value = glyphDisplayText(linkedGlyph);
    if (openBtn) {
      openBtn.disabled = !isEditor();
      openBtn.addEventListener("click", () =>
        openGlyphPickerForAnnotation(ann.id),
      );
    }
    if (clearBtn) {
      clearBtn.disabled = !isEditor() || !ann.glyphRef;
      clearBtn.addEventListener("click", () =>
        clearGlyphRefForAnnotation(ann.id),
      );
    }
  }

  return {
    getGlyphById,
    glyphDisplayText,
    fillGlyphRefControl,
    openGlyphPickerForAnnotation,
    hideGlyphPicker,
    clearGlyphRefForAnnotation,
    applyGlyphToCurrentAnnotation,
    renderGlyphPickerList,
  };
};
