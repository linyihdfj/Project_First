/**
 * @description state相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 处理exposestatefactory相关逻辑。
 * @param {*} global global参数。
 * @returns {*} statefactory结果。
 */
(function exposeStateFactory(global) {

  /**
   * @description 创建initialstate。
   * @returns {*} initialstate结果。
   */
  function createInitialState() {
    return {
      currentUser: null,
      article: {
        id: "article-1",
        type: "1",
        version: "1.0",
        title: "周易注",
        subtitle: "卷一",
        author: "王弼",
        book: "周易注",
        volume: "卷一",
        publishYear: "AD249",
        writingYear: "AD240",
      },
      pages: [],
      currentPageIndex: -1,
      selectedAnnotationId: null,
      selectedHeadingId: null,
      drawing: null,
      canvasView: {
        zoom: 1,
        minZoom: 0.3,
        maxZoom: 4,
        offsetX: 0,
        offsetY: 0,
        isPanning: false,
        panStartClientX: 0,
        panStartClientY: 0,
        panOriginX: 0,
        panOriginY: 0,
      },
      glyphs: [],
      headings: [],
      headingExpandedState: {},
      headingDragState: {
        draggedHeadingId: null,
      },
      glyphCaptureDataUrl: "",
      articleList: [],
      accessArticleId: null,
      currentArticleRole: "",
      pendingInvite: null,
      inviteAuthMode: "login",
      inviteTargetArticleId: "",
      presenceUsers: [],
      addingRegionForAnnotation: null,
      selectedRegionId: null,
      regionResize: null,
      regionMove: null,
      glyphPicker: {
        annotationId: null,
        query: "",
      },
    };
  }

  global.createInitialState = createInitialState;
})(window);

