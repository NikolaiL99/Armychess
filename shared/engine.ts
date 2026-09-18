export const FILES = 16;
export const RANKS = 16;
export const SQUARES = FILES * RANKS;

export const FILE_NAMES = "abcdefghijklmnop";

export type Color = "white" | "black";
export type PieceType = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
export type Phase = "place" | "play" | "over";

export interface Piece {
  id: string;
  type: PieceType;
  color: Color;
  moved: boolean;
}

export type Board = Array<Piece | null>;

export interface Clock {
  initialMs: number;
  incrementMs: number;
  remaining: { white: number; black: number };
  running: Color | null;
  lastStartedAt: number | null;
}

export interface GameState {
  board: Board;
  turn: Color;
  phase: Phase;
  placed: { white: boolean; black: boolean };
  enPassant: number | null;
  winner: Color | "draw" | null;
  endReason: string | null;
  lastMove: { from: number; to: number } | null;
  clocks: Clock;
  ply: number;
}

export interface PlayMove {
  from: number;
  to: number;
  promotion?: Exclude<PieceType, "king" | "pawn">;
}

export function sq(file: number, rank: number): number {
  return rank * FILES + file;
}

export function fileOf(index: number): number {
  return index % FILES;
}

export function rankOf(index: number): number {
  return Math.floor(index / FILES);
}

export function inBounds(file: number, rank: number): boolean {
  return file >= 0 && file < FILES && rank >= 0 && rank < RANKS;
}

export function kingHome(color: Color): number {
  return color === "white" ? sq(8, 0) : sq(8, 15);
}

export function opponent(color: Color): Color {
  return color === "white" ? "black" : "white";
}

export function algebraic(index: number): string {
  return `${FILE_NAMES[fileOf(index)]}${rankOf(index) + 1}`;
}

function pid(prefix: string, n: number): string {
  return `${prefix}${n}`;
}

export function emptyBoard(): Board {
  return Array.from({ length: SQUARES }, () => null);
}

export function createClocks(initialMs: number, incrementMs: number): Clock {
  return {
    initialMs,
    incrementMs,
    remaining: { white: initialMs, black: initialMs },
    running: null,
    lastStartedAt: null,
  };
}

export function createGame(initialMs = 10 * 60_000, incrementMs = 0): GameState {
  const board = emptyBoard();
  const back: PieceType[] = [
    "rook",
    "rook",
    "rook",
    "knight",
    "bishop",
    "bishop",
    "bishop",
    "queen",
    "king",
    "bishop",
    "bishop",
    "bishop",
    "knight",
    "rook",
    "rook",
    "rook",
  ];
  const second: PieceType[] = [
    "knight",
    "knight",
    "knight",
    "knight",
    "knight",
    "knight",
    "knight",
    "bishop",
    "bishop",
    "knight",
    "knight",
    "knight",
    "knight",
    "knight",
    "knight",
    "knight",
  ];

  let n = 0;
  const placeRow = (rank: number, types: PieceType[], color: Color) => {
    for (let file = 0; file < FILES; file++) {
      const type = types[file];
      if (type === "king") continue;
      board[sq(file, rank)] = {
        id: pid(color[0], n++),
        type,
        color,
        moved: false,
      };
    }
  };

  placeRow(0, back, "white");
  placeRow(1, second, "white");
  for (const rank of [2, 3]) {
    for (let file = 0; file < FILES; file++) {
      board[sq(file, rank)] = {
        id: pid("w", n++),
        type: "pawn",
        color: "white",
        moved: false,
      };
    }
  }

  placeRow(15, back, "black");
  placeRow(14, second, "black");
  for (const rank of [13, 12]) {
    for (let file = 0; file < FILES; file++) {
      board[sq(file, rank)] = {
        id: pid("b", n++),
        type: "pawn",
        color: "black",
        moved: false,
      };
    }
  }

  return {
    board,
    turn: "white",
    phase: "place",
    placed: { white: false, black: false },
    enPassant: null,
    winner: null,
    endReason: null,
    lastMove: null,
    clocks: createClocks(initialMs, incrementMs),
    ply: 0,
  };
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    board: state.board.map((piece) => (piece ? { ...piece } : null)),
    placed: { ...state.placed },
    lastMove: state.lastMove ? { ...state.lastMove } : null,
    clocks: {
      ...state.clocks,
      remaining: { ...state.clocks.remaining },
    },
  };
}

export function remainingNow(clocks: Clock, color: Color, now = Date.now()): number {
  const base = clocks.remaining[color];
  if (clocks.running !== color || clocks.lastStartedAt == null) return Math.max(0, base);
  return Math.max(0, base - (now - clocks.lastStartedAt));
}

export function snapshotClocks(clocks: Clock, now = Date.now()): Clock {
  const next = {
    ...clocks,
    remaining: {
      white: remainingNow(clocks, "white", now),
      black: remainingNow(clocks, "black", now),
    },
    lastStartedAt: clocks.running ? now : null,
  };
  return next;
}

function startClock(state: GameState, color: Color, now = Date.now()) {
  state.clocks = snapshotClocks(state.clocks, now);
  state.clocks.running = color;
  state.clocks.lastStartedAt = now;
}

function stopClock(state: GameState, now = Date.now()) {
  state.clocks = snapshotClocks(state.clocks, now);
  state.clocks.running = null;
  state.clocks.lastStartedAt = null;
}

export function applyTimeout(state: GameState, now = Date.now()): GameState {
  if (state.phase === "over") return state;
  const next = cloneState(state);
  next.clocks = snapshotClocks(next.clocks, now);
  for (const color of ["white", "black"] as Color[]) {
    if (next.clocks.remaining[color] <= 0) {
      next.phase = "over";
      next.winner = opponent(color);
      next.endReason = "timeout";
      next.clocks.running = null;
      next.clocks.lastStartedAt = null;
      next.clocks.remaining[color] = 0;
      break;
    }
  }
  return next;
}

const KNIGHT_DELTAS = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];

const KING_DELTAS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function slide(board: Board, from: number, color: Color, dirs: number[][]): number[] {
  const targets: number[] = [];
  const f0 = fileOf(from);
  const r0 = rankOf(from);
  for (const [df, dr] of dirs) {
    let f = f0 + df;
    let r = r0 + dr;
    while (inBounds(f, r)) {
      const i = sq(f, r);
      const occupant = board[i];
      if (!occupant) targets.push(i);
      else {
        if (occupant.color !== color) targets.push(i);
        break;
      }
      f += df;
      r += dr;
    }
  }
  return targets;
}

function pawnDir(color: Color): number {
  return color === "white" ? 1 : -1;
}

function lastRank(color: Color): number {
  return color === "white" ? 15 : 0;
}

export function movesFrom(state: GameState, from: number): number[] {
  if (state.phase !== "play") return [];
  const piece = state.board[from];
  if (!piece || piece.color !== state.turn) return [];

  const f = fileOf(from);
  const r = rankOf(from);
  const { board } = state;
  const targets: number[] = [];

  const pushIf = (file: number, rank: number, capture: "any" | "empty" | "enemy") => {
    if (!inBounds(file, rank)) return;
    const i = sq(file, rank);
    const occ = board[i];
    if (capture === "empty" && !occ) targets.push(i);
    if (capture === "enemy" && occ && occ.color !== piece.color) targets.push(i);
    if (capture === "any" && (!occ || occ.color !== piece.color)) targets.push(i);
  };

  switch (piece.type) {
    case "knight":
      for (const [df, dr] of KNIGHT_DELTAS) pushIf(f + df, r + dr, "any");
      break;
    case "king":
      for (const [df, dr] of KING_DELTAS) pushIf(f + df, r + dr, "any");
      if (!piece.moved && from === kingHome(piece.color)) {
        const homeRank = rankOf(from);
        const clearTo = (rookFile: number) => {
          const step = rookFile > 8 ? 1 : -1;
          for (let file = 8 + step; file !== rookFile; file += step) {
            if (board[sq(file, homeRank)]) return false;
          }
          const rook = board[sq(rookFile, homeRank)];
          return Boolean(rook && rook.type === "rook" && rook.color === piece.color && !rook.moved);
        };
        if (clearTo(15)) targets.push(sq(10, homeRank));
        if (clearTo(0)) targets.push(sq(6, homeRank));
      }
      break;
    case "bishop":
      targets.push(
        ...slide(board, from, piece.color, [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]),
      );
      break;
    case "rook":
      targets.push(
        ...slide(board, from, piece.color, [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]),
      );
      break;
    case "queen":
      targets.push(
        ...slide(board, from, piece.color, [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]),
      );
      break;
    case "pawn": {
      const dir = pawnDir(piece.color);
      pushIf(f, r + dir, "empty");
      if (!piece.moved && board[sq(f, r + dir)] == null) {
        pushIf(f, r + 2 * dir, "empty");
      }
      pushIf(f - 1, r + dir, "enemy");
      pushIf(f + 1, r + dir, "enemy");
      if (state.enPassant != null) {
        const ep = state.enPassant;
        if (rankOf(ep) === r + dir && Math.abs(fileOf(ep) - f) === 1) {
          targets.push(ep);
        }
      }
      break;
    }
  }

  return Array.from(new Set(targets));
}

export function allMoves(state: GameState): PlayMove[] {
  const list: PlayMove[] = [];
  if (state.phase !== "play") return list;
  for (let from = 0; from < SQUARES; from++) {
    const piece = state.board[from];
    if (!piece || piece.color !== state.turn) continue;
    for (const to of movesFrom(state, from)) {
      if (piece.type === "pawn" && rankOf(to) === lastRank(piece.color)) {
        for (const promotion of ["queen", "rook", "bishop", "knight"] as const) {
          list.push({ from, to, promotion });
        }
      } else {
        list.push({ from, to });
      }
    }
  }
  return list;
}

export function findKing(state: GameState, color: Color): number | null {
  for (let i = 0; i < SQUARES; i++) {
    const p = state.board[i];
    if (p && p.type === "king" && p.color === color) return i;
  }
  return null;
}

export function isAttacked(state: GameState, square: number, by: Color): boolean {
  for (let from = 0; from < SQUARES; from++) {
    const piece = state.board[from];
    if (!piece || piece.color !== by) continue;
    if (piece.type === "pawn") {
      const dir = pawnDir(piece.color);
      const f = fileOf(from);
      const r = rankOf(from);
      if (inBounds(f - 1, r + dir) && sq(f - 1, r + dir) === square) return true;
      if (inBounds(f + 1, r + dir) && sq(f + 1, r + dir) === square) return true;
      continue;
    }
    const probe: GameState = { ...state, turn: by, phase: "play" };
    if (!movesFrom(probe, from).includes(square)) continue;
    if (piece.type === "king" && Math.abs(fileOf(square) - fileOf(from)) === 2) continue;
    return true;
  }
  return false;
}

export function placeKing(state: GameState, to: number, now = Date.now()): GameState {
  const next = applyTimeout(cloneState(state), now);
  if (next.phase !== "place") throw new Error("Kein Platzierungszug");
  const color = next.turn;
  if (next.placed[color]) throw new Error("König schon platziert");
  if (to < 0 || to >= SQUARES) throw new Error("Ungültiges Feld");

  const enemyKing = findKing(next, opponent(color));
  if (enemyKing === to) throw new Error("Feld ist durch den gegnerischen König belegt");

  const home = kingHome(color);
  const occupant = next.board[to];
  const king: Piece = {
    id: pid(color[0], 999),
    type: "king",
    color,
    moved: to !== home,
  };

  if (occupant) {
    next.board[to] = king;
    next.board[home] = occupant;
  } else {
    next.board[to] = king;
  }

  next.placed[color] = true;
  next.lastMove = { from: home, to };
  next.ply += 1;

  if (!next.placed.white) {
    next.turn = "white";
  } else if (!next.placed.black) {
    next.turn = "black";
  } else {
    next.phase = "play";
    next.turn = "white";
    startClock(next, "white", now);
  }

  return next;
}

function applyCastle(board: Board, color: Color, to: number) {
  const rank = color === "white" ? 0 : 15;
  if (to === sq(10, rank)) {
    const rook = board[sq(15, rank)];
    board[sq(15, rank)] = null;
    if (rook) {
      rook.moved = true;
      board[sq(9, rank)] = rook;
    }
  }
  if (to === sq(6, rank)) {
    const rook = board[sq(0, rank)];
    board[sq(0, rank)] = null;
    if (rook) {
      rook.moved = true;
      board[sq(7, rank)] = rook;
    }
  }
}

export function makeMove(state: GameState, move: PlayMove, now = Date.now()): GameState {
  let next = applyTimeout(cloneState(state), now);
  if (next.phase === "over") throw new Error("Die Partie ist vorbei");
  if (next.phase !== "play") throw new Error("Zuerst müssen beide Könige platziert werden");

  const piece = next.board[move.from];
  if (!piece || piece.color !== next.turn) throw new Error("Ungültige Figur");
  const legal = movesFrom(next, move.from);
  if (!legal.includes(move.to)) throw new Error("Ungültiger Zug");

  if (piece.type === "pawn" && rankOf(move.to) === lastRank(piece.color) && !move.promotion) {
    throw new Error("Umwandlung wählen");
  }
  if (move.promotion && piece.type !== "pawn") throw new Error("Keine Umwandlung möglich");

  const mover = next.turn;
  next.clocks = snapshotClocks(next.clocks, now);
  next.clocks.remaining[mover] += next.clocks.incrementMs;

  let captured = next.board[move.to];
  const dir = pawnDir(piece.color);
  const isEnPassant = piece.type === "pawn" && move.to === next.enPassant && !captured;
  if (isEnPassant) {
    const capSq = sq(fileOf(move.to), rankOf(move.to) - dir);
    captured = next.board[capSq];
    next.board[capSq] = null;
  }

  const isCastle =
    piece.type === "king" && Math.abs(fileOf(move.to) - fileOf(move.from)) === 2 && rankOf(move.to) === rankOf(move.from);

  next.board[move.to] = {
    ...piece,
    moved: true,
    type: move.promotion ?? piece.type,
  };
  next.board[move.from] = null;
  if (isCastle) applyCastle(next.board, piece.color, move.to);

  if (piece.type === "pawn" && Math.abs(rankOf(move.to) - rankOf(move.from)) === 2) {
    next.enPassant = sq(fileOf(move.from), rankOf(move.from) + dir);
  } else {
    next.enPassant = null;
  }

  next.lastMove = { from: move.from, to: move.to };
  next.ply += 1;

  if (captured?.type === "king") {
    next.phase = "over";
    next.winner = piece.color;
    next.endReason = "king-captured";
    stopClock(next, now);
    return next;
  }

  const nextTurn = opponent(piece.color);
  next.turn = nextTurn;
  if (allMoves(next).length === 0) {
    next.phase = "over";
    next.winner = "draw";
    next.endReason = "no-moves";
    stopClock(next, now);
    return next;
  }

  startClock(next, nextTurn, now);
  return next;
}

export function resign(state: GameState, color: Color, now = Date.now()): GameState {
  const next = applyTimeout(cloneState(state), now);
  if (next.phase === "over") return next;
  next.phase = "over";
  next.winner = opponent(color);
  next.endReason = "resign";
  stopClock(next, now);
  return next;
}

export function pieceLetter(type: PieceType): string {
  switch (type) {
    case "knight":
      return "N";
    case "bishop":
      return "B";
    case "rook":
      return "R";
    case "queen":
      return "Q";
    case "king":
      return "K";
    case "pawn":
      return "";
  }
}

export function describeEnd(state: GameState): string {
  if (state.phase !== "over") return "";
  if (state.winner === "draw") return "Remis — keine Züge mehr möglich.";
  const winner = state.winner === "white" ? "Weiß" : "Schwarz";
  if (state.endReason === "king-captured") return `${winner} gewinnt durch Schlag des Königs.`;
  if (state.endReason === "timeout") return `${winner} gewinnt am Zeitlimit.`;
  if (state.endReason === "resign") return `${winner} gewinnt durch Aufgabe.`;
  return `${winner} gewinnt.`;
}
