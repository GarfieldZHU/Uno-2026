import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CardArt } from "./CardArt";
import { DiscardHistory } from "./DiscardHistory";
import { PlayFlight } from "./PlayFlight";
import { copy, localizeEngineMessage, translateColor, type Language } from "./i18n";
import { type OnlineApi, type OnlineRoom } from "./online";
import { COLORS, type Card, type Color, type PlayFlightEvent, type PlayFlightSource, type Snapshot } from "./types";

type Props = { language: Language; room: OnlineRoom; api: OnlineApi; onLeave: () => void; onLanguageChange: (language: Language) => void };

const HUMAN_ID_FALLBACK = 0;
const SEAT_LAYOUTS: Record<number, string[]> = {
  3: ["north", "west"], 4: ["north-west", "north-east", "west"], 5: ["north-west", "north", "north-east", "west"],
  6: ["north-west", "north", "north-east", "east", "west"], 7: ["north-west", "north", "north-east", "east", "south-east", "west"],
  8: ["north-west", "north", "north-east", "east", "south-east", "south-west", "west"],
};

function sourceForPlayer(playerId: number, playerCount: number): PlayFlightSource {
  if (playerId === 0) return "human";
  return SEAT_LAYOUTS[playerCount]?.[playerId - 1] as PlayFlightSource ?? "north";
}

function parsePlayedPlayer(lastAction: string) {
  const match = /^player-(\d+)-played-/.exec(lastAction);
  return match ? Number(match[1]) : null;
}

function OnlineBackStack({ count, disabled, onDraw, language }: { count: number; disabled: boolean; onDraw: () => void; language: Language }) {
  return <button className="draw-stack" onClick={onDraw} disabled={disabled} type="button" aria-label={language === "zh" ? "从摸牌堆摸牌" : "Draw from the deck"}><span className="stack-offset stack-offset-one" /><span className="stack-offset stack-offset-two" /><img className="card-back-image" src="/assets/cards/reference/card-back.svg" alt="" /><span className="pile-count">{count}</span></button>;
}

export function OnlineTable({ language, room: initialRoom, api, onLeave, onLanguageChange }: Props) {
  const text = copy(language);
  const [room, setRoom] = useState(initialRoom);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [wildCardId, setWildCardId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [animation, setAnimation] = useState<"play" | "draw" | null>(null);
  const [flight, setFlight] = useState<PlayFlightEvent | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(room.countdownSeconds);
  const [topbarOpen, setTopbarOpen] = useState(false);
  const roomRef = useRef(room);
  const previousAction = useRef(room.snapshot?.last_action ?? "");
  const humanId = room.session?.playerId ?? HUMAN_ID_FALLBACK;
  const snapshot = room.snapshot;
  const human = snapshot?.players[humanId];
  const currentPlayer = snapshot?.players[snapshot.current_player];
  roomRef.current = room;

  const refresh = async () => {
    try {
      const next = await api.getRoom(roomRef.current);
      const nextSnapshot = next.snapshot;
      if (nextSnapshot && nextSnapshot.last_action !== previousAction.current) {
        const playerId = parsePlayedPlayer(nextSnapshot.last_action);
        setAnimation(nextSnapshot.last_action.includes("drew") ? "draw" : playerId === null ? null : "play");
        if (playerId !== null) {
          const card = nextSnapshot.top_card;
          setFlight({ id: `${nextSnapshot.last_action}-${Date.now()}`, card, playerId, source: sourceForPlayer(playerId, nextSnapshot.players.length) });
          window.setTimeout(() => setFlight(null), 1_050);
        }
        previousAction.current = nextSnapshot.last_action;
        window.setTimeout(() => setAnimation(null), 760);
      }
      setRoom(next);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Network error");
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 1_000);
    return () => window.clearInterval(timer);
  }, [api]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const deadline = room.turnDeadlineEpochMs;
      setSecondsLeft(deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1_000)) : room.countdownSeconds);
    }, 250);
    return () => window.clearInterval(timer);
  }, [room.turnDeadlineEpochMs, room.countdownSeconds]);

  const playableIds = useMemo(() => {
    if (!snapshot || snapshot.current_player !== humanId || snapshot.pending_draw > 0 || snapshot.status === "Won") return new Set<number>();
    return new Set(human?.hand.filter((card) => {
      if (card.kind === "wild-draw-four") {
        return !human.hand.some((candidate) => candidate.color === snapshot.active_color && candidate.color !== "Wild");
      }
      return card.color === "Wild" || card.color === snapshot.active_color || card.kind === snapshot.top_card.kind;
    }).map((card) => card.id) ?? []);
  }, [human, humanId, snapshot]);

  async function dispatch(action: "play" | "draw" | "call_uno", card?: Card, chosenColor?: Color) {
    if (!room.session || !snapshot) return;
    setNotice(null);
    try {
      const next = await api.action(room, { action, cardId: card?.id, chosenColor: chosenColor?.toLowerCase() });
      setRoom(next);
      if (card && action === "play") {
        setFlight({ id: `human-${card.id}-${Date.now()}`, card, playerId: humanId, source: "human" });
        window.setTimeout(() => setFlight(null), 1_050);
        setAnimation("play");
        window.setTimeout(() => setAnimation(null), 760);
      } else if (action === "draw") {
        setAnimation("draw");
        window.setTimeout(() => setAnimation(null), 760);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Network error");
    }
  }

  function play(card: Card) {
    if (!playableIds.has(card.id)) return;
    if (card.color === "Wild") {
      setWildCardId(card.id);
    } else {
      void dispatch("play", card);
    }
  }

  if (!snapshot || !human) {
    return <div className="loading-screen"><div className="loading-mark">UNO<small>2026</small></div><p>{language === "zh" ? "正在同步线上牌桌…" : "Syncing the online table…"}</p></div>;
  }
  const discardCards = snapshot.discard_cards?.length ? snapshot.discard_cards : [snapshot.top_card];
  return <div className={`app-shell online-table-shell ${topbarOpen ? "topbar-is-open" : "topbar-is-hidden"}`}>
    <button className="topbar-toggle" type="button" onClick={() => setTopbarOpen((open) => !open)} aria-expanded={topbarOpen} aria-label={topbarOpen ? (language === "zh" ? "隐藏顶部信息栏" : "Hide top information bar") : (language === "zh" ? "显示顶部信息栏" : "Show top information bar")}>{topbarOpen ? "−" : "☰"}</button>
    <header className="topbar">
      <div className="brand-lockup"><div className="brand-mark">UNO<small>2026</small></div><div className="brand-divider" /><div className="brand-context"><span>{language === "zh" ? "联机牌桌" : "ONLINE TABLE"}</span><small>{room.code} · Rust room service</small></div></div>
      <div className="table-mode"><span className="mode-live-dot" />{language === "zh" ? "联机" : "ONLINE"}<span className="mode-lock">· {room.players.length + room.aiCount}/{room.maxPlayers}</span></div>
      <div className="top-actions"><div className="table-profile"><span>{language === "zh" ? "人类回合倒计时" : "HUMAN TURN TIMER"}</span><strong>{secondsLeft}s</strong><small>{room.expiresInSeconds}s room TTL</small></div><button className="language-toggle" type="button" onClick={() => onLanguageChange(language === "zh" ? "en" : "zh")}>{language === "zh" ? "EN" : "中文"}</button><button className="icon-button" onClick={onLeave} type="button" aria-label={language === "zh" ? "退出联机房间" : "Leave online room"}>×</button></div>
    </header>
    <main className="game-layout">
      <section className="table-column"><div className="table-heading"><div><p className="eyebrow">{language === "zh" ? "房间" : "ROOM"} / {room.code} · {text.seats(snapshot.players.length)}</p><h1>{snapshot.status === "Won" ? text.tableComplete : currentPlayer?.id === humanId ? text.makeYourMove : text.thinking(currentPlayer?.name ?? "AI")}</h1></div><div className="round-meta"><span>{text.turn} {String(snapshot.turn_number).padStart(2, "0")}</span><span className="direction-mark">{snapshot.direction === 1 ? "↻" : "↺"}</span></div></div>
        <div className={`felt-table table-scene ${animation ? `is-online-${animation}` : ""}`} data-animation={animation ?? undefined}>
          <div className="table-grid-lines" /><div className="table-scene-badge"><span className="live-pip" />{snapshot.current_player === humanId ? text.yourMove : text.thinking(currentPlayer?.name ?? "AI")}</div><div className="table-seats">{snapshot.players.filter((player) => player.id !== humanId).map((player, index) => <div key={player.id} className={`seat-player player-row seat-${SEAT_LAYOUTS[snapshot.players.length]?.[index] ?? `seat-${index}`} ${player.id === snapshot.current_player ? "is-active" : ""}`}><span className={`seat-avatar seat-avatar-${player.id % 4}`} /><div className="seat-player-info"><strong>{player.name}</strong><span>{player.kind.startsWith("human") ? `${player.hand_count} ${language === "zh" ? "张牌" : "cards"}` : `AI · ${player.hand_count} ${language === "zh" ? "张牌" : "cards"}`}</span></div><span className="seat-card-fan"><img src="/assets/cards/reference/card-back.svg" alt="" /><b>{player.hand_count}</b></span></div>)}<div className={`seat-player player-row seat-south seat-human ${human.id === snapshot.current_player ? "is-active" : ""}`}><span className="seat-avatar seat-avatar-human" /><div className="seat-player-info"><strong>{human.name}</strong><span>{language === "zh" ? "你 / 人类" : "YOU / HUMAN"}</span></div><span className="seat-turn-pip" /></div></div>
          <div className="table-center"><div className="piles"><OnlineBackStack count={snapshot.draw_count} language={language} disabled={snapshot.current_player !== humanId || snapshot.status === "Won"} onDraw={() => void dispatch("draw")} /><div className="pile-separator" /><button className="discard-stack" onClick={() => setHistoryOpen(true)} type="button" aria-label={text.viewDiscardHistory}><span className="discard-shadow" /><CardArt card={snapshot.top_card} language={language} compact /></button></div><div className="active-color"><span className={`color-swatch swatch-${snapshot.active_color.toLowerCase()}`} />{text.activeColor} <strong>{translateColor(language, snapshot.active_color)}</strong></div></div>
          <div className="table-scene-status"><span>{localizeEngineMessage(language, snapshot.message)}</span><span className="status-code">{snapshot.last_action}</span></div><div className="table-scene-footnote"><span>{text.drawPile} {snapshot.draw_count}</span><span>{text.discard} {snapshot.discard_count}</span><span>{room.expiresInSeconds}s TTL</span></div>{flight && <PlayFlight flight={flight} language={language} />}
        </div>
      </section>
      <section className="hand-column"><div className="hand-heading"><div><p className="eyebrow">{language === "zh" ? "你的手牌" : "YOUR HAND"} / {String(human.hand_count).padStart(2, "0")}</p><h2>{human.hand_count === 1 ? text.oneCardLeft : text.keepRhythm}</h2></div><div className="hand-actions"><button className="ghost-button" onClick={() => void dispatch("call_uno")} disabled={human.hand_count !== 1 || snapshot.current_player !== humanId} type="button">{text.callUno} <span>!</span></button><button className="primary-button" onClick={() => void dispatch("draw")} disabled={snapshot.current_player !== humanId || snapshot.status === "Won"} type="button">{text.drawCard}</button></div></div><div className="hand-rail hand-fan">{human.hand.map((card, index) => <div className="hand-card-slot" key={card.id}><CardArt card={card} language={language} className="hand-card" style={{ "--hand-index": index, "--hand-total": human.hand.length } as CSSProperties} disabled={!playableIds.has(card.id)} onClick={() => play(card)} />{wildCardId === card.id && <div className="wild-picker" role="dialog" aria-modal="false"><span className="wild-picker-stem" /><p className="eyebrow">{text.wildCard}</p><strong>{text.chooseColor}</strong><div className="wild-picker-options">{COLORS.map((color) => <button key={color.name} className={`wild-picker-option color-option-${color.className}`} onClick={() => { setWildCardId(null); void dispatch("play", card, color.name); }} aria-label={translateColor(language, color.name)} type="button"><span className={`color-swatch swatch-${color.className}`} /></button>)}</div><button className="wild-picker-cancel" onClick={() => setWildCardId(null)} type="button">×</button></div>}</div>)}</div><div className="hand-help"><span><kbd>{language === "zh" ? "点击" : "PLAY"}</kbd> {text.clickHint}</span><span><kbd>{language === "zh" ? "摸牌" : "DRAW"}</kbd> {text.drawHint}</span><span className="help-right">{notice ? <strong className="notice">{notice}</strong> : `${language === "zh" ? "房主离开会关闭房间" : "Host departure closes the room"} · ${secondsLeft}s`}</span></div></section>
    </main><DiscardHistory cards={discardCards} language={language} open={historyOpen} onClose={() => setHistoryOpen(false)} />
  </div>;
}
