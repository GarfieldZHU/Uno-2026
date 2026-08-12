import { useEffect, useMemo, useState } from "react";
import {
  AI_DELAY_MAX_SECONDS,
  AI_DELAY_MIN_SECONDS,
  DEFAULT_AI_DELAY_SECONDS,
  PLAYER_COUNTS,
  PROFILE_OPTIONS,
  type PlayerCount,
} from "./types";
import { copy, profileHint, profileLabel, type Language } from "./i18n";
import { SEAT_NAMES, type SetupConfig } from "./SetupScreen";

type SettingsDrawerProps = {
  initialConfig: SetupConfig;
  language: Language;
  open: boolean;
  onClose: () => void;
  onApply: (config: SetupConfig) => void;
  onLanguageChange: (language: Language) => void;
};

function makeSeatPauses(playerCount: PlayerCount, value = DEFAULT_AI_DELAY_SECONDS) {
  return Object.fromEntries(Array.from({ length: playerCount - 1 }, (_, index) => [index + 1, value])) as Record<number, number>;
}

function clampPause(value: number) {
  return Math.min(AI_DELAY_MAX_SECONDS, Math.max(AI_DELAY_MIN_SECONDS, value));
}

export function SettingsDrawer({ initialConfig, language, open, onClose, onApply, onLanguageChange }: SettingsDrawerProps) {
  const text = copy(language);
  const [playerCount, setPlayerCount] = useState<PlayerCount>(initialConfig.playerCount);
  const [profile, setProfile] = useState(initialConfig.profile);
  const [defaultPauseSeconds, setDefaultPauseSeconds] = useState(initialConfig.defaultPauseSeconds);
  const [seatPauses, setSeatPauses] = useState<Record<number, number>>(initialConfig.seatPauses);

  useEffect(() => {
    if (!open) return;
    setPlayerCount(initialConfig.playerCount);
    setProfile(initialConfig.profile);
    setDefaultPauseSeconds(initialConfig.defaultPauseSeconds);
    setSeatPauses(initialConfig.seatPauses);
  }, [initialConfig, open]);

  const visibleSeats = useMemo(() => Array.from({ length: playerCount }, (_, index) => ({ id: index, name: SEAT_NAMES[index] })), [playerCount]);

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

  function updateSeatPause(id: number, value: number) {
    setSeatPauses((current) => ({ ...current, [id]: clampPause(value) }));
  }

  function apply() {
    onApply({ playerCount, profile, defaultPauseSeconds, seatPauses });
  }

  return (
    <div className={`drawer-layer ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <button className="drawer-backdrop" type="button" onClick={onClose} aria-label={text.closeSettings} tabIndex={open ? 0 : -1} />
      <aside className="settings-drawer" data-testid="settings-drawer" aria-label={text.settings} aria-hidden={!open}>
        <div className="drawer-heading">
          <div><p className="eyebrow">{text.settingsEyebrow}</p><h2>{text.settingsTitle}</h2></div>
          <button className="drawer-close" type="button" onClick={onClose} aria-label={text.closeSettings}>×</button>
        </div>
        <p className="drawer-lede">{text.settingsLede}</p>

        <label className="setup-field">
          <span className="field-label">{text.players} <small>{text.youAiSeats}</small></span>
          <select aria-label={text.playerCountLabel} value={playerCount} onChange={(event) => updatePlayerCount(event.target.value)}>
            {PLAYER_COUNTS.map((count) => <option key={count} value={count}>{text.playerOption(count)}</option>)}
          </select>
        </label>

        <label className="setup-field">
          <span className="field-label">{text.aiProfile} <small>{text.appliesToEveryAi}</small></span>
          <select aria-label={text.aiProfileLabel} value={profile} onChange={(event) => setProfile(event.target.value)}>
            {PROFILE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{profileLabel(language, option.value)}</option>)}
          </select>
          <span className="field-hint">{profileHint(language, profile)}</span>
        </label>

        <div className="setup-field setup-range-field">
          <div className="field-label-row"><span className="field-label">{text.defaultAiPause} <small>{text.secondsBetweenMoves}</small></span><output>{defaultPauseSeconds}{language === "zh" ? " 秒" : "s"}</output></div>
          <input aria-label={text.defaultAiPauseLabel} type="range" min={AI_DELAY_MIN_SECONDS} max={AI_DELAY_MAX_SECONDS} value={defaultPauseSeconds} onChange={(event) => setDefaultPauseSeconds(clampPause(Number(event.target.value)))} />
          <div className="range-scale"><span>{AI_DELAY_MIN_SECONDS}s</span><span>{AI_DELAY_MAX_SECONDS}s</span></div>
        </div>

        <div className="seat-settings">
          <div className="seat-settings-heading"><span className="field-label">{text.seatRhythm} <small>{text.individualOverrides}</small></span><button className="text-button" type="button" onClick={() => setSeatPauses(makeSeatPauses(playerCount, defaultPauseSeconds))}>{text.setAllTo(defaultPauseSeconds)}</button></div>
          <div className="seat-list">
            {visibleSeats.map((seat) => seat.id === 0 ? (
              <div className="seat-setting seat-setting-human" key={seat.id}><span className="seat-avatar seat-avatar-human">Y</span><div><strong>{seat.name}</strong><small>{text.youHuman}</small></div><span className="seat-ready">{text.ready}</span></div>
            ) : (
              <label className="seat-setting" key={seat.id}>
                <span className={`seat-avatar seat-avatar-${seat.id}`}>{seat.name.slice(0, 1)}</span>
                <span className="seat-setting-copy"><strong>{seat.name}</strong><small>{text.aiPause(seatPauses[seat.id] ?? defaultPauseSeconds)}</small></span>
                <input data-testid={`pause-${seat.name}`} aria-label={`${seat.name} ${language === "zh" ? "AI 停顿" : "AI pause"}`} type="range" min={AI_DELAY_MIN_SECONDS} max={AI_DELAY_MAX_SECONDS} value={seatPauses[seat.id] ?? defaultPauseSeconds} onChange={(event) => updateSeatPause(seat.id, Number(event.target.value))} />
                <output>{seatPauses[seat.id] ?? defaultPauseSeconds}{language === "zh" ? " 秒" : "s"}</output>
              </label>
            ))}
          </div>
        </div>

        <div className="drawer-footer">
          <button className="language-toggle" type="button" onClick={() => onLanguageChange(language === "zh" ? "en" : "zh")} aria-label={language === "zh" ? text.switchToEnglish : text.switchToChinese}>{language === "zh" ? "EN" : "中文"}</button>
          <div className="drawer-actions"><button className="cancel-button" type="button" onClick={onClose}>{text.cancel}</button><button className="primary-button" type="button" onClick={apply}>{text.saveSettings}</button></div>
        </div>
      </aside>
    </div>
  );
}
