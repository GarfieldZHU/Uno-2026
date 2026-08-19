import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { AboutPanel } from "./AboutPanel";
import { CardArt } from "./CardArt";
import { DiscardHistory } from "./DiscardHistory";
import { MainMenuScreen } from "./MainMenuScreen";
import { OnlineLobby } from "./OnlineLobby";
import { OnlineTable } from "./OnlineTable";
import { createOnlineApi, readOnlineResume, type OnlineRoom } from "./online";
import { NetworkLogExportButton } from "./NetworkLogExportButton";
import { resetNetworkDiagnostics } from "./networkDiagnostics";
import { PlayFlight } from "./PlayFlight";
import { DrawCardFlight } from "./DrawCardFlight";
import { ActionEffectOverlay, PenaltyDrawFlight } from "./PenaltyDrawFlight";
import { SettingsDrawer } from "./SettingsDrawer";
import { createDefaultSetup, type SetupConfig } from "./SetupScreen";
import { DealSequenceOverlay, SettlementOverlay, TurnTransitionOverlay, type TablePhase } from "./TableOverlays";
import { GameRecordPanel } from "./GameRecordPanel";
import { appendSnapshotEvent, createGameRecord, type GameRecord } from "./gameRecord";
import { TableDirectionArrows } from "./TableDirectionArrows";
import { copy, localizeEngineMessage, profileLabel, translateColor, type Language } from "./i18n";
import { createWasmGame, type WasmGame } from "./wasm";
import { preloadTableAssets, TABLE_ASSET_URLS, type AssetProgress } from "./tableAssets";
import { COLORS, type Card, type Color, type PlayFlightEvent, type PlayFlightSource, type Snapshot } from "./types";
import { drawInfoForAction, effectForAction, type TableEffect } from "./tableEffects";
import { nextPlayerId, orderedOpponents, seatSlotForPlayer, sourceForPlayer as seatSourceForPlayer } from "./tableSeats";

const HUMAN_ID = 0;
type Screen = "menu" | "table" | "online-lobby" | "online-table";
type TableAnimation = "deal" | "draw" | "play" | "shuffle" | null;
const DEAL_DURATION_MS = 3_800;
const START_CALLOUT_MS = 1_600;

function seedFromClock() {
  return Math.floor(Date.now() % 2_000_000_000);
}

function parseSnapshot(raw: string): { snapshot: Snapshot; error?: string } {
  const parsed = JSON.parse(raw) as Snapshot | { ok: false; error: string | null; snapshot: Snapshot };
  if ("ok" in parsed && parsed.ok === false) return { snapshot: parsed.snapshot, error: parsed.error ?? "That move is not available." };
  return { snapshot: parsed as Snapshot };
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function colorClass(color: Color) {
  return color.toLowerCase();
}

function sourceForPlayer(playerId: number, playerCount: number, playerIds?: readonly number[]): PlayFlightSource {
  return seatSourceForPlayer(playerId, HUMAN_ID, playerCount, playerIds);
}

function playedPlayerId(lastAction: string): number | null {
  const match = /^player-(\d+)-played-/.exec(lastAction);
  return match ? Number(match[1]) : null;
}

function AssetLoadingScreen({ language, progress }: { language: Language; progress: AssetProgress }) {
  const text = copy(language);
  const percentage = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;
  return (
    <div className="loading-screen asset-loading-screen" data-testid="asset-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="asset-loading-card">
        <div className="loading-mark">UNO<small>2026</small></div>
        <span className="asset-loading-orbit" aria-hidden="true" />
        <p>{text.loadingAssets}</p>
        <div className="asset-loading-track" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.loaded} aria-label={text.loadingAssets}>
          <span style={{ width: `${percentage}%` }} />
        </div>
        <small className="asset-loading-detail">{text.loadingAssetsDetail(progress.loaded, progress.total)}</small>
      </div>
    </div>
  );
}

function BackStack({ count, language, onDraw, disabled }: { count: number; language: Language; onDraw: () => void; disabled: boolean }) {
  return (
    <button className="draw-stack" onClick={onDraw} disabled={disabled} aria-label={language === "zh" ? "从摸牌堆摸牌" : "Draw from the deck"} type="button">
      <span className="stack-offset stack-offset-one" />
      <span className="stack-offset stack-offset-two" />
      <img className="card-back-image" src="/assets/cards/reference/card-back.svg" alt="" />
      <span className="pile-count">{count}</span>
    </button>
  );
}

function SeatAvatar({ player, language }: { player: Snapshot["players"][number]; language: Language }) {
  return <span className={`seat-avatar seat-avatar-${player.id % 4}`} role="img" aria-label={`${player.name} ${language === "zh" ? "头像" : "avatar"}`} />;
}

function CardBackFan({ count }: { count: number }) {
  const visible = Math.min(8, Math.max(0, count));
  const center = visible > 0 ? (visible - 1) / 2 : 0;
  return (
    <span className="seat-card-fan" aria-hidden="true" style={{ "--fan-total": visible, "--fan-center": center } as CSSProperties}>
      {Array.from({ length: visible }, (_, index) => <img key={index} src="/assets/cards/reference/card-back.svg" alt="" style={{ "--fan-index": index } as CSSProperties} />)}
      <b>{count}</b>
    </span>
  );
}

function SeatAvatarWithTurn({ player, language, active }: { player: Snapshot["players"][number]; language: Language; active: boolean }) {
  return (
    <span className="seat-avatar-wrap">
      <SeatAvatar player={player} language={language} />
      {active && <span className="seat-turn-pip" aria-label={language === "zh" ? "当前回合" : "current turn"} />}
    </span>
  );
}

function SeatPlayer({ player, language, active, next = false, slot, human = false, unoCall = false, challengeAvailable = false, onChallenge }: { player: Snapshot["players"][number]; language: Language; active: boolean; next?: boolean; slot: string; human?: boolean; unoCall?: boolean; challengeAvailable?: boolean; onChallenge?: () => void }) {
  const text = copy(language);
  return (
    <div className={`seat-player player-row seat-${slot} ${human ? "seat-human" : ""} ${active ? "is-active" : ""} ${next ? "is-next" : ""}`} data-seat={slot} data-player-id={player.id}>
      <SeatAvatarWithTurn player={player} language={language} active={active} />
      {unoCall && <span className="uno-shout" data-testid="uno-shout" aria-live="polite">UNO!</span>}
      <div className="seat-player-info">
        <strong title={player.name}>{player.name}</strong>
        <span>{active ? (language === "zh" ? "当前回合" : "CURRENT TURN") : human ? text.youHuman : text.cards(player.hand_count, player.uno_called)}</span>
      </div>
      {active && <span className="seat-turn-label">{language === "zh" ? "出牌中" : "TURN"}</span>}
      {!human && <CardBackFan count={player.hand_count} />}
      {next && <><span className="seat-next-label">{text.nextPlayer}</span><span className="seat-next-marker" aria-label={language === "zh" ? "下一位出牌玩家" : "next player to play"}>↗</span></>}
      {challengeAvailable && onChallenge && <button className="challenge-uno-button" type="button" onClick={onChallenge}>{text.challengeUno}</button>}
    </div>
  );
}

export function App() {
  const [language, setLanguage] = useState<Language>("zh");
  const [setupConfig, setSetupConfig] = useState<SetupConfig>(() => createDefaultSetup());
  const [activeConfig, setActiveConfig] = useState<SetupConfig | null>(null);
  const [screen, setScreen] = useState<Screen>(() => readOnlineResume() ? "online-lobby" : "menu");
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoom | null>(null);
  const onlineApi = useMemo(() => createOnlineApi(), []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [topbarOpen, setTopbarOpen] = useState(false);
  const [game, setGame] = useState<WasmGame | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [assetProgress, setAssetProgress] = useState<AssetProgress>({ loaded: 0, total: TABLE_ASSET_URLS.length });
  const [wasmError, setWasmError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wildCardId, setWildCardId] = useState<number | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<number | null>(null);
  const [liftedCardId, setLiftedCardId] = useState<number | null>(null);
  const [handOrder, setHandOrder] = useState<number[]>([]);
  const [animation, setAnimation] = useState<TableAnimation>(null);
  const [dealPhase, setDealPhase] = useState<TablePhase>(null);
  const [dealHumanCount, setDealHumanCount] = useState(0);
  const [startingPlayerId, setStartingPlayerId] = useState<number | null>(null);
  const [playFlight, setPlayFlight] = useState<PlayFlightEvent | null>(null);
  const [tableEffect, setTableEffect] = useState<TableEffect>(null);
  const [turnTransition, setTurnTransition] = useState<{ kind: "reverse" | "skip"; currentId: number; nextId: number } | null>(null);
  const [unoCallPlayerId, setUnoCallPlayerId] = useState<number | null>(null);
  const [settlementActionsVisible, setSettlementActionsVisible] = useState(false);
  const [penaltyDraw, setPenaltyDraw] = useState<{ playerId: number; count: number; source: PlayFlightSource } | null>(null);
  const [drawFlight, setDrawFlight] = useState<{ card: Card; playerId: number } | null>(null);
  const [drawnCardId, setDrawnCardId] = useState<number | null>(null);
  const gameRecordRef = useRef<GameRecord>(createGameRecord("offline"));
  const [gameRecord, setGameRecord] = useState<GameRecord>(() => gameRecordRef.current);
  const aiBusy = useRef(false);
  const gameRef = useRef<WasmGame | null>(null);
  const draggingCardRef = useRef<number | null>(null);
  const pointerDragRef = useRef<{ cardId: number; startX: number; startY: number; active: boolean } | null>(null);
  const liftedCardRef = useRef<number | null>(null);
  const clickSequenceRef = useRef<{ cardId: number; count: number; timer: number } | null>(null);
  const suppressClickRef = useRef(false);
  const suppressDoubleClickRef = useRef(false);
  const tableDropRef = useRef<HTMLDivElement | null>(null);
  const runTokenRef = useRef(0);
  const animationTimerRef = useRef<number | null>(null);
  const flightTimerRef = useRef<number | null>(null);
  const effectTimerRef = useRef<number | null>(null);
  const penaltyTimerRef = useRef<number | null>(null);
  const drawFlightTimerRef = useRef<number | null>(null);
  const drawnHighlightTimerRef = useRef<number | null>(null);
  const dealTimerRef = useRef<number | null>(null);
  const startingTimerRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const unoCallTimerRef = useRef<number | null>(null);
  const settlementTimerRef = useRef<number | null>(null);
  const text = copy(language);

  const resetGameRecord = useCallback((source: "offline" | "online" = "offline", roomCode?: string) => {
    const next = createGameRecord(source, roomCode);
    gameRecordRef.current = next;
    setGameRecord(next);
  }, []);

  const appendGameRecord = useCallback((nextSnapshot: Snapshot) => {
    const next = appendSnapshotEvent(gameRecordRef.current, nextSnapshot);
    gameRecordRef.current = next;
    setGameRecord(next);
  }, []);

  const triggerAnimation = useCallback((next: Exclude<TableAnimation, null>) => {
    if (animationTimerRef.current !== null) window.clearTimeout(animationTimerRef.current);
    setAnimation(next);
    animationTimerRef.current = window.setTimeout(() => {
      setAnimation(null);
      animationTimerRef.current = null;
    }, 760);
  }, []);

  const beginDealSequence = useCallback((playerId: number) => {
    if (dealTimerRef.current !== null) window.clearTimeout(dealTimerRef.current);
    if (startingTimerRef.current !== null) window.clearTimeout(startingTimerRef.current);
    if (animationTimerRef.current !== null) window.clearTimeout(animationTimerRef.current);
    setStartingPlayerId(playerId);
    setDealHumanCount(0);
    setDealPhase("dealing");
    setAnimation("deal");
    dealTimerRef.current = window.setTimeout(() => {
      setDealPhase("starting");
      setAnimation(null);
      startingTimerRef.current = window.setTimeout(() => {
        setDealPhase(null);
        startingTimerRef.current = null;
      }, START_CALLOUT_MS);
      dealTimerRef.current = null;
    }, DEAL_DURATION_MS);
  }, []);

  const showPlayFlight = useCallback((card: Card, playerId: number, playerCount: number, playerIds?: readonly number[]) => {
    if (flightTimerRef.current !== null) window.clearTimeout(flightTimerRef.current);
    setPlayFlight({ id: `${playerId}-${card.id}-${Date.now()}`, card, playerId, source: sourceForPlayer(playerId, playerCount, playerIds) });
    flightTimerRef.current = window.setTimeout(() => {
      setPlayFlight(null);
      flightTimerRef.current = null;
    }, 1_050);
  }, []);

  const showDrawCard = useCallback((previous: Snapshot | null, next: Snapshot, playerId: number) => {
    if (playerId !== HUMAN_ID) return;
    const before = new Set(previous?.players[HUMAN_ID]?.hand.map((card) => card.id) ?? []);
    const drawn = next.players[HUMAN_ID]?.hand.find((card) => !before.has(card.id));
    if (!drawn) return;
    if (drawFlightTimerRef.current !== null) window.clearTimeout(drawFlightTimerRef.current);
    if (drawnHighlightTimerRef.current !== null) window.clearTimeout(drawnHighlightTimerRef.current);
    setDrawFlight({ card: drawn, playerId });
    setDrawnCardId(drawn.id);
    drawFlightTimerRef.current = window.setTimeout(() => {
      setDrawFlight(null);
      drawFlightTimerRef.current = null;
    }, 1_250);
    drawnHighlightTimerRef.current = window.setTimeout(() => {
      setDrawnCardId(null);
      drawnHighlightTimerRef.current = null;
    }, 2_100);
  }, []);

  const showTableEffects = useCallback((nextSnapshot: Snapshot) => {
    const effect = effectForAction(nextSnapshot.last_action);
    if (effectTimerRef.current !== null) window.clearTimeout(effectTimerRef.current);
    if (effect) {
      setTableEffect(effect);
      effectTimerRef.current = window.setTimeout(() => {
        setTableEffect(null);
        effectTimerRef.current = null;
      }, effect === "draw-four" ? 1_450 : 900);
    }
    const draw = drawInfoForAction(nextSnapshot.last_action);
    if (penaltyTimerRef.current !== null) window.clearTimeout(penaltyTimerRef.current);
    if (draw && draw.playerId !== HUMAN_ID) {
      setPenaltyDraw({ playerId: draw.playerId, count: draw.count, source: sourceForPlayer(draw.playerId, nextSnapshot.players.length, nextSnapshot.players.map((player) => player.id)) });
      penaltyTimerRef.current = window.setTimeout(() => {
        setPenaltyDraw(null);
        penaltyTimerRef.current = null;
      }, 1_100);
    } else setPenaltyDraw(null);
    const playedId = playedPlayerId(nextSnapshot.last_action);
    const transitionKind = effect === "reverse" || effect === "skip" ? effect : null;
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    if (transitionKind !== null && playedId !== null) {
      setTurnTransition({ kind: transitionKind, currentId: playedId, nextId: nextSnapshot.current_player });
      transitionTimerRef.current = window.setTimeout(() => {
        setTurnTransition(null);
        transitionTimerRef.current = null;
      }, 2_600);
    } else {
      setTurnTransition(null);
    }
    const called = /^player-(\d+)-called-uno$/.exec(nextSnapshot.last_action);
    if (unoCallTimerRef.current !== null) window.clearTimeout(unoCallTimerRef.current);
    if (called) {
      const playerId = Number(called[1]);
      setUnoCallPlayerId(playerId);
      unoCallTimerRef.current = window.setTimeout(() => {
        setUnoCallPlayerId(null);
        unoCallTimerRef.current = null;
      }, 3_000);
    } else if (!nextSnapshot.players.some((player) => player.id === unoCallPlayerId && player.uno_called)) {
      setUnoCallPlayerId(null);
    }
  }, [unoCallPlayerId]);

  const startGame = useCallback(async (nextConfig: SetupConfig, nextSeed = seedFromClock()) => {
    const runToken = runTokenRef.current + 1;
    runTokenRef.current = runToken;
    aiBusy.current = false;
    setLoading(true);
    setWasmError(null);
    setNotice(null);
    setWildCardId(null);
    setHistoryOpen(false);
    setRecordOpen(false);
    resetGameRecord("offline");
    setTopbarOpen(false);
    setPlayFlight(null);
    setDrawFlight(null);
    setDrawnCardId(null);
    setTableEffect(null);
    setTurnTransition(null);
    setUnoCallPlayerId(null);
    setSettlementActionsVisible(false);
    setPenaltyDraw(null);
    setDealPhase(null);
    setDealHumanCount(0);
    setStartingPlayerId(null);
    setAssetProgress({ loaded: 0, total: TABLE_ASSET_URLS.length });
    try {
      const [nextGame] = await Promise.all([
        createWasmGame(nextSeed, nextConfig.profile, nextConfig.playerCount),
        preloadTableAssets((progress) => {
          if (runToken === runTokenRef.current) setAssetProgress(progress);
        }),
      ]);
      if (runToken !== runTokenRef.current) return;
      gameRef.current = nextGame;
      const nextSnapshot = parseSnapshot(nextGame.snapshot()).snapshot;
      setGame(nextGame);
      setSnapshot(nextSnapshot);
      appendGameRecord(nextSnapshot);
      setActiveConfig(nextConfig);
      setSetupConfig(nextConfig);
      setScreen("table");
      beginDealSequence(nextSnapshot.current_player);
    } catch (error) {
      if (runToken === runTokenRef.current) {
        setWasmError(error instanceof Error ? error.message : "WASM table failed to load.");
        setScreen("menu");
      }
    } finally {
      if (runToken === runTokenRef.current) setLoading(false);
    }
  }, [appendGameRecord, beginDealSequence, resetGameRecord]);

  const enterOnlineTable = useCallback(async (room: OnlineRoom) => {
    const runToken = runTokenRef.current + 1;
    runTokenRef.current = runToken;
    setLoading(true);
    setWasmError(null);
    setAssetProgress({ loaded: 0, total: TABLE_ASSET_URLS.length });
    try {
      await preloadTableAssets((progress) => {
        if (runToken === runTokenRef.current) setAssetProgress(progress);
      });
      if (runToken !== runTokenRef.current) return;
      setOnlineRoom(room);
      setScreen("online-table");
    } catch (error) {
      if (runToken === runTokenRef.current) {
        setWasmError(error instanceof Error ? error.message : "Table assets failed to load.");
        setScreen("menu");
      }
    } finally {
      if (runToken === runTokenRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => () => {
    runTokenRef.current += 1;
    if (animationTimerRef.current !== null) window.clearTimeout(animationTimerRef.current);
    if (flightTimerRef.current !== null) window.clearTimeout(flightTimerRef.current);
    if (effectTimerRef.current !== null) window.clearTimeout(effectTimerRef.current);
    if (penaltyTimerRef.current !== null) window.clearTimeout(penaltyTimerRef.current);
    if (drawFlightTimerRef.current !== null) window.clearTimeout(drawFlightTimerRef.current);
    if (drawnHighlightTimerRef.current !== null) window.clearTimeout(drawnHighlightTimerRef.current);
    if (dealTimerRef.current !== null) window.clearTimeout(dealTimerRef.current);
    if (startingTimerRef.current !== null) window.clearTimeout(startingTimerRef.current);
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    if (unoCallTimerRef.current !== null) window.clearTimeout(unoCallTimerRef.current);
    if (settlementTimerRef.current !== null) window.clearTimeout(settlementTimerRef.current);
  }, []);

  const openMenu = useCallback(() => {
    runTokenRef.current += 1;
    aiBusy.current = false;
    gameRef.current = null;
    setGame(null);
    setSnapshot(null);
    setActiveConfig(null);
    setNotice(null);
    setWildCardId(null);
    setHistoryOpen(false);
    setRecordOpen(false);
    resetGameRecord("offline");
    setPlayFlight(null);
    setDrawFlight(null);
    setDrawnCardId(null);
    setTableEffect(null);
    setTurnTransition(null);
    setUnoCallPlayerId(null);
    setSettlementActionsVisible(false);
    setPenaltyDraw(null);
    setDealPhase(null);
    setStartingPlayerId(null);
    setWasmError(null);
    setScreen("menu");
    setOnlineRoom(null);
  }, []);

  const applyRaw = useCallback((raw: string, nextAnimation?: Exclude<TableAnimation, null>) => {
    const previousSnapshot = snapshot;
    const result = parseSnapshot(raw);
    setSnapshot(result.snapshot);
    appendGameRecord(result.snapshot);
    showTableEffects(result.snapshot);
    if (result.error) setNotice(result.error);
    else {
      setNotice(null);
      if (nextAnimation) {
        triggerAnimation(nextAnimation);
        if (nextAnimation === "draw") showDrawCard(previousSnapshot, result.snapshot, HUMAN_ID);
      }
    }
    if (result.snapshot.status === "Won") setWildCardId(null);
  }, [appendGameRecord, showDrawCard, showTableEffects, snapshot, triggerAnimation]);

  useEffect(() => {
    if (settlementTimerRef.current !== null) window.clearTimeout(settlementTimerRef.current);
    if (snapshot?.status !== "Won") {
      setSettlementActionsVisible(false);
      settlementTimerRef.current = null;
      return;
    }
    setSettlementActionsVisible(false);
    settlementTimerRef.current = window.setTimeout(() => {
      setSettlementActionsVisible(true);
      settlementTimerRef.current = null;
    }, 5_000);
    return () => {
      if (settlementTimerRef.current !== null) window.clearTimeout(settlementTimerRef.current);
    };
  }, [snapshot?.status]);

  const runAiTurns = useCallback(async () => {
    if (dealPhase !== null || aiBusy.current || !gameRef.current || !activeConfig) return;
    aiBusy.current = true;
    const runToken = runTokenRef.current;
    try {
      let current = snapshot;
      for (let step = 0; step < 64; step += 1) {
        if (!current || current.status === "Won" || current.current_player === HUMAN_ID || runToken !== runTokenRef.current) break;
        const pauseSeconds = activeConfig.seatPauses[current.current_player] ?? activeConfig.defaultPauseSeconds;
        await delay(pauseSeconds * 1_000);
        if (runToken !== runTokenRef.current || !gameRef.current) break;
        const result = parseSnapshot(gameRef.current.ai_step());
        current = result.snapshot;
        const aiPlayerId = playedPlayerId(result.snapshot.last_action);
        if (aiPlayerId !== null) showPlayFlight(result.snapshot.top_card, aiPlayerId, result.snapshot.players.length, result.snapshot.players.map((player) => player.id));
        showTableEffects(result.snapshot);
        appendGameRecord(result.snapshot);
        setSnapshot(result.snapshot);
        triggerAnimation(aiPlayerId === null ? "draw" : "play");
        if (result.error) setNotice(result.error);
        if (result.snapshot.status === "Won" || result.snapshot.current_player === HUMAN_ID) break;
      }
    } finally {
      aiBusy.current = false;
    }
  }, [activeConfig, appendGameRecord, dealPhase, showPlayFlight, showTableEffects, snapshot, triggerAnimation]);

  useEffect(() => {
    if (screen === "table" && dealPhase === null && snapshot && snapshot.current_player !== HUMAN_ID && snapshot.status === "Playing") void runAiTurns();
  }, [dealPhase, runAiTurns, screen, snapshot]);

  const human = snapshot?.players.find((player) => player.id === HUMAN_ID);
  const orderedHand = useMemo(() => {
    if (!human) return [];
    const byId = new Map(human.hand.map((card) => [card.id, card]));
    const ordered = handOrder.map((id) => byId.get(id)).filter((card): card is Card => Boolean(card));
    return [...ordered, ...human.hand.filter((card) => !handOrder.includes(card.id))];
  }, [handOrder, human]);
  const currentPlayer = snapshot?.players.find((player) => player.id === snapshot.current_player);
  const nextId = snapshot ? (snapshot.next_player ?? nextPlayerId(snapshot.players, snapshot.current_player, snapshot.direction)) : null;
  const playableIds = useMemo(() => {
    if (dealPhase !== null || !snapshot || snapshot.current_player !== HUMAN_ID || snapshot.pending_draw > 0) return new Set<number>();
    const top = snapshot.top_card;
    return new Set(human?.hand.filter((card) => {
      if (card.kind === "wild-draw-four") {
        return !human.hand.some((candidate) => candidate.color === snapshot.active_color && candidate.color !== "Wild");
      }
      return card.color === "Wild" || card.color === snapshot.active_color || card.kind === top.kind;
    }).map((card) => card.id) ?? []);
  }, [dealPhase, human, snapshot]);

  function handlePlay(card: Card) {
    if (dealPhase !== null || !game || !snapshot || snapshot.current_player !== HUMAN_ID || !playableIds.has(card.id)) return;
    liftedCardRef.current = null;
    setLiftedCardId(null);
    if (card.color === "Wild") {
      setWildCardId(card.id);
      return;
    }
    showPlayFlight(card, HUMAN_ID, snapshot.players.length, snapshot.players.map((player) => player.id));
    applyRaw(game.play_card(card.id, ""), "play");
  }

  function handleCardClick(card: Card) {
    if (dealPhase !== null || !playableIds.has(card.id)) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const previous = clickSequenceRef.current;
    if (previous && previous.cardId === card.id) {
      window.clearTimeout(previous.timer);
      clickSequenceRef.current = null;
      suppressDoubleClickRef.current = true;
      handlePlay(card);
      return;
    }
    if (previous) window.clearTimeout(previous.timer);
    const timer = window.setTimeout(() => {
      clickSequenceRef.current = null;
      if (liftedCardRef.current === card.id) {
        handlePlay(card);
      } else {
        liftedCardRef.current = card.id;
        setLiftedCardId(card.id);
      }
    }, 220);
    clickSequenceRef.current = { cardId: card.id, count: 1, timer };
  }

  function handleCardDoubleClick(card: Card) {
    if (dealPhase !== null || !playableIds.has(card.id)) return;
    if (suppressDoubleClickRef.current) {
      suppressDoubleClickRef.current = false;
      return;
    }
    const pending = clickSequenceRef.current;
    if (pending) window.clearTimeout(pending.timer);
    clickSequenceRef.current = null;
    handlePlay(card);
  }

  function handleDragStart(event: DragEvent<HTMLElement>, card: Card) {
    if (dealPhase !== null || !game || !snapshot || snapshot.current_player !== HUMAN_ID || snapshot.status === "Won") {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(card.id));
    draggingCardRef.current = card.id;
    setDraggingCardId(card.id);
  }

  function reorderHand(cardId: number, targetId: number) {
    if (cardId === targetId) return;
    const ids = orderedHand.map((card) => card.id);
    const from = ids.indexOf(cardId); const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1); ids.splice(to, 0, cardId); setHandOrder(ids);
  }

  function handleDragEnd() {
    setDraggingCardId(null);
    const cardId = draggingCardRef.current;
    if (cardId !== null) {
      window.setTimeout(() => {
        if (draggingCardRef.current === cardId) draggingCardRef.current = null;
      }, 0);
    }
  }

  function handleTableDragOver(event: DragEvent<HTMLElement>) {
    if (draggingCardRef.current !== null || draggingCardId !== null || event.dataTransfer.types.includes("text/plain")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }
  }

  function handleTableDragEnter(event: DragEvent<HTMLElement>) {
    if (draggingCardRef.current !== null || event.dataTransfer.types.includes("text/plain")) event.preventDefault();
  }

  function handleTableDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const transferredId = Number(event.dataTransfer.getData("text/plain"));
    const cardId = Number.isFinite(transferredId) && transferredId > 0 ? transferredId : draggingCardRef.current;
    const card = human?.hand.find((candidate) => candidate.id === cardId);
    draggingCardRef.current = null;
    setDraggingCardId(null);
    if (card && playableIds.has(card.id)) {
      // A wild card only flies after the player confirms its color.
      handlePlay(card);
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>, card: Card) {
    if (event.button !== 0 || dealPhase !== null || !game || !snapshot || snapshot.current_player !== HUMAN_ID || snapshot.status === "Won") return;
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
      const table = tableDropRef.current?.getBoundingClientRect();
      const overTable = table && event.clientX >= table.left && event.clientX <= table.right && event.clientY >= table.top && event.clientY <= table.bottom;
      setDraggingCardId(null);
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-card-id]");
      if (target) {
        const targetId = Number(target.dataset.cardId);
        if (Number.isFinite(targetId)) reorderHand(drag.cardId, targetId);
      }
      if (overTable) {
        const card = human?.hand.find((candidate) => candidate.id === drag.cardId);
        if (card && playableIds.has(card.id)) {
          handlePlay(card);
        }
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
  }, [dealPhase, human, playableIds, snapshot, game]);

  function handleWildColor(color: Color) {
    if (dealPhase !== null || !game || wildCardId === null) return;
    const card = human?.hand.find((candidate) => candidate.id === wildCardId);
    if (card && snapshot) showPlayFlight(card, HUMAN_ID, snapshot.players.length, snapshot.players.map((player) => player.id));
    applyRaw(game.play_card(wildCardId, color.toLowerCase()), "play");
    setWildCardId(null);
  }

  function handleDraw() {
    if (dealPhase !== null || !game || !snapshot || snapshot.current_player !== HUMAN_ID) return;
    applyRaw(game.draw(), "draw");
  }

  function handleUno() {
    if (dealPhase !== null || !game || !snapshot || human?.hand_count !== 1 || snapshot.uno_pending_player !== HUMAN_ID) return;
    applyRaw(game.call_uno());
  }

  function handleChallengeUno() {
    if (dealPhase !== null || !game || !snapshot || snapshot.uno_pending_player === null || snapshot.uno_pending_player === HUMAN_ID) return;
    applyRaw(game.challenge_uno());
  }

  if (loading) {
    return <AssetLoadingScreen language={language} progress={assetProgress} />;
  }

  if (screen === "menu") {
    return (
      <>
        <MainMenuScreen language={language} onLanguageChange={setLanguage} onStart={() => void startGame(setupConfig)} onOpenOnline={() => { resetNetworkDiagnostics(); setWasmError(null); setScreen("online-lobby"); }} onOpenSettings={() => setSettingsOpen(true)} onOpenAbout={() => setAboutOpen(true)} error={wasmError} />
        <SettingsDrawer initialConfig={setupConfig} language={language} open={settingsOpen} onClose={() => setSettingsOpen(false)} onApply={(config) => { setSetupConfig(config); setSettingsOpen(false); }} onLanguageChange={setLanguage} />
        <AboutPanel language={language} open={aboutOpen} onClose={() => setAboutOpen(false)} />
      </>
    );
  }

  if (screen === "online-lobby") {
    return <div className="online-lobby-screen"><NetworkLogExportButton language={language} /><OnlineLobby language={language} api={onlineApi} onClose={openMenu} onStarted={(room) => { void enterOnlineTable(room); }} /></div>;
  }

  if (screen === "online-table" && onlineRoom) {
    return <OnlineTable language={language} room={onlineRoom} api={onlineApi} onLanguageChange={setLanguage} onLeave={openMenu} />;
  }

  if (!snapshot || !game || !activeConfig) return null;
  const discardCards = snapshot.discard_cards?.length ? snapshot.discard_cards : [snapshot.top_card];
  const startingPlayer = startingPlayerId === null ? undefined : snapshot.players.find((player) => player.id === startingPlayerId);
  const winner = snapshot.winner === null ? undefined : snapshot.players.find((player) => player.id === snapshot.winner);
  const transitionCurrent = turnTransition ? snapshot.players.find((player) => player.id === turnTransition.currentId) : undefined;
  const transitionNext = turnTransition ? snapshot.players.find((player) => player.id === turnTransition.nextId) : undefined;

  return (
    <div className={`app-shell ${topbarOpen ? "topbar-is-open" : "topbar-is-hidden"}`}>
      <GameRecordPanel language={language} record={gameRecord} open={recordOpen} onToggle={() => setRecordOpen((open) => !open)} />
      <button className="table-exit-floating" data-testid="table-exit" type="button" onClick={openMenu} aria-label={language === "zh" ? "退出牌桌" : "Exit table"}>×</button>
      <button className="topbar-toggle" type="button" onClick={() => setTopbarOpen((open) => !open)} aria-expanded={topbarOpen} aria-label={topbarOpen ? (language === "zh" ? "隐藏顶部信息栏" : "Hide top information bar") : (language === "zh" ? "显示顶部信息栏" : "Show top information bar")}>{topbarOpen ? "−" : "☰"}</button>
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark">UNO<small>2026</small></div><div className="brand-divider" /><div className="brand-context"><span>{text.offlineTable}</span><small>{text.rustRuntime}</small></div></div>
        <div className="table-mode"><span className="mode-live-dot" />{text.offline}<span className="mode-lock">· {text.online} {text.locked}</span></div>
        <div className="top-actions"><div className="table-profile"><span>{text.aiProfile}</span><strong>{profileLabel(language, activeConfig.profile)}</strong><small>{text.seats(snapshot.players.length)} · {text.basePause(activeConfig.defaultPauseSeconds)}</small></div><button className="language-toggle" type="button" onClick={() => setLanguage(language === "zh" ? "en" : "zh")} aria-label={language === "zh" ? text.switchToEnglish : text.switchToChinese}>{language === "zh" ? "EN" : "中文"}</button><button className="icon-button" onClick={openMenu} aria-label={language === "zh" ? "返回主菜单" : "Return to main menu"} type="button">×</button></div>
      </header>

      <main className="game-layout" data-deal-phase={dealPhase ?? "ready"}>
        <section className="table-column">
          <div className="table-heading"><div><p className="eyebrow">{text.match} / 001 · {text.seats(snapshot.players.length)}</p><h1>{text.makeYourMove}</h1></div><div className="round-meta"><span>{text.turn} {String(snapshot.turn_number).padStart(2, "0")}</span><span className="direction-mark" data-testid="direction-indicator" data-direction={snapshot.direction === 1 ? "clockwise" : "counter-clockwise"} aria-label={snapshot.direction === 1 ? (language === "zh" ? "顺时针出牌" : "Clockwise play") : (language === "zh" ? "逆时针出牌" : "Counter-clockwise play")}><b>{snapshot.direction === 1 ? "↻" : "↺"}</b><small>{snapshot.direction === 1 ? (language === "zh" ? "顺时针" : "CW") : (language === "zh" ? "逆时针" : "CCW")}</small></span></div></div>
          <div ref={tableDropRef} className={`felt-table table-scene ${draggingCardId !== null ? "is-card-drop-target" : ""}`} data-animation={animation ?? undefined} data-deal-phase={dealPhase ?? "ready"} data-drop-target="table" onDragEnter={handleTableDragEnter} onDragOver={handleTableDragOver} onDrop={handleTableDrop}>
            <div className="table-grid-lines" />
            <TableDirectionArrows direction={snapshot.direction} language={language} players={snapshot.players.map((player) => player.id)} humanId={HUMAN_ID} currentPlayerId={snapshot.current_player} nextPlayerId={nextId} />
            <div className="table-scene-badge"><span className="live-pip" />{snapshot.status === "Won" ? text.tableComplete : currentPlayer?.name === "You" ? text.yourMove : text.thinking(currentPlayer?.name ?? "AI")}</div>
            <div className="table-seats" data-player-count={snapshot.players.length}>
              {orderedOpponents(snapshot.players, HUMAN_ID).map((player) => <SeatPlayer key={player.id} player={player} language={language} active={player.id === snapshot.current_player} next={player.id === nextId} slot={seatSlotForPlayer(player.id, HUMAN_ID, snapshot.players.length, snapshot.players.map((candidate) => candidate.id))} unoCall={unoCallPlayerId === player.id} challengeAvailable={snapshot.uno_pending_player === player.id && player.id !== HUMAN_ID} onChallenge={handleChallengeUno} />)}
              {human && <SeatPlayer player={human} language={language} active={human.id === snapshot.current_player} next={human.id === nextId} slot="south" human unoCall={unoCallPlayerId === human.id} />}
            </div>
            <div className="table-center">
              <div className="piles">
                <BackStack count={snapshot.draw_count} language={language} onDraw={handleDraw} disabled={dealPhase !== null || snapshot.current_player !== HUMAN_ID || snapshot.status === "Won"} />
                <div className="pile-separator" />
                <button className="discard-stack" onClick={() => setHistoryOpen(true)} aria-label={text.viewDiscardHistory} type="button"><span className="discard-shadow" /><CardArt card={snapshot.top_card} language={language} compact /></button>
              </div>
              <div className="active-color"><span className={`color-swatch swatch-${colorClass(snapshot.active_color)}`} />{text.activeColor} <strong>{translateColor(language, snapshot.active_color)}</strong></div>
              {snapshot.pending_draw > 0 && <div key={`pending-${snapshot.pending_draw}`} className="pending-draw-badge" data-testid="pending-draw" data-count={snapshot.pending_draw} aria-live="assertive">+{snapshot.pending_draw} {language === "zh" ? "连击抽牌" : "PENALTY DRAW"}</div>}
            </div>
            <div className="table-scene-status" aria-live="polite"><span className={`status-pulse ${snapshot.status === "Won" ? "is-won" : ""}`} aria-label={localizeEngineMessage(language, snapshot.message)} /><span className="sr-only">{localizeEngineMessage(language, snapshot.message)}</span><span className="status-code sr-only">{snapshot.last_action}</span></div>
            <div className="table-scene-footnote table-metrics" aria-label={`${text.drawPile} ${snapshot.draw_count}, ${text.discard} ${snapshot.discard_count}`}><span className="table-metric" title={text.drawPile}><span aria-hidden="true">▤</span><b>{snapshot.draw_count}</b></span><span className="table-metric" title={text.discard}><span aria-hidden="true">◈</span><b>{snapshot.discard_count}</b></span><span className="table-metric metric-ruleset" title={text.ruleset}>UNO</span></div>
            {playFlight && <PlayFlight flight={playFlight} language={language} />}
            {drawFlight && <DrawCardFlight card={drawFlight.card} playerId={drawFlight.playerId} language={language} />}
            {tableEffect && <ActionEffectOverlay effect={tableEffect} language={language} />}
            {penaltyDraw && <PenaltyDrawFlight count={penaltyDraw.count} playerId={penaltyDraw.playerId} source={penaltyDraw.source} language={language} />}
            {turnTransition && <TurnTransitionOverlay language={language} kind={turnTransition.kind} current={transitionCurrent} next={transitionNext} />}
            {snapshot.status === "Won" && <SettlementOverlay language={language} winner={winner} isWinner={snapshot.winner === HUMAN_ID} showActions={settlementActionsVisible} onPlayAgain={() => { if (activeConfig) void startGame(activeConfig); }} onExit={openMenu} />}
          </div>
        </section>

        <section className="hand-column">
          <div className="hand-heading"><div><p className="eyebrow">{language === "zh" ? "你的手牌" : "YOUR HAND"} / {String(dealPhase !== null ? dealHumanCount : human?.hand_count ?? 0).padStart(2, "0")}</p>{human?.hand_count === 1 && <h2 className="hand-alert">{text.oneCardLeft}</h2>}</div><div className="hand-actions"><button className="ghost-button" data-testid="sort-hand" disabled={dealPhase !== null || snapshot.status === "Won"} onClick={() => { if (human) setHandOrder([...human.hand].sort((a, b) => a.color.localeCompare(b.color) || a.kind.localeCompare(b.kind)).map((card) => card.id)); }} type="button">{language === "zh" ? "整理手牌" : "SORT"}</button><button className={`ghost-button uno-call-button ${snapshot.uno_pending_player === HUMAN_ID ? "is-uno-ready" : ""}`} data-testid="call-uno" onClick={handleUno} disabled={dealPhase !== null || human?.hand_count !== 1 || snapshot.uno_pending_player !== HUMAN_ID || snapshot.status === "Won"} type="button">{text.callUno} <span>!</span></button><button className="primary-button" onClick={handleDraw} disabled={dealPhase !== null || snapshot.current_player !== HUMAN_ID || snapshot.status === "Won"} type="button">{text.drawCard}</button></div></div>
          <div className="hand-rail hand-fan" data-testid="hand-rail">{orderedHand.map((card, index) => <div className={`hand-card-slot ${draggingCardId === card.id ? "is-dragging" : ""} ${drawnCardId === card.id ? "is-drawn-highlight" : ""}`} key={card.id} data-card-id={card.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const source = Number(event.dataTransfer.getData("text/plain")); if (source) reorderHand(source, card.id); }}>
            <CardArt card={card} language={language} className={`hand-card ${playableIds.has(card.id) ? "is-playable" : "is-unplayable"} ${liftedCardId === card.id ? "is-lifted" : ""} ${drawnCardId === card.id ? "is-drawn-highlight" : ""}`} style={{ "--hand-index": index, "--hand-total": human?.hand.length ?? 0 } as CSSProperties} disabled={snapshot.current_player !== HUMAN_ID || snapshot.status === "Won"} ariaDisabled={!playableIds.has(card.id)} draggable={snapshot.current_player === HUMAN_ID && snapshot.status !== "Won"} onClick={() => handleCardClick(card)} onDoubleClick={() => handleCardDoubleClick(card)} onDragStart={(event) => handleDragStart(event, card)} onDragEnd={handleDragEnd} onPointerDown={(event) => handlePointerDown(event, card)} />
            {wildCardId === card.id && <div className="wild-picker" role="dialog" aria-modal="false" aria-labelledby="color-title"><span className="wild-picker-stem" /><p className="eyebrow">{text.wildCard}</p><strong id="color-title">{text.chooseColor}</strong><div className="wild-picker-options">{COLORS.map((color) => <button key={color.name} className={`wild-picker-option color-option-${color.className}`} onClick={() => handleWildColor(color.name)} aria-label={translateColor(language, color.name)} type="button"><span className={`color-swatch swatch-${color.className}`} /></button>)}</div><button className="wild-picker-cancel" onClick={() => setWildCardId(null)} type="button">×</button></div>}
          </div>)}</div>
          <div className="hand-help compact-help" aria-label={language === "zh" ? "牌桌操作提示" : "Table controls"}><span className="help-action" title={language === "zh" ? "拖拽亮起的牌到牌桌出牌" : "Drag a lit card to the table"}><kbd>↕</kbd><span className="sr-only">{language === "zh" ? "拖拽亮起的牌到牌桌出牌" : "Drag a lit card to the table"}</span></span><span className="help-action" title={text.drawHint}><kbd>＋</kbd><span className="sr-only">{text.drawHint}</span></span><span className={`help-state ${notice ? "is-alert" : "is-ready"}`} title={notice ? localizeEngineMessage(language, notice) : text.playableHint}><span className="status-pulse" /><span className="sr-only">{notice ? localizeEngineMessage(language, notice) : text.playableHint}</span></span></div>
        </section>
        {dealPhase && <DealSequenceOverlay phase={dealPhase} language={language} players={snapshot.players} humanId={HUMAN_ID} humanCards={orderedHand} startingPlayer={startingPlayer} onHumanCountChange={setDealHumanCount} />}
      </main>

      <DiscardHistory cards={discardCards} language={language} open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
