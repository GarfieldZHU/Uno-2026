import { copy, type Language } from "./i18n";

type AboutPanelProps = {
  language: Language;
  open: boolean;
  onClose: () => void;
};

export function AboutPanel({ language, open, onClose }: AboutPanelProps) {
  const text = copy(language);
  return (
    <div className={`about-layer ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <button className="drawer-backdrop" type="button" onClick={onClose} aria-label={text.closeAbout} tabIndex={open ? 0 : -1} />
      <section className="about-panel" data-testid="about-panel" role="dialog" aria-modal="true" aria-labelledby="about-title" aria-hidden={!open}>
        <button className="drawer-close" type="button" onClick={onClose} aria-label={text.closeAbout}>×</button>
        <img className="about-wordmark" src="/assets/cards/uno-title.svg" alt="UNO" />
        <p className="eyebrow">{text.aboutEyebrow}</p>
        <h2 id="about-title">{text.aboutTitle}</h2>
        <p className="about-copy">{text.aboutBody}</p>
        <a className="about-link" href="https://github.com/1411-duliu/Uno" target="_blank" rel="noreferrer">{text.memorialLink}<span>↗</span></a>
        <div className="about-status"><span className="status-led" />{text.aboutStatus}</div>
      </section>
    </div>
  );
}
