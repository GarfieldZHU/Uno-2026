import { useEffect, useMemo, useRef, useState } from "react";
import type { Language } from "./i18n";
import { connectOnlineRoom, createOnlineApi, type OnlineApi, type OnlineRoom, type OnlineSyncStatus } from "./online";

type Props = {
  language?: Language;
  api?: OnlineApi;
  onStarted?: (room: OnlineRoom) => void;
  onClose?: () => void;
};

const copy = {
  zh: {
    title: "联机房间",
    create: "创建房间",
    join: "加入房间",
    name: "你的昵称",
    code: "房间码",
    seats: "总席位",
    ai: "AI 数量",
    countdown: "人类回合倒计时",
    seconds: "秒",
    leave: "退出房间",
    start: "房主开始",
    waiting: "等待人类玩家加入",
    host: "房主",
    empty: "还没有玩家",
    minPlayers: "至少需要 3 个席位（可由 AI 补齐）",
    expires: (seconds: number) => `房间将在 ${Math.max(0, seconds)} 秒后失效`,
    onlineHint: "等待阶段房主离开会关闭房间；开局后任何席位离开都会由 AI 接管。",
    back: "返回",
  },
  en: {
    title: "Online room",
    create: "Create room",
    join: "Join room",
    name: "Your name",
    code: "Room code",
    seats: "Total seats",
    ai: "AI players",
    countdown: "Human turn countdown",
    seconds: "sec",
    leave: "Leave room",
    start: "Start game",
    waiting: "Waiting for human players",
    host: "Host",
    empty: "No players yet",
    minPlayers: "At least 3 seats are required (AI can fill them).",
    expires: (seconds: number) => `Room expires in ${Math.max(0, seconds)}s`,
    onlineHint: "A waiting-room host closes the room; after start, any leaving seat is taken over by AI.",
    back: "Back",
  },
} as const;

export function OnlineLobby({ language = "zh", api = createOnlineApi(), onStarted, onClose }: Props) {
  const t = copy[language];
  const [room, setRoom] = useState<OnlineRoom | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [aiCount, setAiCount] = useState(0);
  const [countdownSeconds, setCountdownSeconds] = useState(15);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<OnlineSyncStatus>("connecting");
  const roomRef = useRef<OnlineRoom | null>(null);
  const syncStatusRef = useRef<OnlineSyncStatus>("connecting");
  const onStartedRef = useRef(onStarted);
  roomRef.current = room;
  onStartedRef.current = onStarted;

  const humanCapacity = useMemo(() => Math.max(1, maxPlayers - aiCount), [maxPlayers, aiCount]);

  useEffect(() => {
    if (!room || room.status !== "waiting") return undefined;
    const handleStatus = (status: OnlineSyncStatus) => {
      syncStatusRef.current = status;
      setSyncStatus(status);
    };
    const liveSocket = connectOnlineRoom(room, (next) => {
      setRoom(next);
      if (next.status === "playing") onStartedRef.current?.(next);
    }, handleStatus);
    const timer = window.setInterval(() => {
      if (syncStatusRef.current !== "connected") {
        const current = roomRef.current;
        if (!current) return;
        void api.getRoom(current).then((next) => {
          setRoom(next);
          if (next.status === "playing") onStartedRef.current?.(next);
        }).catch(() => undefined);
      }
    }, 5_000);
    return () => {
      liveSocket.close();
      window.clearInterval(timer);
    };
  }, [api, room?.code, room?.session?.playerToken]);

  async function run(action: () => Promise<OnlineRoom | void>) {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (result) {
        setRoom(result);
        if (result.status === "playing") onStarted?.(result);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!room) return;
    await run(async () => {
      await api.leaveRoom(room);
      setRoom(null);
      return undefined;
    });
  }

  if (!room) {
    return (
      <section className="online-lobby-panel" aria-labelledby="online-lobby-title" data-testid="online-lobby">
        <div className="drawer-heading"><div><p className="eyebrow">1411 / NETWORK</p><h2 id="online-lobby-title">{t.title}</h2></div>{onClose && <button className="drawer-close" onClick={onClose} type="button" aria-label={t.back}>×</button>}</div>
        <div className="online-lobby-fields">
          <label>{t.name}<input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} autoComplete="nickname" /></label>
          <label>{t.code}<input value={code} onChange={(event) => setCode(event.target.value.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase())} maxLength={4} placeholder="ABCD" /></label>
          <label>{t.seats}<input type="number" min={3} max={8} value={maxPlayers} onChange={(event) => { const next = Math.min(8, Math.max(3, Number(event.target.value))); setMaxPlayers(next); setAiCount((current) => Math.min(current, next - 1)); }} /></label>
          <label>{t.ai}<input type="number" min={0} max={Math.max(0, maxPlayers - 1)} value={aiCount} onChange={(event) => setAiCount(Math.min(maxPlayers - 1, Math.max(0, Number(event.target.value))))} /></label>
          <label className="online-range-field">{t.countdown}<output>{countdownSeconds} {t.seconds}</output><input type="range" min={5} max={30} value={countdownSeconds} onChange={(event) => setCountdownSeconds(Number(event.target.value))} /><span className="range-scale"><span>5s</span><span>30s</span></span></label>
        </div>
        <p className="online-lobby-note">{t.minPlayers}<br />{t.onlineHint}</p>
        <div className="drawer-actions"><button className="primary-button" disabled={busy || !name.trim()} onClick={() => void run(() => api.createRoom({ name: name.trim(), maxPlayers, aiCount, countdownSeconds }))} type="button">{t.create}</button><button className="secondary-button" disabled={busy || !name.trim() || code.length !== 4} onClick={() => void run(() => api.joinRoom({ name: name.trim(), code }))} type="button">{t.join}</button></div>
        {error && <p role="alert" className="menu-error">{error}</p>}
      </section>
    );
  }

  const isHost = room.session?.host ?? room.players.find((player) => player.id === room.session?.playerId)?.isHost ?? false;
  return (
    <section className="online-lobby-panel" aria-labelledby="online-room-title" data-testid="online-room" data-sync-state={syncStatus} data-sync-transport={syncStatus === "connected" ? "websocket" : "rest-fallback"}>
      <div className="drawer-heading"><div><p className="eyebrow">{room.status === "playing" ? "MATCH LIVE" : "WAITING ROOM"}</p><h2 id="online-room-title">{t.title} <code>{room.code}</code></h2></div>{room.status === "waiting" && onClose && <button className="drawer-close" onClick={onClose} type="button" aria-label={t.back}>×</button>}</div>
      <p className="online-room-meta">{room.players.length + room.aiCount}/{room.maxPlayers} · {room.countdownSeconds} {t.seconds} · {t.expires(room.expiresInSeconds)}</p>
      <ul className="online-player-list">{room.players.map((player) => <li key={player.id}><span className={`seat-avatar seat-avatar-${player.id % 4}`}>{player.name.slice(0, 1).toUpperCase()}</span><span>{player.name}</span>{(player.isHost || player.host) && <small>{t.host}</small>}</li>)}{Array.from({ length: room.aiCount }, (_, index) => <li key={`ai-${index}`}><span className="seat-avatar seat-avatar-2">A</span><span>AI {index + 1}</span><small>AI</small></li>)}</ul>
      {room.status === "waiting" && <p className="online-lobby-note">{t.waiting}<br />{t.onlineHint}</p>}
      <div className="drawer-actions"><button className="secondary-button" disabled={busy} onClick={() => void leave()} type="button">{t.leave}</button>{isHost && room.status === "waiting" && <button className="primary-button" disabled={busy || room.players.length + room.aiCount < 3} onClick={() => void run(() => api.startRoom(room))} type="button">{t.start}</button>}</div>
      {error && <p role="alert" className="menu-error">{error}</p>}
    </section>
  );
}
