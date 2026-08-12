import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SetupScreen, createDefaultSetup, type SetupConfig } from "./SetupScreen";
import { createWasmGame, type WasmGame } from "./wasm";
import { COLORS, PROFILE_OPTIONS, type Card, type Color, type Snapshot } from "./types";
import { copy, localizeEngineMessage, profileHint, profileLabel, translateCardLabel, translateColor, type Language } from "./i18n";

const HUMAN_ID = 0;

function seedFromClock() {
  return Math.floor(Date.now() % 2_000_000_000);
}

function parseSnapshot(raw: string): { snapshot: Snapshot; error?: string } {
  const parsed = JSON.parse(raw) as Snapshot | { ok: false; error: string | null; snapshot: Snapshot };
  if ("ok" in parsed && parsed.ok === false) {
    return { snapshot: parsed.snapshot, error: parsed.error ?? "That move is not available." };
  }
  return { snapshot: parsed as Snapshot };
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function colorClass(color: Color) {
  return color.toLowerCase();
}

function cardIcon(card: Card, language: Language) {
  if (card.kind.startsWith("number-")) return card.label;
  if (card.kind === "skip") return "⊘";
  if (card.kind === "reverse") return "↻";
  if (card.kind === "draw-two") return "+2";
  if (card.kind === "wild-draw-four") return "+4";
  return language === "zh" ? "万" : "✦";
}

function CardView({ card, language, disabled, onClick, compact = false }: { card: Card; language: Language; disabled?: boolean; onClick?: () => void; compact?: boolean }) {
  const Tag = onClick ? "button" : "div";
  const label = translateCardLabel(language, card.label);
  const color = translateColor(language, card.color);
  return (
    <Tag
      className={`playing-card card-${colorClass(card.color)} ${card.kind.startsWith("number-") ? "card-number" : "card-action"} ${compact ? "card-compact" : ""}`}
      disabled={disabled}
      onClick={onClick}
      aria-label={language === "zh" ? `${color}${label}牌` : `${label} ${color} card`}
      type={onClick ? "button" : undefined}
    >
      <span className="card-corner card-corner-top">{label}</span>
      <span className="card-glyph">{cardIcon(card, language)}</span>
      <span className="card-corner card-corner-bottom">{label}</span>
    </Tag>
  );
}

function BackStack({ count, language, onDraw, disabled }: { count: number; language: Language; onDraw: () => void; disabled: boolean }) {
  return (
    <button className="draw-stack" onClick={onDraw} disabled={disabled} aria-label={language === "zh" ? "从摸牌堆摸牌" : "Draw from the deck"} type="button">
      <span className="stack-offset stack-offset-one" />
      <span className="stack-offset stack-offset-two" />
      <span className="card-back">
        <span className="back-logo">UNO<small>2026</small></span>
      </span>
      <span className="pile-count">{count}</span>
    </button>
  );
}

function PlayerChip({ player, language, active }: { player: Snapshot["players"][number]; language: Language; active: boolean }) {
  const text = copy(language);
  return (
    <div className={`player-chip player-${player.id} ${active ? "is-active" : ""}`}>
      <div className="avatar">{player.name.slice(0, 1)}</div>
      <div className="player-copy">
        <span className="player-name">{player.name}</span>
        <span className="player-hand-count">{text.cards(player.hand_count, player.uno_called)}</span>
      </div>
      {active && <span className="turn-dot" aria-label="current turn" />}
    </div>
  );
}

export function App() {
  const [language, setLanguage] = useState<Language>("zh");
  const [setupConfig, setSetupConfig] = useState<SetupConfig>(() => createDefaultSetup());
  const [activeConfig, setActiveConfig] = useState<SetupConfig | null>(null);
  const [screen, setScreen] = useState<"setup" | "table">("setup");
  const [game, setGame] = useState<WasmGame | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [wasmError, setWasmError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wildCardId, setWildCardId] = useState<number | null>(null);
  const aiBusy = useRef(false);
  const gameRef = useRef<WasmGame | null>(null);
  const runTokenRef = useRef(0);
  const text = copy(language);

  const startGame = useCallback(async (nextConfig: SetupConfig, nextSeed = seedFromClock()) => {
    const runToken = runTokenRef.current + 1;
    runTokenRef.current = runToken;
    aiBusy.current = false;
    setLoading(true);
    setWasmError(null);
    setNotice(null);
    setWildCardId(null);
    try {
      const nextGame = await createWasmGame(nextSeed, nextConfig.profile, nextConfig.playerCount);
      if (runToken !== runTokenRef.current) return;
      gameRef.current = nextGame;
      setGame(nextGame);
      setSnapshot(parseSnapshot(nextGame.snapshot()).snapshot);
      setActiveConfig(nextConfig);
      setSetupConfig(nextConfig);
      setScreen("table");
    } catch (error) {
      if (runToken === runTokenRef.current) {
        setWasmError(error instanceof Error ? error.message : "WASM table failed to load.");
        setScreen("setup");
      }
    } finally {
      if (runToken === runTokenRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => () => {
    runTokenRef.current += 1;
  }, []);

  const openSetup = useCallback(() => {
    runTokenRef.current += 1;
    aiBusy.current = false;
    gameRef.current = null;
    setGame(null);
    setSnapshot(null);
    setActiveConfig(null);
    setNotice(null);
    setWildCardId(null);
    setWasmError(null);
    setScreen("setup");
  }, []);

  const applyRaw = useCallback((raw: string) => {
    const result = parseSnapshot(raw);
    setSnapshot(result.snapshot);
    if (result.error) setNotice(result.error);
    else setNotice(null);
    if (result.snapshot.status === "Won") setWildCardId(null);
  }, []);

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
        if (result.error) setNotice(result.error);
        if (result.snapshot.status === "Won" || result.snapshot.current_player === HUMAN_ID) break;
      }
    } finally {
      aiBusy.current = false;
    }
  }, [activeConfig, snapshot]);

  useEffect(() => {
    if (screen === "table" && snapshot && snapshot.current_player !== HUMAN_ID && snapshot.status === "Playing") void runAiTurns();
  }, [runAiTurns, screen, snapshot]);

  const human = snapshot?.players[HUMAN_ID];
  const currentPlayer = snapshot?.players[snapshot.current_player];
  const playableIds = useMemo(() => {
    if (!snapshot || snapshot.current_player !== HUMAN_ID || snapshot.pending_draw > 0) return new Set<number>();
    const top = snapshot.top_card;
    return new Set(
      human?.hand
        .filter((card) => card.color === "Wild" || card.color === snapshot.active_color || card.kind === top.kind)
        .map((card) => card.id) ?? [],
    );
  }, [human, snapshot]);

  function handlePlay(card: Card) {
    if (!game || !snapshot || snapshot.current_player !== HUMAN_ID || !playableIds.has(card.id)) return;
    if (card.color === "Wild") {
      setWildCardId(card.id);
      return;
    }
    applyRaw(game.play_card(card.id, ""));
  }

  function handleWildColor(color: Color) {
    if (!game || wildCardId === null) return;
    applyRaw(game.play_card(wildCardId, color.toLowerCase()));
    setWildCardId(null);
  }

  function handleDraw() {
    if (!game || !snapshot || snapshot.current_player !== HUMAN_ID) return;
    applyRaw(game.draw());
  }

  function handleUno() {
    if (!game || !snapshot || human?.hand_count !== 1) return;
    applyRaw(game.call_uno());
  }

  if (loading) {
    return <div className="loading-screen"><div className="loading-mark">UNO<small>2026</small></div><p>{text.loading}</p></div>;
  }

  if (screen === "setup" || !snapshot || !game || !activeConfig) {
    return <SetupScreen initialConfig={setupConfig} onStart={(config) => void startGame(config)} error={wasmError} language={language} onLanguageChange={setLanguage} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">UNO<small>2026</small></div>
          <div className="brand-divider" />
          <div className="brand-context"><span>{text.offlineTable}</span><small>{text.rustRuntime}</small></div>
        </div>
        <div className="mode-switch" aria-label="Game mode">
          <button className="mode-button is-selected" type="button">{text.offline} <span className="mode-live-dot" /></button>
          <button className="mode-button" type="button" disabled>{text.online} <span className="mode-lock">{text.locked}</span></button>
          <button className="language-toggle" type="button" onClick={() => setLanguage(language === "zh" ? "en" : "zh")} aria-label={language === "zh" ? text.switchToEnglish : text.switchToChinese}>{language === "zh" ? "EN" : "中文"}</button>
        </div>
        <div className="top-actions">
          <div className="table-profile"><span>{text.aiProfile}</span><strong>{profileLabel(language, activeConfig.profile)}</strong><small>{text.seats(snapshot.players.length)} · {text.basePause(activeConfig.defaultPauseSeconds)}</small></div>
          <button className="icon-button" onClick={openSetup} aria-label={language === "zh" ? "重新设置牌桌" : "Set up a new table"} type="button">↻</button>
        </div>
      </header>

      <main className="game-layout">
        <section className="table-column">
          <div className="table-heading"><div><p className="eyebrow">{text.match} / 001 · {text.seats(snapshot.players.length)}</p><h1>{text.makeYourMove}</h1></div><div className="round-meta"><span>{text.turn} {String(snapshot.turn_number).padStart(2, "0")}</span><span className="direction-mark">{snapshot.direction === 1 ? "↻" : "↺"}</span></div></div>
          <div className="felt-table">
            <div className="table-grid-lines" />
            <div className="opponent-row">{snapshot.players.slice(1).map((player) => <PlayerChip key={player.id} player={player} language={language} active={player.id === snapshot.current_player} />)}</div>
            <div className="table-center">
              <div className="center-label"><span className="live-pip" />{snapshot.status === "Won" ? text.tableComplete : currentPlayer?.name === "You" ? text.yourMove : text.thinking(currentPlayer?.name ?? "AI")}</div>
              <div className="piles">
                <BackStack count={snapshot.draw_count} language={language} onDraw={handleDraw} disabled={snapshot.current_player !== HUMAN_ID || aiBusy.current || snapshot.status === "Won"} />
                <div className="pile-separator" />
                <div className="discard-stack"><span className="discard-shadow" /><CardView card={snapshot.top_card} language={language} compact /></div>
              </div>
              <div className="active-color"><span className={`color-swatch swatch-${colorClass(snapshot.active_color)}`} />{text.activeColor} <strong>{translateColor(language, snapshot.active_color)}</strong></div>
            </div>
            <div className="table-status"><span>{localizeEngineMessage(language, snapshot.message)}</span><span className="status-code">{snapshot.last_action}</span></div>
            <div className="table-footnote"><span>{text.drawPile} {snapshot.draw_count}</span><span>{text.discard} {snapshot.discard_count}</span><span>{text.ruleset}</span></div>
          </div>
        </section>

        <aside className="side-column">
          <div className="panel panel-players"><div className="panel-title"><span>{text.players}</span><span className="panel-count">{String(snapshot.players.length).padStart(2, "0")}</span></div><div className="player-list">{snapshot.players.map((player) => <div className={`player-row ${player.id === snapshot.current_player ? "is-active" : ""}`} key={player.id}><div className="mini-avatar">{player.name.slice(0, 1)}</div><div className="player-row-copy"><strong>{player.name}</strong><span>{player.id === 0 ? text.youHuman : `${text.ai} / ${profileLabel(language, activeConfig.profile)}`}</span></div><span className="count-pill">{player.hand_count}</span></div>)}</div></div>
          <div className="panel panel-rules"><div className="panel-title"><span>{text.tableSignal}</span><span className="signal-bars"><i /><i /><i /></span></div><div className="rule-line"><span>{text.engine}</span><strong>RUST / WASM</strong></div><div className="rule-line"><span>{text.network}</span><strong className="muted">{text.disabled}</strong></div><div className="rule-line"><span>{text.aiProfile}</span><strong>{profileHint(language, activeConfig.profile)}</strong></div><div className="panel-note">{text.onlineNote}</div></div>
        </aside>

        <section className="hand-column">
          <div className="hand-heading"><div><p className="eyebrow">{language === "zh" ? "你的手牌" : "YOUR HAND"} / {String(human?.hand_count ?? 0).padStart(2, "0")}</p><h2>{human?.hand_count === 1 ? text.oneCardLeft : text.keepRhythm}</h2></div><div className="hand-actions"><button className="ghost-button" onClick={handleUno} disabled={human?.hand_count !== 1 || snapshot.status === "Won"} type="button">{text.callUno} <span>!</span></button><button className="primary-button" onClick={handleDraw} disabled={snapshot.current_player !== HUMAN_ID || snapshot.status === "Won"} type="button">{text.drawCard}</button></div></div>
          <div className="hand-rail">{human?.hand.map((card) => <CardView key={card.id} card={card} language={language} disabled={snapshot.current_player !== HUMAN_ID || !playableIds.has(card.id) || snapshot.status === "Won"} onClick={() => handlePlay(card)} />)}</div>
          <div className="hand-help"><span><kbd>{language === "zh" ? "点击" : "CLICK"}</kbd> {text.clickHint}</span><span><kbd>{language === "zh" ? "摸牌" : "DRAW"}</kbd> {text.drawHint}</span><span className="help-right">{notice ? <strong className="notice">{localizeEngineMessage(language, notice)}</strong> : text.playableHint}</span></div>
        </section>
      </main>

      {wildCardId !== null && <div className="modal-scrim" role="presentation"><div className="color-modal" role="dialog" aria-modal="true" aria-labelledby="color-title"><p className="eyebrow">{text.wildCard}</p><h2 id="color-title">{text.chooseColor}</h2><p>{text.wildExplanation}</p><div className="color-options">{COLORS.map((color) => <button key={color.name} className={`color-option color-option-${color.className}`} onClick={() => handleWildColor(color.name)} type="button"><span className={`color-swatch swatch-${color.className}`} />{translateColor(language, color.name)}</button>)}</div><button className="cancel-button" onClick={() => setWildCardId(null)} type="button">{text.cancel}</button></div></div>}
    </div>
  );
}
