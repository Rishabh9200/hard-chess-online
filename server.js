const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const rooms = new Map();

function clean(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

function state(r) {
  return {
    fen: r.game.fen(),
    turn: r.game.turn(),
    players: r.players.length,
    over: r.game.isGameOver(),
    result: r.game.isCheckmate()
      ? (r.game.turn() === "w" ? "Black" : "White") +
        " wins by checkmate"
      : r.game.isDraw()
        ? "Draw"
        : null
  };
}

io.on("connection", (socket) => {

  socket.on("join", ({ room }) => {
    room = clean(room);

    if (!room) {
      return socket.emit("errorMsg", "Enter a room code.");
    }

    let r = rooms.get(room);

    if (!r) {
      r = {
        game: new Chess(),
        players: []
      };

      rooms.set(room, r);
    }

    if (r.players.length >= 2) {
      return socket.emit("errorMsg", "Room is full.");
    }

    const color = r.players.length === 0 ? "w" : "b";

    r.players.push({
      id: socket.id,
      color
    });

    socket.join(room);
    socket.data.room = room;
    socket.data.color = color;

    socket.emit("joined", {
      color,
      room
    });

    io.to(room).emit("state", state(r));
  });

  socket.on("move", ({ from, to, promotion }) => {

    const room = socket.data.room;
    const r = rooms.get(room);

    if (!r) return;

    const player = r.players.find(
      (p) => p.id === socket.id
    );

    if (!player) return;

    if (r.game.turn() !== player.color) return;

    if (r.game.isGameOver()) return;

    try {

      const move = r.game.move({
        from,
        to,
        promotion: promotion || "q"
      });

      if (move) {
        io.to(room).emit("state", state(r));
      }

    } catch (error) {
      socket.emit("errorMsg", "Illegal move.");
    }
  });

  socket.on("reset", () => {

    const room = socket.data.room;
    const r = rooms.get(room);

    if (!r) return;

    r.game = new Chess();

    io.to(room).emit("state", state(r));
  });

  socket.on("disconnect", () => {

    const room = socket.data.room;
    const r = rooms.get(room);

    if (!r) return;

    r.players = r.players.filter(
      (p) => p.id !== socket.id
    );

    io.to(room).emit("state", state(r));

    if (r.players.length === 0) {
      rooms.delete(room);
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Hard Chess online server running on port ${PORT}`
  );
});
