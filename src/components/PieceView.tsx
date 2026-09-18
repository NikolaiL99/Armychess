import type { Color, PieceType } from "@shared/engine";
import meridaPaths from "./meridaPaths.json";

function largestSubpath(d: string): string {
  const parts = d.split(/(?=M)/).filter(Boolean);
  let best = parts[0] ?? d;
  let bestArea = -1;
  for (const part of parts) {
    const coords = [...part.matchAll(/-?\d*\.?\d+/g)].map((m) => Number(m[0]));
    const xs = coords.filter((_, i) => i % 2 === 0);
    const ys = coords.filter((_, i) => i % 2 === 1);
    if (xs.length === 0 || ys.length === 0) continue;
    const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    if (area > bestArea) {
      bestArea = area;
      best = part;
    }
  }
  return best;
}

export function PieceView({
  type,
  color,
  className,
}: {
  type: PieceType;
  color: Color;
  className?: string;
}) {
  const d = meridaPaths[type][color];
  return (
    <svg
      className={`${className ?? "piece"} ${color}`}
      viewBox="0 0 2048 2048"
      aria-hidden
    >
      <path d={largestSubpath(d)} fill="#f7f7f7" />
      <path d={d} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
