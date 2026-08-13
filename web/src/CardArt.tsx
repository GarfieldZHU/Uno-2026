import type { CSSProperties, DragEventHandler, PointerEventHandler } from "react";
import { translateCardLabel, translateColor, type Language } from "./i18n";
import type { Card } from "./types";

type CardArtProps = {
  card: Card;
  language: Language;
  compact?: boolean;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  draggable?: boolean;
  onDragStart?: DragEventHandler<HTMLElement>;
  onDragEnd?: DragEventHandler<HTMLElement>;
  onPointerDown?: PointerEventHandler<HTMLElement>;
  onPointerMove?: PointerEventHandler<HTMLElement>;
  onPointerUp?: PointerEventHandler<HTMLElement>;
  onPointerCancel?: PointerEventHandler<HTMLElement>;
};

/**
 * Reference card asset selected from the extracted UNO2D sprite sheet.
 * The SVGs retain the original high-resolution source image and therefore
 * stay crisp when used by the table flight animation or hand fan.
 */
export function cardAssetFor(card: Card) {
  if (card.color === "Wild") {
    return `/assets/cards/reference/${card.kind === "wild-draw-four" ? "wild-draw-four" : "wild"}.svg`;
  }
  const color = card.color.toLowerCase();
  if (card.kind === "skip") return `/assets/cards/reference/${color}-0.svg`;
  if (card.kind === "draw-two") return `/assets/cards/reference/${color}-draw-two.svg`;
  if (card.kind === "reverse") return `/assets/cards/reference/${color}-reverse.svg`;
  const number = card.kind.match(/^number-(\d+)$/)?.[1] ?? "0";
  return `/assets/cards/reference/${color}-${number === "0" ? "zero" : number}.svg`;
}

export function CardArt({
  card,
  language,
  compact = false,
  className = "",
  disabled = false,
  onClick,
  style,
  draggable = false,
  onDragStart,
  onDragEnd,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: CardArtProps) {
  const label = translateCardLabel(language, card.label);
  const color = translateColor(language, card.color);
  const Tag = onClick ? "button" : "div";
  const classes = [
    "card-art",
    compact ? "card-art-compact" : "",
    card.color === "Wild" ? "card-art-wild" : `card-art-${card.color.toLowerCase()}`,
    className,
  ].filter(Boolean).join(" ");
  const asset = cardAssetFor(card);

  return (
    <Tag
      className={classes}
      type={onClick ? "button" : undefined}
      disabled={onClick ? disabled : undefined}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={style}
      aria-label={language === "zh" ? `${color}${label}牌` : `${label} ${color} card`}
      data-card-asset={asset}
    >
      <img src={asset} alt="" draggable={false} />
    </Tag>
  );
}
