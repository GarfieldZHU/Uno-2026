import type { PlayFlightSource, Player } from "./types";

/** Slots are ordered clockwise around the human seat (south). */
type OpponentSeat = Exclude<PlayFlightSource, "human">;
type SeatSlot = "south" | OpponentSeat;

export const SEAT_LAYOUTS: Record<number, OpponentSeat[]> = {
  3: ["west", "east"],
  4: ["west", "north", "east"],
  5: ["west", "north-west", "north-east", "east"],
  6: ["south-west", "west", "north", "east", "south-east"],
  7: ["south-west", "west", "north-west", "north-east", "east", "south-east"],
  8: ["south-west", "west", "north-west", "north", "north-east", "east", "south-east"],
  // Nine and ten seats use two shallow lower-corner slots so the human seat
  // remains readable while every opponent still has a unique anchor.
  9: ["south-south-west", "west", "north-west", "north", "north-east", "east", "south-east", "south-south-east"],
  10: ["south-south-west", "south-west", "west", "north-west", "north", "north-east", "east", "south-east", "south-south-east"],
};

function relativeOffset(playerId: number, humanId: number, playerCount: number, playerIds?: readonly number[]) {
  if (playerIds && playerIds.length === playerCount) {
    const playerIndex = playerIds.indexOf(playerId);
    const humanIndex = playerIds.indexOf(humanId);
    if (playerIndex >= 0 && humanIndex >= 0) return (playerIndex - humanIndex + playerCount) % playerCount;
  }
  return (playerId - humanId + playerCount) % playerCount;
}

export function seatSlotForPlayer(playerId: number, humanId: number, playerCount: number, playerIds?: readonly number[]): SeatSlot {
  if (playerId === humanId) return "south";
  const layout = SEAT_LAYOUTS[playerCount] ?? SEAT_LAYOUTS[4];
  return layout[relativeOffset(playerId, humanId, playerCount, playerIds) - 1] ?? "north";
}

export function orderedOpponents(players: Player[], humanId: number) {
  const playerIds = players.map((player) => player.id);
  return [...players]
    .filter((player) => player.id !== humanId)
    .sort((a, b) => relativeOffset(a.id, humanId, players.length, playerIds) - relativeOffset(b.id, humanId, players.length, playerIds));
}

export function nextPlayerId(players: Player[], playerId: number, direction: number) {
  if (players.length === 0) return playerId;
  const index = players.findIndex((player) => player.id === playerId);
  if (index < 0) return players[0]?.id ?? playerId;
  const step = direction === -1 ? -1 : 1;
  return players[(index + step + players.length) % players.length]?.id ?? playerId;
}

export function sourceForPlayer(playerId: number, humanId: number, playerCount: number, playerIds?: readonly number[]): PlayFlightSource {
  if (playerId === humanId) return "human";
  return seatSlotForPlayer(playerId, humanId, playerCount, playerIds) as OpponentSeat;
}
