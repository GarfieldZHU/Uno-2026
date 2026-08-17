import { copy, type Language } from "./i18n";

type MainMenuScreenProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onStart: () => void;
  onOpenOnline: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  error?: string | null;
};

export function MainMenuScreen({ language, onLanguageChange, onStart, onOpenOnline, onOpenSettings, onOpenAbout, error }: MainMenuScreenProps) {
  const text = copy(language);
  const titleLines = text.menuTitle.split("\\n");

  return (
    <main className="main-menu" data-testid="main-menu">
      <div className="menu-hero-glow" />
      <header className="menu-topbar">
        <div className="menu-status"><span className="status-led" />{text.statusOffline}</div>
        <div className="menu-top-actions">
          <span className="menu-legacy-mark">1411</span>
          <button className="language-toggle" type="button" onClick={() => onLanguageChange(language === "zh" ? "en" : "zh")} aria-label={language === "zh" ? text.switchToEnglish : text.switchToChinese}>{language === "zh" ? "EN" : "中文"}</button>
        </div>
      </header>

      <section className="menu-stage" aria-labelledby="menu-title">
        <img className="menu-sparkle menu-sparkle-left" src="/assets/cards/sparkle.svg" alt="" />
        <div className="menu-wordmark" aria-label="UNO 2026">
          <span className="menu-card-logo" aria-hidden="true"><img src="/assets/cards/reference/card-back.svg" alt="" /></span>
          <img className="menu-wordmark-title" src="/assets/cards/uno-title.svg" alt="UNO" />
          <small>2026 · 1411</small>
        </div>
        <p className="menu-eyebrow">{text.menuEyebrow}</p>
        <h1 id="menu-title">{titleLines.map((line) => <span key={line}>{line}</span>)}</h1>
        <div className="menu-actions">
          <button className="menu-action menu-action-primary" type="button" onClick={onStart}><span>{text.startGame}</span><b>→</b></button>
          <button className="menu-action menu-action-online" type="button" onClick={onOpenOnline}><span>{text.online}</span><b>↗</b></button>
          <button className="menu-action" type="button" onClick={onOpenSettings}><span>{text.settings}</span><b>⌘</b></button>
          <button className="menu-action" type="button" onClick={onOpenAbout}><span>{text.about}</span><b>i</b></button>
        </div>
        {error && <p className="menu-error" role="alert">{error}</p>}
        <p className="menu-footnote"><span>{text.statusOnlineLocked}</span><i />{language === "zh" ? "离线牌局不需要登录" : "Offline play needs no account"}<i /><a className="menu-home-link" href="https://alohayo.me/" target="_blank" rel="noreferrer">alohayo.me ↗</a></p>
        <img className="menu-sparkle menu-sparkle-right" src="/assets/cards/sparkle.svg" alt="" />
      </section>
    </main>
  );
}
