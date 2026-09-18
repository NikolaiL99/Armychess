import type { PieceType } from "@shared/engine";

const lightFill = "#f4efe4";
const darkFill = "#1d1a16";
const lightStroke = "#2a2418";
const darkStroke = "#ece6d6";

export function PieceView({
  type,
  color,
  className,
}: {
  type: PieceType;
  color: "white" | "black";
  className?: string;
}) {
  const fill = color === "white" ? lightFill : darkFill;
  const stroke = color === "white" ? lightStroke : darkStroke;
  const sw = color === "white" ? 1.8 : 1.4;
  return (
    <svg className={className ?? "piece"} viewBox="0 0 45 45" aria-hidden>
      {type === "pawn" && (
        <path
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          d="M22.5 9a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm-6.5 16.5c0-4.2 2.9-6.7 6.5-7.6 3.6.9 6.5 3.4 6.5 7.6 0 1.8-2.9 3.2-6.5 3.2s-6.5-1.4-6.5-3.2zM16 32.5s2.2 3.8 6.5 3.8 6.5-3.8 6.5-3.8V36c0 0-2 2.8-6.5 2.8S16 36 16 36z"
        />
      )}
      {type === "rook" && (
        <path
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          d="M11 10h5v4h4V10h5v4h4V10h5v9H11zm2 9h19v12.5H13zM12 32.5h21V36c0 0-3 3-10.5 3S12 36 12 36z"
        />
      )}
      {type === "knight" && (
        <path
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          d="M14 36c0 0 2.5 3 8.5 3s8.5-3 8.5-3V33H14zM13 15c4-7 11-8 16-4 2 2 3 5 2 8l3 2-2 3c-3-1-5 0-7 2-3 3-4 6-4 8H15c0-5 1-9-2-13z"
        />
      )}
      {type === "bishop" && (
        <path
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          d="M22.5 8c2 3 6 8 6 13 0 4-2.4 6.5-6 7.5-3.6-1-6-3.5-6-7.5 0-5 4-10 6-13zM16 30.5h13v3.2H16zM14 35s3 3.5 8.5 3.5S31 35 31 35v-1.2H14z"
        />
      )}
      {type === "queen" && (
        <path
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          d="M10 16l4.5 12h16L35 16l-6 6-6.5-9-6.5 9zM14 30h17v3H14zM13 35s3 3.5 9.5 3.5S32 35 32 35v-1H13z"
        />
      )}
      {type === "king" && (
        <path
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
          d="M20.5 7h4v3h3v4h-3v3h-4v-3h-3V10h3zM12 21l4 10h13l4-10-6.5 4L22.5 16 18.5 25zM14 33h17v2.5H14zM13 37s3 2.8 9.5 2.8S32 37 32 37v-1H13z"
        />
      )}
    </svg>
  );
}
