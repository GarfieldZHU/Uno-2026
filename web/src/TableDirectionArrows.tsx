import type { Language } from "./i18n";
import { seatSlotForPlayer } from "./tableSeats";

type Props = {
  direction: number;
  language: Language;
  players?: number[];
  humanId?: number;
  currentPlayerId?: number | null;
  nextPlayerId?: number | null;
};

type Point = [number, number];

/**
 * The table is an oval, but the route is laid out in the same coordinate
 * system as the seat resolver. That keeps the arrow attached to the actual
 * players instead of stretching a generic circle over the playfield.
 */
const SEAT_ANCHORS: Record<string, Point> = {
  south: [50, 88],
  "south-south-west": [34, 84],
  "south-west": [22, 76],
  west: [9, 50],
  "north-west": [22, 24],
  north: [50, 13],
  "north-east": [78, 24],
  east: [91, 50],
  "south-east": [78, 76],
  "south-south-east": [66, 84],
};

function routePath(from: Point, to: Point) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const midpoint: Point = [(x1 + x2) / 2, (y1 + y2) / 2];
  // Pull the control point slightly toward the felt centre. The result is a
  // short, readable connector that never cuts through the centre piles.
  const control: Point = [midpoint[0] * 0.82 + 50 * 0.18, midpoint[1] * 0.82 + 50 * 0.18];
  return `M ${x1} ${y1} Q ${control[0].toFixed(2)} ${control[1].toFixed(2)} ${x2} ${y2}`;
}

function playerPoint(playerId: number, players: number[], humanId: number): Point {
  const slot = seatSlotForPlayer(playerId, humanId, players.length);
  return SEAT_ANCHORS[slot] ?? SEAT_ANCHORS.north;
}

export function TableDirectionArrows({
  direction,
  language,
  players = [0, 1, 2, 3],
  humanId = 0,
  currentPlayerId = null,
  nextPlayerId = null,
}: Props) {
  const clockwise = direction === 1;
  const label = clockwise
    ? (language === "zh" ? "顺时针出牌，箭头连接每位玩家与下一位" : "Clockwise play; arrows connect each player to the next")
    : (language === "zh" ? "逆时针出牌，箭头连接每位玩家与下一位" : "Counter-clockwise play; arrows connect each player to the next");
  const markerId = clockwise ? "direction-arrow-head-cw" : "direction-arrow-head-ccw";
  const seatPoints = players.map((playerId) => ({ playerId, point: playerPoint(playerId, players, humanId) }));
  // The quiet rail follows the same actual seat ring as the player cards. It
  // is generated from the count rather than using a fixed eight-segment oval,
  // so 5–10 seat tables never show orphaned arrows.
  const orientationRail = seatPoints.map(({ playerId, point }, index) => {
    const next = seatPoints[(index + 1) % seatPoints.length];
    return { playerId, path: routePath(point, next.point) };
  });
  const routeEdges = players.map((from, index) => {
    const nextIndex = (index + (clockwise ? 1 : -1) + players.length) % players.length;
    const to = players[nextIndex];
    return { from, to, path: routePath(playerPoint(from, players, humanId), playerPoint(to, players, humanId)) };
  });

  return (
    <svg
      className={`table-direction-arrows ${clockwise ? "is-clockwise" : "is-counter-clockwise"}`}
      data-testid="table-direction-indicator"
      data-direction={clockwise ? "clockwise" : "counter-clockwise"}
      data-player-count={players.length}
      data-active-route={currentPlayerId !== null && nextPlayerId !== null ? `${currentPlayerId}-${nextPlayerId}` : undefined}
      role="img"
      aria-label={label}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <title>{clockwise ? (language === "zh" ? "顺时针" : "CLOCKWISE") : (language === "zh" ? "逆时针" : "COUNTER-CLOCKWISE")}</title>
      <desc>{label}</desc>
      <defs>
        <marker id={markerId} markerWidth="7" markerHeight="7" refX="5.8" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 7 3.5 L 0 7 L 2 3.5 z" fill="currentColor" />
        </marker>
        <marker id={`${markerId}-active`} markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 9 4.5 L 0 9 L 2.5 4.5 z" fill="currentColor" />
        </marker>
      </defs>

      <g className="direction-arrow-rail" aria-hidden="true">
        {orientationRail.map(({ playerId, path }) => <path className="direction-arrow-line" d={path} key={`rail-${playerId}`} />)}
      </g>

      <g className="direction-arrow-routes" aria-hidden="true">
        {routeEdges.map(({ from, to, path }) => {
          const active = from === currentPlayerId && to === nextPlayerId;
          return (
            <g className={`direction-arrow-route ${active ? "is-active-route" : "is-muted-route"}`} data-from-player={from} data-to-player={to} data-active={active ? "true" : undefined} key={`${from}-${to}`}>
              <path className="direction-arrow-route-hit" d={path} />
              <path className="direction-arrow-route-line" d={path} markerEnd={`url(#${active ? `${markerId}-active` : markerId})`} />
            </g>
          );
        })}
      </g>
      <text className="sr-only" x="-100" y="-100">{label}</text>
    </svg>
  );
}
