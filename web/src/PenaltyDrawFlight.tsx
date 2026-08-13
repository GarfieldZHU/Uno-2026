import type { CSSProperties } from "react";
import type { Language } from "./i18n";
import type { PlayFlightSource } from "./types";
import type { TableEffect } from "./tableEffects";

type PenaltyDrawFlightProps = {
  count: number;
  playerId: number;
  source: PlayFlightSource;
  language: Language;
};

export function PenaltyDrawFlight({ count, playerId, source, language }: PenaltyDrawFlightProps) {
  return (
    <div className={`penalty-draw-flight penalty-draw-${source}`} data-testid="penalty-draw-flight" data-player-id={playerId} data-count={count} aria-hidden="true">
      <span className="penalty-draw-cards">
        {Array.from({ length: Math.min(count, 8) }, (_, index) => <img key={index} src="/assets/cards/reference/card-back.svg" alt="" style={{ "--penalty-index": index } as CSSProperties} />)}
      </span>
      <strong>+{count}</strong>
      <span className="penalty-draw-label">{language === "zh" ? "罚牌" : "PENALTY"}</span>
    </div>
  );
}

export function ActionEffectOverlay({ effect, language }: { effect: Exclude<TableEffect, null>; language: Language }) {
  const labels = {
    "draw-two": language === "zh" ? "+2 连击" : "+2 CHAIN",
    "draw-four": language === "zh" ? "+4 压制" : "+4 WILD",
    skip: language === "zh" ? "跳过" : "SKIP",
    reverse: language === "zh" ? "反转" : "REVERSE",
    wild: language === "zh" ? "变色" : "WILD",
  } as const;
  return <div className={`action-effect-overlay effect-${effect}`} data-testid="action-effect" data-effect={effect} aria-hidden="true"><span>{labels[effect]}</span></div>;
}
