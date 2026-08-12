import { CardArt } from "./CardArt";
import { copy, type Language } from "./i18n";
import type { Card } from "./types";

type DiscardHistoryProps = {
  cards: Card[];
  language: Language;
  open: boolean;
  onClose: () => void;
};

export function DiscardHistory({ cards, language, open, onClose }: DiscardHistoryProps) {
  const text = copy(language);
  return (
    <div className={`history-layer ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <button className="drawer-backdrop" type="button" onClick={onClose} aria-label={text.closeDiscardHistory} tabIndex={open ? 0 : -1} />
      <section className="discard-history" data-testid="discard-history" role="dialog" aria-modal="true" aria-labelledby="discard-history-title" aria-hidden={!open}>
        <div className="history-heading">
          <div><p className="eyebrow">{language === "zh" ? "牌桌记录" : "TABLE LOG"}</p><h2 id="discard-history-title">{text.discardHistoryTitle}</h2></div>
          <button className="drawer-close" type="button" onClick={onClose} aria-label={text.closeDiscardHistory}>×</button>
        </div>
        <div className="history-rail">
          {cards.map((card, index) => (
            <div className={`history-item ${index === cards.length - 1 ? "is-latest" : ""}`} key={`${card.id}-${index}`}>
              <CardArt card={card} language={language} compact className="history-card" />
              {index === cards.length - 1 && <span className="history-latest">{text.latestCard}</span>}
            </div>
          ))}
        </div>
        <button className="history-close-button" type="button" onClick={onClose}>{text.closeDiscardHistory}</button>
      </section>
    </div>
  );
}
