import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

export function Lobby() {
  const navigate = useNavigate();
  const [minutes, setMinutes] = useState(10);
  const [increment, setIncrement] = useState(5);
  const [color, setColor] = useState<"white" | "black" | "random">("white");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startLocal(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams({
      m: String(minutes),
      i: String(increment),
    });
    navigate(`/local?${params.toString()}`);
  }

  function startChallenge(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const socket = io();
    const initialMs = Math.round(Math.max(0.5, minutes) * 60_000);
    const incrementMs = Math.round(Math.max(0, increment) * 1000);
    const timer = window.setTimeout(() => {
      setError("Keine Verbindung zum Partie-Server. Bitte npm run dev laufen lassen.");
      socket.disconnect();
      setBusy(false);
    }, 6000);
    socket.emit(
      "create",
      { initialMs, incrementMs, color },
      (res: { ok: boolean; code?: string; token?: string; error?: string }) => {
        window.clearTimeout(timer);
        if (!res.ok || !res.code || !res.token) {
          setError(res.error ?? "Partie konnte nicht erstellt werden.");
          socket.disconnect();
          setBusy(false);
          return;
        }
        sessionStorage.setItem(`armychess:${res.code}`, res.token);
        socket.disconnect();
        navigate(`/g/${res.code}`);
      },
    );
  }

  return (
    <div className="page">
      <div className="hero">
        <div className="hero-top">
          <div>
            <p className="eyebrow">16 × 16 Feldarmee</p>
            <h1>ARMYCHESS</h1>
            <p className="lede">
              Weiß zieht zuerst. Die Könige stehen noch nicht auf dem Brett — platziere deinen König irgendwo,
              tausche bei Bedarf mit der Figur, die dort steht, und schlage danach den gegnerischen König. Matt
              gibt es nicht.
            </p>
          </div>
        </div>

        <div className="grid-cards">
          <form className="card" onSubmit={startLocal}>
            <h2>Lokal</h2>
            <p>Beide Farben an einem Gerät. Gut zum Ausprobieren der Aufstellung.</p>
            <TimeFields minutes={minutes} setMinutes={setMinutes} increment={increment} setIncrement={setIncrement} />
            <div className="actions">
              <button className="btn" type="submit">
                Partie am Gerät
              </button>
            </div>
          </form>

          <form className="card" onSubmit={startChallenge}>
            <h2>Herausforderung</h2>
            <p>Erzeuge einen Link, schick ihn weiter — sobald jemand beitritt, beginnt die Platzierung.</p>
            <TimeFields minutes={minutes} setMinutes={setMinutes} increment={increment} setIncrement={setIncrement} />
            <label className="field">
              <span>Deine Farbe</span>
              <select value={color} onChange={(e) => setColor(e.target.value as typeof color)}>
                <option value="white">Weiß</option>
                <option value="black">Schwarz</option>
                <option value="random">Zufall</option>
              </select>
            </label>
            {error ? <p className="error">{error}</p> : null}
            <div className="actions">
              <button className="btn" type="submit" disabled={busy}>
                {busy ? "Erzeuge Link …" : "Link erstellen"}
              </button>
            </div>
          </form>

          <form
            className="card"
            onSubmit={(event) => {
              event.preventDefault();
              const code = joinCode.trim().toUpperCase();
              if (code) navigate(`/g/${code}`);
            }}
          >
            <h2>Beitreten</h2>
            <p>Code aus dem Herausforderungslink hier einfügen.</p>
            <label className="field">
              <span>Partiecode</span>
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="z. B. 7K3QMP" />
            </label>
            <button className="btn secondary" type="submit">
              Beitreten
            </button>
          </form>
        </div>

        <section className="card">
          <h2>Regeln</h2>
          <ul className="rules">
            <li>Brett 16×16, Dateien a–p, Reihen 1–16. Weiß beginnt immer.</li>
            <li>
              Grundreihe: 3 Türme, Springer, 3 Läufer, Dame, Königsfeld, 3 Läufer, Springer, 3 Türme. Vorletzte Reihe:
              7 Springer, 2 Läufer, 7 Springer. Dann zwei volle Bauernreihen.
            </li>
            <li>
              Das Königsfeld (i1 / i16) startet leer. Platziere den König irgendwo auf dem Brett. Steht dort eine Figur,
              wandert sie auf das ursprüngliche Königsfeld.
            </li>
            <li>
              Bauern dürfen beim ersten Zug zwei Felder ziehen. En passant gilt. Umwandlung auf der letzten Reihe.
            </li>
            <li>
              Die Partie endet durch Schlag des Königs, Zeitablauf oder Aufgabe — nicht durch Schachmatt. Du darfst
              jede eigene Figur ziehen, auch wenn dein König angegriffen ist oder dadurch angegriffen würde.
            </li>
          </ul>
          <p>
            <Link to="/local">Direkt lokal spielen</Link>
          </p>
        </section>
      </div>
    </div>
  );
}

function TimeFields({
  minutes,
  setMinutes,
  increment,
  setIncrement,
}: {
  minutes: number;
  setMinutes: (n: number) => void;
  increment: number;
  setIncrement: (n: number) => void;
}) {
  return (
    <div className="row">
      <label className="field">
        <span>Startzeit (Minuten)</span>
        <input
          type="number"
          min={0.5}
          step={0.5}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
        />
      </label>
      <label className="field">
        <span>Bonus pro Zug (Sek.)</span>
        <input type="number" min={0} step={1} value={increment} onChange={(e) => setIncrement(Number(e.target.value))} />
      </label>
    </div>
  );
}
