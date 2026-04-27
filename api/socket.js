const { Server } = require("socket.io");

module.exports = function handler(req, res) {
  if (!res.socket.server.io) {
    console.log("Initializing Socket.io server on Vercel...");

    const io = new Server(res.socket.server, {
      path: "/socket.io",
      cors: { origin: "*" },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    res.socket.server.io = io;

    io.on("connection", (socket) => {
      console.log("NEON SOUL CONNECTED:", socket.id);

      socket.on("move", (data) => {
        socket.broadcast.emit("playerMoved", { id: socket.id, player: data });
      });

      socket.on("chat", (msg) => {
        io.emit("chat", { id: socket.id, msg });
      });

      socket.on("disconnect", () => {
        console.log("VOID CLAIMED:", socket.id);
      });
    });
  }

  res.end();
};
