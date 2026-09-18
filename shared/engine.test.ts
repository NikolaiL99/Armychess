import { describe, expect, it } from "vitest";
import {
  algebraic,
  allMoves,
  createGame,
  findKing,
  kingHome,
  makeMove,
  movesFrom,
  placeKing,
  sq,
} from "./engine";

describe("Armychess setup", () => {
  it("leaves both king homes empty", () => {
    const game = createGame();
    expect(game.board[kingHome("white")]).toBeNull();
    expect(game.board[kingHome("black")]).toBeNull();
    expect(findKing(game, "white")).toBeNull();
    expect(findKing(game, "black")).toBeNull();
  });

  it("places the back-rank army as specified", () => {
    const game = createGame();
    const types = (rank: number) =>
      Array.from({ length: 16 }, (_, file) => game.board[sq(file, rank)]?.type ?? "empty");
    expect(types(0)).toEqual([
      "rook",
      "rook",
      "rook",
      "knight",
      "bishop",
      "bishop",
      "bishop",
      "queen",
      "empty",
      "bishop",
      "bishop",
      "bishop",
      "knight",
      "rook",
      "rook",
      "rook",
    ]);
    expect(types(1)).toEqual([
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
    ]);
    expect(types(2).every((t) => t === "pawn")).toBe(true);
    expect(types(3).every((t) => t === "pawn")).toBe(true);
  });
});

describe("king placement", () => {
  it("swaps an occupied piece onto the king home square", () => {
    const start = createGame();
    const pawnSquare = sq(0, 2);
    const after = placeKing(start, pawnSquare);
    expect(after.board[pawnSquare]?.type).toBe("king");
    expect(after.board[pawnSquare]?.color).toBe("white");
    expect(after.board[kingHome("white")]?.type).toBe("pawn");
    expect(after.turn).toBe("black");
  });

  it("starts the clocks after both kings are placed", () => {
    let game = placeKing(createGame(), kingHome("white"));
    game = placeKing(game, kingHome("black"));
    expect(game.phase).toBe("play");
    expect(game.turn).toBe("white");
    expect(game.clocks.running).toBe("white");
  });
});

describe("pawn rules", () => {
  it("allows a two-square first step from both pawn ranks", () => {
    let game = placeKing(createGame(), kingHome("white"));
    game = placeKing(game, kingHome("black"));
    const front = sq(0, 3);
    const rear = sq(4, 2);
    game.board[sq(4, 3)] = null;
    expect(movesFrom(game, front)).toContain(sq(0, 5));
    expect(movesFrom(game, rear)).toContain(sq(4, 4));
  });

  it("supports en passant after a double step", () => {
    let game = placeKing(createGame(), kingHome("white"));
    game = placeKing(game, kingHome("black"));
    game = makeMove(game, { from: sq(4, 3), to: sq(4, 5) });
    const blackPawn = sq(5, 12);
    game.board[sq(5, 5)] = { ...game.board[blackPawn]!, moved: true };
    game.board[blackPawn] = null;
    expect(movesFrom(game, sq(5, 5))).toContain(sq(4, 4));
    game = makeMove(game, { from: sq(5, 5), to: sq(4, 4) });
    expect(game.board[sq(4, 5)]).toBeNull();
    expect(game.board[sq(4, 4)]?.color).toBe("black");
  });
});

describe("king capture", () => {
  it("does not forbid moving while the king is attacked", () => {
    let game = placeKing(createGame(), kingHome("white"));
    game = placeKing(game, kingHome("black"));
    game.board[sq(8, 4)] = {
      id: "rq",
      type: "queen",
      color: "black",
      moved: true,
    };
    expect(allMoves(game).length).toBeGreaterThan(0);
    const pawn = sq(0, 3);
    expect(movesFrom(game, pawn).length).toBeGreaterThan(0);
  });

  it("ends the game when the king is captured", () => {
    let game = placeKing(createGame(), kingHome("white"));
    game = placeKing(game, kingHome("black"));
    game.board[sq(8, 1)] = {
      id: "rq",
      type: "queen",
      color: "black",
      moved: true,
    };
    const whiteKing = findKing(game, "white")!;
    game.turn = "black";
    game = makeMove(game, { from: sq(8, 1), to: whiteKing });
    expect(game.phase).toBe("over");
    expect(game.winner).toBe("black");
    expect(game.endReason).toBe("king-captured");
  });
});

describe("notation", () => {
  it("names files a-p and ranks 1-16", () => {
    expect(algebraic(sq(0, 0))).toBe("a1");
    expect(algebraic(sq(15, 15))).toBe("p16");
    expect(algebraic(sq(8, 0))).toBe("i1");
  });
});
