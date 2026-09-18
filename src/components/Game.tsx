import {
  type Color,
  type GameState,
  type PieceType,
  applyTimeout,
  createGame,
  describeEnd,
  makeMove,
  placeKing,
  remainingNow,
  resign,
} from "@shared/engine";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { Board } from "./Board";
import { ClockView } from "./Clock";

type Promo = Exclude<PieceType, "king" | "pawn">;

type RoomView = {
  code: string;
  state: GameState;
  waiting: boolean;
  players: { white: boolean; black: boolean };
};

function parseTime(params: URLSearchParams) {
  const minutes = Math.max(0.5, Number(params.get("m") ?? 10) || 10);
  const increment = Math.max(0, Number(params.get("i") ?? 0) || 0);
  return { initialMs: Math.round(minutes * 60_000), incrementMs: Math.round(increment * 1000) };
}

export function LocalGame() {
  const [params] = useSearchParams();
  const time = useMemo(() => parseTime(params), [params]);
  const [state, setState] = useState(() => createGame(time.initialMs, time.incrementMs));
  const [flip, setFlip] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setState((current) => {
        if (current.phase !== "play") return current;
        if (remainingNow(current.clocks, "white") <= 0 || remainingNow(current.clocks, "black") <= 0) {
          return applyTimeout(current);
        }
        return current;
      });
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <GameTable
      state={state}
      orientation={flip ? "black" : "white"}
      interactive
      waiting={false}
      status={statusText(state, "local")}
      onPlace={(square) =>
        setState((s) => {
          try {
            return placeKing(s, square);
          } catch {
            return s;
          }
        })
      }
      onMove={(from, to, promotion) =>
        setState((s) => {
          try {
            return makeMove(s, { from, to, promotion });
          } catch {
            return s;
          }
        })
      }
      onResign={(color) => setState((s) => resign(s, color))}
      extraActions={
        <button className="btn secondary" type="button" onClick={() => setFlip((v) => !v)}>
          Brett drehen
        </button>
      }
    />
  );
}

export function OnlineGame() {
  const { code: rawCode } = useParams();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [color, setColor] = useState<Color | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!rawCode || rawCode.toLowerCase() === "new") {
      setError("Ungültiger Herausforderungslink.");
      return;
    }
    const s = io();
    setSocket(s);
    let started = false;
    const onRoom = (next: RoomView) => setRoom(next);
    const join = () => {
      if (started) return;
      started = true;
      const code = rawCode.toUpperCase();
      const token = sessionStorage.getItem(`armychess:${code}`) ?? undefined;
      s.emit(
        "join",
        { code, token },
        (res: { ok: boolean; token?: string; color?: Color; error?: string; room?: RoomView }) => {
          if (!res.ok || !res.token || !res.color) {
            setError(res.error ?? "Beitreten fehlgeschlagen.");
            return;
          }
          sessionStorage.setItem(`armychess:${code}`, res.token);
          setColor(res.color);
          if (res.room) setRoom(res.room);
        },
      );
    };
    s.on("room", onRoom);
    s.on("connect", join);
    if (s.connected) join();
    s.on("connect_error", () => {
      setError("Keine Verbindung zum Partie-Server.");
    });
    return () => {
      s.off("room", onRoom);
      s.off("connect", join);
      s.disconnect();
    };
  }, [rawCode]);

  const link = `${window.location.origin}/g/${room?.code ?? ""}`;
  const token = room ? sessionStorage.getItem(`armychess:${room.code}`) : null;
  const myTurn = Boolean(room && color && room.state.turn === color && room.state.phase !== "over");
  const interactive = Boolean(room && !room.waiting && myTurn);

  if (error) {
    return (
      <div className="page">
        <div className="card">
          <h2>Keine Partie</h2>
          <p className="error">{error}</p>
          <Link to="/">Zurück zur Startseite</Link>
        </div>
      </div>
    );
  }

  if (!room || !color) {
    return (
      <div className="page">
        <p>Verbinde …</p>
      </div>
    );
  }

  return (
    <GameTable
      state={room.state}
      orientation={color}
      interactive={interactive}
      waiting={room.waiting}
      status={
        room.waiting
          ? "Warte auf den Gegner. Schick den Link weiter."
          : statusText(room.state, "online", color)
      }
      onPlace={(square) => socket?.emit("place", { code: room.code, token, square })}
      onMove={(from, to, promotion) => socket?.emit("move", { code: room.code, token, move: { from, to, promotion } })}
      onResign={() => socket?.emit("resign", { code: room.code, token })}
      extraActions={
        <>
          <div className="link-box">
            <input readOnly value={link} />
            <button
              className="btn secondary"
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              }}
            >
              {copied ? "Kopiert" : "Link kopieren"}
            </button>
          </div>
          <span className="banner">Du spielst {color === "white" ? "Weiß" : "Schwarz"}.</span>
        </>
      }
    />
  );
}

function statusText(state: GameState, mode: "local" | "online", myColor?: Color) {
  if (state.phase === "over") return describeEnd(state);
  if (state.phase === "place") {
    const who = state.turn === "white" ? "Weiß" : "Schwarz";
    if (mode === "online" && myColor) {
      return state.turn === myColor
        ? "Platziere deinen König auf einem beliebigen Feld."
        : `${who} platziert den König.`;
    }
    return `${who}: König platzieren. Steht dort eine Figur, tauscht sie auf das Königsfeld.`;
  }
  const who = state.turn === "white" ? "Weiß" : "Schwarz";
  if (mode === "online" && myColor) {
    return state.turn === myColor ? "Du bist am Zug." : `${who} ist am Zug.`;
  }
  return `${who} ist am Zug.`;
}

function GameTable({
  state,
  orientation,
  interactive,
  waiting,
  status,
  onPlace,
  onMove,
  onResign,
  extraActions,
}: {
  state: GameState;
  orientation: Color;
  interactive: boolean;
  waiting: boolean;
  status: string;
  onPlace: (square: number) => void;
  onMove: (from: number, to: number, promotion?: Promo) => void;
  onResign: (color: Color) => void;
  extraActions?: ReactNode;
}) {
  const [focus, setFocus] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onFs = () => setFocus(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  async function toggleFocus() {
    const root = document.getElementById("game-root");
    try {
      if (!document.fullscreenElement && root) await root.requestFullscreen();
      else if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      setFocus((v) => !v);
    }
  }

  const topColor: Color = orientation === "white" ? "black" : "white";
  const bottomColor: Color = orientation;

  return (
    <div id="game-root" className={`game-shell ${focus ? "focus-mode" : ""}`}>
      <header className="topbar">
        <Link className="brand-link" to="/">
          ARMYCHESS
        </Link>
        <div className="actions">
          <button className="btn secondary" type="button" onClick={() => void toggleFocus()}>
            Fokusmodus
          </button>
          <button className="btn danger" type="button" onClick={() => onResign(bottomColor)} disabled={state.phase === "over"}>
            Aufgeben
          </button>
        </div>
      </header>
      <div className="play-layout">
        <aside className="side">
          <ClockView clocks={state.clocks} color={topColor} label={topColor === "white" ? "Weiß" : "Schwarz"} />
          <p className="status">{status}</p>
          {waiting ? extraActions : null}
        </aside>
        <div className="board-shell">
          <div className="focus-clocks">
            <span>
              {topColor === "white" ? "Weiß" : "Schwarz"}{" "}
              {Math.ceil(remainingNow(state.clocks, topColor) / 1000)}s
            </span>
            <span>
              {bottomColor === "white" ? "Weiß" : "Schwarz"}{" "}
              {Math.ceil(remainingNow(state.clocks, bottomColor) / 1000)}s
            </span>
          </div>
          <Board
            state={state}
            orientation={orientation}
            interactive={interactive && !waiting}
            onPlace={onPlace}
            onMove={onMove}
          />
        </div>
        <aside className="side">
          <ClockView clocks={state.clocks} color={bottomColor} label={bottomColor === "white" ? "Weiß" : "Schwarz"} />
          {!waiting ? extraActions : null}
          {state.phase === "over" ? <div className="banner">{describeEnd(state)}</div> : null}
        </aside>
      </div>
    </div>
  );
}

export function NotFound() {
  const location = useLocation();
  return (
    <div className="page">
      <div className="card">
        <h2>Seite nicht gefunden</h2>
        <p>{location.pathname}</p>
        <Link to="/">Zur Startseite</Link>
      </div>
    </div>
  );
}

