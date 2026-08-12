import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AboutPanel } from "./AboutPanel";
import { CardArt } from "./CardArt";
import { DiscardHistory } from "./DiscardHistory";
import { MainMenuScreen } from "./MainMenuScreen";
import { SettingsDrawer } from "./SettingsDrawer";
import { createDefaultSetup, type SetupConfig } from "./SetupScreen";
import { copy, localizeEngineMessage, profileLabel, translateColor, type Language } from "./i18n";
import { createWasmGame, type WasmGame } from "./wasm";
import { COLORS, type Card, type Color, type Snapshot } from "./types";

const HUMAN_ID = 0;
type Screen = "menu" | "table";
type TableAnimation = "deal" | "draw" | "play" | "shuffle" | null;

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

function BackStack({ count, language, onDraw, disabled }: { count: number; language: Language; onDraw: () => void; disabled: boolean }) {
  return (
    <button className="draw-stack" onClick={onDraw} disabled={disabled} aria-label={language === "zh" ? "从摸牌堆摸牌" : "Draw from the deck"} type="button">
      <span className="stack-offset stack-offset-one" />
      <span className="stack-offset stack-offset-two" />
      <img className="card-back-image" src="/assets/cards/card-back-v2.svg" alt="" />
      <span className="pile-count">{count}</span>
    </button>
  );
}

const SEAT_LAYOUTS: Record<number, string[]> = {
  3: ["north", "west"],
  4: ["north-west", "north-east", "west"],
  5: ["north-west", "north", "north-east", "west"],
  6: ["north-west", "north", "north-east", "east", "west"],
  7: ["north-west", "north", "north-east", "east", "south-east", "west"],
  8: ["north-west", "north", "north-east", "east", "south-east", "south-west", "west"],
};

function SeatAvatar({ player, language }: { player: Snapshot["players"][number]; language: Language }) {
  return <span className={`seat-avatar seat-avatar-${player.id % 4}`} role="img" aria-label={`${player.name} ${language === "zh" ? "头像" : "avatar"}`} />;
}

function CardBackFan({ count }: { count: number }) {
  const visible = Math.min(3, Math.max(1, count));
  return (
    <span className="seat-card-fan" aria-hidden="true">
      {Array.from({ length: visible }, (_, index) => <img key={index} src="/assets/cards/card-back-v2.svg" alt="" style={{ "--fan-index": index } as CSSProperties} />)}
      <b>{count}</b>
    </span>
  );
}

function SeatPlayer({ player, language, active, slot, human = false }: { player: Snapshot["players"][number]; language: Language; active: boolean; slot: string; human?: boolean }) {
  const text = copy(language);
  return (
    <div className={`seat-player player-row seat-${slot} ${human ? "seat-human" : ""} ${active ? "is-active" : ""}`} data-seat={slot}>
      <SeatAvatar player={player} language={language} />
      <div className="seat-player-info">
        <strong>{player.name}</strong>
        <span>{human ? text.youHuman : text.cards(player.hand_count, player.uno_called)}</span>
      </div>
      {!human && <CardBackFan count={player.hand_count} />}
      {active && <span className="seat-turn-pip" aria-label={language === "zh" ? "当前回合" : "current turn"} />}
    </div>
  );
}

export function App() {
  const [language, setLanguage] = useState<Language>("zh");
  const [setupConfig, setSetupConfig] = useState<SetupConfig>(() => createDefaultSetup());
  const [activeConfig, setActiveConfig] = useState<SetupConfig | null>(null);
  const [screen, setScreen] = useState<Screen>("menu");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [game, setGame] = useState<WasmGame | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [wasmError, setWasmError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wildCardId, setWildCardId] = useState<number | null>(null);
  const [animation, setAnimation] = useState<TableAnimation>(null);
  const aiBusy = useRef(false);
  const gameRef = useRef<WasmGame | null>(null);
  const runTokenRef = useRef(0);
  const animationTimerRef = useRef<number | null>(null);
  const text = copy(language);

  const triggerAnimation = useCallback((next: Exclude<TableAnimation, null>) => {
    if (animationTimerRef.current !== null) window.clearTimeout(animationTimerRef.current);
    setAnimation(next);
    animationTimerRef.current = window.setTimeout(() => {
      setAnimation(null);
      animationTimerRef.current = null;
    }, 760);
  }, []);

  const startGame = useCallback(async (nextConfig: SetupConfig, nextSeed = seedFromClock()) => {
    const runToken = runTokenRef.current + 1;
    runTokenRef.current = runToken;
    aiBusy.current = false;
    setLoading(true);
    setWasmError(null);
    setNotice(null);
    setWildCardId(null);
    setHistoryOpen(false);
    try {
      const nextGame = await createWasmGame(nextSeed, nextConfig.profile, nextConfig.playerCount);
      if (runToken !== runTokenRef.current) return;
      gameRef.current = nextGame;
      const nextSnapshot = parseSnapshot(nextGame.snapshot()).snapshot;
      setGame(nextGame);
      setSnapshot(nextSnapshot);
      setActiveConfig(nextConfig);
      setSetupConfig(nextConfig);
      setScreen("table");
      triggerAnimation("shuffle");
    } catch (error) {
      if (runToken === runTokenRef.current) {
        setWasmError(error instanceof Error ? error.message : "WASM table failed to load.");
        setScreen("menu");
      }
    } finally {
      if (runToken === runTokenRef.current) setLoading(false);
    }
  }, [triggerAnimation]);

  useEffect(() => () => {
    runTokenRef.current += 1;
    if (animationTimerRef.current !== null) window.clearTimeout(animationTimerRef.current);
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
    setWasmError(null);
    setScreen("menu");
  }, []);

  const applyRaw = useCallback((raw: string, nextAnimation?: Exclude<TableAnimation, null>) => {
    const result = parseSnapshot(raw);
    setSnapshot(result.snapshot);
    if (result.error) setNotice(result.error);
    else {
      setNotice(null);
      if (nextAnimation) triggerAnimation(nextAnimation);
    }
    if (result.snapshot.status === "Won") setWildCardId(null);
  }, [triggerAnimation]);

  const runAiTurns = useCallback(async () => {
    if (aiBusy.current || !gameRef.current || !activeConfig) return;
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
        setSnapshot(result.snapshot);
        triggerAnimation("play");
        if (result.error) setNotice(result.error);
        if (result.snapshot.status === "Won" || result.snapshot.current_player === HUMAN_ID) break;
      }
    } finally {
      aiBusy.current = false;
    }
  }, [activeConfig, snapshot, triggerAnimation]);

  useEffect(() => {
    if (screen === "table" && snapshot && snapshot.current_player !== HUMAN_ID && snapshot.status === "Playing") void runAiTurns();
  }, [runAiTurns, screen, snapshot]);

  const human = snapshot?.players[HUMAN_ID];
  const currentPlayer = snapshot?.players[snapshot.current_player];
  const playableIds = useMemo(() => {
    if (!snapshot || snapshot.current_player !== HUMAN_ID || snapshot.pending_draw > 0) return new Set<number>();
    const top = snapshot.top_card;
    return new Set(human?.hand.filter((card) => card.color === "Wild" || card.color === snapshot.active_color || card.kind === top.kind).map((card) => card.id) ?? []);
  }, [human, snapshot]);

  function handlePlay(card: Card) {
    if (!game || !snapshot || snapshot.current_player !== HUMAN_ID || !playableIds.has(card.id)) return;
    if (card.color === "Wild") {
      setWildCardId(card.id);
      return;
    }
    applyRaw(game.play_card(card.id, ""), "play");
  }

  function handleWildColor(color: Color) {
    if (!game || wildCardId === null) return;
    applyRaw(game.play_card(wildCardId, color.toLowerCase()), "play");
    setWildCardId(null);
  }

  function handleDraw() {
    if (!game || !snapshot || snapshot.current_player !== HUMAN_ID) return;
    applyRaw(game.draw(), "draw");
  }

  function handleUno() {
    if (!game || !snapshot || human?.hand_count !== 1) return;
    applyRaw(game.call_uno());
  }

  if (loading) {
    return <div className="loading-screen"><div className="loading-mark">UNO<small>2026</small></div><p>{text.loading}</p></div>;
  }

  if (screen === "menu") {
    return (
      <>
        <MainMenuScreen language={language} onLanguageChange={setLanguage} onStart={() => void startGame(setupConfig)} onOpenSettings={() => setSettingsOpen(true)} onOpenAbout={() => setAboutOpen(true)} error={wasmError} />
        <SettingsDrawer initialConfig={setupConfig} language={language} open={settingsOpen} onClose={() => setSettingsOpen(false)} onApply={(config) => { setSetupConfig(config); setSettingsOpen(false); }} onLanguageChange={setLanguage} />
        <AboutPanel language={language} open={aboutOpen} onClose={() => setAboutOpen(false)} />
      </>
    );
  }

  if (!snapshot || !game || !activeConfig) return null;
  const discardCards = snapshot.discard_cards?.length ? snapshot.discard_cards : [snapshot.top_card];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark">UNO<small>2026</small></div><div className="brand-divider" /><div className="brand-context"><span>{text.offlineTable}</span><small>{text.rustRuntime}</small></div></div>
        <div className="table-mode"><span className="mode-live-dot" />{text.offline}<span className="mode-lock">· {text.online} {text.locked}</span></div>
        <div className="top-actions"><div className="table-profile"><span>{text.aiProfile}</span><strong>{profileLabel(language, activeConfig.profile)}</strong><small>{text.seats(snapshot.players.length)} · {text.basePause(activeConfig.defaultPauseSeconds)}</small></div><button className="language-toggle" type="button" onClick={() => setLanguage(language === "zh" ? "en" : "zh")} aria-label={language === "zh" ? text.switchToEnglish : text.switchToChinese}>{language === "zh" ? "EN" : "中文"}</button><button className="icon-button" onClick={openMenu} aria-label={language === "zh" ? "返回主菜单" : "Return to main menu"} type="button">×</button></div>
      </header>

      <main className="game-layout">
        <section className="table-column">
          <div className="table-heading"><div><p className="eyebrow">{text.match} / 001 · {text.seats(snapshot.players.length)}</p><h1>{text.makeYourMove}</h1></div><div className="round-meta"><span>{text.turn} {String(snapshot.turn_number).padStart(2, "0")}</span><span className="direction-mark">{snapshot.direction === 1 ? "↻" : "↺"}</span></div></div>
          <div className="felt-table table-scene" data-animation={animation ?? undefined}>
            <div className="table-grid-lines" />
            <div className="table-scene-badge"><span className="live-pip" />{snapshot.status === "Won" ? text.tableComplete : currentPlayer?.name === "You" ? text.yourMove : text.thinking(currentPlayer?.name ?? "AI")}</div>
            <div className="table-seats">
              {snapshot.players.slice(1).map((player, index) => <SeatPlayer key={player.id} player={player} language={language} active={player.id === snapshot.current_player} slot={SEAT_LAYOUTS[snapshot.players.length]?.[index] ?? `seat-${index}`} />)}
              {human && <SeatPlayer player={human} language={language} active={human.id === snapshot.current_player} slot="south" human />}
            </div>
            <div className="table-center">
              <div className="piles">
                <BackStack count={snapshot.draw_count} language={language} onDraw={handleDraw} disabled={snapshot.current_player !== HUMAN_ID || aiBusy.current || snapshot.status === "Won"} />
                <div className="pile-separator" />
                <button className="discard-stack" onClick={() => setHistoryOpen(true)} aria-label={text.viewDiscardHistory} type="button"><span className="discard-shadow" /><CardArt card={snapshot.top_card} language={language} compact /></button>
              </div>
              <div className="active-color"><span className={`color-swatch swatch-${colorClass(snapshot.active_color)}`} />{text.activeColor} <strong>{translateColor(language, snapshot.active_color)}</strong></div>
            </div>
            <div className="table-scene-status"><span>{localizeEngineMessage(language, snapshot.message)}</span><span className="status-code">{snapshot.last_action}</span></div>
            <div className="table-scene-footnote"><span>{text.drawPile} {snapshot.draw_count}</span><span>{text.discard} {snapshot.discard_count}</span><span>{text.ruleset}</span></div>
          </div>
        </section>

        <section className="hand-column">
          <div className="hand-heading"><div><p className="eyebrow">{language === "zh" ? "你的手牌" : "YOUR HAND"} / {String(human?.hand_count ?? 0).padStart(2, "0")}</p><h2>{human?.hand_count === 1 ? text.oneCardLeft : text.keepRhythm}</h2></div><div className="hand-actions"><button className="ghost-button" onClick={handleUno} disabled={human?.hand_count !== 1 || snapshot.status === "Won"} type="button">{text.callUno} <span>!</span></button><button className="primary-button" onClick={handleDraw} disabled={snapshot.current_player !== HUMAN_ID || snapshot.status === "Won"} type="button">{text.drawCard}</button></div></div>
          <div className="hand-rail hand-fan">{human?.hand.map((card, index) => <CardArt key={card.id} card={card} language={language} className="hand-card" style={{ "--hand-index": index, "--hand-total": human.hand.length } as CSSProperties} disabled={snapshot.current_player !== HUMAN_ID || !playableIds.has(card.id) || snapshot.status === "Won"} onClick={() => handlePlay(card)} />)}</div>
          <div className="hand-help"><span><kbd>{language === "zh" ? "点击" : "CLICK"}</kbd> {text.clickHint}</span><span><kbd>{language === "zh" ? "摸牌" : "DRAW"}</kbd> {text.drawHint}</span><span className="help-right">{notice ? <strong className="notice">{localizeEngineMessage(language, notice)}</strong> : text.playableHint}</span></div>
        </section>
      </main>

      <DiscardHistory cards={discardCards} language={language} open={historyOpen} onClose={() => setHistoryOpen(false)} />
      {wildCardId !== null && <div className="modal-scrim" role="presentation"><div className="color-modal" role="dialog" aria-modal="true" aria-labelledby="color-title"><p className="eyebrow">{text.wildCard}</p><h2 id="color-title">{text.chooseColor}</h2><p>{text.wildExplanation}</p><div className="color-options">{COLORS.map((color) => <button key={color.name} className={`color-option color-option-${color.className}`} onClick={() => handleWildColor(color.name)} type="button"><span className={`color-swatch swatch-${color.className}`} />{translateColor(language, color.name)}</button>)}</div><button className="cancel-button" onClick={() => setWildCardId(null)} type="button">{text.cancel}</button></div></div>}
    </div>
  );
}
