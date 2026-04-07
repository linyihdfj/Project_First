window.createRegionDragTools = function createRegionDragTools(deps) {
  const {
    state,
    clampValue,
    isEditor,
    getCurrentPage,
    getPointerPoint,
    getRegionFromAnnotation,
    syncRegionAcrossPages,
    MIN_REGION_SIZE,
  } = deps;

  /**
   * @description 开始区域缩放操作并记录初始状态。
   * @param {MouseEvent} evt 鼠标事件。
   * @param {number} annotationId 标注 ID。
   * @param {number} regionId 区域 ID。
   * @param {string} handle 缩放手柄方向。
   * @returns {void}
   */
  function startRegionResize(evt, annotationId, regionId, handle) {
    if (!isEditor()) {
      return;
    }
    const page = getCurrentPage();
    if (!page) {
      return;
    }
    const region = getRegionFromAnnotation(annotationId, regionId);
    if (!region) {
      return;
    }

    const pt = getPointerPoint(evt);
    state.regionResize = {
      annotationId,
      regionId,
      handle,
      startX: pt.x,
      startY: pt.y,
      origin: {
        x: Number(region.x),
        y: Number(region.y),
        width: Number(region.width),
        height: Number(region.height),
      },
    };

    state.selectedAnnotationId = annotationId;
    state.selectedRegionId = regionId;
    state.selectedHeadingId = null;
    evt.preventDefault();
    evt.stopPropagation();
  }

  /**
   * @description 开始区域平移操作并记录初始状态。
   * @param {MouseEvent} evt 鼠标事件。
   * @param {number} annotationId 标注 ID。
   * @param {number} regionId 区域 ID。
   * @returns {void}
   */
  function startRegionMove(evt, annotationId, regionId) {
    if (!isEditor()) {
      return;
    }
    const page = getCurrentPage();
    if (!page) {
      return;
    }
    const region = getRegionFromAnnotation(annotationId, regionId);
    if (!region) {
      return;
    }

    const pt = getPointerPoint(evt);
    state.regionMove = {
      annotationId,
      regionId,
      startX: pt.x,
      startY: pt.y,
      origin: {
        x: Number(region.x),
        y: Number(region.y),
        width: Number(region.width),
        height: Number(region.height),
      },
    };

    state.selectedAnnotationId = annotationId;
    state.selectedRegionId = regionId;
    state.selectedHeadingId = null;
    evt.preventDefault();
    evt.stopPropagation();
  }

  /**
   * @description 根据鼠标位移实时更新区域位置。
   * @param {MouseEvent} evt 鼠标事件。
   * @returns {void}
   */
  function updateRegionMove(evt) {
    if (!state.regionMove) {
      return;
    }
    const page = getCurrentPage();
    if (!page) {
      return;
    }

    const pt = getPointerPoint(evt);
    const { startX, startY, origin, annotationId, regionId } = state.regionMove;
    const dx = pt.x - startX;
    const dy = pt.y - startY;

    syncRegionAcrossPages(annotationId, regionId, {
      x: Math.round(clampValue(origin.x + dx, 0, page.width - origin.width)),
      y: Math.round(clampValue(origin.y + dy, 0, page.height - origin.height)),
      width: Math.round(origin.width),
      height: Math.round(origin.height),
    });
  }

  /**
   * @description 根据鼠标位移实时更新区域尺寸与位置。
   * @param {MouseEvent} evt 鼠标事件。
   * @returns {void}
   */
  function updateRegionResize(evt) {
    if (!state.regionResize) {
      return;
    }
    const page = getCurrentPage();
    if (!page) {
      return;
    }

    const pt = getPointerPoint(evt);
    const { startX, startY, origin, handle, annotationId, regionId } =
      state.regionResize;
    const dx = pt.x - startX;
    const dy = pt.y - startY;

    let left = origin.x;
    let top = origin.y;
    let right = origin.x + origin.width;
    let bottom = origin.y + origin.height;

    if (handle.includes("w")) {
      left = clampValue(origin.x + dx, 0, right - MIN_REGION_SIZE);
    }
    if (handle.includes("e")) {
      right = clampValue(
        origin.x + origin.width + dx,
        left + MIN_REGION_SIZE,
        page.width,
      );
    }
    if (handle.includes("n")) {
      top = clampValue(origin.y + dy, 0, bottom - MIN_REGION_SIZE);
    }
    if (handle.includes("s")) {
      bottom = clampValue(
        origin.y + origin.height + dy,
        top + MIN_REGION_SIZE,
        page.height,
      );
    }

    syncRegionAcrossPages(annotationId, regionId, {
      x: Math.round(left),
      y: Math.round(top),
      width: Math.round(right - left),
      height: Math.round(bottom - top),
    });
  }

  return {
    startRegionResize,
    startRegionMove,
    updateRegionMove,
    updateRegionResize,
  };
};
