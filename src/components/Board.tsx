import {
  FILE_NAMES,
  algebraic,
  type Color,
  type GameState,
  type PieceType,
  fileOf,
  findKing,
  isAttacked,
  kingHome,
  movesFrom,
  opponent,
  pieceMoves,
  rankOf,
} from "@shared/engine";
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { PieceView } from "./PieceView";

type Promo = Exclude<PieceType, "king" | "pawn">;
type Arrow = { from: number; to: number };

function squareAtPoint(clientX: number, clientY: number, order: number[]): number | null {
  const el = document.elementFromPoint(clientX, clientY);
  const cell = el?.closest(".sq") as HTMLElement | null;
  if (!cell?.parentElement) return null;
  const index = [...cell.parentElement.children].indexOf(cell);
  return index >= 0 ? (order[index] ?? null) : null;
}

function squareCenter(square: number, orientation: Color): { x: number; y: number } {
  const file = fileOf(square);
  const rank = rankOf(square);
  const col = orientation === "white" ? file : 15 - file;
  const row = orientation === "white" ? 15 - rank : rank;
  return { x: col + 0.5, y: row + 0.5 };
}

function shorten(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const start = 0.22;
  const end = 0.42;
  return {
    x1: x1 + (dx / len) * start,
    y1: y1 + (dy / len) * start,
    x2: x2 - (dx / len) * end,
    y2: y2 - (dy / len) * end,
  };
}

export function Board({
  state,
  orientation,
  interactive,
  myColor,
  allowPremove = false,
  onPlace,
  onMove,
}: {
  state: GameState;
  orientation: Color;
  interactive: boolean;
  myColor?: Color;
  allowPremove?: boolean;
  onPlace: (square: number) => void;
  onMove: (from: number, to: number, promotion?: Promo) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number; premove: boolean } | null>(null);
  const [drag, setDrag] = useState<{ from: number; x: number; y: number } | null>(null);
  const [premove, setPremove] = useState<{ from: number; to: number; promotion?: Promo } | null>(null);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [marks, setMarks] = useState<number[]>([]);
  const [arrowDraft, setArrowDraft] = useState<{ from: number; to: number } | null>(null);
  const skipClick = useRef(false);
  const appliedPremove = useRef<string | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const markerId = `arrowhead-${useId().replace(/:/g, "")}`;

  const origin = drag?.from ?? selected;
  const targets = useMemo(() => {
    if (origin == null || state.phase !== "play") return new Set<number>();
    if (interactive && state.board[origin]?.color === state.turn) return new Set(movesFrom(state, origin));
    if (allowPremove && myColor && state.turn !== myColor && state.board[origin]?.color === myColor) {
      return new Set(pieceMoves(state, origin));
    }
    return new Set<number>();
  }, [allowPremove, interactive, myColor, origin, state]);

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

  const heldSquare = drag?.from ?? selected;
  const heldPiece = heldSquare != null ? state.board[heldSquare] : null;

  useEffect(() => {
    setSelected(null);
    setPromo(null);
    setDrag(null);
  }, [state.ply]);

  useEffect(() => {
    if (!premove) return;
    if (state.phase !== "play" || !myColor || state.turn !== myColor) return;
    const key = `${state.ply}:${premove.from}:${premove.to}:${premove.promotion ?? ""}`;
    if (appliedPremove.current === key) return;
    const legal = movesFrom(state, premove.from);
    const next = premove;
    setPremove(null);
    if (!legal.includes(next.to)) return;
    appliedPremove.current = key;
    onMoveRef.current(next.from, next.to, next.promotion);
  }, [myColor, premove, state]);

  function clearShapes() {
    setArrows([]);
    setMarks([]);
    setArrowDraft(null);
  }

  function canGrab(square: number): boolean {
    const piece = state.board[square];
    if (!piece || state.phase !== "play") return false;
    if (interactive && piece.color === state.turn) return true;
    return Boolean(allowPremove && myColor && state.turn !== myColor && piece.color === myColor);
  }

  function commitMove(from: number, to: number, asPremove: boolean, promotion?: Promo) {
    if (asPremove) {
      setPremove({ from, to, promotion });
      setSelected(null);
      setPromo(null);
      return;
    }
    onMove(from, to, promotion);
    setSelected(null);
    setPromo(null);
    setPremove(null);
  }

  function attemptMove(from: number, to: number, asPremove: boolean) {
    const piece = state.board[from];
    if (piece?.type === "pawn" && (rankOf(to) === 0 || rankOf(to) === 15)) {
      setPromo({ from, to, premove: asPremove });
      setSelected(from);
      return;
    }
    commitMove(from, to, asPremove);
  }

  function clickSquare(square: number) {
    if (state.phase === "place") {
      if (interactive) onPlace(square);
      return;
    }
    if (state.phase !== "play") return;
    const piece = state.board[square];
    const asPremove = Boolean(allowPremove && myColor && state.turn !== myColor);
    if (selected != null && targets.has(square)) {
      attemptMove(selected, square, asPremove && state.board[selected]?.color === myColor);
      return;
    }
    if (canGrab(square)) {
      setSelected(square);
      setPromo(null);
      if (!asPremove) setPremove(null);
      return;
    }
    setSelected(null);
    setPromo(null);
    if (asPremove && !piece) setPremove(null);
  }

  function onSquarePointerDown(square: number, event: PointerEvent<HTMLDivElement>) {
    const draw = event.button === 2 || (event.button === 0 && event.shiftKey);
    if (draw) {
      event.preventDefault();
      skipClick.current = true;
      setArrowDraft({ from: square, to: square });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) return;
    clearShapes();
    if (!canGrab(square)) return;
    setSelected(square);
    setDrag({ from: square, x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onSquarePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (arrowDraft) {
      const to = squareAtPoint(event.clientX, event.clientY, order) ?? arrowDraft.from;
      setArrowDraft({ from: arrowDraft.from, to });
      return;
    }
    if (drag) setDrag({ ...drag, x: event.clientX, y: event.clientY });
  }

  function onSquarePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (arrowDraft) {
      const to = squareAtPoint(event.clientX, event.clientY, order) ?? arrowDraft.from;
      if (to === arrowDraft.from) {
        setMarks((current) => (current.includes(to) ? current.filter((sq) => sq !== to) : [...current, to]));
      } else {
        setArrows((current) => {
          const exists = current.some((arrow) => arrow.from === arrowDraft.from && arrow.to === to);
          return exists
            ? current.filter((arrow) => !(arrow.from === arrowDraft.from && arrow.to === to))
            : [...current, { from: arrowDraft.from, to }];
        });
      }
      setArrowDraft(null);
      return;
    }
    if (!drag) return;
    const to = squareAtPoint(event.clientX, event.clientY, order);
    const asPremove = Boolean(allowPremove && myColor && state.turn !== myColor && state.board[drag.from]?.color === myColor);
    const legal = asPremove ? new Set(pieceMoves(state, drag.from)) : new Set(movesFrom(state, drag.from));
    if (to != null && to !== drag.from && legal.has(to)) {
      skipClick.current = true;
      attemptMove(drag.from, to, asPremove);
    }
    setDrag(null);
  }

  const drawnArrows = arrowDraft && arrowDraft.from !== arrowDraft.to ? [...arrows, arrowDraft] : arrows;

  return (
    <div className="board-frame" onContextMenu={(event) => event.preventDefault()}>
      <div className="ranks">
        {ranks.map((r) => (
          <span key={r}>{r}</span>
        ))}
      </div>
      <div className="board-wrap">
        <div className="board">
          {order.map((square) => {
          const piece = state.board[square];
          const light = (fileOf(square) + rankOf(square)) % 2 === 1;
          const isLast = last && (last.from === square || last.to === square);
          const isTarget = targets.has(square);
          const home = state.phase === "place" && square === kingHome(state.turn) && !piece;
          const isPremove = premove && (premove.from === square || premove.to === square);
          const classes = [
            "sq",
            light ? "light" : "dark",
            selected === square ? "selected" : "",
            isLast ? "last" : "",
            isTarget ? "target" : "",
            isTarget && piece ? "capture" : "",
            kingAttacked && square === myKing ? "attacked-king" : "",
            home ? "home" : "",
            isPremove ? "premove" : "",
            marks.includes(square) ? "marked" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={square}
              className={classes}
              data-square={algebraic(square)}
              onPointerDown={(event) => onSquarePointerDown(square, event)}
              onPointerMove={onSquarePointerMove}
              onPointerUp={onSquarePointerUp}
              onPointerCancel={() => {
                setDrag(null);
                setArrowDraft(null);
              }}
              onClick={() => {
                if (skipClick.current) {
                  skipClick.current = false;
                  return;
                }
                clickSquare(square);
              }}
            >
              {piece && !(drag && drag.from === square) ? (
                <PieceView type={piece.type} color={piece.color} />
              ) : null}
              {promo && promo.to === square ? (
                <div className="promo">
                  {(["queen", "rook", "bishop", "knight"] as Promo[]).map((type) => (
                    <button
                      key={type}
                      onClick={(e) => {
                        e.stopPropagation();
                        commitMove(promo.from, promo.to, promo.premove, type);
                      }}
                    >
                      <PieceView type={type} color={heldPiece?.color ?? state.turn} />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        </div>
        <svg className="board-arrows" viewBox="0 0 16 16" aria-hidden>
          <defs>
            <marker id={markerId} markerWidth="2.4" markerHeight="2.4" refX="1.6" refY="1.2" orient="auto">
              <path d="M0,0 L2.4,1.2 L0,2.4 Z" fill="rgba(232, 196, 106, 0.92)" />
            </marker>
          </defs>
          {drawnArrows.map((arrow) => {
            const start = squareCenter(arrow.from, orientation);
            const end = squareCenter(arrow.to, orientation);
            const line = shorten(start.x, start.y, end.x, end.y);
            return (
              <line
                key={`${arrow.from}-${arrow.to}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="rgba(232, 196, 106, 0.92)"
                strokeWidth="0.18"
                strokeLinecap="round"
                markerEnd={`url(#${markerId})`}
              />
            );
          })}
        </svg>
      </div>
      <div className="files">
        {files.map((f) => (
          <span key={f}>{f}</span>
        ))}
      </div>
      {drag && heldPiece ? (
        <div className="ghost" style={{ left: drag.x, top: drag.y }}>
          <PieceView type={heldPiece.type} color={heldPiece.color} />
        </div>
      ) : null}
    </div>
  );
}
