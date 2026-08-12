import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SetupScreen, createDefaultSetup, type SetupConfig } from "./SetupScreen";
import { createWasmGame, type WasmGame } from "./wasm";
import { COLORS, PROFILE_OPTIONS, type Card, type Color, type Snapshot } from "./types";

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

function cardIcon(card: Card) {
  if (card.kind.startsWith("number-")) return card.label;
  if (card.kind === "skip") return "⊘";
  if (card.kind === "reverse") return "↻";
  if (card.kind === "draw-two") return "+2";
  if (card.kind === "wild-draw-four") return "+4";
  return "✦";
}

function CardView({ card, disabled, onClick, compact = false }: { card: Card; disabled?: boolean; onClick?: () => void; compact?: boolean }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      className={`playing-card card-${colorClass(card.color)} ${card.kind.startsWith("number-") ? "card-number" : "card-action"} ${compact ? "card-compact" : ""}`}
      disabled={disabled}
      onClick={onClick}
      aria-label={`${card.label} ${card.color} card`}
      type={onClick ? "button" : undefined}
    >
      <span className="card-corner card-corner-top">{card.label}</span>
      <span className="card-glyph">{cardIcon(card)}</span>
      <span className="card-corner card-corner-bottom">{card.label}</span>
    </Tag>
  );
}

function BackStack({ count, onDraw, disabled }: { count: number; onDraw: () => void; disabled: boolean }) {
  return (
    <button className="draw-stack" onClick={onDraw} disabled={disabled} aria-label="Draw from the deck" type="button">
      <span className="stack-offset stack-offset-one" />
      <span className="stack-offset stack-offset-two" />
      <span className="card-back">
        <span className="back-logo">UNO<small>2026</small></span>
      </span>
      <span className="pile-count">{count}</span>
    </button>
  );
}

function PlayerChip({ player, active }: { player: Snapshot["players"][number]; active: boolean }) {
  return (
    <div className={`player-chip player-${player.id} ${active ? "is-active" : ""}`}>
      <div className="avatar">{player.name.slice(0, 1)}</div>
      <div className="player-copy">
        <span className="player-name">{player.name}</span>
        <span className="player-hand-count">{player.hand_count} cards {player.uno_called ? "· UNO" : ""}</span>
      </div>
      {active && <span className="turn-dot" aria-label="current turn" />}
    </div>
  );
}

export function App() {
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
    return <div className="loading-screen"><div className="loading-mark">UNO<small>2026</small></div><p>Shuffling the Rust table…</p></div>;
  }

  if (screen === "setup" || !snapshot || !game || !activeConfig) {
    return <SetupScreen initialConfig={setupConfig} onStart={(config) => void startGame(config)} error={wasmError} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">UNO<small>2026</small></div>
          <div className="brand-divider" />
          <div className="brand-context"><span>OFFLINE TABLE</span><small>Rust core · WASM runtime</small></div>
        </div>
        <div className="mode-switch" aria-label="Game mode">
          <button className="mode-button is-selected" type="button">OFFLINE <span className="mode-live-dot" /></button>
          <button className="mode-button" type="button" disabled>ONLINE <span className="mode-lock">LOCKED</span></button>
        </div>
        <div className="top-actions">
          <div className="table-profile"><span>AI PROFILE</span><strong>{PROFILE_OPTIONS.find((option) => option.value === activeConfig.profile)?.label}</strong><small>{snapshot.players.length} SEATS · {activeConfig.defaultPauseSeconds}s BASE PAUSE</small></div>
          <button className="icon-button" onClick={openSetup} aria-label="Set up a new table" type="button">↻</button>
        </div>
      </header>

      <main className="game-layout">
        <section className="table-column">
          <div className="table-heading"><div><p className="eyebrow">MATCH / 001 · {snapshot.players.length} SEATS</p><h1>Make your move.</h1></div><div className="round-meta"><span>TURN {String(snapshot.turn_number).padStart(2, "0")}</span><span className="direction-mark">{snapshot.direction === 1 ? "↻" : "↺"}</span></div></div>
          <div className="felt-table">
            <div className="table-grid-lines" />
            <div className="opponent-row">{snapshot.players.slice(1).map((player) => <PlayerChip key={player.id} player={player} active={player.id === snapshot.current_player} />)}</div>
            <div className="table-center">
              <div className="center-label"><span className="live-pip" />{snapshot.status === "Won" ? "TABLE COMPLETE" : currentPlayer?.name === "You" ? "YOUR MOVE" : `${currentPlayer?.name.toUpperCase()} IS THINKING`}</div>
              <div className="piles">
                <BackStack count={snapshot.draw_count} onDraw={handleDraw} disabled={snapshot.current_player !== HUMAN_ID || aiBusy.current || snapshot.status === "Won"} />
                <div className="pile-separator" />
                <div className="discard-stack"><span className="discard-shadow" /><CardView card={snapshot.top_card} compact /></div>
              </div>
              <div className="active-color"><span className={`color-swatch swatch-${colorClass(snapshot.active_color)}`} />ACTIVE COLOR <strong>{snapshot.active_color.toUpperCase()}</strong></div>
            </div>
            <div className="table-status"><span>{snapshot.message}</span><span className="status-code">{snapshot.last_action}</span></div>
            <div className="table-footnote"><span>DRAW PILE {snapshot.draw_count}</span><span>DISCARD {snapshot.discard_count}</span><span>RULESET / CLASSIC + UNO CALL</span></div>
          </div>
        </section>

        <aside className="side-column">
          <div className="panel panel-players"><div className="panel-title"><span>PLAYERS</span><span className="panel-count">{String(snapshot.players.length).padStart(2, "0")}</span></div><div className="player-list">{snapshot.players.map((player) => <div className={`player-row ${player.id === snapshot.current_player ? "is-active" : ""}`} key={player.id}><div className="mini-avatar">{player.name.slice(0, 1)}</div><div className="player-row-copy"><strong>{player.name}</strong><span>{player.id === 0 ? "YOU / HUMAN" : "AI / " + activeConfig.profile.replace("uno-2026-", "").replace("garfield1993-", "")}</span></div><span className="count-pill">{player.hand_count}</span></div>)}</div></div>
          <div className="panel panel-rules"><div className="panel-title"><span>TABLE SIGNAL</span><span className="signal-bars"><i /><i /><i /></span></div><div className="rule-line"><span>ENGINE</span><strong>RUST / WASM</strong></div><div className="rule-line"><span>NETWORK</span><strong className="muted">DISABLED</strong></div><div className="rule-line"><span>PROFILE</span><strong>{PROFILE_OPTIONS.find((option) => option.value === activeConfig.profile)?.hint}</strong></div><div className="panel-note">Online rooms stay closed while the transport layer is being hardened. Your offline match is fully local and deterministic.</div></div>
        </aside>

        <section className="hand-column">
          <div className="hand-heading"><div><p className="eyebrow">YOUR HAND / {String(human?.hand_count ?? 0).padStart(2, "0")}</p><h2>{human?.hand_count === 1 ? "One card left." : "Keep the rhythm."}</h2></div><div className="hand-actions"><button className="ghost-button" onClick={handleUno} disabled={human?.hand_count !== 1 || snapshot.status === "Won"} type="button">CALL UNO <span>!</span></button><button className="primary-button" onClick={handleDraw} disabled={snapshot.current_player !== HUMAN_ID || snapshot.status === "Won"} type="button">DRAW CARD</button></div></div>
          <div className="hand-rail">{human?.hand.map((card) => <CardView key={card.id} card={card} disabled={snapshot.current_player !== HUMAN_ID || !playableIds.has(card.id) || snapshot.status === "Won"} onClick={() => handlePlay(card)} />)}</div>
          <div className="hand-help"><span><kbd>CLICK</kbd> a lit card to play</span><span><kbd>DRAW</kbd> when no move is open</span><span className="help-right">{notice ? <strong className="notice">{notice}</strong> : "A playable card glows on the rail."}</span></div>
        </section>
      </main>

      {wildCardId !== null && <div className="modal-scrim" role="presentation"><div className="color-modal" role="dialog" aria-modal="true" aria-labelledby="color-title"><p className="eyebrow">WILD CARD</p><h2 id="color-title">Name the next color.</h2><p>The table will continue with your choice.</p><div className="color-options">{COLORS.map((color) => <button key={color.name} className={`color-option color-option-${color.className}`} onClick={() => handleWildColor(color.name)} type="button"><span className={`color-swatch swatch-${color.className}`} />{color.label}</button>)}</div><button className="cancel-button" onClick={() => setWildCardId(null)} type="button">Cancel</button></div></div>}
    </div>
  );
}
