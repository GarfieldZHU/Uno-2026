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

function trimEndpoints(from: Point, to: Point): [Point, Point] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const distance = Math.hypot(dx, dy) || 1;
  // Keep the visible route in the gap between seat cards. The arrowhead is
  // now placed at the route midpoint, so this inset only protects avatars
  // from the connector itself and can be a little more generous.
  const inset = Math.min(15, Math.max(5.5, distance * .22));
  const ux = dx / distance;
  const uy = dy / distance;
  return [
    [from[0] + ux * inset, from[1] + uy * inset],
    [to[0] - ux * inset, to[1] - uy * inset],
  ];
}

type CubicRoute = {
  path: string;
};

function lerp(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Split the cubic at t=.5 so SVG's marker-mid can place one crisp arrowhead
 * at the geometric midpoint. Keeping the curve itself intact avoids the
 * visual kink that a separate overlay triangle would introduce on oval
 * tables with different aspect ratios.
 */
function splitCubicAtMidpoint(start: Point, c1: Point, c2: Point, end: Point) {
  const p01 = lerp(start, c1, .5);
  const p12 = lerp(c1, c2, .5);
  const p23 = lerp(c2, end, .5);
  const p012 = lerp(p01, p12, .5);
  const p123 = lerp(p12, p23, .5);
  const midpoint = lerp(p012, p123, .5);
  return { left1: p01, left2: p012, midpoint, right1: p123, right2: p23 };
}

function formatPoint([x, y]: Point) {
  return `${x.toFixed(2)} ${y.toFixed(2)}`;
}

function routePath(from: Point, to: Point): CubicRoute {
  const [start, end] = trimEndpoints(from, to);
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const midpoint: Point = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const radialX = midpoint[0] - 50;
  const radialY = midpoint[1] - 50;
  const radialLength = Math.hypot(radialX, radialY);
  // Bend toward the felt rim, not toward the central piles. For the rare
  // straight-through case (three seats), use the upper normal so the route
  // follows the table perimeter instead of crossing the discard pile.
  const throughCentre = radialLength <= 7;
  const outward: Point = !throughCentre
    ? [radialX / radialLength, radialY / radialLength]
    : [Math.abs(dx) >= Math.abs(dy) ? 0 : (dy >= 0 ? 1 : -1), Math.abs(dx) >= Math.abs(dy) ? -1 : 0];
  const bend = throughCentre
    ? Math.min(22, Math.max(16, Math.hypot(dx, dy) * .25))
    : Math.min(10, Math.max(4.5, Math.hypot(dx, dy) * .14));
  const c1: Point = [start[0] + dx * .32 + outward[0] * bend, start[1] + dy * .32 + outward[1] * bend];
  const c2: Point = [start[0] + dx * .68 + outward[0] * bend, start[1] + dy * .68 + outward[1] * bend];
  const { left1, left2, midpoint: curveMidpoint, right1, right2 } = splitCubicAtMidpoint(start, c1, c2, end);
  return {
    // The join at `midpoint` is intentional: marker-mid renders exactly one
    // direction head there, while the endpoints stay clear of seat avatars.
    path: `M ${formatPoint(start)} C ${formatPoint(left1)} ${formatPoint(left2)} ${formatPoint(curveMidpoint)} C ${formatPoint(right1)} ${formatPoint(right2)} ${formatPoint(end)}`,
  };
}

function playerPoint(playerId: number, players: number[], humanId: number): Point {
  const slot = seatSlotForPlayer(playerId, humanId, players.length, players);
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
  const routeEdges = players.map((from, index) => {
    const nextIndex = (index + (clockwise ? 1 : -1) + players.length) % players.length;
    const to = players[nextIndex];
    return { from, to, ...routePath(playerPoint(from, players, humanId), playerPoint(to, players, humanId)) };
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
        <marker id={markerId} markerWidth="4.2" markerHeight="4.2" viewBox="0 0 8 8" refX="6.8" refY="4" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 8 4 L 0 8 L 2.2 4 z" fill="currentColor" />
        </marker>
        <marker id={`${markerId}-active`} markerWidth="5.2" markerHeight="5.2" viewBox="0 0 10 10" refX="8.2" refY="5" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 10 5 L 0 10 L 2.8 5 z" fill="currentColor" />
        </marker>
      </defs>

      <g className="direction-arrow-routes" aria-hidden="true">
        {routeEdges.map(({ from, to, path }) => {
          const active = from === currentPlayerId && to === nextPlayerId;
          return (
            <g className={`direction-arrow-route ${active ? "is-active-route" : "is-muted-route"}`} data-from-player={from} data-to-player={to} data-active={active ? "true" : undefined} key={`${from}-${to}`}>
              <path className="direction-arrow-route-hit" d={path} />
              <path
                className="direction-arrow-route-line direction-arrow-line"
                d={path}
                markerMid={`url(#${active ? `${markerId}-active` : markerId})`}
                data-arrow-position="midpoint"
              />
            </g>
          );
        })}
      </g>
      <text className="sr-only" x="-100" y="-100">{label}</text>
    </svg>
  );
}
