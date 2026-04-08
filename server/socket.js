const { Server: SocketServer } = require("socket.io");

function createSocketLayer({
  httpServer,
  verifyToken,
  getUserById,
  checkArticleAccess,
}) {
  const io = new SocketServer(httpServer, { cors: { origin: "*" } });

  function broadcastToPage(req, roomName, event, data) {
    const senderSocketId = req.headers["x-socket-id"];
    if (senderSocketId) {
      io.to(roomName).except(senderSocketId).emit(event, data);
    } else {
      io.to(roomName).emit(event, data);
    }
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth.token || "";
    if (!token) return next(new Error("未登录"));
    const data = verifyToken(token);
    if (!data) return next(new Error("登录已过期"));
    socket.userId = data.userId;
    socket.userRole = data.role === "admin" ? "admin" : "user";
    next();
  });

  async function getRoomMembers(roomName) {
    const sockets = await io.in(roomName).fetchSockets();
    return sockets.map((s) => ({
      userId: s.userId,
      displayName: s.displayName || "",
      role: s.userRole,
    }));
  }

  io.on("connection", async (socket) => {
    try {
      const user = await getUserById(socket.userId);
      socket.displayName = user ? user.displayName : "未知用户";
    } catch {
      socket.displayName = "未知用户";
    }

    socket.on("join-page", async ({ pageId }) => {
      for (const room of socket.rooms) {
        if (room.startsWith("page:")) {
          socket.leave(room);
          io.to(room).emit("presence:leave", {
            userId: socket.userId,
            displayName: socket.displayName,
          });
        }
      }
      if (!pageId) return;
      const roomName = `page:${pageId}`;
      socket.join(roomName);
      socket.to(roomName).emit("presence:join", {
        userId: socket.userId,
        displayName: socket.displayName,
        role: socket.userRole,
      });
      const members = await getRoomMembers(roomName);
      socket.emit("presence:members", { members });
    });

    socket.on("join-article", async ({ articleId }) => {
      for (const room of socket.rooms) {
        if (room.startsWith("article:")) {
          socket.leave(room);
        }
      }
      const normalizedArticleId = String(articleId || "").trim();
      if (!normalizedArticleId) return;
      const hasAccess = await checkArticleAccess(
        socket.userId,
        normalizedArticleId,
        socket.userRole,
      );
      if (!hasAccess) return;
      socket.join(`article:${normalizedArticleId}`);
    });

    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (room.startsWith("page:")) {
          socket.to(room).emit("presence:leave", {
            userId: socket.userId,
            displayName: socket.displayName,
          });
        }
      }
    });
  });

  return {
    io,
    broadcastToPage,
  };
}

module.exports = {
  createSocketLayer,
};
