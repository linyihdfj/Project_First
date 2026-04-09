/**
 * @description annotationformtools相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 创建annotationformtools。
 * @param {*} deps 模块依赖集合。
 * @returns {*} annotationformtools结果。
 */
window.createAnnotationFormTools = function createAnnotationFormTools(deps) {
  const {
    state,
    refs,
    escapeHtml,
    isEditor,
    getSelectedAnnotation,
    fillGlyphRefControl,
    drawOverlay,
    scheduleAnnotationPersist,
    recalcParentTextFromChildren,
    buildAnnotationList,
    removeSelectedAnnotation,
    apiRequest,
    getCurrentPage,
    renderAll,
  } = deps;

  /**
   * @description ?????
   * @param {*} annotationId ?? ID?
   * @param {*} regions ???
   * @param {*} draggedId dragged ID?
   * @param {*} targetId target ID?
   * @param {*} position position?
   * @param {*} container container?
   * @returns {Promise<void>} ?????
   */

  async function reorderRegions(
    annotationId,
    regions,
    draggedId,
    targetId,
    position,
    container,
  ) {
    const ids = regions
      .map((region) => region.id)
      .filter((id) => id !== draggedId);
    const targetIdx = ids.indexOf(targetId);
    if (position === "before") {
      ids.splice(targetIdx, 0, draggedId);
    } else {
      ids.splice(targetIdx + 1, 0, draggedId);
    }

    try {
      await apiRequest(
        `/annotations/${encodeURIComponent(annotationId)}/regions/reorder`,
        {
          method: "PUT",
          body: { regionIds: ids },
        },
      );

      const ann = getSelectedAnnotation();
      if (ann && ann.regions) {
        ann.regions.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
      }
      loadAnnotationRegions(annotationId, container);
      drawOverlay();
    } catch (error) {
      alert("排序失败：" + error.message);
    }
  }

  /**
   * @description 加载annotationregions。
   * @param {*} annotationId 标注 ID。
   * @param {*} container container参数。
   * @returns {*} annotationregions结果。
   */
  async function loadAnnotationRegions(annotationId, container) {
    try {
      const payload = await apiRequest(
        `/annotations/${encodeURIComponent(annotationId)}/regions`,
      );
      const regions = payload.regions || [];
      if (!regions.length) {
        container.innerHTML = "<p class='empty-tip'>无区域</p>";
        return;
      }

      container.innerHTML = "";
      const currentPage = getCurrentPage();
      const editable = isEditor();

      regions.forEach((region, idx) => {
        const div = document.createElement("div");
        const isSelected = state.selectedRegionId === region.id;
        div.className =
          "region-item" +
          (currentPage && region.pageId === currentPage.id
            ? " current-page"
            : "") +
          (isSelected ? " region-selected" : "");
        div.draggable = editable;
        div.dataset.regionId = region.id;
        div.dataset.regionIdx = idx;

        const page = state.pages.find((item) => item.id === region.pageId);
        const label = page ? page.name : region.pageId;
        const isCurrent = currentPage && region.pageId === currentPage.id;
        const handleHtml = editable
          ? '<span class="region-drag-handle">⋮⋮</span>'
          : "";
        const deleteHtml = editable
          ? `<button class="ai-btn-sm reject" data-region-id="${escapeHtml(region.id)}">×</button>`
          : "";
        div.innerHTML = `${handleHtml}
        <span class="region-label">${escapeHtml(label)} (${region.x},${region.y} ${region.width}x${region.height})${isCurrent ? " 当前页" : ""}</span>
        ${deleteHtml}`;

        div.addEventListener("click", (evt) => {
          if (
            evt.target.closest("button[data-region-id]") ||
            evt.target.closest(".region-drag-handle")
          ) {
            return;
          }

          if (state.selectedRegionId === region.id) {
            state.selectedRegionId = null;
          } else {
            state.selectedRegionId = region.id;
            const pageIdx = state.pages.findIndex(
              (item) => item.id === region.pageId,
            );
            if (pageIdx >= 0 && pageIdx !== state.currentPageIndex) {
              state.currentPageIndex = pageIdx;
            }
          }

          container.querySelectorAll(".region-item").forEach((el) => {
            el.classList.toggle(
              "region-selected",
              el.dataset.regionId === state.selectedRegionId,
            );
          });
          renderAll({ skipFormRebuild: true });
        });

        if (editable) {
          div.addEventListener("dragstart", (evt) => {
            evt.dataTransfer.setData("text/region-id", region.id);
            evt.dataTransfer.effectAllowed = "move";
            div.classList.add("dragging");
          });
          div.addEventListener("dragend", () =>
            div.classList.remove("dragging"),
          );
          div.addEventListener("dragover", (evt) => {
            evt.preventDefault();
            evt.dataTransfer.dropEffect = "move";
            const rect = div.getBoundingClientRect();
            const relY = evt.clientY - rect.top;
            div.classList.remove("drop-before", "drop-after");
            if (relY < rect.height / 2) {
              div.classList.add("drop-before");
            } else {
              div.classList.add("drop-after");
            }
          });
          div.addEventListener("dragleave", () =>
            div.classList.remove("drop-before", "drop-after"),
          );
          div.addEventListener("drop", (evt) => {
            evt.preventDefault();
            div.classList.remove("drop-before", "drop-after");
            const draggedId = evt.dataTransfer.getData("text/region-id");
            if (!draggedId || draggedId === region.id) return;
            const rect = div.getBoundingClientRect();
            const relY = evt.clientY - rect.top;
            const position = relY < rect.height / 2 ? "before" : "after";
            reorderRegions(
              annotationId,
              regions,
              draggedId,
              region.id,
              position,
              container,
            );
          });

          div
            .querySelector("button[data-region-id]")
            .addEventListener("click", async () => {
              await apiRequest(
                `/annotation-regions/${encodeURIComponent(region.id)}`,
                { method: "DELETE" },
              );
              const ann = getSelectedAnnotation();
              if (ann && ann.regions) {
                ann.regions = ann.regions.filter(
                  (item) => item.id !== region.id,
                );
              }
              renderAnnotationForm();
              drawOverlay();
            });
        }

        container.appendChild(div);
      });
    } catch (error) {
      container.innerHTML = "<p class='empty-tip'>加载失败</p>";
    }
  }

  /**
   * @description 渲染annotationform。
   * @returns {void} 无返回值。
   */
  function renderAnnotationForm() {
    refs.annotationForm.innerHTML = "";
    const ann = getSelectedAnnotation();
    if (!ann) {
      const p = document.createElement("p");
      p.className = "empty-tip";
      p.textContent = "当前未选中标注。";
      refs.annotationForm.appendChild(p);
      return;
    }

    const fragment = refs.annotationFormTemplate.content.cloneNode(true);

    const hideFields = {
      paragraph: [
        "id",
        "charCode",
        "glyphRef",
        "x",
        "y",
        "width",
        "height",
        "style",
        "color",
      ],
      sentence: [
        "id",
        "charCode",
        "glyphRef",
        "x",
        "y",
        "width",
        "height",
        "style",
        "color",
      ],
      char: ["id", "charCode", "x", "y", "width", "height", "style", "color"],
      image: [
        "id",
        "charCode",
        "glyphRef",
        "originalText",
        "simplifiedText",
        "x",
        "y",
        "width",
        "height",
        "style",
        "color",
      ],
    };

    const toHide = new Set(hideFields[ann.level] || []);
    fragment.querySelectorAll("[data-field]").forEach((el) => {
      if (toHide.has(el.dataset.field)) el.closest("label").remove();
    });

    if (ann.level === "paragraph" || ann.level === "sentence") {
      fragment
        .querySelectorAll(
          '[data-field="originalText"], [data-field="simplifiedText"]',
        )
        .forEach((el) => {
          el.disabled = true;
        });
    }

    const fieldElements = fragment.querySelectorAll("[data-field]");
    fieldElements.forEach((el) => {
      const field = el.dataset.field;
      if (field === "glyphRef") {
        fillGlyphRefControl(fragment, el, ann);
        return;
      }

      el.value = ann[field] ?? "";
      if (!el.disabled) {
        el.addEventListener("input", () => {
          ann[field] = el.value;
          drawOverlay();
          scheduleAnnotationPersist(ann);
          if (
            ann.parentId &&
            (field === "originalText" || field === "simplifiedText")
          ) {
            recalcParentTextFromChildren(ann.parentId);
          }
          buildAnnotationList();
        });
      }
    });

    const deleteBtn = fragment.querySelector("[data-action=delete]");
    if (isEditor()) {
      deleteBtn.addEventListener("click", () => {
        removeSelectedAnnotation().catch((error) => alert(error.message));
      });
    } else {
      deleteBtn.style.display = "none";
    }

    if (!isEditor()) {
      fragment
        .querySelectorAll("input:not([disabled]), select")
        .forEach((el) => {
          el.disabled = true;
        });
      fragment
        .querySelectorAll(
          'button[data-action="open-glyph-picker"], button[data-action="clear-glyph-ref"]',
        )
        .forEach((el) => {
          el.disabled = true;
        });
    }

    refs.annotationForm.appendChild(fragment);

    if (ann.level === "paragraph" || ann.level === "sentence") {
      const crossDiv = document.createElement("div");
      crossDiv.className = "region-controls";

      if (isEditor()) {
        const btnAdd = document.createElement("button");
        btnAdd.type = "button";
        btnAdd.className = "btn-add-region";
        if (state.addingRegionForAnnotation === ann.id) {
          btnAdd.textContent = "取消画框";
          btnAdd.classList.add("active");
        } else {
          btnAdd.textContent = "添加区域";
        }
        btnAdd.addEventListener("click", () => {
          if (state.addingRegionForAnnotation === ann.id) {
            state.addingRegionForAnnotation = null;
          } else {
            state.addingRegionForAnnotation = ann.id;
          }
          renderAnnotationForm();
        });
        crossDiv.appendChild(btnAdd);

        if (state.addingRegionForAnnotation === ann.id) {
          const tip = document.createElement("p");
          tip.className = "region-tip";
          tip.textContent =
            "请在当前页面，或切换到目标页面后，在画布上框选该标注对应的区域。";
          crossDiv.appendChild(tip);
        }
      }

      const regionList = document.createElement("div");
      regionList.className = "region-list";
      regionList.id = "region-list";
      crossDiv.appendChild(regionList);
      refs.annotationForm.appendChild(crossDiv);

      loadAnnotationRegions(ann.id, regionList);
    }
  }

  return {
    renderAnnotationForm,
  };
};

