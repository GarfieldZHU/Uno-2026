import { CardArt } from "./CardArt";
import type { Language } from "./i18n";
import type { Card } from "./types";

type Props = {
  card: Card;
  language: Language;
  playerId: number;
};

/** A private draw reveal: back arrives first, then the new card flips face-up. */
export function DrawCardFlight({ card, language, playerId }: Props) {
  return (
    <div className="draw-card-flight" data-testid="draw-card-flight" data-player-id={playerId} aria-hidden="true">
      <span className="draw-card-flight-trail" />
      <span className="draw-card-flight-card">
        <span className="draw-card-flight-face">
          <img className="draw-card-flight-back" src="/assets/cards/reference/card-back.svg" alt="" />
          <span className="draw-card-flight-front"><CardArt card={card} language={language} compact /></span>
        </span>
      </span>
      <span className="draw-card-flight-shadow" />
    </div>
  );
}
