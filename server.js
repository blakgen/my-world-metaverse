const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const players = new Map();
const WORLD = { width: 1800, height: 1200 };

function safeName(value) {
  return String(value || "탐험가").replace(/[<>]/g, "").trim().slice(0, 16) || "탐험가";
}

io.on("connection", (socket) => {
  const spawn = {
    x: 200 + Math.random() * 1400,
    y: 160 + Math.random() * 880
  };
  const player = {
    id: socket.id,
    name: "탐험가",
    x: spawn.x,
    y: spawn.y,
    color: Math.floor(Math.random() * 0xffffff)
  };
  players.set(socket.id, player);
  socket.emit("welcome", { selfId: socket.id, players: [...players.values()], world: WORLD });
  socket.broadcast.emit("playerJoined", player);

  socket.on("setName", (name) => {
    const p = players.get(socket.id);
    if (!p) return;
    p.name = safeName(name);
    io.emit("playerUpdated", p);
  });

  socket.on("move", (pos) => {
    const p = players.get(socket.id);
    if (!p || !pos) return;
    const x = Number(pos.x), y = Number(pos.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    p.x = Math.max(24, Math.min(WORLD.width - 24, x));
    p.y = Math.max(24, Math.min(WORLD.height - 24, y));
    socket.broadcast.emit("playerMoved", { id: p.id, x: p.x, y: p.y });
  });

  socket.on("chat", (message) => {
    const p = players.get(socket.id);
    if (!p) return;
    const text = String(message || "").trim().slice(0, 180);
    if (!text) return;
    io.emit("chat", { id: p.id, name: p.name, text, at: Date.now() });
  });

  socket.on("disconnect", () => {
    players.delete(socket.id);
    io.emit("playerLeft", socket.id);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`MY WORLD running on port ${port}`));