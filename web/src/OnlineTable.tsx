import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { CardArt } from "./CardArt";
import { DiscardHistory } from "./DiscardHistory";
import { PlayFlight } from "./PlayFlight";
import { ActionEffectOverlay, PenaltyDrawFlight } from "./PenaltyDrawFlight";
import { copy, localizeEngineMessage, translateColor, type Language } from "./i18n";
import { connectOnlineRoom, type OnlineApi, type OnlineRoom, type OnlineSyncStatus } from "./online";
import { drawInfoForAction, effectForAction, type TableEffect } from "./tableEffects";
import { COLORS, type Card, type Color, type PlayFlightEvent, type PlayFlightSource, type Snapshot } from "./types";
import { nextPlayerId, orderedOpponents, seatSlotForPlayer, sourceForPlayer } from "./tableSeats";

type Props = { language: Language; room: OnlineRoom; api: OnlineApi; onLeave: () => void; onLanguageChange: (language: Language) => void };

const HUMAN_ID_FALLBACK = 0;
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
  const [handOrder, setHandOrder] = useState<number[]>([]);
  const [draggingCardId, setDraggingCardId] = useState<number | null>(null);
  const [liftedCardId, setLiftedCardId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [animation, setAnimation] = useState<"play" | "draw" | null>(null);
  const [flight, setFlight] = useState<PlayFlightEvent | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(room.countdownSeconds);
  const [topbarOpen, setTopbarOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<OnlineSyncStatus>("connecting");
  const syncStatusRef = useRef<OnlineSyncStatus>("connecting");
  const [tableEffect, setTableEffect] = useState<TableEffect>(null);
  const [penaltyDraw, setPenaltyDraw] = useState<{ playerId: number; count: number; source: PlayFlightSource } | null>(null);
  const roomRef = useRef(room);
  const tableDropRef = useRef<HTMLDivElement | null>(null);
  const pointerDragRef = useRef<{ cardId: number; startX: number; startY: number; active: boolean } | null>(null);
  const liftedCardRef = useRef<number | null>(null);
  const clickSequenceRef = useRef<{ cardId: number; timer: number } | null>(null);
  const suppressClickRef = useRef(false);
  const suppressDoubleClickRef = useRef(false);
  const previousAction = useRef(room.snapshot?.last_action ?? "");
  const humanId = room.session?.playerId ?? HUMAN_ID_FALLBACK;
  const snapshot = room.snapshot;
  const human = snapshot?.players[humanId];
  const currentPlayer = snapshot?.players[snapshot.current_player];
  const nextId = snapshot ? (snapshot.next_player ?? nextPlayerId(snapshot.players, snapshot.current_player, snapshot.direction)) : null;
  const nextPlayer = snapshot?.players.find((player) => player.id === nextId);
  roomRef.current = room;
  const orderedHand = useMemo(() => {
    if (!human) return [];
    const byId = new Map(human.hand.map((card) => [card.id, card]));
    const ordered = handOrder.map((id) => byId.get(id)).filter((card): card is Card => Boolean(card));
    return [...ordered, ...human.hand.filter((card) => !handOrder.includes(card.id))];
  }, [handOrder, human]);

  const showTableEffects = (nextSnapshot: Snapshot) => {
    const effect = effectForAction(nextSnapshot.last_action);
    setTableEffect(effect);
    if (effect) window.setTimeout(() => setTableEffect(null), effect === "draw-four" ? 1_450 : 900);
    const draw = drawInfoForAction(nextSnapshot.last_action);
    setPenaltyDraw(draw ? { playerId: draw.playerId, count: draw.count, source: sourceForPlayer(draw.playerId, humanId, nextSnapshot.players.length) } : null);
    if (draw) window.setTimeout(() => setPenaltyDraw(null), 1_100);
  };

  const applyRoom = (next: OnlineRoom) => {
    const nextSnapshot = next.snapshot;
    if (nextSnapshot && nextSnapshot.last_action !== previousAction.current) {
      const playerId = parsePlayedPlayer(nextSnapshot.last_action);
      setAnimation(nextSnapshot.last_action.includes("drew") ? "draw" : playerId === null ? null : "play");
      if (playerId !== null) {
        const card = nextSnapshot.top_card;
        setFlight({ id: `${nextSnapshot.last_action}-${Date.now()}`, card, playerId, source: sourceForPlayer(playerId, humanId, nextSnapshot.players.length) });
        window.setTimeout(() => setFlight(null), 1_050);
      }
      previousAction.current = nextSnapshot.last_action;
      showTableEffects(nextSnapshot);
      window.setTimeout(() => setAnimation(null), 760);
    }
    setRoom(next);
  };

  const refresh = async () => {
    try {
      applyRoom(await api.getRoom(roomRef.current));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Network error");
    }
  };

  useEffect(() => {
    const handleSyncStatus = (status: OnlineSyncStatus) => {
      syncStatusRef.current = status;
      setSyncStatus(status);
    };
    const socket = connectOnlineRoom(roomRef.current, applyRoom, handleSyncStatus);
    const timer = window.setInterval(() => {
      // REST remains a bounded fallback for hosts that block WebSocket upgrade;
      // normal updates are pushed immediately by the room service.
      if (syncStatusRef.current !== "connected") void refresh();
    }, 2_500);
    return () => {
      socket.close();
      window.clearInterval(timer);
    };
  // The room code/token are stable for this table. Keeping the socket effect
  // independent from each pushed snapshot prevents reconnect churn.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, room.code]);

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
      applyRoom(next);
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
    liftedCardRef.current = null;
    setLiftedCardId(null);
    if (card.color === "Wild") {
      setWildCardId(card.id);
    } else {
      void dispatch("play", card);
    }
  }

  function handleCardClick(card: Card) {
    if (!playableIds.has(card.id)) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const pending = clickSequenceRef.current;
    if (pending && pending.cardId === card.id) {
      window.clearTimeout(pending.timer);
      clickSequenceRef.current = null;
      suppressDoubleClickRef.current = true;
      play(card);
      return;
    }
    if (pending) window.clearTimeout(pending.timer);
    const timer = window.setTimeout(() => {
      clickSequenceRef.current = null;
      if (liftedCardRef.current === card.id) {
        play(card);
      } else {
        liftedCardRef.current = card.id;
        setLiftedCardId(card.id);
      }
    }, 220);
    clickSequenceRef.current = { cardId: card.id, timer };
  }

  function handleCardDoubleClick(card: Card) {
    if (!playableIds.has(card.id)) return;
    if (suppressDoubleClickRef.current) {
      suppressDoubleClickRef.current = false;
      return;
    }
    const pending = clickSequenceRef.current;
    if (pending) window.clearTimeout(pending.timer);
    clickSequenceRef.current = null;
    play(card);
  }

  function reorderHand(cardId: number, targetId: number) {
    if (cardId === targetId) return;
    const ids = orderedHand.map((card) => card.id);
    const from = ids.indexOf(cardId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, cardId);
    setHandOrder(ids);
  }

  function handleHandDragStart(event: DragEvent<HTMLElement>, card: Card) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(card.id));
    setDraggingCardId(card.id);
  }

  function handleTableDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const cardId = Number(event.dataTransfer.getData("text/plain"));
    setDraggingCardId(null);
    const card = human?.hand.find((candidate) => candidate.id === cardId);
    if (card && playableIds.has(card.id)) play(card);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>, card: Card) {
    if (event.button !== 0 || snapshot?.current_player !== humanId || snapshot.status === "Won") return;
    pointerDragRef.current = { cardId: card.id, startX: event.clientX, startY: event.clientY, active: false };
  }

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const drag = pointerDragRef.current;
      if (!drag) return;
      if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 8) drag.active = true;
      if (drag.active) {
        event.preventDefault();
        setDraggingCardId(drag.cardId);
      }
    }
    function onPointerUp(event: PointerEvent) {
      const drag = pointerDragRef.current;
      if (!drag) return;
      pointerDragRef.current = null;
      if (!drag.active) return;
      suppressClickRef.current = true;
      const bounds = tableDropRef.current?.getBoundingClientRect();
      const overTable = bounds && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
      setDraggingCardId(null);
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-card-id]");
      if (target) {
        const targetId = Number(target.dataset.cardId);
        if (Number.isFinite(targetId)) reorderHand(drag.cardId, targetId);
      }
      if (overTable) {
        const card = human?.hand.find((candidate) => candidate.id === drag.cardId);
        if (card && playableIds.has(card.id)) play(card);
      }
      window.setTimeout(() => { suppressClickRef.current = false; }, 240);
    }
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [human, playableIds, snapshot]);

  if (!snapshot || !human) {
    return <div className="loading-screen"><div className="loading-mark">UNO<small>2026</small></div><p>{language === "zh" ? "正在同步线上牌桌…" : "Syncing the online table…"}</p></div>;
  }
  const discardCards = snapshot.discard_cards?.length ? snapshot.discard_cards : [snapshot.top_card];
  return <div className={`app-shell online-table-shell ${topbarOpen ? "topbar-is-open" : "topbar-is-hidden"}`} data-sync-transport={syncStatus === "connected" ? "websocket" : "rest-fallback"} data-sync-state={syncStatus}>
    <button className="topbar-toggle" type="button" onClick={() => setTopbarOpen((open) => !open)} aria-expanded={topbarOpen} aria-label={topbarOpen ? (language === "zh" ? "隐藏顶部信息栏" : "Hide top information bar") : (language === "zh" ? "显示顶部信息栏" : "Show top information bar")}>{topbarOpen ? "−" : "☰"}</button>
    <header className="topbar">
      <div className="brand-lockup"><div className="brand-mark">UNO<small>2026</small></div><div className="brand-divider" /><div className="brand-context"><span>{language === "zh" ? "联机牌桌" : "ONLINE TABLE"}</span><small>{room.code} · Rust room service</small></div></div>
      <div className="table-mode"><span className="mode-live-dot" />{language === "zh" ? "联机" : "ONLINE"}<span className="mode-lock">· {room.players.length + room.aiCount}/{room.maxPlayers}</span></div>
      <div className="top-actions"><div className="table-profile"><span>{language === "zh" ? "人类回合倒计时" : "HUMAN TURN TIMER"}</span><strong>{secondsLeft}s</strong><small>{room.expiresInSeconds}s room TTL</small></div><button className="language-toggle" type="button" onClick={() => onLanguageChange(language === "zh" ? "en" : "zh")}>{language === "zh" ? "EN" : "中文"}</button><button className="icon-button" onClick={onLeave} type="button" aria-label={language === "zh" ? "退出联机房间" : "Leave online room"}>×</button></div>
    </header>
    <main className="game-layout">
      <section className="table-column"><div className="table-heading"><div><p className="eyebrow">{language === "zh" ? "房间" : "ROOM"} / {room.code} · {text.seats(snapshot.players.length)}</p><h1>{snapshot.status === "Won" ? text.tableComplete : currentPlayer?.id === humanId ? text.makeYourMove : text.thinking(currentPlayer?.name ?? "AI")}</h1></div><div className="round-meta"><span>{text.turn} {String(snapshot.turn_number).padStart(2, "0")}</span><span className="direction-mark" data-testid="direction-indicator" data-direction={snapshot.direction === 1 ? "clockwise" : "counter-clockwise"} aria-label={snapshot.direction === 1 ? (language === "zh" ? "顺时针出牌" : "Clockwise play") : (language === "zh" ? "逆时针出牌" : "Counter-clockwise play")}><b>{snapshot.direction === 1 ? "↻" : "↺"}</b><small>{snapshot.direction === 1 ? (language === "zh" ? "顺时针" : "CW") : (language === "zh" ? "逆时针" : "CCW")}</small></span></div></div>
        <div ref={tableDropRef} className={`felt-table table-scene ${animation ? `is-online-${animation}` : ""} ${draggingCardId !== null ? "is-card-drop-target" : ""}`} data-animation={animation ?? undefined} data-drop-target="table" onDragOver={(event) => event.preventDefault()} onDrop={handleTableDrop}>
          <div className="table-grid-lines" />
          <div className="table-scene-badge">
            <span className="live-pip" />
            {snapshot.current_player === humanId ? text.yourMove : text.thinking(currentPlayer?.name ?? "AI")}
          </div>
          <div className="turn-countdown-chip" data-testid="turn-countdown" data-expired={secondsLeft === 0 ? "true" : undefined}>
            <span aria-hidden="true">◷</span>
            <strong>{secondsLeft}s</strong>
            <small>{language === "zh" ? "回合倒计时" : "turn timer"}</small>
          </div>
          {nextPlayer && nextPlayer.id !== humanId && <div className="next-player-chip" data-testid="next-player-indicator"><span>↗</span>{language === "zh" ? `你的下家：${nextPlayer.name}` : `Next: ${nextPlayer.name}`}</div>}
          <div className="table-seats">
            {orderedOpponents(snapshot.players, humanId).map((player) => {
              const visible = Math.min(8, Math.max(0, player.hand_count));
              const center = visible > 0 ? (visible - 1) / 2 : 0;
              const active = player.id === snapshot.current_player;
              const isNext = player.id === nextId;
              return <div key={player.id} data-player-id={player.id} className={`seat-player player-row seat-${seatSlotForPlayer(player.id, humanId, snapshot.players.length)} ${active ? "is-active" : ""} ${isNext ? "is-next" : ""}`}>
                <span className="seat-avatar-wrap"><span className={`seat-avatar seat-avatar-${player.id % 4}`} />{active && <span className="seat-turn-pip" aria-label={language === "zh" ? "当前回合" : "current turn"} />}</span>
                <div className="seat-player-info"><strong>{player.name}</strong><span>{active ? (language === "zh" ? "当前回合" : "CURRENT TURN") : player.kind.startsWith("human") ? `${player.hand_count} ${language === "zh" ? "张牌" : "cards"}` : `AI · ${player.hand_count} ${language === "zh" ? "张牌" : "cards"}`}</span></div>
                {active && <span className="seat-turn-label">{language === "zh" ? "出牌中" : "TURN"}</span>}
                <span className="seat-card-fan" aria-hidden="true" style={{ "--fan-total": visible, "--fan-center": center } as CSSProperties}>{Array.from({ length: visible }, (_, cardIndex) => <img key={cardIndex} src="/assets/cards/reference/card-back.svg" alt="" style={{ "--fan-index": cardIndex } as CSSProperties} />)}<b>{player.hand_count}</b></span>
                {isNext && <span className="seat-next-marker" aria-label={language === "zh" ? "你的下家" : "your next player"}>↗</span>}
              </div>;
            })}
            <div className={`seat-player player-row seat-south seat-human ${human.id === snapshot.current_player ? "is-active" : ""} ${human.id === nextId ? "is-next" : ""}`} data-player-id={human.id}>
              <span className="seat-avatar-wrap"><span className="seat-avatar seat-avatar-human" />{human.id === snapshot.current_player && <span className="seat-turn-pip" aria-label={language === "zh" ? "当前回合" : "current turn"} />}</span>
              <div className="seat-player-info"><strong>{human.name}</strong><span>{human.id === snapshot.current_player ? (language === "zh" ? "当前回合" : "CURRENT TURN") : (language === "zh" ? "你 / 人类" : "YOU / HUMAN")}</span></div>
              {human.id === snapshot.current_player && <span className="seat-turn-label">{language === "zh" ? "出牌中" : "TURN"}</span>}
              {human.id === nextId && <span className="seat-next-marker" aria-label={language === "zh" ? "你的下家" : "your next player"}>↗</span>}
            </div>
          </div>
          <div className="table-center"><div className="table-direction-chip" data-testid="table-direction-indicator" data-direction={snapshot.direction === 1 ? "clockwise" : "counter-clockwise"} aria-label={snapshot.direction === 1 ? (language === "zh" ? "顺时针出牌" : "Clockwise play") : (language === "zh" ? "逆时针出牌" : "Counter-clockwise play")}><b>{snapshot.direction === 1 ? "↻" : "↺"}</b><span>{snapshot.direction === 1 ? (language === "zh" ? "顺时针" : "CLOCKWISE") : (language === "zh" ? "逆时针" : "COUNTER-CLOCKWISE")}</span></div><div className="piles"><OnlineBackStack count={snapshot.draw_count} language={language} disabled={snapshot.current_player !== humanId || snapshot.status === "Won"} onDraw={() => void dispatch("draw")} /><div className="pile-separator" /><button className="discard-stack" onClick={() => setHistoryOpen(true)} type="button" aria-label={text.viewDiscardHistory}><span className="discard-shadow" /><CardArt card={snapshot.top_card} language={language} compact /></button></div><div className="active-color"><span className={`color-swatch swatch-${snapshot.active_color.toLowerCase()}`} />{text.activeColor} <strong>{translateColor(language, snapshot.active_color)}</strong></div>{snapshot.pending_draw > 0 && <div key={`pending-${snapshot.pending_draw}`} className="pending-draw-badge" data-testid="pending-draw" data-count={snapshot.pending_draw} aria-live="assertive">+{snapshot.pending_draw} {language === "zh" ? "连击抽牌" : "PENALTY DRAW"}</div>}</div>
          <div className="table-scene-status" aria-live="polite"><span className={`status-pulse ${snapshot.status === "Won" ? "is-won" : ""}`} aria-label={localizeEngineMessage(language, snapshot.message)} /><span className="sr-only">{localizeEngineMessage(language, snapshot.message)}</span><span className="status-code sr-only">{snapshot.last_action}</span></div><div className="table-scene-footnote table-metrics" aria-label={`${text.drawPile} ${snapshot.draw_count}, ${text.discard} ${snapshot.discard_count}`}><span className="table-metric" title={text.drawPile}><span aria-hidden="true">▤</span><b>{snapshot.draw_count}</b></span><span className="table-metric" title={text.discard}><span aria-hidden="true">◈</span><b>{snapshot.discard_count}</b></span><span className="table-metric metric-ruleset" title={language === "zh" ? "房间有效期" : "Room TTL"}>{room.expiresInSeconds}s</span></div>{flight && <PlayFlight flight={flight} language={language} />}{tableEffect && <ActionEffectOverlay effect={tableEffect} language={language} />}{penaltyDraw && <PenaltyDrawFlight count={penaltyDraw.count} playerId={penaltyDraw.playerId} source={penaltyDraw.source} language={language} />}
        </div>
      </section>
      <section className="hand-column">
        <div className="hand-heading"><div><p className="eyebrow">{language === "zh" ? "你的手牌" : "YOUR HAND"} / {String(human.hand_count).padStart(2, "0")}</p><h2>{human.hand_count === 1 ? text.oneCardLeft : text.keepRhythm}</h2></div><div className="hand-actions"><button className="ghost-button" data-testid="sort-hand" onClick={() => setHandOrder([...human.hand].sort((a, b) => a.color.localeCompare(b.color) || a.kind.localeCompare(b.kind)).map((card) => card.id))} type="button">{language === "zh" ? "整理手牌" : "SORT"}</button><button className="ghost-button" onClick={() => void dispatch("call_uno")} disabled={human.hand_count !== 1 || snapshot.current_player !== humanId} type="button">{text.callUno} <span>!</span></button><button className="primary-button" onClick={() => void dispatch("draw")} disabled={snapshot.current_player !== humanId || snapshot.status === "Won"} type="button">{text.drawCard}</button></div></div>
        <div className="hand-rail hand-fan" data-testid="hand-rail">
          {orderedHand.map((card, index) => <div className={`hand-card-slot ${draggingCardId === card.id ? "is-dragging" : ""}`} key={card.id} data-card-id={card.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const source = Number(event.dataTransfer.getData("text/plain")); if (source) reorderHand(source, card.id); }}>
            <CardArt card={card} language={language} className={`hand-card ${playableIds.has(card.id) ? "is-playable" : "is-unplayable"} ${liftedCardId === card.id ? "is-lifted" : ""}`} style={{ "--hand-index": index, "--hand-total": human.hand.length } as CSSProperties} disabled={snapshot.current_player !== humanId || snapshot.status === "Won"} ariaDisabled={!playableIds.has(card.id)} draggable={snapshot.current_player === humanId && snapshot.status !== "Won"} onClick={() => handleCardClick(card)} onDoubleClick={() => handleCardDoubleClick(card)} onPointerDown={(event) => handlePointerDown(event, card)} onDragStart={(event) => handleHandDragStart(event, card)} onDragEnd={() => setDraggingCardId(null)} />
            {wildCardId === card.id && <div className="wild-picker" role="dialog" aria-modal="false"><span className="wild-picker-stem" /><p className="eyebrow">{text.wildCard}</p><strong>{text.chooseColor}</strong><div className="wild-picker-options">{COLORS.map((color) => <button key={color.name} className={`wild-picker-option color-option-${color.className}`} onClick={() => { setWildCardId(null); void dispatch("play", card, color.name); }} aria-label={translateColor(language, color.name)} type="button"><span className={`color-swatch swatch-${color.className}`} /></button>)}</div><button className="wild-picker-cancel" onClick={() => setWildCardId(null)} type="button">×</button></div>}
          </div>)}
        </div>
        <div className="hand-help compact-help" aria-label={language === "zh" ? "牌桌操作提示" : "Table controls"}><span className="help-action" title={text.clickHint}><kbd>↕</kbd><span className="sr-only">{text.clickHint}</span></span><span className="help-action" title={text.drawHint}><kbd>＋</kbd><span className="sr-only">{text.drawHint}</span></span><span className={`help-state ${notice ? "is-alert" : "is-ready"}`} title={notice ?? (language === "zh" ? `房间剩余 ${secondsLeft} 秒` : `${secondsLeft}s room TTL`)}><span className="status-pulse" /><span className="sr-only">{notice ?? `${secondsLeft}s`}</span></span></div>
      </section>
    </main><DiscardHistory cards={discardCards} language={language} open={historyOpen} onClose={() => setHistoryOpen(false)} />
  </div>;
}
