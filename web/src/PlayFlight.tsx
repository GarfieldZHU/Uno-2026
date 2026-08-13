import { CardArt } from "./CardArt";
import type { Language } from "./i18n";
import type { PlayFlightEvent } from "./types";

type PlayFlightProps = {
  flight: PlayFlightEvent;
  language: Language;
};

export function PlayFlight({ flight, language }: PlayFlightProps) {
  const opponent = flight.source !== "human";
  return (
    <div
      className={`play-flight play-flight-${flight.source} ${opponent ? "is-opponent" : "is-human"}`}
      data-testid="play-flight"
      data-source={flight.source}
      data-player-id={flight.playerId}
      aria-hidden="true"
    >
      <span className="play-flight-trail" />
      <span className="play-flight-card">
        <span className="play-flight-face">
          <img className="play-flight-back" src="/assets/cards/reference/card-back.svg" alt="" />
          <span className="play-flight-front"><CardArt card={flight.card} language={language} compact /></span>
        </span>
      </span>
      <span className="play-flight-shadow" />
      <span className="play-flight-ripple" />
    </div>
  );
}
