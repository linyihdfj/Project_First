/**
 * @description regionhittools相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 创建regionhittools。
 * @param {*} deps 模块依赖集合。
 * @returns {*} regionhittools结果。
 */
window.createRegionHitTools = function createRegionHitTools(deps) {
  const {
    state,
    refs,
    clampValue,
    getCurrentPage,
    getAnnotationById,
    BORDER_HIT_TOLERANCE_PX,
    MIN_HANDLE_SIZE_PX,
    MAX_HANDLE_SIZE_PX,
    HANDLE_HIT_PADDING_PX,
  } = deps;

  /**
   * @description 获取resizehandlemetrics。
   * @param {*} page 页面对象。
   * @returns {*} resizehandlemetrics结果。
   */
  function getResizeHandleMetrics(page) {
    const rect = refs.annotationSvg?.getBoundingClientRect();
    if (!page || !rect || rect.width <= 0 || rect.height <= 0) {
      return {
        visualSizePx: MIN_HANDLE_SIZE_PX,
        hitRadiusPx: MIN_HANDLE_SIZE_PX / 2 + HANDLE_HIT_PADDING_PX,
      };
    }

    const scaleX = rect.width / page.width;
    const scaleY = rect.height / page.height;
    const displayScale = Math.min(scaleX, scaleY);
    const baseHandleSizePx = 8;
    const scaledSizePx = baseHandleSizePx * (0.85 + displayScale * 0.5);
    const visualSizePx = clampValue(
      scaledSizePx,
      MIN_HANDLE_SIZE_PX,
      MAX_HANDLE_SIZE_PX,
    );

    return {
      visualSizePx,
      hitRadiusPx: visualSizePx / 2 + HANDLE_HIT_PADDING_PX,
    };
  }

  /**
   * @description 获取pointerpoint。
   * @param {*} evt 浏览器事件对象。
   * @returns {*} pointerpoint结果。
   */
  function getPointerPoint(evt) {
    const rect = refs.annotationSvg.getBoundingClientRect();
    const page = getCurrentPage();
    if (!page || rect.width <= 0 || rect.height <= 0) {
      return { x: 0, y: 0 };
    }

    const x = ((evt.clientX - rect.left) / rect.width) * page.width;
    const y = ((evt.clientY - rect.top) / rect.height) * page.height;
    return {
      x: clampValue(x, 0, page.width),
      y: clampValue(y, 0, page.height),
    };
  }

  /**
   * @description 获取regionannotation。
   * @param {*} annotationId 标注 ID。
   * @param {*} regionId 区域 ID。
   * @returns {*} regionannotation结果。
   */
  function getRegionFromAnnotation(annotationId, regionId) {
    const ann = getAnnotationById(annotationId);
    if (!ann || !Array.isArray(ann.regions)) {
      return null;
    }
    return ann.regions.find((region) => region.id === regionId) || null;
  }

  /**
   * @description 同步regionacrosspages。
   * @param {*} annotationId 标注 ID。
   * @param {*} regionId 区域 ID。
   * @param {*} rect rect参数。
   * @returns {void} 无返回值。
   */
  function syncRegionAcrossPages(annotationId, regionId, rect) {
    state.pages.forEach((page) => {
      page.annotations
        .filter((ann) => ann.id === annotationId && Array.isArray(ann.regions))
        .forEach((ann) => {
          const region = ann.regions.find((item) => item.id === regionId);
          if (!region) {
            return;
          }
          region.x = rect.x;
          region.y = rect.y;
          region.width = rect.width;
          region.height = rect.height;
        });
    });
  }

  /**
   * @description 获取resizecursorhandle。
   * @param {*} handle handle参数。
   * @returns {*} resizecursorhandle结果。
   */
  function getResizeCursorByHandle(handle) {
    const cursorMap = {
      nw: "nwse-resize",
      n: "ns-resize",
      ne: "nesw-resize",
      e: "ew-resize",
      se: "nwse-resize",
      s: "ns-resize",
      sw: "nesw-resize",
      w: "ew-resize",
    };
    return cursorMap[handle] || "default";
  }

  /**
   * @description 获取regionborderhit。
   * @param {*} region 区域对象。
   * @param {*} page 页面对象。
   * @param {*} evt 浏览器事件对象。
   * @returns {*} regionborderhit结果。
   */
  function getRegionBorderHit(region, page, evt) {
    if (!region || !page || !evt || !refs.annotationSvg) {
      return null;
    }

    const rect = refs.annotationSvg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const pt = getPointerPoint(evt);
    const toleranceX = (BORDER_HIT_TOLERANCE_PX / rect.width) * page.width;
    const toleranceY = (BORDER_HIT_TOLERANCE_PX / rect.height) * page.height;
    const { hitRadiusPx } = getResizeHandleMetrics(page);
    const handleRadiusX = (hitRadiusPx / rect.width) * page.width;
    const handleRadiusY = (hitRadiusPx / rect.height) * page.height;

    const left = Number(region.x);
    const top = Number(region.y);
    const right = left + Number(region.width);
    const bottom = top + Number(region.height);

    const withinBounds =
      pt.x >= left - toleranceX &&
      pt.x <= right + toleranceX &&
      pt.y >= top - toleranceY &&
      pt.y <= bottom + toleranceY;
    if (!withinBounds) {
      return null;
    }

    const handlePoints = [
      { key: "nw", x: left, y: top },
      { key: "n", x: (left + right) / 2, y: top },
      { key: "ne", x: right, y: top },
      { key: "e", x: right, y: (top + bottom) / 2 },
      { key: "se", x: right, y: bottom },
      { key: "s", x: (left + right) / 2, y: bottom },
      { key: "sw", x: left, y: bottom },
      { key: "w", x: left, y: (top + bottom) / 2 },
    ];

    const handleHit = handlePoints.find(
      (item) =>
        Math.abs(pt.x - item.x) <= handleRadiusX &&
        Math.abs(pt.y - item.y) <= handleRadiusY,
    );
    if (handleHit) {
      return {
        type: "resize",
        handle: handleHit.key,
        cursor: getResizeCursorByHandle(handleHit.key),
      };
    }

    const nearLeft =
      Math.abs(pt.x - left) <= toleranceX &&
      pt.y >= top - toleranceY &&
      pt.y <= bottom + toleranceY;
    const nearRight =
      Math.abs(pt.x - right) <= toleranceX &&
      pt.y >= top - toleranceY &&
      pt.y <= bottom + toleranceY;
    const nearTop =
      Math.abs(pt.y - top) <= toleranceY &&
      pt.x >= left - toleranceX &&
      pt.x <= right + toleranceX;
    const nearBottom =
      Math.abs(pt.y - bottom) <= toleranceY &&
      pt.x >= left - toleranceX &&
      pt.x <= right + toleranceX;

    return nearLeft || nearRight || nearTop || nearBottom
      ? { type: "move", cursor: "move" }
      : null;
  }

  /**
   * @description 更新svgcursor。
   * @param {*} cursor cursor参数。
   * @returns {void} 无返回值。
   */
  function updateSvgCursor(cursor) {
    if (!refs.annotationSvg) {
      return;
    }
    refs.annotationSvg.style.cursor = cursor || "default";
  }

  return {
    getPointerPoint,
    getRegionFromAnnotation,
    syncRegionAcrossPages,
    getResizeHandleMetrics,
    getResizeCursorByHandle,
    getRegionBorderHit,
    updateSvgCursor,
  };
};

