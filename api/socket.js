const { Server } = require("socket.io");

const players = {};

module.exports = function (req, res) {
  if (!res.socket.server.io) {
    console.log("🌃 Initializing Socket.io on Vercel...");

    const io = new Server(res.socket.server, {
      path: "/socket.io",
      cors: { origin: "*" },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    res.socket.server.io = io;

    io.on("connection", (socket) => {
      console.log("NEON SOUL CONNECTED:", socket.id);

      players[socket.id] = {
        x: (Math.random() - 0.5) * 20,
        y: 1,
        z: (Math.random() - 0.5) * 20,
        color: Math.floor(Math.random() * 16777215)
      };

      socket.emit("init", players);
      socket.broadcast.emit("playerJoined", { 
        id: socket.id, 
        player: players[socket.id] 
      });

      socket.on("move", (data) => {
        if (players[socket.id]) {
          players[socket.id] = { ...players[socket.id], ...data };
          socket.broadcast.emit("playerMoved", {
            id: socket.id,
            player: players[socket.id]
          });
        }
      });

      socket.on("disconnect", () => {
        delete players[socket.id];
        io.emit("playerLeft", socket.id);
        console.log("SOUL RETURNED TO THE VOID:", socket.id);
      });
    });
  }

  res.end();
};
