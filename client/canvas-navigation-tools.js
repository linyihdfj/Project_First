/**
 * @description canvasnavigationtools相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
window.createCanvasNavigationTools = function createCanvasNavigationTools(
  deps,
) {
  const { state, refs, clampValue, renderAll, joinCurrentPageRoom } = deps;
  const WHEEL_LINE_PX = 16;

  /**
   * @description 获取currentpage。
   * @returns {*} currentpage结果。
   */
  function getCurrentPage() {
    if (
      state.currentPageIndex < 0 ||
      state.currentPageIndex >= state.pages.length
    ) {
      return null;
    }
    return state.pages[state.currentPageIndex];
  }

  /**
   * @description 获取canvasviewbounds。
   * @param {*} zoomValue zoomvalue参数。
   * @returns {*} canvasviewbounds结果。
   */
  function getCanvasViewBounds(zoomValue = state.canvasView.zoom) {
    const stageWidth = refs.canvasStage ? refs.canvasStage.clientWidth : 0;
    const stageHeight = refs.canvasStage ? refs.canvasStage.clientHeight : 0;
    const scaledWidth = stageWidth * zoomValue;
    const scaledHeight = stageHeight * zoomValue;

    return {
      minX: Math.min(0, stageWidth - scaledWidth),
      maxX: 0,
      minY: Math.min(0, stageHeight - scaledHeight),
      maxY: 0,
    };
  }

  /**
   * @description 将画布偏移量限制在可用边界内。
   * @param {number} offsetX 目标 X 偏移。
   * @param {number} offsetY 目标 Y 偏移。
   * @param {number} [zoomValue=state.canvasView.zoom] 参与计算的缩放值。
   * @returns {{x:number,y:number}} 夹取后的偏移。
   */
  function clampCanvasView(
    offsetX,
    offsetY,
    zoomValue = state.canvasView.zoom,
  ) {
    const bounds = getCanvasViewBounds(zoomValue);
    return {
      x: clampValue(offsetX, bounds.minX, bounds.maxX),
      y: clampValue(offsetY, bounds.minY, bounds.maxY),
    };
  }

  /**
   * @description 应用canvasview。
   * @returns {void} 无返回值。
   */
  function applyCanvasView() {
    if (refs.canvasViewport) {
      refs.canvasViewport.style.transform = `translate(${state.canvasView.offsetX}px, ${state.canvasView.offsetY}px) scale(${state.canvasView.zoom})`;
    }
    if (refs.btnZoomReset) {
      refs.btnZoomReset.textContent = `${Math.round(state.canvasView.zoom * 100)}%`;
    }
  }

  /**
   * @description 重置canvasview。
   * @returns {void} 无返回值。
   */
  function resetCanvasView() {
    state.canvasView.zoom = 1;
    state.canvasView.offsetX = 0;
    state.canvasView.offsetY = 0;
    state.canvasView.isPanning = false;
    if (refs.canvasStage) {
      refs.canvasStage.classList.remove("is-panning");
    }
    applyCanvasView();
  }

  /**
   * @description 处理switchpage相关逻辑。
   * @param {*} step step参数。
   * @returns {void} 无返回值。
   */
  function switchPage(step) {
    if (!state.pages.length) {
      return;
    }
    state.currentPageIndex = clampValue(
      state.currentPageIndex + step,
      0,
      state.pages.length - 1,
    );
    state.selectedAnnotationId = null;
    state.selectedHeadingId = null;
    state.selectedRegionId = null;
    resetCanvasView();
    renderAll();
    joinCurrentPageRoom();
  }

  /**
   * @description 设置canvaszoom。
   * @param {*} nextZoom nextzoom参数。
   * @param {*} anchorClientX anchorclientx参数。
   * @param {*} anchorClientY anchorclienty参数。
   * @returns {*} canvaszoom结果。
   */
  function setCanvasZoom(nextZoom, anchorClientX, anchorClientY) {
    const oldZoom = state.canvasView.zoom;
    const zoom = clampValue(
      nextZoom,
      state.canvasView.minZoom,
      state.canvasView.maxZoom,
    );
    if (Math.abs(zoom - oldZoom) < 0.001 || !refs.canvasStage) {
      return;
    }

    const rect = refs.canvasStage.getBoundingClientRect();
    const anchorX =
      Number.isFinite(anchorClientX) && rect.width > 0
        ? anchorClientX - rect.left
        : rect.width / 2;
    const anchorY =
      Number.isFinite(anchorClientY) && rect.height > 0
        ? anchorClientY - rect.top
        : rect.height / 2;

    const contentX = (anchorX - state.canvasView.offsetX) / oldZoom;
    const contentY = (anchorY - state.canvasView.offsetY) / oldZoom;

    const nextOffsetX = anchorX - contentX * zoom;
    const nextOffsetY = anchorY - contentY * zoom;
    const clamped = clampCanvasView(nextOffsetX, nextOffsetY, zoom);

    state.canvasView.zoom = zoom;
    state.canvasView.offsetX = clamped.x;
    state.canvasView.offsetY = clamped.y;
    applyCanvasView();
  }

  /**
   * @description 处理pancanvas相关逻辑。
   * @param {*} deltaX deltax参数。
   * @param {*} deltaY deltay参数。
   * @returns {*} canvas结果。
   */
  function panCanvasBy(deltaX, deltaY) {
    const clamped = clampCanvasView(
      state.canvasView.offsetX + deltaX,
      state.canvasView.offsetY + deltaY,
    );
    state.canvasView.offsetX = clamped.x;
    state.canvasView.offsetY = clamped.y;
    applyCanvasView();
  }

  /**
   * @description 判断是否应当startpanning。
   * @param {*} evt 浏览器事件对象。
   * @returns {boolean} startpanning是否成立。
   */
  function shouldStartPanning(evt) {
    return !!evt && (evt.shiftKey || evt.button === 1);
  }

  /**
   * @description 处理begincanvaspan相关逻辑。
   * @param {*} evt 浏览器事件对象。
   * @returns {void} 无返回值。
   */
  function beginCanvasPan(evt) {
    state.canvasView.isPanning = true;
    state.canvasView.panStartClientX = evt.clientX;
    state.canvasView.panStartClientY = evt.clientY;
    state.canvasView.panOriginX = state.canvasView.offsetX;
    state.canvasView.panOriginY = state.canvasView.offsetY;
    refs.canvasStage.classList.add("is-panning");
    evt.preventDefault();
  }

  /**
   * @description 处理movecanvaspan相关逻辑。
   * @param {*} evt 浏览器事件对象。
   * @returns {void} 无返回值。
   */
  function moveCanvasPan(evt) {
    if (!state.canvasView.isPanning) {
      return;
    }
    const deltaX = evt.clientX - state.canvasView.panStartClientX;
    const deltaY = evt.clientY - state.canvasView.panStartClientY;
    const clamped = clampCanvasView(
      state.canvasView.panOriginX + deltaX,
      state.canvasView.panOriginY + deltaY,
    );
    state.canvasView.offsetX = clamped.x;
    state.canvasView.offsetY = clamped.y;
    applyCanvasView();
    evt.preventDefault();
  }

  /**
   * @description 处理endcanvaspan相关逻辑。
   * @returns {void} 无返回值。
   */
  function endCanvasPan() {
    if (!state.canvasView.isPanning) {
      return;
    }
    state.canvasView.isPanning = false;
    refs.canvasStage.classList.remove("is-panning");
  }

  /**
   * @description 规范化wheeldelta。
   * @param {*} rawDelta rawdelta参数。
   * @param {*} deltaMode deltamode参数。
   * @returns {*} wheeldelta结果。
   */
  function normalizeWheelDelta(rawDelta, deltaMode) {
    if (!Number.isFinite(rawDelta)) {
      return 0;
    }
    if (deltaMode === 1) {
      return rawDelta * WHEEL_LINE_PX;
    }
    if (deltaMode === 2 && refs.canvasStage) {
      return rawDelta * refs.canvasStage.clientHeight;
    }
    return rawDelta;
  }

  /**
   * @description 处理canvaswheel。
   * @param {*} evt 浏览器事件对象。
   * @returns {void} 无返回值。
   */
  function handleCanvasWheel(evt) {
    evt.preventDefault();

    if (!getCurrentPage()) {
      return;
    }

    const deltaX = normalizeWheelDelta(evt.deltaX, evt.deltaMode);
    const deltaY = normalizeWheelDelta(evt.deltaY, evt.deltaMode);

    if (evt.shiftKey) {
      const horizontalDelta = deltaX !== 0 ? deltaX : deltaY;
      panCanvasBy(-horizontalDelta, 0);
      return;
    }

    if (evt.ctrlKey || evt.altKey) {
      const factor = deltaY < 0 ? 1.12 : 1 / 1.12;
      setCanvasZoom(state.canvasView.zoom * factor, evt.clientX, evt.clientY);
      return;
    }

    panCanvasBy(0, -deltaY);
  }

  return {
    getCurrentPage,
    switchPage,
    getCanvasViewBounds,
    clampCanvasView,
    applyCanvasView,
    resetCanvasView,
    setCanvasZoom,
    panCanvasBy,
    shouldStartPanning,
    beginCanvasPan,
    moveCanvasPan,
    endCanvasPan,
    normalizeWheelDelta,
    handleCanvasWheel,
  };
};

