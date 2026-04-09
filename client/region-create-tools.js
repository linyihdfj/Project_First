/**
 * @description regioncreatetools相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 创建regioncreatetools。
 * @param {*} deps 模块依赖集合。
 * @returns {*} regioncreatetools结果。
 */
window.createRegionCreateTools = function createRegionCreateTools(deps) {
  const {
    state,
    isEditor,
    apiRequest,
    renderAll,
    drawOverlay,
    getCurrentPage,
    getPointerPoint,
    getRegionFromAnnotation,
    updateSvgCursor,
    shouldStartPanning,
    beginCanvasPan,
    moveCanvasPan,
    endCanvasPan,
    panCanvasBy,
    getRegionBorderHit,
    updateRegionMove,
    updateRegionResize,
  } = deps;
  const { buildDraftPayload, persistDraggedRegion, addRegionToExisting } =
    window.createRegionCreateHelpers(deps);

  const EDGE_TRIGGER_PX = 40;
  const REGION_MOVE_DRAG_THRESHOLD_PX = 3;
  const AUTO_PAN_MIN_STEP = 2;
  const AUTO_PAN_MAX_STEP = 10;
  const AUTO_PAN_INTERVAL_MS = 20;
  let autoPanTimer = null;
  let lastPointerClientX = null;
  let lastPointerClientY = null;

  /**
   * @description 处理computeautopandelta相关逻辑。
   * @param {*} clientY clienty参数。
   * @param {*} viewportHeight viewportheight参数。
   * @returns {*} autopandelta结果。
   */
  function computeAutoPanDelta(clientY, viewportHeight) {
    if (!Number.isFinite(clientY) || !Number.isFinite(viewportHeight)) {
      return 0;
    }

    if (clientY <= EDGE_TRIGGER_PX) {
      const intensity = (EDGE_TRIGGER_PX - clientY) / EDGE_TRIGGER_PX;
      const step =
        AUTO_PAN_MIN_STEP +
        (AUTO_PAN_MAX_STEP - AUTO_PAN_MIN_STEP) * Math.max(0, intensity);
      return Math.round(step);
    }

    const bottomTriggerStart = viewportHeight - EDGE_TRIGGER_PX;
    if (clientY >= bottomTriggerStart) {
      const intensity = (clientY - bottomTriggerStart) / EDGE_TRIGGER_PX;
      const step =
        AUTO_PAN_MIN_STEP +
        (AUTO_PAN_MAX_STEP - AUTO_PAN_MIN_STEP) * Math.max(0, intensity);
      return -Math.round(step);
    }

    return 0;
  }

  /**
   * @description 同步drawingpointer。
   * @returns {void} 无返回值。
   */
  function syncDrawingPointer() {
    if (
      !state.drawing ||
      !Number.isFinite(lastPointerClientX) ||
      !Number.isFinite(lastPointerClientY)
    ) {
      return;
    }
    const pt = getPointerPoint({
      clientX: lastPointerClientX,
      clientY: lastPointerClientY,
    });
    state.drawing.endX = pt.x;
    state.drawing.endY = pt.y;
  }

  /**
   * @description 应用autopandelta。
   * @param {*} deltaY deltay参数。
   * @returns {void} 无返回值。
   */
  function applyAutoPanDelta(deltaY) {
    if (!deltaY) {
      return false;
    }

    if (typeof panCanvasBy === "function") {
      const beforeOffsetY = state.canvasView.offsetY;
      panCanvasBy(0, deltaY);
      return state.canvasView.offsetY !== beforeOffsetY;
    }
    return false;
  }

  /**
   * @description 处理maybeautopanwhiledrawing相关逻辑。
   * @param {*} evt 浏览器事件对象。
   * @returns {*} autopanwhiledrawing结果。
   */
  function maybeAutoPanWhileDrawing(evt) {
    if (!state.drawing) {
      return;
    }
    if (!Number.isFinite(evt.clientX) || !Number.isFinite(evt.clientY)) {
      return;
    }
    lastPointerClientX = evt.clientX;
    lastPointerClientY = evt.clientY;

    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight || 0;
    if (!viewportHeight) {
      return;
    }
    const deltaY = computeAutoPanDelta(evt.clientY, viewportHeight);
    if (!deltaY) {
      return;
    }
    if (applyAutoPanDelta(deltaY)) {
      syncDrawingPointer();
      drawOverlay();
    }
  }

  /**
   * @description 开始autopanloop。
   * @returns {void} 无返回值。
   */
  function startAutoPanLoop() {
    if (autoPanTimer) {
      return;
    }
    autoPanTimer = window.setInterval(() => {
      if (
        !state.drawing ||
        !Number.isFinite(lastPointerClientX) ||
        !Number.isFinite(lastPointerClientY)
      ) {
        return;
      }
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight || 0;
      if (!viewportHeight) {
        return;
      }
      const deltaY = computeAutoPanDelta(lastPointerClientY, viewportHeight);
      if (!deltaY) {
        return;
      }
      if (applyAutoPanDelta(deltaY)) {
        syncDrawingPointer();
        drawOverlay();
      }
    }, AUTO_PAN_INTERVAL_MS);
  }

  /**
   * @description 停止autopanloop。
   * @returns {void} 无返回值。
   */
  function stopAutoPanLoop() {
    if (autoPanTimer) {
      window.clearInterval(autoPanTimer);
      autoPanTimer = null;
    }
    lastPointerClientX = null;
    lastPointerClientY = null;
  }

  /**
   * @description 处理flushpendingregionedit相关逻辑。
   * @returns {*} pendingregionedit结果。
   */
  async function flushPendingRegionEdit() {
    return persistDraggedRegion();
  }

  /**
   * @description 处理begindraw相关逻辑。
   * @param {*} evt 浏览器事件对象。
   * @returns {void} 无返回值。
   */
  async function beginDraw(evt) {
    if (shouldStartPanning(evt)) {
      beginCanvasPan(evt);
      return;
    }
    if (evt.button !== 0) {
      return;
    }
    if (
      state.selectedAnnotationId ||
      state.selectedHeadingId ||
      state.selectedRegionId
    ) {
      await flushPendingRegionEdit();
      state.selectedAnnotationId = null;
      state.selectedHeadingId = null;
      state.selectedRegionId = null;
      renderAll();
    }

    if (!isEditor()) {
      return;
    }
    const page = getCurrentPage();
    if (!page) {
      return;
    }
    const pt = getPointerPoint(evt);
    state.drawing = {
      startX: pt.x,
      startY: pt.y,
      endX: pt.x,
      endY: pt.y,
    };
    lastPointerClientX = evt.clientX;
    lastPointerClientY = evt.clientY;
    startAutoPanLoop();
    drawOverlay();
  }

  /**
   * @description 处理movedraw相关逻辑。
   * @param {*} evt 浏览器事件对象。
   * @returns {void} 无返回值。
   */
  function moveDraw(evt) {
    if (
      state.pendingRegionMove &&
      !state.regionMove &&
      !state.regionResize &&
      !state.drawing
    ) {
      const deltaX = evt.clientX - state.pendingRegionMove.startClientX;
      const deltaY = evt.clientY - state.pendingRegionMove.startClientY;
      if (
        Math.abs(deltaX) >= REGION_MOVE_DRAG_THRESHOLD_PX ||
        Math.abs(deltaY) >= REGION_MOVE_DRAG_THRESHOLD_PX
      ) {
        startRegionMove(
          evt,
          state.pendingRegionMove.annotationId,
          state.pendingRegionMove.regionId,
        );
      }
    }

    if (state.canvasView.isPanning) {
      moveCanvasPan(evt);
      return;
    }

    if (state.regionResize) {
      updateRegionResize(evt);
      drawOverlay();
      return;
    }

    if (state.regionMove) {
      updateRegionMove(evt);
      drawOverlay();
      return;
    }
    if (!state.drawing) {
      const target = evt.target;
      const annotationId = target?.dataset?.annId;
      const regionId = target?.dataset?.regionId;
      const page = getCurrentPage();
      const isSelectedRegion =
        annotationId &&
        regionId &&
        state.selectedAnnotationId === annotationId &&
        state.selectedRegionId === regionId;

      if (isEditor() && isSelectedRegion && page) {
        const region = getRegionFromAnnotation(annotationId, regionId);
        const hit = getRegionBorderHit(region, page, evt);
        if (hit) {
          updateSvgCursor(hit.cursor);
          return;
        }
      }
      updateSvgCursor(annotationId && regionId ? "pointer" : "default");
      return;
    }
    maybeAutoPanWhileDrawing(evt);
    const pt = getPointerPoint(evt);
    state.drawing.endX = pt.x;
    state.drawing.endY = pt.y;
    drawOverlay();
  }

  /**
   * @description 处理finishdraw相关逻辑。
   * @returns {*} draw结果。
   */
  async function finishDraw() {
    state.pendingRegionMove = null;

    if (state.canvasView.isPanning) {
      endCanvasPan();
      stopAutoPanLoop();
      return;
    }
    if (await persistDraggedRegion()) {
      stopAutoPanLoop();
      return;
    }
    const page = getCurrentPage();
    if (!page || !state.drawing) {
      stopAutoPanLoop();
      return;
    }

    const x = Math.min(state.drawing.startX, state.drawing.endX);
    const y = Math.min(state.drawing.startY, state.drawing.endY);
    const width = Math.abs(state.drawing.endX - state.drawing.startX);
    const height = Math.abs(state.drawing.endY - state.drawing.startY);
    state.drawing = null;
    stopAutoPanLoop();

    if (width < 8 || height < 8) {
      drawOverlay();
      return;
    }
    const body = {
      pageId: page.id,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    };

    if (state.addingRegionForAnnotation) {
      await addRegionToExisting(page, body);
      return;
    }
    const payload = await apiRequest(
      `/pages/${encodeURIComponent(page.id)}/annotations`,
      {
        method: "POST",
        body: buildDraftPayload(body),
      },
    );
    page.annotations.push(payload.annotation);
    state.selectedAnnotationId = payload.annotation.id;
    state.selectedHeadingId = null;
    renderAll();
  }

  return { beginDraw, moveDraw, finishDraw, flushPendingRegionEdit };
};

