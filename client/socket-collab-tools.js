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

  function joinCurrentArticleRoom() {
    const socket = getSocket();
    if (!socket || !socket.connected || !state.article || !state.article.id)
      return;
    socket.emit("join-article", { articleId: state.article.id });
  }

  function joinCurrentPageRoom() {
    const socket = getSocket();
    if (!socket || !socket.connected) return;
    state.presenceUsers = [];
    handlers.renderPresenceBar();
    const page = getCurrentPage();
    socket.emit("join-page", { pageId: page ? page.id : null });
  }

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
    refreshCurrentPageAnnotations: handlers.refreshCurrentPageAnnotations,
    handleRemoteAnnotationCreated: handlers.handleRemoteAnnotationCreated,
    handleRemoteAnnotationUpdated: handlers.handleRemoteAnnotationUpdated,
    handleRemoteAnnotationDeleted: handlers.handleRemoteAnnotationDeleted,
    handleRemoteGlyphCreated: handlers.handleRemoteGlyphCreated,
    handleRemoteGlyphDeleted: handlers.handleRemoteGlyphDeleted,
    handleRemoteGlyphImported: handlers.handleRemoteGlyphImported,
    handlePresenceJoin: handlers.handlePresenceJoin,
    handlePresenceLeave: handlers.handlePresenceLeave,
    handlePresenceMembers: handlers.handlePresenceMembers,
    renderPresenceBar: handlers.renderPresenceBar,
  };
};
