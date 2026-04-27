import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  path: '/socket.io'
});

app.use(express.static('dist'));

let players = {};

io.on('connection', (socket) => {
  console.log('NEON SOUL ENTERED:', socket.id);
  
  players[socket.id] = {
    x: (Math.random() - 0.5) * 20,
    y: 1,
    z: (Math.random() - 0.5) * 20,
    color: Math.floor(Math.random() * 0xffffff)
  };

  socket.emit('init', players);
  socket.broadcast.emit('playerJoined', { id: socket.id, player: players[socket.id] });

  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id] = { ...players[socket.id], ...data };
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        player: players[socket.id]
      });
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerLeft', socket.id);
    console.log('SOUL RETURNED TO VOID:', socket.id);
  });
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'neon', players: Object.keys(players).length });
});

const PORT = process.env.PORT || 5173;
server.listen(PORT, () => {
  console.log(`🌃 AI LOUNGE AFTER DARK running on port ${PORT}`);
});
