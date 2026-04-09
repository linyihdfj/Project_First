/**
 * @description socketcollabtools相关前端模块，负责对应界面能力的状态处理与交互封装。
 */
/**
 * @description 创建socketcollabtools。
 * @param {*} deps 模块依赖集合。
 * @returns {*} socketcollabtools结果。
 */
window.createSocketCollabTools = function createSocketCollabTools(deps) {
  const {
    state,
    io,
    getAuthToken,
    removeAuthToken,
    showLoginOverlay,
    getCurrentPage,
    setSocket,
    getSocket,
  } = deps;
  const handlers = window.createSocketEventHandlers(deps);

  /**
   * @description 加入currentarticleroom。
   * @returns {void} 无返回值。
   */
  function joinCurrentArticleRoom() {
    const socket = getSocket();
    if (!socket || !socket.connected || !state.article || !state.article.id)
      return;
    socket.emit("join-article", { articleId: state.article.id });
  }

  /**
   * @description 加入currentpageroom。
   * @returns {void} 无返回值。
   */
  function joinCurrentPageRoom() {
    const socket = getSocket();
    if (!socket || !socket.connected) return;
    state.presenceUsers = [];
    handlers.renderPresenceBar();
    const page = getCurrentPage();
    socket.emit("join-page", { pageId: page ? page.id : null });
  }

  /**
   * @description 初始化 socket 连接并绑定协作事件处理器。
   * @returns {void}
   */

  /**
   * @description 初始化协作 Socket 连接并绑定事件。
   * @returns {*} socket结果。
   */
  function initSocket() {
    if (getSocket()) return;
    const token = getAuthToken();
    if (!token) return;

    const socket = io({
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    setSocket(socket);

    socket.on("connect", () => {
      joinCurrentArticleRoom();
      joinCurrentPageRoom();
      handlers.refreshCurrentPageAnnotations();
    });

    socket.on("connect_error", (err) => {
      if (err.message !== "登录已过期") return;
      socket.disconnect();
      setSocket(null);
      removeAuthToken();
      state.currentUser = null;
      showLoginOverlay();
    });

    socket.on("annotation:created", handlers.handleRemoteAnnotationCreated);
    socket.on("annotation:updated", handlers.handleRemoteAnnotationUpdated);
    socket.on("annotation:deleted", handlers.handleRemoteAnnotationDeleted);
    socket.on(
      "annotation-region:created",
      handlers.handleRemoteRegionCreated,
    );
    socket.on(
      "annotation-region:updated",
      handlers.handleRemoteRegionUpdated,
    );
    socket.on(
      "annotation-region:deleted",
      handlers.handleRemoteRegionDeleted,
    );
    socket.on(
      "annotation-region:reordered",
      handlers.handleRemoteRegionReordered,
    );
    socket.on("heading:created", handlers.handleRemoteHeadingCreated);
    socket.on("heading:updated", handlers.handleRemoteHeadingUpdated);
    socket.on("heading:reordered", handlers.handleRemoteHeadingReordered);
    socket.on("heading:deleted", handlers.handleRemoteHeadingDeleted);
    socket.on("glyph:created", handlers.handleRemoteGlyphCreated);
    socket.on("glyph:deleted", handlers.handleRemoteGlyphDeleted);
    socket.on("glyph:imported", handlers.handleRemoteGlyphImported);
    socket.on("presence:join", handlers.handlePresenceJoin);
    socket.on("presence:leave", handlers.handlePresenceLeave);
    socket.on("presence:members", handlers.handlePresenceMembers);
  }

  return {
    initSocket,
    joinCurrentArticleRoom,
    joinCurrentPageRoom,
  };
};

