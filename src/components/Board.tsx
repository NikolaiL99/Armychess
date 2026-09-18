import {
  FILE_NAMES,
  algebraic,
  type GameState,
  type PieceType,
  fileOf,
  findKing,
  isAttacked,
  kingHome,
  movesFrom,
  opponent,
  rankOf,
} from "@shared/engine";
import { useMemo, useState } from "react";
import { PieceView } from "./PieceView";

type Promo = Exclude<PieceType, "king" | "pawn">;

export function Board({
  state,
  orientation,
  interactive,
  onPlace,
  onMove,
}: {
  state: GameState;
  orientation: "white" | "black";
  interactive: boolean;
  onPlace: (square: number) => void;
  onMove: (from: number, to: number, promotion?: Promo) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);
  const [drag, setDrag] = useState<{ from: number; x: number; y: number } | null>(null);

  const origin = drag?.from ?? selected;
  const targets = useMemo(() => {
    if (origin == null || state.phase !== "play") return new Set<number>();
    return new Set(movesFrom(state, origin));
  }, [origin, state]);

  const last = state.lastMove;
  const myKing = findKing(state, state.turn);
  const kingAttacked = myKing != null && isAttacked(state, myKing, opponent(state.turn));

  const order = useMemo(() => {
    const squares: number[] = [];
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 16; col++) {
        const rank = orientation === "white" ? 15 - row : row;
        const file = orientation === "white" ? col : 15 - col;
        squares.push(rank * 16 + file);
      }
    }
    return squares;
  }, [orientation]);

  const files = orientation === "white" ? FILE_NAMES.split("") : FILE_NAMES.split("").reverse();
  const ranks = (orientation === "white" ? [...Array(16)].map((_, i) => 16 - i) : [...Array(16)].map((_, i) => i + 1)).map(String);

  const pieceAt = selected != null ? state.board[selected] : null;

  function clickSquare(square: number) {
    if (!interactive) return;
    if (state.phase === "place") {
      onPlace(square);
      return;
    }
    if (state.phase !== "play") return;
    const piece = state.board[square];
    if (selected != null && targets.has(square)) {
      attemptMove(selected, square);
      return;
    }
    if (piece && piece.color === state.turn) {
      setSelected(square);
      setPromo(null);
      return;
    }
    setSelected(null);
  }

  function attemptMove(from: number, to: number) {
    const piece = state.board[from];
    if (piece?.type === "pawn" && (rankOf(to) === 0 || rankOf(to) === 15)) {
      setPromo({ from, to });
      setSelected(from);
      return;
    }
    onMove(from, to);
    setSelected(null);
    setPromo(null);
  }

  return (
    <div className="board-frame">
      <div className="ranks">
        {ranks.map((r) => (
          <span key={r}>{r}</span>
        ))}
      </div>
      <div className="board">
        {order.map((square) => {
          const piece = state.board[square];
          const light = (fileOf(square) + rankOf(square)) % 2 === 1;
          const isLast = last && (last.from === square || last.to === square);
          const isTarget = targets.has(square);
          const home = state.phase === "place" && square === kingHome(state.turn) && !piece;
          const classes = [
            "sq",
            light ? "light" : "dark",
            selected === square ? "selected" : "",
            isLast ? "last" : "",
            isTarget ? "target" : "",
            isTarget && piece ? "capture" : "",
            kingAttacked && square === myKing ? "attacked-king" : "",
            home ? "home" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={square}
              className={classes}
              data-square={algebraic(square)}
              onPointerDown={(event) => {
                if (!interactive || state.phase !== "play") return;
                if (piece && piece.color === state.turn) {
                  setSelected(square);
                  setDrag({ from: square, x: event.clientX, y: event.clientY });
                  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
                }
              }}
              onPointerMove={(event) => {
                if (drag) setDrag({ ...drag, x: event.clientX, y: event.clientY });
              }}
              onPointerUp={(event) => {
                if (drag) {
                  const el = document.elementFromPoint(event.clientX, event.clientY);
                  const cell = el?.closest(".sq") as HTMLElement | null;
                  const to = cell ? order[[...cell.parentElement!.children].indexOf(cell)] : null;
                  const legal = new Set(movesFrom(state, drag.from));
                  if (to != null && to !== drag.from && legal.has(to)) attemptMove(drag.from, to);
                  setDrag(null);
                }
              }}
              onClick={() => clickSquare(square)}
            >
              {piece && !(drag && drag.from === square) ? <PieceView type={piece.type} color={piece.color} /> : null}
              {promo && promo.to === square ? (
                <div className="promo">
                  {(["queen", "rook", "bishop", "knight"] as Promo[]).map((type) => (
                    <button
                      key={type}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMove(promo.from, promo.to, type);
                        setPromo(null);
                        setSelected(null);
                      }}
                    >
                      <PieceView type={type} color={pieceAt?.color ?? state.turn} />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="files">
        {files.map((f) => (
          <span key={f}>{f}</span>
        ))}
      </div>
      {drag && pieceAt ? (
        <div className="ghost" style={{ left: drag.x, top: drag.y }}>
          <PieceView type={pieceAt.type} color={pieceAt.color} />
        </div>
      ) : null}
    </div>
  );
}
