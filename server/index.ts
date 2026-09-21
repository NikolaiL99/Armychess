import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import {
  applyTimeout,
  type Color,
  createGame,
  type GameState,
  makeMove,
  placeKing,
  type PlayMove,
  remainingNow,
  resign,
} from "../shared/engine.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3001);

type Seat = {
  token: string;
  color: Color;
  socketId: string | null;
};

type Room = {
  code: string;
  state: GameState;
  seats: Seat[];
  createdAt: number;
};

const rooms = new Map<string, Room>();
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function uniqueCode(): string {
  let code = randomCode();
  while (rooms.has(code)) code = randomCode();
  return code;
}

function token(): string {
  return `${randomCode(8)}${randomCode(8)}`;
}

function publicRoom(room: Room) {
  return {
    code: room.code,
    state: room.state,
    players: {
      white: room.seats.some((s) => s.color === "white"),
      black: room.seats.some((s) => s.color === "black"),
    },
    waiting: room.seats.length < 2,
  };
}

function seatByToken(room: Room, playerToken?: string): Seat | undefined {
  return room.seats.find((s) => s.token === playerToken);
}

function emitRoom(io: Server, room: Room) {
  io.to(room.code).emit("room", publicRoom(room));
}

function tickRoom(io: Server, room: Room) {
  if (room.state.phase !== "play") return;
  for (const color of ["white", "black"] as Color[]) {
    if (remainingNow(room.state.clocks, color) <= 0) {
      room.state = applyTimeout(room.state);
      emitRoom(io, room);
      return;
    }
  }
}

const app = express();
app.use(cors());
app.use(express.json());
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const dist = path.resolve(__dirname, "../dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/socket.io") || req.path === "/health") return next();
    res.sendFile(path.join(dist, "index.html"));
  });
}

const server = createServer(app);
const io = new Server(server, {
  cors: { origin: true },
});

io.on("connection", (socket) => {
  socket.on(
    "create",
    (
      payload: { initialMs: number; incrementMs: number; color?: Color | "random" },
      cb: (result: unknown) => void,
    ) => {
      const initialMs = Math.max(5_000, Math.min(payload.initialMs || 600_000, 24 * 60 * 60_000));
      const incrementMs = Math.max(0, Math.min(payload.incrementMs || 0, 60_000));
      const code = uniqueCode();
      let color: Color = "white";
      if (payload.color === "black") color = "black";
      if (payload.color === "random") color = Math.random() < 0.5 ? "white" : "black";
      const player: Seat = { token: token(), color, socketId: socket.id };
      const room: Room = {
        code,
        state: createGame(initialMs, incrementMs),
        seats: [player],
        createdAt: Date.now(),
      };
      rooms.set(code, room);
      socket.join(code);
      cb({ ok: true, code, token: player.token, color: player.color, room: publicRoom(room) });
    },
  );

  socket.on(
    "join",
    (payload: { code: string; token?: string }, cb: (result: unknown) => void) => {
      const code = (payload.code || "").trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        cb({ ok: false, error: "Partie nicht gefunden. Der Link ist ungültig oder der Server wurde neu gestartet." });
        return;
      }
      socket.join(code);

      const existing = seatByToken(room, payload.token);
      if (existing) {
        existing.socketId = socket.id;
        cb({ ok: true, code, token: existing.token, color: existing.color, room: publicRoom(room) });
        emitRoom(io, room);
        return;
      }

      if (room.seats.length >= 2) {
        cb({ ok: false, error: "Diese Partie ist bereits voll." });
        return;
      }

      const taken = room.seats[0].color;
      const color: Color = taken === "white" ? "black" : "white";
      const player: Seat = { token: token(), color, socketId: socket.id };
      room.seats.push(player);
      cb({ ok: true, code, token: player.token, color, room: publicRoom(room) });
      emitRoom(io, room);
    },
  );

  socket.on("place", (payload: { code: string; token: string; square: number }, cb?: (result: unknown) => void) => {
    const room = rooms.get(payload.code);
    if (!room) return cb?.({ ok: false, error: "Partie nicht gefunden" });
    const seat = seatByToken(room, payload.token);
    if (!seat) return cb?.({ ok: false, error: "Kein Sitzplatz" });
    room.state = applyTimeout(room.state);
    if (room.state.phase !== "place" || room.state.turn !== seat.color) {
      return cb?.({ ok: false, error: "Du bist nicht am Zug" });
    }
    try {
      room.state = placeKing(room.state, payload.square);
      emitRoom(io, room);
      cb?.({ ok: true });
    } catch (error) {
      cb?.({ ok: false, error: error instanceof Error ? error.message : "Ungültig" });
    }
  });

  socket.on("move", (payload: { code: string; token: string; move: PlayMove }, cb?: (result: unknown) => void) => {
    const room = rooms.get(payload.code);
    if (!room) return cb?.({ ok: false, error: "Partie nicht gefunden" });
    const seat = seatByToken(room, payload.token);
    if (!seat) return cb?.({ ok: false, error: "Kein Sitzplatz" });
    room.state = applyTimeout(room.state);
    if (room.state.phase !== "play" || room.state.turn !== seat.color) {
      return cb?.({ ok: false, error: "Du bist nicht am Zug" });
    }
    try {
      room.state = makeMove(room.state, payload.move);
      emitRoom(io, room);
      cb?.({ ok: true });
    } catch (error) {
      cb?.({ ok: false, error: error instanceof Error ? error.message : "Ungültig" });
    }
  });

  socket.on("resign", (payload: { code: string; token: string }) => {
    const room = rooms.get(payload.code);
    if (!room) return;
    const seat = seatByToken(room, payload.token);
    if (!seat) return;
    room.state = resign(room.state, seat.color);
    emitRoom(io, room);
  });

  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      const seat = room.seats.find((s) => s.socketId === socket.id);
      if (seat) seat.socketId = null;
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    tickRoom(io, room);
    if (now - room.createdAt > 12 * 60 * 60_000) rooms.delete(code);
  }
}, 250);

server.listen(PORT, () => {
  console.log(`Armychess listening on ${PORT}`);
});
