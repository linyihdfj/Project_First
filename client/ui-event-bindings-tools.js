/**
 * @description uieventbindingstools相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 创建uieventbindingstools。
 * @param {*} deps 模块依赖集合。
 * @returns {*} uieventbindingstools结果。
 */
window.createUiEventBindingsTools = function createUiEventBindingsTools(deps) {
  const {
    state,
    refs,
    normalizeArticleId,
    loadSnapshot,
    updateArticleMetaFromForm,
    scheduleSaveArticleMeta,
    doLogin,
    doInviteRegister,
    showInviteLoginMode,
    showInviteRegisterMode,
    doLogout,
    backToArticleSelect,
    createNewArticle,
    showUserManageDialog,
    hideAccessDialog,
    grantAccess,
    createInvite,
    hideUserManageDialog,
    hideGlyphPicker,
    renderGlyphPickerList,
    createNewUser,
    aiRecognizeSelected,
    setActiveTab,
    addHeadingFromSelection,
    handleImageUpload,
    clearAllPages,
    exportArticleXml,
    switchPage,
    jumpToPage,
    setCanvasZoom,
    resetCanvasView,
    handleCanvasWheel,
    beginDraw,
    moveDraw,
    finishDraw,
    updateSvgCursor,
    endCanvasPan,
    addGlyph,
    captureGlyphFromSelection,
    setGlyphCaptureImage,
    exportGlyphJson,
    importGlyphJson,
    clampCanvasView,
    applyCanvasView,
    drawOverlay,
  } = deps;

  /**
   * @description 绑定metainputs。
   * @returns {void} 无返回值。
   */
  function bindMetaInputs() {
    const textInputs = [
      refs.metaTitle,
      refs.metaSubtitle,
      refs.metaAuthor,
      refs.metaBook,
      refs.metaVolume,
      refs.metaPublishYear,
      refs.metaWritingYear,
    ].filter(Boolean);

    textInputs.forEach((input) => {
      input.addEventListener("input", () => {
        updateArticleMetaFromForm();
        scheduleSaveArticleMeta();
      });
    });

    if (refs.metaArticleId) {
      refs.metaArticleId.addEventListener("change", () => {
        const targetId = normalizeArticleId(refs.metaArticleId.value);
        loadSnapshot(targetId).catch((error) => alert(error.message));
      });
    }
  }

  /**
   * @description 绑定events。
   * @returns {void} 无返回值。
   */
  function bindEvents() {
    if (refs.btnLogin) {
      refs.btnLogin.addEventListener("click", () => doLogin());
    }
    if (refs.btnInviteRegister) {
      refs.btnInviteRegister.addEventListener("click", () => doInviteRegister());
    }
    if (refs.btnShowInviteRegister) {
      refs.btnShowInviteRegister.addEventListener("click", () =>
        showInviteRegisterMode(),
      );
    }
    if (refs.btnShowInviteLogin) {
      refs.btnShowInviteLogin.addEventListener("click", () =>
        showInviteLoginMode(),
      );
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

    if (refs.btnCloseAccessDialog) {
      refs.btnCloseAccessDialog.addEventListener("click", hideAccessDialog);
    }
    if (refs.btnGrantAccess) {
      refs.btnGrantAccess.addEventListener("click", () => grantAccess());
    }
    if (refs.btnCreateInvite) {
      refs.btnCreateInvite.addEventListener("click", () => createInvite());
    }

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

    if (refs.btnAiOcrRegion) {
      refs.btnAiOcrRegion.addEventListener("click", () =>
        aiRecognizeSelected(),
      );
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
    if (refs.btnPageJump) {
      refs.btnPageJump.addEventListener("click", () => {
        jumpToPage(refs.pageJumpInput ? refs.pageJumpInput.value : "");
      });
    }
    if (refs.pageJumpInput) {
      refs.pageJumpInput.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter") {
          jumpToPage(refs.pageJumpInput.value);
        }
      });
    }

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

    refs.annotationSvg.addEventListener("mousedown", (evt) => {
      beginDraw(evt).catch((error) => alert(error.message));
    });
    refs.annotationSvg.addEventListener("mousemove", moveDraw);
    refs.annotationSvg.addEventListener("mouseup", () => {
      finishDraw().catch((error) => alert(error.message));
    });
    refs.annotationSvg.addEventListener("mouseleave", () => {
      updateSvgCursor("default");
      if (state.canvasView.isPanning) {
        endCanvasPan();
        return;
      }
    });

    window.addEventListener("mousemove", (evt) => {
      if (
        state.canvasView.isPanning ||
        state.regionResize ||
        state.regionMove ||
        state.drawing
      ) {
        moveDraw(evt);
      }
    });

    window.addEventListener("mouseup", () => {
      if (state.canvasView.isPanning) {
        endCanvasPan();
      }
      if (state.regionResize || state.regionMove || state.drawing) {
        finishDraw().catch((error) => alert(error.message));
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

  return {
    bindEvents,
  };
};

