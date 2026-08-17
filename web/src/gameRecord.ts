import type { Card, Snapshot } from "./types";

export type GameRecordSource = "offline" | "online";

export type GameRecordEvent = {
  id: string;
  sequence: number;
  turnNumber: number;
  observedAt: string;
  source: GameRecordSource;
  action: string;
  lastAction: string;
  actorId: number | null;
  actorName: string | null;
  card: Card | null;
  topCard: Card;
  activeColor: Snapshot["active_color"];
  direction: number;
  currentPlayerId: number;
  currentPlayerName: string | null;
  nextPlayerId: number;
  nextPlayerName: string | null;
  pendingDraw: number;
  drawCount: number;
  discardCount: number;
  handCounts: Record<string, number>;
  message: string;
  status: Snapshot["status"];
  winnerId: number | null;
};

export type GameRecord = {
  schemaVersion: 1;
  source: GameRecordSource;
  roomCode?: string;
  startedAt: string;
  endedAt?: string;
  events: GameRecordEvent[];
  finalSnapshot: Snapshot | null;
};

function parseAction(lastAction: string, snapshot: Snapshot) {
  const played = /^player-(\d+)-played-(.+)$/.exec(lastAction);
  if (played) return { action: "play", actorId: Number(played[1]), card: snapshot.top_card };
  const drew = /^player-(\d+)-drew-(\d+)$/.exec(lastAction);
  if (drew) return { action: `draw-${drew[2]}`, actorId: Number(drew[1]), card: null };
  const calledUno = /^player-(\d+)-called-uno$/.exec(lastAction);
  if (calledUno) return { action: "call-uno", actorId: Number(calledUno[1]), card: null };
  const penalty = /^player-(\d+)-uno-penalty$/.exec(lastAction);
  if (penalty) return { action: "uno-penalty", actorId: Number(penalty[1]), card: null };
  return { action: snapshot.status === "Won" ? "game-won" : "table-ready", actorId: null, card: null };
}

export function createGameRecord(source: GameRecordSource, roomCode?: string, initialSnapshot?: Snapshot | null): GameRecord {
  const now = new Date().toISOString();
  const empty: GameRecord = { schemaVersion: 1, source, roomCode, startedAt: now, events: [], finalSnapshot: null };
  return initialSnapshot ? appendSnapshotEvent(empty, initialSnapshot, now) : empty;
}

export function snapshotEventKey(snapshot: Snapshot) {
  return [snapshot.turn_number, snapshot.last_action, snapshot.status, snapshot.top_card.id, snapshot.pending_draw, snapshot.players.map((player) => player.hand_count).join(",")].join("|");
}

export function appendSnapshotEvent(record: GameRecord, snapshot: Snapshot, observedAt = new Date().toISOString()): GameRecord {
  const previous = record.events[record.events.length - 1];
  const previousKey = previous ? [previous.turnNumber, previous.lastAction, previous.status, previous.topCard.id, previous.pendingDraw, Object.values(previous.handCounts).join(",")].join("|") : null;
  const currentKey = snapshotEventKey(snapshot);
  if (previous && previousKey === currentKey) return { ...record, finalSnapshot: snapshot };

  const parsed = parseAction(snapshot.last_action, snapshot);
  const actor = parsed.actorId === null ? null : snapshot.players.find((player) => player.id === parsed.actorId) ?? null;
  const current = snapshot.players.find((player) => player.id === snapshot.current_player) ?? null;
  const next = snapshot.players.find((player) => player.id === snapshot.next_player) ?? null;
  const event: GameRecordEvent = {
    id: `${snapshot.turn_number}-${snapshot.last_action || "ready"}-${snapshot.top_card.id}`,
    sequence: record.events.length + 1,
    turnNumber: snapshot.turn_number,
    observedAt,
    source: record.source,
    action: parsed.action,
    lastAction: snapshot.last_action,
    actorId: parsed.actorId,
    actorName: actor?.name ?? null,
    card: parsed.card,
    topCard: snapshot.top_card,
    activeColor: snapshot.active_color,
    direction: snapshot.direction,
    currentPlayerId: snapshot.current_player,
    currentPlayerName: current?.name ?? null,
    nextPlayerId: snapshot.next_player,
    nextPlayerName: next?.name ?? null,
    pendingDraw: snapshot.pending_draw,
    drawCount: snapshot.draw_count,
    discardCount: snapshot.discard_count,
    handCounts: Object.fromEntries(snapshot.players.map((player) => [String(player.id), player.hand_count])),
    message: snapshot.message,
    status: snapshot.status,
    winnerId: snapshot.winner,
  };
  return {
    ...record,
    endedAt: snapshot.status === "Won" ? (record.endedAt ?? observedAt) : record.endedAt,
    events: [...record.events, event],
    finalSnapshot: snapshot,
  };
}

export function downloadGameRecord(record: GameRecord) {
  const payload = JSON.stringify(record, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `uno-2026-${record.roomCode ?? record.source}-record-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
