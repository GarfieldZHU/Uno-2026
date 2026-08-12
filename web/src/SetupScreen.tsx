import { useMemo, useState, type FormEvent } from "react";
import {
  AI_DELAY_MAX_SECONDS,
  AI_DELAY_MIN_SECONDS,
  DEFAULT_AI_DELAY_SECONDS,
  PLAYER_COUNTS,
  PROFILE_OPTIONS,
  type PlayerCount,
} from "./types";

export const SEAT_NAMES = ["You", "Mika", "Nori", "Juno", "Kiki", "Olli", "Pika", "Rumi"] as const;

export type SetupConfig = {
  playerCount: PlayerCount;
  profile: string;
  defaultPauseSeconds: number;
  seatPauses: Record<number, number>;
};

function makeSeatPauses(playerCount: PlayerCount, value = DEFAULT_AI_DELAY_SECONDS) {
  return Object.fromEntries(
    Array.from({ length: playerCount - 1 }, (_, index) => [index + 1, value]),
  ) as Record<number, number>;
}

export function createDefaultSetup(): SetupConfig {
  return {
    playerCount: 4,
    profile: PROFILE_OPTIONS[1].value,
    defaultPauseSeconds: DEFAULT_AI_DELAY_SECONDS,
    seatPauses: makeSeatPauses(4),
  };
}

function clampPause(value: number) {
  return Math.min(AI_DELAY_MAX_SECONDS, Math.max(AI_DELAY_MIN_SECONDS, value));
}

type SetupScreenProps = {
  initialConfig: SetupConfig;
  onStart: (config: SetupConfig) => void;
  error?: string | null;
};

export function SetupScreen({ initialConfig, onStart, error }: SetupScreenProps) {
  const [playerCount, setPlayerCount] = useState<PlayerCount>(initialConfig.playerCount);
  const [profile, setProfile] = useState(initialConfig.profile);
  const [defaultPauseSeconds, setDefaultPauseSeconds] = useState(initialConfig.defaultPauseSeconds);
  const [seatPauses, setSeatPauses] = useState<Record<number, number>>(initialConfig.seatPauses);

  const visibleSeats = useMemo(
    () => Array.from({ length: playerCount }, (_, index) => ({ id: index, name: SEAT_NAMES[index] })),
    [playerCount],
  );

  function updatePlayerCount(value: string) {
    const nextCount = Number(value) as PlayerCount;
    setPlayerCount(nextCount);
    setSeatPauses((current) => {
      const next = makeSeatPauses(nextCount, defaultPauseSeconds);
      for (const id of Object.keys(next)) {
        const numericId = Number(id);
        if (current[numericId] !== undefined) next[numericId] = current[numericId];
      }
      return next;
    });
  }

  function updateDefaultPause(value: number) {
    const nextPause = clampPause(value);
    setDefaultPauseSeconds(nextPause);
  }

  function setAllPauses() {
    setSeatPauses(makeSeatPauses(playerCount, defaultPauseSeconds));
  }

  function updateSeatPause(id: number, value: number) {
    setSeatPauses((current) => ({ ...current, [id]: clampPause(value) }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onStart({ playerCount, profile, defaultPauseSeconds, seatPauses });
  }

  return (
    <div className="setup-shell" data-testid="setup-screen">
      <header className="setup-topbar">
        <div className="brand-lockup">
          <div className="brand-mark">UNO<small>2026</small></div>
          <div className="brand-divider" />
          <div className="brand-context"><span>OFFLINE TABLE</span><small>A quiet table for loud plays</small></div>
        </div>
        <div className="mode-switch" aria-label="Game mode">
          <button className="mode-button is-selected" type="button">OFFLINE <span className="mode-live-dot" /></button>
          <button className="mode-button" type="button" disabled>ONLINE <span className="mode-lock">LOCKED</span></button>
        </div>
      </header>

      <main className="setup-layout">
        <section className="setup-intro">
          <p className="eyebrow">TABLE SETUP / 1411</p>
          <h1>Deal a table<br /><em>worth remembering.</em></h1>
          <p className="setup-lede">A local UNO table powered by the Rust engine. Choose the room size, tune the rhythm, and keep every move on your machine.</p>
          <div className="setup-legend" aria-label="Offline table promises">
            <span><i className="legend-dot legend-dot-cyan" />DETERMINISTIC CORE</span>
            <span><i className="legend-dot legend-dot-amber" />NO NETWORK REQUIRED</span>
          </div>
        </section>

        <form className="setup-card" onSubmit={handleSubmit}>
          <div className="setup-card-heading">
            <div><p className="eyebrow">STARTING LINEUP</p><h2>Set the table.</h2></div>
            <span className="setup-card-mark">01</span>
          </div>

          <label className="setup-field">
            <span className="field-label">PLAYERS <small>YOU + AI SEATS</small></span>
            <select aria-label="Player count" value={playerCount} onChange={(event) => updatePlayerCount(event.target.value)}>
              {PLAYER_COUNTS.map((count) => <option key={count} value={count}>{count} players</option>)}
            </select>
          </label>

          <label className="setup-field">
            <span className="field-label">AI PROFILE <small>APPLIES TO EVERY AI SEAT</small></span>
            <select aria-label="AI profile" value={profile} onChange={(event) => setProfile(event.target.value)}>
              {PROFILE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <span className="field-hint">{PROFILE_OPTIONS.find((option) => option.value === profile)?.hint}</span>
          </label>

          <div className="setup-field setup-range-field">
            <div className="field-label-row"><span className="field-label">DEFAULT AI PAUSE <small>SECONDS BETWEEN MOVES</small></span><output>{defaultPauseSeconds}s</output></div>
            <input aria-label="Default AI pause" type="range" min={AI_DELAY_MIN_SECONDS} max={AI_DELAY_MAX_SECONDS} value={defaultPauseSeconds} onChange={(event) => updateDefaultPause(Number(event.target.value))} />
            <div className="range-scale"><span>{AI_DELAY_MIN_SECONDS}s</span><span>{AI_DELAY_MAX_SECONDS}s</span></div>
          </div>

          <div className="seat-settings">
            <div className="seat-settings-heading"><span className="field-label">SEAT RHYTHM <small>INDIVIDUAL OVERRIDES</small></span><button className="text-button" type="button" onClick={setAllPauses}>SET ALL TO {defaultPauseSeconds}S</button></div>
            <div className="seat-list">
              {visibleSeats.map((seat) => seat.id === 0 ? (
                <div className="seat-setting seat-setting-human" key={seat.id}><span className="seat-avatar seat-avatar-human">Y</span><div><strong>{seat.name}</strong><small>YOU / HUMAN</small></div><span className="seat-ready">READY</span></div>
              ) : (
                <label className="seat-setting" key={seat.id}>
                  <span className={`seat-avatar seat-avatar-${seat.id}`}>{seat.name.slice(0, 1)}</span>
                  <span className="seat-setting-copy"><strong>{seat.name}</strong><small>AI / {seatPauses[seat.id] ?? defaultPauseSeconds}s pause</small></span>
                  <input data-testid={`pause-${seat.name}`} aria-label={`${seat.name} pause`} type="range" min={AI_DELAY_MIN_SECONDS} max={AI_DELAY_MAX_SECONDS} value={seatPauses[seat.id] ?? defaultPauseSeconds} onChange={(event) => updateSeatPause(seat.id, Number(event.target.value))} />
                  <output>{seatPauses[seat.id] ?? defaultPauseSeconds}s</output>
                </label>
              ))}
            </div>
          </div>

          <button className="primary-button setup-start-button" type="submit">START OFFLINE TABLE <span>→</span></button>
          {error && <p className="setup-error" role="alert">{error}</p>}
          <p className="setup-footnote"><span className="live-pip" />Rust / WASM stays local. Online rooms are still locked.</p>
        </form>
      </main>
    </div>
  );
}
