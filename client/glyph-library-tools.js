window.createGlyphLibraryTools = function createGlyphLibraryTools(deps) {
  const {
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
  } = deps;

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
      return;
    }

    refs.glyphCapturePreview.removeAttribute("src");
    refs.glyphCapturePreviewWrap.hidden = true;
  }

  async function captureGlyphFromSelection() {
    const page = getCurrentPage();
    const ann = getSelectedAnnotation();

    if (!page || !ann) {
      throw new Error("请先在编辑器中框选并选中一个标注，再执行截取。");
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
      `已截取字样图 (${sw}x${sh})，可直接点击“加入造字库”保存。`,
    );
    setActiveTab("glyph");
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
        body: { code, name, note, imgDataUrl },
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

  function exportGlyphJson() {
    const payload = JSON.stringify(
      {
        count: state.glyphs.length,
        glyphs: state.glyphs,
      },
      null,
      2,
    );
    const blob = new Blob([payload], {
      type: "application/json;charset=utf-8",
    });
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
        result.glyphs.forEach((glyph) => state.glyphs.unshift(glyph));
      }

      renderGlyphList();
      alert(`成功导入 ${imported} 个造字（重复编码已跳过）`);
    } catch (error) {
      alert(`导入失败: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  }

  return {
    setGlyphCaptureImage,
    captureGlyphFromSelection,
    renderGlyphList,
    deleteGlyph,
    addGlyph,
    exportGlyphJson,
    importGlyphJson,
  };
};
