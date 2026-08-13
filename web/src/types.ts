export type Color = "Red" | "Yellow" | "Green" | "Blue" | "Wild";

export type Card = {
  id: number;
  color: Color;
  kind: string;
  label: string;
};

export type PlayFlightSource =
  | "human"
  | "north"
  | "north-west"
  | "north-east"
  | "east"
  | "west"
  | "south-east"
  | "south-west";

export type PlayFlightEvent = {
  id: string;
  card: Card;
  playerId: number;
  source: PlayFlightSource;
};

export type Player = {
  id: number;
  name: string;
  kind: string;
  hand_count: number;
  hand: Card[];
  uno_called: boolean;
};

export type Snapshot = {
  players: Player[];
  current_player: number;
  next_player: number;
  direction: number;
  active_color: Color;
  top_card: Card;
  discard_cards: Card[];
  draw_count: number;
  discard_count: number;
  pending_draw: number;
  status: "Playing" | "Won";
  winner: number | null;
  turn_number: number;
  message: string;
  last_action: string;
  ai_profile: string;
};

export type PlayerCount = 3 | 4 | 5 | 6 | 7 | 8;

export const PLAYER_COUNTS: PlayerCount[] = [3, 4, 5, 6, 7, 8];
export const AI_DELAY_MIN_SECONDS = 1;
export const AI_DELAY_MAX_SECONDS = 30;
export const DEFAULT_AI_DELAY_SECONDS = 3;

export type CommandError = {
  ok: false;
  error: string | null;
  snapshot: Snapshot;
};

export const COLORS: Array<{ name: Color; label: string; className: string }> = [
  { name: "Red", label: "Red", className: "red" },
  { name: "Yellow", label: "Yellow", className: "yellow" },
  { name: "Green", label: "Green", className: "green" },
  { name: "Blue", label: "Blue", className: "blue" },
];

export const PROFILE_OPTIONS = [
  { value: "garfield1993-ai-simple", label: "garfield1993 · simple", hint: "First legal move" },
  { value: "garfield1993-ai-hard", label: "garfield1993 · hard", hint: "Action pressure" },
  { value: "uno-2026-ai-easy", label: "uno-2026 · easy", hint: "Readable pacing" },
  { value: "uno-2026-ai-strategist", label: "uno-2026 · strategist", hint: "Color + threat scoring" },
] as const;
