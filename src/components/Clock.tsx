import { type Clock, type Color, remainingNow } from "@shared/engine";
import { useEffect, useState } from "react";

function formatTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 100));
  const tenths = total % 10;
  const seconds = Math.floor(total / 10);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (seconds < 20) return `${m}:${String(s).padStart(2, "0")}.${tenths}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ClockView({
  clocks,
  color,
  label,
}: {
  clocks: Clock;
  color: Color;
  label: string;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);
  const ms = remainingNow(clocks, color, now);
  const active = clocks.running === color;
  return (
    <div className={`clock ${active ? "active" : ""} ${ms <= 20_000 ? "low" : ""}`}>
      <div className="who">{label}</div>
      <div className="time">{formatTime(ms)}</div>
    </div>
  );
}
