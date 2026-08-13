import type { Snapshot } from "./types";

export type OnlinePlayer = {
  id: number;
  name: string;
  ready?: boolean;
  isHost?: boolean;
  host?: boolean;
};

export type OnlineSession = {
  code: string;
  playerId: number;
  playerToken: string;
  host: boolean;
};

export type OnlineRoom = {
  code: string;
  roomCode: string;
  hostId: number | null;
  players: OnlinePlayer[];
  maxPlayers: number;
  aiCount: number;
  countdownSeconds: number;
  status: "waiting" | "playing";
  started: boolean;
  snapshot: Snapshot | null;
  expiresInSeconds: number;
  turnDeadlineEpochMs?: number | null;
  session?: OnlineSession;
};

export type CreateRoomRequest = {
  name: string;
  maxPlayers: number;
  aiCount: number;
  countdownSeconds: number;
  aiProfile?: string;
};

export type JoinRoomRequest = { name: string; code: string };
export type OnlineAction = { action: "play" | "draw" | "call_uno"; cardId?: number; chosenColor?: string };

export interface OnlineApi {
  createRoom(request: CreateRoomRequest): Promise<OnlineRoom>;
  joinRoom(request: JoinRoomRequest): Promise<OnlineRoom>;
  leaveRoom(room: OnlineRoom): Promise<void>;
  startRoom(room: OnlineRoom): Promise<OnlineRoom>;
  getRoom(room: OnlineRoom): Promise<OnlineRoom>;
  action(room: OnlineRoom, action: OnlineAction): Promise<OnlineRoom>;
}

type WireRoom = Partial<OnlineRoom> & {
  room_code?: string;
  player_id?: number;
  player_token?: string;
  host?: boolean;
  expires_in_seconds?: number;
  turn_timeout_seconds?: number;
  turn_deadline_epoch_ms?: number | null;
  room?: WireRoom;
  host_id?: number | null;
  seat_count?: number;
  ai_count?: number;
};

/** REST adapter for the Rust room service. Set VITE_ONLINE_API_URL when the
 * service is hosted separately; an empty value supports a same-origin proxy. */
export function createOnlineApi(baseUrl = import.meta.env.VITE_ONLINE_API_URL ?? ""): OnlineApi {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || `Request failed (${response.status})`);
    return payload as T;
  }

  function sessionHeaders(room: OnlineRoom): HeadersInit {
    return { "X-Player-Token": room.session?.playerToken ?? "" };
  }

  function mergeSession(payload: WireRoom, previous?: OnlineRoom): OnlineRoom {
    const code = payload.code ?? payload.room_code ?? previous?.code ?? "";
    const playerToken = payload.player_token ?? previous?.session?.playerToken;
    const playerId = payload.player_id ?? previous?.session?.playerId ?? 0;
    const host = payload.host ?? previous?.session?.host ?? false;
    const session = playerToken ? { code, playerId, playerToken, host } : previous?.session;
    return {
      code,
      roomCode: payload.roomCode ?? payload.room_code ?? code,
      hostId: payload.hostId ?? (payload.host_id as number | null | undefined) ?? previous?.hostId ?? null,
      players: payload.players ?? previous?.players ?? [],
      maxPlayers: payload.maxPlayers ?? (payload.seat_count as number | undefined) ?? previous?.maxPlayers ?? 4,
      aiCount: payload.aiCount ?? (payload.ai_count as number | undefined) ?? previous?.aiCount ?? 0,
      countdownSeconds: payload.countdownSeconds ?? (payload.turn_timeout_seconds as number | undefined) ?? previous?.countdownSeconds ?? 15,
      status: payload.status === "playing" || payload.started ? "playing" : "waiting",
      started: Boolean(payload.started ?? (payload.status === "playing" || previous?.started)),
      snapshot: payload.snapshot ?? previous?.snapshot ?? null,
      expiresInSeconds: payload.expiresInSeconds ?? (payload.expires_in_seconds as number | undefined) ?? previous?.expiresInSeconds ?? 0,
      turnDeadlineEpochMs: payload.turnDeadlineEpochMs ?? payload.turn_deadline_epoch_ms ?? previous?.turnDeadlineEpochMs,
      session,
    };
  }

  async function refresh(room: OnlineRoom): Promise<OnlineRoom> {
    const payload = await request<WireRoom>(`/api/v1/rooms/${encodeURIComponent(room.code)}`, { headers: sessionHeaders(room) });
    return mergeSession(payload, room);
  }

  return {
    async createRoom(body) {
      // The browser contract is camelCase; keep the Rust HTTP wire contract
      // explicit so configured seats, AI count, and deadline are not silently
      // replaced by server defaults.
      const payload = await request<WireRoom>("/api/v1/rooms", {
        method: "POST",
        body: JSON.stringify({
          name: body.name,
          max_players: body.maxPlayers,
          ai_count: body.aiCount,
          countdown_seconds: body.countdownSeconds,
          ai_profile: body.aiProfile,
        }),
      });
      return refresh(mergeSession(payload));
    },
    async joinRoom({ code, ...body }) {
      const payload = await request<WireRoom>(`/api/v1/rooms/${encodeURIComponent(code)}/players`, { method: "POST", body: JSON.stringify(body) });
      return refresh(mergeSession(payload, { ...mergeSession(payload), code, roomCode: code, snapshot: null }));
    },
    async leaveRoom(room) {
      await request(`/api/v1/rooms/${encodeURIComponent(room.code)}/players/${room.session?.playerId ?? 0}`, { method: "DELETE", headers: sessionHeaders(room) });
    },
    async startRoom(room) {
      await request(`/api/v1/rooms/${encodeURIComponent(room.code)}/start`, { method: "POST", headers: sessionHeaders(room), body: "{}" });
      return refresh(room);
    },
    getRoom: refresh,
    async action(room, action) {
      const payload = await request<WireRoom & { ok?: boolean; error?: string | null }>(`/api/v1/rooms/${encodeURIComponent(room.code)}/actions`, { method: "POST", headers: sessionHeaders(room), body: JSON.stringify({ action: action.action, card_id: action.cardId, chosen_color: action.chosenColor }) });
      if (payload.ok === false) throw new Error(payload.error || "That move is not available.");
      return mergeSession(payload.room ? payload.room : payload, room);
    },
  };
}
