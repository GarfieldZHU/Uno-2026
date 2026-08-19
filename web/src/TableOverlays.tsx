import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { CardArt } from "./CardArt";
import { copy, type Language } from "./i18n";
import type { Card, Player } from "./types";

export type TablePhase = "dealing" | "starting" | null;

type DealProps = {
  phase: Exclude<TablePhase, null>;
  language: Language;
  players: Player[];
  humanId: number;
  humanCards: Card[];
  startingPlayer?: Player;
  onHumanCountChange?: (count: number) => void;
};

type DealAnchor = { x: number; y: number; width: number; height: number; rotate: number };
type DealCard = { key: string; playerId: number; card?: Card; target: DealAnchor; delay: number; humanIndex: number | null };
type DealLayout = { source: DealAnchor; copy: { x: number; y: number }; progress: { x: number; y: number }; cards: DealCard[] };

const DEAL_ANIMATION_MS = 3_800;

function rotationFromTransform(transform: string) {
  const match = transform.match(/matrix\(([^)]+)\)/);
  if (!match) return 0;
  const [a, b] = match[1].split(",").map(Number);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.atan2(b, a) * (180 / Math.PI) : 0;
}

function anchorFromElement(element: HTMLElement | null, layerRect: DOMRect, fallback: DealAnchor): DealAnchor {
  if (!element) return fallback;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return fallback;
  return {
    x: rect.left - layerRect.left + rect.width / 2,
    y: rect.top - layerRect.top + rect.height / 2,
    width: Math.max(1, element.offsetWidth || rect.width),
    height: Math.max(1, element.offsetHeight || rect.height),
    rotate: rotationFromTransform(window.getComputedStyle(element).transform),
  };
}

function fallbackTarget(layerRect: DOMRect, index: number, count: number): DealAnchor {
  const width = Math.min(96, Math.max(44, (layerRect.width - 48) / Math.max(1, count)));
  const left = Math.max(24, (layerRect.width - width * count) / 2 + width * index);
  return { x: left + width / 2, y: layerRect.height - 70, width, height: Math.min(135, width * 1.4), rotate: 0 };
}

export function DealSequenceOverlay({ phase, language, players, humanId, humanCards, startingPlayer, onHumanCountChange }: DealProps) {
  const text = copy(language);
  const dealing = phase === "dealing";
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<DealLayout | null>(null);
  const [revealedHumanCount, setRevealedHumanCount] = useState(0);

  const measureLayout = useCallback(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const layerRect = layer.getBoundingClientRect();
    const sourceElement = document.querySelector<HTMLElement>(".draw-stack");
    const source = anchorFromElement(sourceElement, layerRect, { x: layerRect.width / 2, y: layerRect.height / 2, width: 102, height: 142, rotate: -4 });
    const humanRail = document.querySelector<HTMLElement>(".hand-rail");
    const progressRect = humanRail?.getBoundingClientRect();
    const progress = progressRect
      ? { x: progressRect.left - layerRect.left + progressRect.width / 2, y: progressRect.top - layerRect.top - 13 }
      : { x: layerRect.width / 2, y: layerRect.height - 178 };
    const copy = { x: source.x, y: source.y + source.height / 2 + 46 };
    const humanElements = Array.from(document.querySelectorAll<HTMLElement>(".hand-rail .hand-card-slot .hand-card"));
    const humanTargets = humanCards.map((_, index) => anchorFromElement(humanElements[index] ?? null, layerRect, fallbackTarget(layerRect, index, humanCards.length)));
    const targetByPlayer = new Map<number, DealAnchor[]>();
    targetByPlayer.set(humanId, humanTargets);

    players.filter((player) => player.id !== humanId).forEach((player) => {
      const seat = document.querySelector<HTMLElement>(`.seat-player[data-player-id="${player.id}"]`);
      const fan = seat?.querySelector<HTMLElement>(".seat-card-fan") ?? null;
      const fanCards = Array.from(fan?.querySelectorAll<HTMLElement>("img") ?? []);
      const fanFallback = anchorFromElement(fan ?? seat ?? null, layerRect, { x: layerRect.width / 2, y: layerRect.height / 2, width: 29, height: 48, rotate: 0 });
      const visibleCount = Math.min(8, Math.max(0, player.hand_count));
      targetByPlayer.set(player.id, Array.from({ length: visibleCount }, (_, index) => anchorFromElement(fanCards[index] ?? null, layerRect, { ...fanFallback, rotate: (index - (visibleCount - 1) / 2) * 7 })));
    });

    const rounds = Math.max(1, ...players.map((player) => targetByPlayer.get(player.id)?.length ?? 0));
    const totalCards = players.reduce((count, player) => count + (targetByPlayer.get(player.id)?.length ?? 0), 0);
    const interval = totalCards > 1 ? Math.max(34, (DEAL_ANIMATION_MS - 680) / (totalCards - 1)) : 0;
    const cards: DealCard[] = [];
    let sequence = 0;
    let humanIndex = 0;
    for (let round = 0; round < rounds; round += 1) {
      for (const player of players) {
        const target = targetByPlayer.get(player.id)?.[round];
        if (!target) continue;
        cards.push({
          key: `${player.id}-${round}`,
          playerId: player.id,
          card: player.id === humanId ? humanCards[humanIndex] : undefined,
          target,
          delay: sequence * interval,
          humanIndex: player.id === humanId ? humanIndex++ : null,
        });
        sequence += 1;
      }
    }
    setLayout({ source, copy, progress, cards });
  }, [humanCards, humanId, players]);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(measureLayout);
    const table = document.querySelector<HTMLElement>(".game-layout");
    const observer = typeof ResizeObserver === "undefined" || !table ? null : new ResizeObserver(() => window.requestAnimationFrame(measureLayout));
    if (observer && table) observer.observe(table);
    window.addEventListener("resize", measureLayout);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measureLayout);
    };
  }, [measureLayout]);

  useEffect(() => {
    if (!layout) return;
    if (!dealing) {
      setRevealedHumanCount(humanCards.length);
      onHumanCountChange?.(humanCards.length);
      return;
    }
    setRevealedHumanCount(0);
    onHumanCountChange?.(0);
    const timers = layout.cards.filter((card) => card.humanIndex !== null).map((card) => window.setTimeout(() => {
      const next = (card.humanIndex ?? 0) + 1;
      setRevealedHumanCount(next);
      onHumanCountChange?.(next);
    }, card.delay + 460));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [dealing, humanCards.length, layout, onHumanCountChange]);

  const humanCount = dealing ? revealedHumanCount : humanCards.length;
  const source = layout?.source;
  return (
    <div ref={layerRef} className={`deal-sequence-layer ${dealing ? "is-dealing" : "is-starting"}`} data-testid="initial-deal" data-phase={phase} data-human-count={humanCount} role="status" aria-live="polite">
      <div className="deal-sequence-vignette" />
      <div className="deal-sequence-stack" aria-hidden="true">
        {source && <span className="deal-source-stack" style={{ left: `${source.x}px`, top: `${source.y}px`, width: `${source.width}px`, height: `${source.height}px` } as CSSProperties}><span className="deal-source-offset deal-source-offset-one" /><span className="deal-source-offset deal-source-offset-two" /><img className="deal-source-card" src="/assets/cards/reference/card-back.svg" alt="" /></span>}
        {layout?.cards.map((dealCard) => {
          const sourceScale = Math.max(1, source ? Math.max(source.width / dealCard.target.width, source.height / dealCard.target.height) : 1);
          return <span key={dealCard.key} className={`deal-sequence-card ${dealCard.playerId === humanId ? "is-human" : "is-opponent"} ${!dealing && dealCard.playerId === humanId ? "is-face-up" : ""}`} style={{ left: `${source?.x ?? 0}px`, top: `${source?.y ?? 0}px`, width: `${dealCard.target.width}px`, height: `${dealCard.target.height}px`, "--deal-dx": `${dealCard.target.x - (source?.x ?? 0)}px`, "--deal-dy": `${dealCard.target.y - (source?.y ?? 0)}px`, "--deal-source-scale": sourceScale, "--deal-target-rotate": `${dealCard.target.rotate}deg`, "--deal-delay": `${dealCard.delay}ms`, "--deal-human-index": dealCard.humanIndex ?? 0 } as CSSProperties}>
            <img className="deal-sequence-card-back" src="/assets/cards/reference/card-back.svg" alt="" />
            {dealCard.playerId === humanId && dealCard.card && <span className="deal-sequence-card-face"><CardArt card={dealCard.card} language={language} /></span>}
          </span>;
        })}
      </div>
      {layout && <div className="deal-human-progress" data-testid="deal-human-progress" style={{ left: `${layout.progress.x}px`, top: `${layout.progress.y}px` } as CSSProperties}><span>{language === "zh" ? "你的手牌" : "YOUR HAND"}</span><strong>{humanCount}/{humanCards.length}</strong></div>}
      <div className="deal-sequence-copy" style={layout ? { left: `${layout.copy.x}px`, top: `${layout.copy.y}px` } as CSSProperties : undefined}>
        {dealing ? (
          <>
            <span className="deal-sequence-kicker">UNO · 1411</span>
            <strong>{language === "zh" ? "正在发牌" : "DEALING"}</strong>
            <small>{text.dealingDetail(players.length)}</small>
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
