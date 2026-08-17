import type { Snapshot } from "./types";
import { getNetworkDiagnostics, safeWebSocketOrigin, sanitizeRoute } from "./networkDiagnostics";

export type OnlinePlayer = {
  id: number;
  name: string;
  ready?: boolean;
  isHost?: boolean;
  host?: boolean;
  connected?: boolean;
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
  status: "waiting" | "playing" | "finished";
  started: boolean;
  snapshot: Snapshot | null;
  expiresInSeconds: number | null;
  turnDeadlineEpochMs?: number | null;
  session?: OnlineSession;
};

export type OnlineResumeRecord = {
  version: 1;
  roomCode: string;
  playerId: number;
  playerToken: string;
  host: boolean;
  savedAt: number;
};

const ONLINE_RESUME_KEY = "uno-2026:online-session:v1";

export function readOnlineResume(): OnlineResumeRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ONLINE_RESUME_KEY) ?? "null") as Partial<OnlineResumeRecord> | null;
    if (
      parsed?.version !== 1 ||
      typeof parsed.roomCode !== "string" || !/^[A-Z2-9]{4}$/.test(parsed.roomCode) ||
      typeof parsed.playerId !== "number" || !Number.isInteger(parsed.playerId) || parsed.playerId < 0 ||
      typeof parsed.playerToken !== "string" || parsed.playerToken.length < 8 ||
      typeof parsed.host !== "boolean" || typeof parsed.savedAt !== "number"
    ) return null;
    return parsed as OnlineResumeRecord;
  } catch {
    return null;
  }
}

export function persistOnlineResume(room: OnlineRoom): void {
  if (typeof window === "undefined" || !room.session) return;
  const record: OnlineResumeRecord = {
    version: 1,
    roomCode: room.code,
    playerId: room.session.playerId,
    playerToken: room.session.playerToken,
    host: room.session.host,
    savedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(ONLINE_RESUME_KEY, JSON.stringify(record));
  } catch {
    // Private browsing or a full storage quota should not block a live game.
  }
}

export function clearOnlineResume(): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(ONLINE_RESUME_KEY); } catch { /* ignore storage failures */ }
}

export function roomFromOnlineResume(record: OnlineResumeRecord): OnlineRoom {
  return {
    code: record.roomCode,
    roomCode: record.roomCode,
    hostId: record.host ? record.playerId : null,
    players: [],
    maxPlayers: 4,
    aiCount: 0,
    countdownSeconds: 15,
    status: "playing",
    started: true,
    snapshot: null,
    expiresInSeconds: null,
    session: {
      code: record.roomCode,
      playerId: record.playerId,
      playerToken: record.playerToken,
      host: record.host,
    },
  };
}

export type CreateRoomRequest = {
  name: string;
  maxPlayers: number;
  aiCount: number;
  countdownSeconds: number;
  aiProfile?: string;
};

export type JoinRoomRequest = { name: string; code: string };
export type OnlineAction = { action: "play" | "draw" | "call_uno" | "challenge_uno"; cardId?: number; chosenColor?: string };

export interface OnlineApi {
  createRoom(request: CreateRoomRequest): Promise<OnlineRoom>;
  joinRoom(request: JoinRoomRequest): Promise<OnlineRoom>;
  leaveRoom(room: OnlineRoom): Promise<void>;
  startRoom(room: OnlineRoom): Promise<OnlineRoom>;
  getRoom(room: OnlineRoom): Promise<OnlineRoom>;
  action(room: OnlineRoom, action: OnlineAction): Promise<OnlineRoom>;
}

export type WireRoom = Partial<OnlineRoom> & {
  room_code?: string;
  player_id?: number;
  player_token?: string;
  host?: boolean;
  expires_in_seconds?: number | null;
  turn_timeout_seconds?: number;
  turn_deadline_epoch_ms?: number | null;
  room?: WireRoom;
  host_id?: number | null;
  seat_count?: number;
  ai_count?: number;
};

export type OnlineSyncStatus = "connecting" | "connected" | "fallback" | "closed";

export type OnlineSync = {
  close: () => void;
};

export function mergeOnlineRoom(payload: WireRoom, previous?: OnlineRoom): OnlineRoom {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(payload, key);
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
    status: payload.status ?? (payload.started === true ? "playing" : previous?.status ?? "waiting"),
    started: Boolean(payload.started ?? (payload.status === "playing" ? true : previous?.started)),
    snapshot: has("snapshot") ? (payload.snapshot ?? null) : (previous?.snapshot ?? null),
    expiresInSeconds: has("expiresInSeconds")
      ? payload.expiresInSeconds ?? null
      : Object.prototype.hasOwnProperty.call(payload, "expires_in_seconds")
        ? payload.expires_in_seconds ?? null
        : previous?.expiresInSeconds ?? null,
    turnDeadlineEpochMs: has("turnDeadlineEpochMs")
      ? payload.turnDeadlineEpochMs
      : has("turn_deadline_epoch_ms")
        ? payload.turn_deadline_epoch_ms
        : previous?.turnDeadlineEpochMs,
    session,
  };
}

export function connectOnlineRoom(
  room: OnlineRoom,
  onRoom: (room: OnlineRoom) => void,
  onStatus?: (status: OnlineSyncStatus) => void,
): OnlineSync {
  const diagnostics = getNetworkDiagnostics();
  const configuredBase = import.meta.env.VITE_ONLINE_API_URL ?? "";
  const websocketBase = configuredBase
    ? configuredBase.replace(/^http:/, "ws:").replace(/^https:/, "wss:")
    : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
  const token = room.session?.playerToken ?? "";
  const url = `${websocketBase}/api/v1/rooms/${encodeURIComponent(room.code)}/ws?token=${encodeURIComponent(token)}`;
  let socket: WebSocket | null = null;
  let currentRoom = room;
  let stopped = false;
  let reconnectTimer: number | null = null;
  let reconnectAttempt = 0;
  let generation = 0;

  const reportStatus = (status: OnlineSyncStatus) => {
    diagnostics.record("sync.status", { status });
    onStatus?.(status);
  };

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer !== null) return;
    const delay = Math.min(500 * 2 ** reconnectAttempt, 5_000);
    diagnostics.record("ws.reconnect.scheduled", { attempt: reconnectAttempt + 1, delayMs: delay });
    reportStatus("fallback");
    reconnectAttempt += 1;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      openSocket();
    }, delay);
  };

  const openSocket = () => {
    if (stopped) return;
    const socketGeneration = ++generation;
    const attempt = reconnectAttempt + 1;
    const openedAt = performance.now();
    diagnostics.record("ws.connecting", { attempt, origin: safeWebSocketOrigin(url) });
    reportStatus("connecting");
    try {
      socket = new WebSocket(url);
    } catch {
      diagnostics.record("ws.constructor-error", { attempt });
      scheduleReconnect();
      return;
    }
    const currentSocket = socket;
    currentSocket.addEventListener("open", () => {
      if (stopped || socketGeneration !== generation) return;
      reconnectAttempt = 0;
      diagnostics.record("ws.open", { attempt, handshakeMs: Math.round(performance.now() - openedAt), readyState: currentSocket.readyState });
      reportStatus("connected");
    });
    currentSocket.addEventListener("message", (event) => {
      if (stopped || socketGeneration !== generation) return;
      const raw = String(event.data);
      const bytes = typeof TextEncoder === "undefined" ? raw.length : new TextEncoder().encode(raw).byteLength;
      try {
        const payload = JSON.parse(raw) as { type?: string; room?: WireRoom };
        diagnostics.record("ws.message", { type: payload.type ?? "unknown", bytes, snapshot: Boolean(payload.room?.snapshot) });
        if (payload.type === "room.snapshot" && payload.room) {
          currentRoom = mergeOnlineRoom(payload.room, currentRoom);
          onRoom(currentRoom);
          if (currentRoom.status === "finished" || currentRoom.snapshot?.status === "Won") {
            stopped = true;
            if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
            reconnectTimer = null;
            diagnostics.record("ws.closed", { manual: false, reason: "room-finished" });
            currentSocket.close();
          }
        }
      } catch {
        diagnostics.record("ws.message.parse-error", { bytes });
        // Ignore malformed messages and keep REST recovery available.
      }
    });
    currentSocket.addEventListener("error", () => {
      diagnostics.record("ws.error", { readyState: currentSocket.readyState });
      if (!stopped && socketGeneration === generation) scheduleReconnect();
    });
    currentSocket.addEventListener("close", (event) => {
      if (stopped || socketGeneration !== generation) return;
      socket = null;
      diagnostics.record("ws.close", { code: event.code, clean: event.wasClean, hadReason: Boolean(event.reason) });
      scheduleReconnect();
    });
  };

  openSocket();
  return {
    close: () => {
      stopped = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
      generation += 1;
      diagnostics.record("ws.closed", { manual: true });
      reportStatus("closed");
      socket?.close();
      socket = null;
    },
  };
}

/** REST adapter for the Rust room service. Set VITE_ONLINE_API_URL when the
 * service is hosted separately; an empty value supports a same-origin proxy. */
export function createOnlineApi(baseUrl = import.meta.env.VITE_ONLINE_API_URL ?? ""): OnlineApi {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const diagnostics = getNetworkDiagnostics();
    const method = (init.method ?? "GET").toUpperCase();
    const route = sanitizeRoute(path);
    const startedAt = performance.now();
    diagnostics.record("rest.request", { method, route });
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      });
      const payload = await response.json().catch(() => ({}));
      diagnostics.record("rest.response", {
        method,
        route,
        status: response.status,
        ok: response.ok,
        durationMs: Math.round(performance.now() - startedAt),
        contentLength: response.headers.get("content-length") ?? null,
        edge: response.headers.get("x-vercel-id") ?? response.headers.get("server") ?? null,
      });
      if (!response.ok) throw new Error(payload.message || payload.error || `Request failed (${response.status})`);
      return payload as T;
    } catch (error) {
      diagnostics.record("rest.error", { method, route, durationMs: Math.round(performance.now() - startedAt), name: error instanceof Error ? error.name : "unknown" });
      throw error;
    }
  }

  function sessionHeaders(room: OnlineRoom): HeadersInit {
    return { "X-Player-Token": room.session?.playerToken ?? "" };
  }

  async function refresh(room: OnlineRoom): Promise<OnlineRoom> {
    const payload = await request<WireRoom>(`/api/v1/rooms/${encodeURIComponent(room.code)}`, { headers: sessionHeaders(room) });
    return mergeOnlineRoom(payload, room);
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
      return refresh(mergeOnlineRoom(payload));
    },
    async joinRoom({ code, ...body }) {
      const payload = await request<WireRoom>(`/api/v1/rooms/${encodeURIComponent(code)}/players`, { method: "POST", body: JSON.stringify(body) });
      return refresh(mergeOnlineRoom(payload, { ...mergeOnlineRoom(payload), code, roomCode: code, snapshot: null }));
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
      return mergeOnlineRoom(payload.room ? payload.room : payload, room);
    },
  };
}
