import { useEffect, useState } from "react";
import { copy, translateCardLabel, translateColor, type Language } from "./i18n";
import { downloadGameRecord, type GameRecord, type GameRecordEvent } from "./gameRecord";

type Props = {
  language: Language;
  record: GameRecord;
  open: boolean;
  onToggle: () => void;
};

function actionLabel(event: GameRecordEvent, language: Language) {
  const actor = event.actorName ?? (language === "zh" ? "牌桌" : "Table");
  if (event.action === "play") {
    const card = `${translateColor(language, event.card?.color ?? event.topCard.color)} ${translateCardLabel(language, event.card?.label ?? event.topCard.label)}`;
    return language === "zh" ? `${actor} 打出 ${card}` : `${actor} played ${card}`;
  }
  if (event.action.startsWith("draw-")) return language === "zh" ? `${actor} 摸 ${event.action.slice(5)} 张牌` : `${actor} drew ${event.action.slice(5)} card(s)`;
  if (event.action === "call-uno") return language === "zh" ? `${actor} 喊 UNO` : `${actor} called UNO`;
  if (event.action === "uno-penalty") return language === "zh" ? `${actor} 未喊 UNO，接受惩罚` : `${actor} missed UNO and took the penalty`;
  if (event.action === "game-won") return language === "zh" ? `${actor} 赢得牌局` : `${actor} won the table`;
  return language === "zh" ? "牌局开始" : "Table ready";
}

function EventRow({ event, language, active }: { event: GameRecordEvent; language: Language; active: boolean }) {
  const color = translateColor(language, event.activeColor);
  const direction = event.direction === 1 ? (language === "zh" ? "顺时针" : "clockwise") : (language === "zh" ? "逆时针" : "counter-clockwise");
  return (
    <li className={`game-record-event ${active ? "is-replay-active" : ""}`} data-sequence={event.sequence}>
      <span className="game-record-sequence">{String(event.sequence).padStart(2, "0")}</span>
      <div>
        <strong>{actionLabel(event, language)}</strong>
        <small>{language === "zh" ? `当前颜色 ${color} · ${direction} · 当前手牌 ${Object.values(event.handCounts).join("/")} · 下家 ${event.nextPlayerName ?? "—"}` : `Color ${color} · ${direction} · hands ${Object.values(event.handCounts).join("/")} · next ${event.nextPlayerName ?? "—"}`}</small>
      </div>
    </li>
  );
}

export function GameRecordPanel({ language, record, open, onToggle }: Props) {
  const text = copy(language);
  const [exported, setExported] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!replaying) return;
    if (record.events.length === 0) {
      setReplaying(false);
      return;
    }
    let index = 0;
    setReplayIndex(0);
    const timer = window.setInterval(() => {
      index += 1;
      if (index >= record.events.length) {
        window.clearInterval(timer);
        setReplayIndex(record.events.length - 1);
        setReplaying(false);
      } else {
        setReplayIndex(index);
      }
    }, 650);
    return () => window.clearInterval(timer);
  }, [record.events.length, replaying]);

  return (
    <>
      <button className={`game-record-trigger ${open ? "is-open" : ""}`} data-testid="game-record-toggle" type="button" title={text.gameRecordHint} aria-label={text.gameRecord} aria-expanded={open} onClick={onToggle}>
        <span aria-hidden="true">◷</span>
        <span className="sr-only">{text.gameRecord}</span>
        {record.events.length > 0 && <b>{record.events.length}</b>}
      </button>
      {open && (
        <aside className="game-record-panel" data-testid="game-record-panel" aria-label={text.gameRecordTitle}>
          <div className="game-record-heading">
            <div><span className="eyebrow">{language === "zh" ? "局内记录" : "MATCH LOG"}</span><h2>{text.gameRecordTitle}</h2></div>
            <button type="button" className="game-record-close" onClick={onToggle} aria-label={text.closeRecord}>×</button>
          </div>
          <p className="game-record-summary">{record.events.length ? text.gameRecordSummary(record.events.length) : text.noGameRecord}</p>
          <div className="game-record-actions">
            <button type="button" className="ghost-button" data-testid="game-record-replay" disabled={record.events.length === 0} onClick={() => { setReplayIndex(null); setReplaying(true); }}>{replaying ? text.replaying : text.replayRecord}</button>
            <button type="button" className="primary-button" data-testid="game-record-export" disabled={record.events.length === 0} onClick={() => { downloadGameRecord(record); setExported(true); window.setTimeout(() => setExported(false), 2_400); }}>{exported ? text.recordExported : text.exportRecord}</button>
          </div>
          <ol className="game-record-list">
            {record.events.slice().reverse().map((event, index) => <EventRow key={event.id} event={event} language={language} active={replayIndex === record.events.length - 1 - index} />)}
          </ol>
        </aside>
      )}
    </>
  );
}

