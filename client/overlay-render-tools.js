window.createOverlayRenderTools = function createOverlayRenderTools(deps) {
  const {
    NS_SVG,
    refs,
    state,
    isEditor,
    getCurrentPage,
    getResizeHandleMetrics,
    getRegionBorderHit,
    startRegionResize,
    startRegionMove,
    flushPendingRegionEdit,
    renderAll,
    renderAnnotationForm,
  } = deps;

  /**
   * @description 基于页面坐标构建单个标注区域 SVG 矩形元素。
   * @param {object} ann 区域数据（包含 x/y/width/height 与 reviewStatus）。
   * @param {object} page 当前页面对象。
   * @param {boolean} selected 是否选中态。
   * @returns {SVGRectElement} 区域矩形节点。
   */
  function buildShapeElement(ann, page, selected) {
    const scaleX = refs.annotationSvg.clientWidth / page.width;
    const scaleY = refs.annotationSvg.clientHeight / page.height;
    const x = ann.x * scaleX;
    const y = ann.y * scaleY;
    const width = ann.width * scaleX;
    const height = ann.height * scaleY;
    const strokeWidth = selected ? 3 : 2;

    const isApproved = ann.reviewStatus === "approved";
    const isRejected = ann.reviewStatus === "rejected";
    const rect = document.createElementNS(NS_SVG, "rect");
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(width));
    rect.setAttribute("height", String(height));
    rect.setAttribute("rx", "3");
    rect.setAttribute("ry", "3");

    if (isApproved) {
      rect.setAttribute("stroke", "#1e7e34");
      rect.setAttribute("fill", "#28a74555");
    } else if (isRejected) {
      rect.setAttribute("stroke", "#dc3545");
      rect.setAttribute("fill", "#dc354555");
    } else {
      rect.setAttribute("stroke", "#d5533f");
      rect.setAttribute("fill", "#d5533f55");
    }

    rect.setAttribute("stroke-width", String(strokeWidth));
    rect.style.cursor = selected ? "move" : "pointer";
    return rect;
  }

  /**
   * @description 为当前区域构建 8 个缩放手柄并绑定事件。
   * @param {number} annotationId 标注 ID。
   * @param {object} region 区域对象。
   * @param {object} page 当前页面对象。
   * @returns {DocumentFragment} 含手柄节点的片段。
   */
  function buildResizeHandles(annotationId, region, page) {
    const scaleX = refs.annotationSvg.clientWidth / page.width;
    const scaleY = refs.annotationSvg.clientHeight / page.height;
    const x = region.x * scaleX;
    const y = region.y * scaleY;
    const width = region.width * scaleX;
    const height = region.height * scaleY;
    const { visualSizePx } = getResizeHandleMetrics(page);
    const handleSize = Math.round(visualSizePx * 10) / 10;

    const handles = [
      { key: "nw", x, y, cursor: "nwse-resize" },
      { key: "n", x: x + width / 2, y, cursor: "ns-resize" },
      { key: "ne", x: x + width, y, cursor: "nesw-resize" },
      { key: "e", x: x + width, y: y + height / 2, cursor: "ew-resize" },
      { key: "se", x: x + width, y: y + height, cursor: "nwse-resize" },
      { key: "s", x: x + width / 2, y: y + height, cursor: "ns-resize" },
      { key: "sw", x, y: y + height, cursor: "nesw-resize" },
      { key: "w", x, y: y + height / 2, cursor: "ew-resize" },
    ];

    const fragment = document.createDocumentFragment();
    handles.forEach((item) => {
      const node = document.createElementNS(NS_SVG, "rect");
      node.setAttribute("x", String(item.x - handleSize / 2));
      node.setAttribute("y", String(item.y - handleSize / 2));
      node.setAttribute("width", String(handleSize));
      node.setAttribute("height", String(handleSize));
      node.setAttribute("fill", "#fff");
      node.setAttribute("stroke", "#d5533f");
      node.setAttribute("stroke-width", "2");
      node.style.cursor = item.cursor;
      node.addEventListener("mousedown", (evt) => {
        startRegionResize(evt, annotationId, region.id, item.key);
      });
      fragment.appendChild(node);
    });
    return fragment;
  }

  /**
   * @description 计算当前页需要展示的标注 ID 集合。
   * @returns {Set<number>} 可见标注 ID 集。
   */
  function getVisibleAnnotationIds() {
    const page = getCurrentPage();
    if (!page || !state.selectedAnnotationId) return new Set();
    return new Set([state.selectedAnnotationId]);
  }

  /**
   * @description 重绘标注覆盖层，包括选中区域、手柄和临时绘制框。
   * @returns {void}
   */
  function drawOverlay() {
    const page = getCurrentPage();
    refs.annotationSvg.innerHTML = "";
    if (!page) return;

    const visibleIds = getVisibleAnnotationIds();
    page.annotations
      .filter((ann) => visibleIds.has(ann.id))
      .forEach((ann) => {
        const selected = ann.id === state.selectedAnnotationId;
        (ann.regions || []).forEach((region) => {
          if (state.selectedRegionId && region.id !== state.selectedRegionId)
            return;
          const regionAnn = {
            ...ann,
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
          };
          const shape = buildShapeElement(regionAnn, page, selected);
          shape.dataset.annId = ann.id;
          shape.dataset.regionId = region.id;

          shape.addEventListener("mousedown", (evt) => {
            if (evt.button !== 0) {
              return;
            }

            const isSelectedRegion =
              state.selectedAnnotationId === ann.id &&
              state.selectedRegionId === region.id;
            if (isEditor() && isSelectedRegion) {
              const hit = getRegionBorderHit(region, page, evt);
              if (hit?.type === "resize")
                return startRegionResize(evt, ann.id, region.id, hit.handle);
              state.pendingRegionMove = {
                annotationId: ann.id,
                regionId: region.id,
                startClientX: evt.clientX,
                startClientY: evt.clientY,
              };
              evt.stopPropagation();
              return;
            }
            evt.stopPropagation();
          });

          shape.addEventListener("click", (evt) => {
            evt.stopPropagation();
            const isCurrent =
              state.selectedAnnotationId === ann.id &&
              state.selectedRegionId === region.id;
            const run = async () => {
              if (isCurrent) {
                await flushPendingRegionEdit();
                state.selectedRegionId = null;
                state.pendingRegionMove = null;
                renderAll({ skipFormRebuild: true });
                renderAnnotationForm();
                return;
              }
              state.selectedAnnotationId = ann.id;
              state.selectedHeadingId = null;
              state.selectedRegionId = region.id;
              renderAll({ skipFormRebuild: true });
              renderAnnotationForm();
            };
            run().catch((error) => alert(error.message));
          });

          shape.addEventListener("dblclick", (evt) => {
            evt.stopPropagation();
            if (state.selectedAnnotationId !== ann.id) return;
            const run = async () => {
              await flushPendingRegionEdit();
              state.selectedAnnotationId = null;
              state.selectedHeadingId = null;
              state.selectedRegionId = null;
              renderAll({ skipFormRebuild: true });
              renderAnnotationForm();
            };
            run().catch((error) => alert(error.message));
          });

          refs.annotationSvg.appendChild(shape);
          if (
            isEditor() &&
            selected &&
            state.selectedRegionId === region.id &&
            !state.addingRegionForAnnotation
          ) {
            refs.annotationSvg.appendChild(
              buildResizeHandles(ann.id, region, page),
            );
          }
        });
      });

    if (state.drawing) {
      const tempAnn = {
        x: Math.min(state.drawing.startX, state.drawing.endX),
        y: Math.min(state.drawing.startY, state.drawing.endY),
        width: Math.abs(state.drawing.endX - state.drawing.startX),
        height: Math.abs(state.drawing.endY - state.drawing.startY),
        style: "highlight",
        color: "#d5533f",
      };
      const shape = buildShapeElement(tempAnn, page, true);
      shape.setAttribute("stroke-dasharray", "8 4");
      refs.annotationSvg.appendChild(shape);
    }
  }

  return {
    buildShapeElement,
    buildResizeHandles,
    getVisibleAnnotationIds,
    drawOverlay,
  };
};
