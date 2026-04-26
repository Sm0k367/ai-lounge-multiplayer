const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors({
    origin: "*",
    methods: ["GET", "POST"]
}));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

// In-memory store for demo. In production: Redis or Mongo
let players = {};
let playerCount = 0;

console.log("\x1b[35m%s\x1b[0m", `
╔══════════════════════════════════════════════════════════════╗
║                AI LOUNGE AFTER DARK — SERVER                 ║
║               NEON PROTOCOL v0.1.0 INITIALIZED               ║
╚══════════════════════════════════════════════════════════════╝
`);

io.on("connection", (socket) => {
    playerCount++;
    console.log(`\x1b[32m→ PLAYER CONNECTED\x1b[0m ${socket.id} | Total: ${playerCount}`);
    
    // Initial player state
    players[socket.id] = {
        x: (Math.random() - 0.5) * 20,
        y: 2.2,
        z: (Math.random() - 0.5) * 20,
        rotationY: 0,
        color: Math.random() * 0xffffff,
        lastUpdate: Date.now()
    };

    // Send current state to new player
    socket.emit("init", players);

    // Broadcast new player to others
    socket.broadcast.emit("playerJoined", {
        id: socket.id,
        player: players[socket.id]
    });

    // Movement with basic validation
    socket.on("move", (data) => {
        if (!players[socket.id]) return;
        
        // Simple sanity check (prevent teleporting too far)
        const current = players[socket.id];
        const dx = data.x - current.x;
        const dz = data.z - current.z;
        
        if (Math.abs(dx) < 8 && Math.abs(dz) < 8) {
            players[socket.id] = {
                ...data,
                lastUpdate: Date.now()
            };
            
            socket.broadcast.emit("playerMoved", {
                id: socket.id,
                player: players[socket.id]
            });
        }
    });

    // Chat
    socket.on("chat", (message) => {
        if (typeof message !== "string" || message.length > 140) return;
        
        const cleanMsg = message.trim();
        if (!cleanMsg) return;
        
        const payload = {
            id: socket.id,
            msg: cleanMsg.substring(0, 120)
        };
        
        io.emit("chat", payload);
        console.log(`[CHAT] ${socket.id.slice(0,8)}: ${cleanMsg}`);
    });

    socket.on("disconnect", () => {
        playerCount = Math.max(0, playerCount - 1);
        console.log(`\x1b[31m← PLAYER LEFT\x1b[0m ${socket.id} | Remaining: ${playerCount}`);
        
        if (players[socket.id]) {
            delete players[socket.id];
            io.emit("playerLeft", socket.id);
        }
    });

    // Future hooks
    socket.on("auth", (token) => {
        // JWT validation hook for Phase 3
        console.log(`Auth attempt from ${socket.id}`);
    });
});

// Health check endpoint
app.get("/", (req, res) => {
    res.send(`
        <h1 style="font-family:monospace;color:#00ffff;background:#110022;padding:40px;text-align:center">
            🌀 AI LOUNGE AFTER DARK<br>
            <span style="font-size:0.6em;color:#ff00aa">SOCKET SERVER RUNNING — ${Object.keys(players).length} SOULS IN THE VOID</span>
        </h1>
        <p style="text-align:center;font-family:monospace;color:#00ffaa">Connect via client at http://localhost:5173</p>
    `);
});

app.get("/status", (req, res) => {
    res.json({
        status: "neon",
        players: Object.keys(players).length,
        uptime: Math.floor(process.uptime()),
        version: "0.1.0-after-dark"
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\x1b[36m🚀 Server listening on http://localhost:${PORT}\x1b[0m`);
    console.log(`\x1b[33m📡 Ready for clients. Open multiple http://localhost:5173 tabs.\x1b[0m\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\x1b[31mShutting down neon server...\x1b[0m');
    server.close();
    process.exit(0);
});
