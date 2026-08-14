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
  const cardCount = Math.min(8, Math.max(4, playerCount + 2));
  return (
    <div className={`deal-sequence-layer ${dealing ? "is-dealing" : "is-starting"}`} data-testid="initial-deal" data-phase={phase} role="status" aria-live="polite">
      <div className="deal-sequence-vignette" />
      <div className="deal-sequence-stack" aria-hidden="true">
        {Array.from({ length: cardCount }, (_, index) => (
          <img key={index} src="/assets/cards/reference/card-back.svg" alt="" style={{ "--deal-index": index } as CSSProperties} />
        ))}
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
};

export function SettlementOverlay({ language, winner, isWinner }: SettlementProps) {
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
      </div>
    </div>
  );
}
