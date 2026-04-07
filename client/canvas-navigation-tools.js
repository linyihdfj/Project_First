window.createCanvasNavigationTools = function createCanvasNavigationTools(
  deps,
) {
  const { state, refs, clampValue, renderAll, joinCurrentPageRoom } = deps;
  const WHEEL_LINE_PX = 16;

  /**
   * @description 获取当前选中的页面对象。
   * @returns {object|null} 当前页面；索引越界时返回 null。
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
   * @description 计算指定缩放下画布可平移的边界范围。
   * @param {number} [zoomValue=state.canvasView.zoom] 目标缩放值。
   * @returns {{minX:number,maxX:number,minY:number,maxY:number}} 平移边界。
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
   * @description 将当前画布视图状态应用到 DOM（位移与缩放）。
   * @returns {void}
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
   * @description 重置画布缩放和平移状态。
   * @returns {void}
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
   * @description 切换页面并重置选择态、视图与协作房间。
   * @param {number} step 页面步长（-1 上一页，+1 下一页）。
   * @returns {void}
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
   * @description 以指定锚点缩放画布，并保持锚点内容位置尽量不跳动。
   * @param {number} nextZoom 目标缩放值。
   * @param {number} [anchorClientX] 缩放锚点 X（客户端坐标）。
   * @param {number} [anchorClientY] 缩放锚点 Y（客户端坐标）。
   * @returns {void}
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
   * @description 按增量平移画布。
   * @param {number} deltaX X 增量。
   * @param {number} deltaY Y 增量。
   * @returns {void}
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
   * @description 判断当前事件是否应进入画布平移模式。
   * @param {MouseEvent} evt 鼠标事件。
   * @returns {boolean} 满足 Shift 或中键时返回 true。
   */
  function shouldStartPanning(evt) {
    return !!evt && (evt.shiftKey || evt.button === 1);
  }

  /**
   * @description 开始画布平移并记录起点。
   * @param {MouseEvent} evt 鼠标事件。
   * @returns {void}
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
   * @description 在平移模式中根据鼠标位移更新画布偏移。
   * @param {MouseEvent} evt 鼠标事件。
   * @returns {void}
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
   * @description 结束画布平移状态。
   * @returns {void}
   */
  function endCanvasPan() {
    if (!state.canvasView.isPanning) {
      return;
    }
    state.canvasView.isPanning = false;
    refs.canvasStage.classList.remove("is-panning");
  }

  /**
   * @description 将不同 wheel deltaMode 统一换算为像素值。
   * @param {number} rawDelta 原始滚轮增量。
   * @param {number} deltaMode 滚轮模式（像素/行/页）。
   * @returns {number} 像素单位增量。
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
   * @description 处理画布滚轮交互（横向平移、缩放或纵向平移）。
   * @param {WheelEvent} evt 滚轮事件。
   * @returns {void}
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
