import type { CSSProperties } from "react";
import { copy, type Language } from "./i18n";
import type { Player } from "./types";

export type TablePhase = "dealing" | "starting" | null;

type DealProps = {
  phase: Exclude<TablePhase, null>;
  language: Language;
  playerCount: number;
  startingPlayer?: Player;
};

export function DealSequenceOverlay({ phase, language, playerCount, startingPlayer }: DealProps) {
  const text = copy(language);
  const dealing = phase === "dealing";
  // One visible pass around the table is enough to communicate the real deal
  // without holding the player in a loading state for the full seven-card
  // deal. The engine has already dealt the complete hands underneath.
  const cardCount = Math.min(24, Math.max(9, playerCount * 3));
  const targets = [
    ["0vw", "24vh", "0deg"],
    ["-28vw", "-15vh", "-12deg"],
    ["0vw", "-23vh", "0deg"],
    ["28vw", "-15vh", "12deg"],
    ["27vw", "14vh", "10deg"],
    ["-27vw", "14vh", "-10deg"],
    ["20vw", "-25vh", "9deg"],
    ["-20vw", "-25vh", "-9deg"],
  ];
  return (
    <div className={`deal-sequence-layer ${dealing ? "is-dealing" : "is-starting"}`} data-testid="initial-deal" data-phase={phase} role="status" aria-live="polite">
      <div className="deal-sequence-vignette" />
      <div className="deal-sequence-stack" aria-hidden="true">
        {Array.from({ length: cardCount }, (_, index) => {
          const [x, y, rotate] = targets[index % Math.min(playerCount, targets.length)];
          return <img key={index} src="/assets/cards/reference/card-back.svg" alt="" style={{ "--deal-index": index, "--deal-x": x, "--deal-y": y, "--deal-rotate": rotate, "--deal-delay": `${index * 115}ms` } as CSSProperties} />;
        })}
      </div>
      <div className="deal-sequence-copy">
        {dealing ? (
          <>
            <span className="deal-sequence-kicker">UNO · 1411</span>
            <strong>{language === "zh" ? "正在发牌" : "DEALING"}</strong>
            <small>{text.dealingDetail(playerCount)}</small>
            <span className="deal-sequence-dots" aria-hidden="true"><i /><i /><i /></span>
          </>
        ) : (
          <div className="starting-player-callout" data-testid="starting-player-callout">
            <span className="starting-player-kicker">{language === "zh" ? "开局玩家" : "STARTING PLAYER"}</span>
            <strong>{text.startingWith(startingPlayer?.name ?? (language === "zh" ? "你" : "YOU"))}</strong>
            <small>{text.playBegins}</small>
          </div>
        )}
      </div>
    </div>
  );
}

type SettlementProps = {
  language: Language;
  winner?: Player;
  isWinner: boolean;
  showActions: boolean;
  onPlayAgain: () => void;
  onExit: () => void;
};

export function SettlementOverlay({ language, winner, isWinner, showActions, onPlayAgain, onExit }: SettlementProps) {
  const text = copy(language);
  return (
    <div className="settlement-layer" data-testid="settlement-overlay" data-result={isWinner ? "win" : "lose"} role="dialog" aria-modal="true" aria-live="assertive">
      <div className="settlement-sparkles" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="settlement-panel">
        <span className="settlement-kicker">{text.tableComplete}</span>
        <div className="settlement-trophy" aria-hidden="true">🏆</div>
        <h2>{isWinner ? text.youWin : text.youLose}</h2>
        <p>{text.winnerSubtitle(winner?.name ?? (language === "zh" ? "获胜者" : "the winner"))}</p>
        <span className="settlement-result">{text.winnerLabel}</span>
        <strong className="settlement-winner">{winner?.name ?? (language === "zh" ? "未知玩家" : "Unknown player")}</strong>
        <div className={`settlement-actions ${showActions ? "is-visible" : ""}`} aria-hidden={!showActions}>
          <button className="primary-button" type="button" onClick={onPlayAgain} disabled={!showActions}>{text.playAgain}</button>
          <button className="ghost-button" type="button" onClick={onExit} disabled={!showActions}>{text.exitTable}</button>
        </div>
        {!showActions && <small className="settlement-actions-countdown">{text.settlementActionsHint}</small>}
      </div>
    </div>
  );
}

type TurnTransitionProps = {
  language: Language;
  kind: "reverse" | "skip";
  current?: Player;
  next?: Player;
};

export function TurnTransitionOverlay({ language, kind, current, next }: TurnTransitionProps) {
  const reverse = kind === "reverse";
  return (
    <div className={`turn-transition-overlay transition-${kind}`} data-testid="turn-transition" data-transition={kind} role="status" aria-live="polite">
      <span className="turn-transition-icon" aria-hidden="true">{reverse ? "↺" : "⤼"}</span>
      <strong>{reverse ? (language === "zh" ? "方向反转" : "DIRECTION REVERSED") : (language === "zh" ? "跳过一位" : "PLAYER SKIPPED")}</strong>
      <span>{current?.name ?? "—"} <b>→</b> {next?.name ?? "—"}</span>
    </div>
  );
}
