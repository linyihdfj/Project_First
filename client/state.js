(function exposeStateFactory(global) {
  /**
   * @description 创建应用初始状态，集中定义编辑器运行时数据模型。
   * @returns {object} 应用初始状态对象。
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
