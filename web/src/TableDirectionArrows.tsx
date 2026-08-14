import type { Language } from "./i18n";

type Props = {
  direction: number;
  language: Language;
};

// The segments form a quiet oval around the playfield. Each arrow points to
// the next seat, so the direction remains legible without taking over the
// center piles or adding another HUD box.
const CLOCKWISE_SEGMENTS = [
  "M 18 24 Q 32 11 49 12",
  "M 51 12 Q 68 11 82 24",
  "M 82 24 Q 92 35 89 49",
  "M 89 51 Q 92 66 82 76",
  "M 82 76 Q 68 89 51 88",
  "M 49 88 Q 32 89 18 76",
  "M 18 76 Q 8 65 11 51",
  "M 11 49 Q 8 35 18 24",
];

const COUNTER_CLOCKWISE_SEGMENTS = [
  "M 49 12 Q 32 11 18 24",
  "M 82 24 Q 68 11 51 12",
  "M 89 49 Q 92 35 82 24",
  "M 82 76 Q 92 66 89 51",
  "M 51 88 Q 68 89 82 76",
  "M 18 76 Q 32 89 49 88",
  "M 11 51 Q 8 65 18 76",
  "M 18 24 Q 8 35 11 49",
];

export function TableDirectionArrows({ direction, language }: Props) {
  const clockwise = direction === 1;
  const label = clockwise
    ? (language === "zh" ? "顺时针出牌，箭头连接下一位玩家" : "Clockwise play; arrows connect each next player")
    : (language === "zh" ? "逆时针出牌，箭头连接下一位玩家" : "Counter-clockwise play; arrows connect each next player");
  const segments = clockwise ? CLOCKWISE_SEGMENTS : COUNTER_CLOCKWISE_SEGMENTS;
  const markerId = clockwise ? "direction-arrow-head-cw" : "direction-arrow-head-ccw";

  return (
    <svg
      className={`table-direction-arrows ${clockwise ? "is-clockwise" : "is-counter-clockwise"}`}
      data-testid="table-direction-indicator"
      data-direction={clockwise ? "clockwise" : "counter-clockwise"}
      role="img"
      aria-label={label}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <title>{clockwise ? (language === "zh" ? "顺时针" : "CLOCKWISE") : (language === "zh" ? "逆时针" : "COUNTER-CLOCKWISE")}</title>
      <desc>{label}</desc>
      <defs>
        <marker id={markerId} markerWidth="5" markerHeight="5" refX="4.2" refY="2.5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 5 2.5 L 0 5 z" fill="currentColor" />
        </marker>
      </defs>
      <g className="direction-arrow-ring" aria-hidden="true">
        {segments.map((path, index) => (
          <g className="direction-arrow-segment" key={`${direction}-${index}`}>
            <path className="direction-arrow-hit" d={path} />
            <path className="direction-arrow-line" d={path} markerEnd={`url(#${markerId})`} />
          </g>
        ))}
      </g>
      <text className="sr-only" x="-100" y="-100">{label}</text>
    </svg>
  );
}
