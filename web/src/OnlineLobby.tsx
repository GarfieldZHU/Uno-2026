import { useEffect, useMemo, useRef, useState } from "react";
import type { Language } from "./i18n";
import { clearOnlineResume, connectOnlineRoom, createOnlineApi, persistOnlineResume, readOnlineResume, roomFromOnlineResume, type OnlineApi, type OnlineResumeRecord, type OnlineRoom, type OnlineSyncStatus } from "./online";

type Props = {
  language?: Language;
  api?: OnlineApi;
  onStarted?: (room: OnlineRoom) => void;
  onClose?: () => void;
};

type LobbyMode = "join" | "create";

const copy = {
  zh: {
    title: "联机房间",
    create: "创建房间",
    join: "加入房间",
    modeLabel: "选择联机方式",
    joinIntro: "输入房间码，快速回到牌桌。",
    createIntro: "创建房间并配置席位、AI 与人类回合时间。",
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
    resumeTitle: "发现未完成牌局",
    resumeBody: (code: string) => `房间 ${code} 仍可能在线。要重新连接吗？`,
    resume: "重新连接",
    cancelResume: "取消并清除",
    reconnecting: "正在恢复牌桌…",
    wsOnline: "WebSocket 在线",
  },
  en: {
    title: "Online room",
    create: "Create room",
    join: "Join room",
    modeLabel: "Choose an online mode",
    joinIntro: "Enter a room code and get back to the table.",
    createIntro: "Set up seats, AI players, and the human turn deadline.",
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
    resumeTitle: "Unfinished game found",
    resumeBody: (code: string) => `Room ${code} may still be online. Reconnect?`,
    resume: "Reconnect",
    cancelResume: "Cancel and forget",
    reconnecting: "Reconnecting…",
    wsOnline: "WebSocket online",
  },
} as const;

export function OnlineLobby({ language = "zh", api = createOnlineApi(), onStarted, onClose }: Props) {
  const t = copy[language];
  const [room, setRoom] = useState<OnlineRoom | null>(null);
  const [resume, setResume] = useState<OnlineResumeRecord | null>(() => readOnlineResume());
  const [mode, setMode] = useState<LobbyMode>("join");
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

  useEffect(() => {
    if (room?.session) persistOnlineResume(room);
  }, [room?.code, room?.session?.playerId, room?.session?.playerToken, room?.session?.host]);

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
        persistOnlineResume(result);
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
      clearOnlineResume();
      setResume(null);
      setRoom(null);
      return undefined;
    });
  }

  if (!room) {
    return (
      <section className={`online-lobby-panel online-lobby-setup-panel online-lobby-${mode}-mode`} aria-labelledby="online-lobby-title" data-testid="online-lobby" data-lobby-mode={mode}>
        <div className="drawer-heading"><div><p className="eyebrow">1411 / NETWORK</p><h2 id="online-lobby-title">{t.title}</h2></div>{onClose && <button className="drawer-close" onClick={onClose} type="button" aria-label={t.back}>×</button>}</div>
        <div className="online-lobby-mode-switch" role="tablist" aria-label={t.modeLabel}>
          <button className={mode === "join" ? "is-selected" : undefined} onClick={() => setMode("join")} type="button" role="tab" aria-selected={mode === "join"} data-testid="online-mode-join">{t.join}<span>{t.joinIntro}</span></button>
          <button className={mode === "create" ? "is-selected" : undefined} onClick={() => setMode("create")} type="button" role="tab" aria-selected={mode === "create"} data-testid="online-mode-create">{t.create}<span>{t.createIntro}</span></button>
        </div>
        {resume && <div className="online-resume-prompt" data-testid="online-resume-prompt" role="alert"><p className="eyebrow">{t.resumeTitle}</p><strong>{t.resumeBody(resume.roomCode)}</strong><div className="drawer-actions"><button className="primary-button" disabled={busy} onClick={() => void (async () => { setBusy(true); setError(null); try { const recovered = await api.getRoom(roomFromOnlineResume(resume)); if (recovered.status === "finished" || recovered.snapshot?.status === "Won") { clearOnlineResume(); setResume(null); setError(language === "zh" ? "该牌局已经结束或失效。" : "That game has ended or expired."); } else { persistOnlineResume(recovered); setRoom(recovered); if (recovered.status === "playing") onStartedRef.current?.(recovered); } } catch (cause) { setError(cause instanceof Error ? cause.message : "Network error"); } finally { setBusy(false); } })()} type="button">{busy ? t.reconnecting : t.resume}</button><button className="secondary-button" disabled={busy} onClick={() => { clearOnlineResume(); setResume(null); setError(null); }} type="button">{t.cancelResume}</button></div></div>}
        <div className="online-lobby-fields">
          <label>{t.name}<input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} autoComplete="nickname" /></label>
          {mode === "join" ? (
            <label>{t.code}<input value={code} onChange={(event) => setCode(event.target.value.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase())} maxLength={4} placeholder="ABCD" /></label>
          ) : (
            <>
              <label>{t.seats}<input type="number" min={3} max={8} value={maxPlayers} onChange={(event) => { const next = Math.min(8, Math.max(3, Number(event.target.value))); setMaxPlayers(next); setAiCount((current) => Math.min(current, next - 1)); }} /></label>
              <label>{t.ai}<input type="number" min={0} max={Math.max(0, maxPlayers - 1)} value={aiCount} onChange={(event) => setAiCount(Math.min(maxPlayers - 1, Math.max(0, Number(event.target.value))))} /></label>
              <label className="online-range-field">{t.countdown}<output>{countdownSeconds} {t.seconds}</output><input type="range" min={5} max={30} value={countdownSeconds} onChange={(event) => setCountdownSeconds(Number(event.target.value))} /><span className="range-scale"><span>5s</span><span>30s</span></span></label>
            </>
          )}
        </div>
        {mode === "create" && <p className="online-lobby-note">{t.minPlayers}<br />{t.onlineHint}</p>}
        <div className="drawer-actions"><button className="primary-button" disabled={busy || !name.trim() || (mode === "join" && code.length !== 4)} onClick={() => void run(() => mode === "create" ? api.createRoom({ name: name.trim(), maxPlayers, aiCount, countdownSeconds }) : api.joinRoom({ name: name.trim(), code }))} type="button">{mode === "create" ? t.create : t.join}</button></div>
        {error && <p role="alert" className="menu-error">{error}</p>}
      </section>
    );
  }

  const isHost = room.session?.host ?? room.players.find((player) => player.id === room.session?.playerId)?.isHost ?? false;
  return (
    <section className="online-lobby-panel" aria-labelledby="online-room-title" data-testid="online-room" data-sync-state={syncStatus} data-sync-transport={syncStatus === "connected" ? "websocket" : "rest-fallback"}>
      <div className="drawer-heading"><div><p className="eyebrow">{room.status === "playing" ? "MATCH LIVE" : room.status === "finished" ? "MATCH COMPLETE" : "WAITING ROOM"}</p><h2 id="online-room-title">{t.title} <code>{room.code}</code></h2></div>{room.status === "waiting" && onClose && <button className="drawer-close" onClick={onClose} type="button" aria-label={t.back}>×</button>}</div>
      <p className="online-room-meta">{room.players.length + room.aiCount}/{room.maxPlayers} · {room.countdownSeconds} {t.seconds}{room.expiresInSeconds === null ? ` · ${t.wsOnline}` : ` · ${t.expires(room.expiresInSeconds)}`}</p>
      <ul className="online-player-list">{room.players.map((player) => <li key={player.id}><span className={`seat-avatar seat-avatar-${player.id % 4}`}>{player.name.slice(0, 1).toUpperCase()}</span><span>{player.name}</span>{(player.isHost || player.host) && <small>{t.host}</small>}</li>)}{Array.from({ length: room.aiCount }, (_, index) => <li key={`ai-${index}`}><span className="seat-avatar seat-avatar-2">A</span><span>AI {index + 1}</span><small>AI</small></li>)}</ul>
      {room.status === "waiting" && <p className="online-lobby-note">{t.waiting}<br />{t.onlineHint}</p>}
      <div className="drawer-actions"><button className="secondary-button" disabled={busy} onClick={() => void leave()} type="button">{t.leave}</button>{isHost && room.status === "waiting" && <button className="primary-button" disabled={busy || room.players.length + room.aiCount < 3} onClick={() => void run(() => api.startRoom(room))} type="button">{t.start}</button>}</div>
      {error && <p role="alert" className="menu-error">{error}</p>}
    </section>
  );
}
