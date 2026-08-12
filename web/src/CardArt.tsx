import { useId } from "react";
import { translateCardLabel, translateColor, type Language } from "./i18n";
import type { Card } from "./types";

type CardArtProps = {
  card: Card;
  language: Language;
  compact?: boolean;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
};

function glyphFor(card: Card) {
  if (card.kind.startsWith("number-")) return card.label;
  if (card.kind === "skip") return "⊘";
  if (card.kind === "reverse") return "↻";
  if (card.kind === "draw-two") return "+2";
  if (card.kind === "wild-draw-four") return "+4";
  return "✦";
}
function paletteFor(card: Card) {
  if (card.color === "Red") return { base: "#e34f43", deep: "#a82834", ink: "#fff8e5" };
  if (card.color === "Yellow") return { base: "#f3c85d", deep: "#bd8427", ink: "#172421" };
  if (card.color === "Green") return { base: "#4fc796", deep: "#238061", ink: "#f5ffef" };
  if (card.color === "Blue") return { base: "#6da5ed", deep: "#3e5db6", ink: "#f4f7ff" };
  return { base: "#31426d", deep: "#121b42", ink: "#fff8e5" };
}

export function CardArt({ card, language, compact = false, className = "", disabled = false, onClick }: CardArtProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const palette = paletteFor(card);
  const label = translateCardLabel(language, card.label);
  const color = translateColor(language, card.color);
  const Tag = onClick ? "button" : "div";
  const classes = ["card-art", compact ? "card-art-compact" : "", card.color === "Wild" ? "card-art-wild" : `card-art-${card.color.toLowerCase()}`, className].filter(Boolean).join(" ");

  return (
    <Tag
      className={classes}
      type={onClick ? "button" : undefined}
      disabled={onClick ? disabled : undefined}
      onClick={onClick}
      aria-label={language === "zh" ? `${color}${label}牌` : `${label} ${color} card`}
    >
      <svg viewBox="0 0 200 280" role="img" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`card-bg-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor={palette.base} />
            <stop offset="1" stopColor={palette.deep} />
          </linearGradient>
          <filter id={`card-shadow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="5" floodColor="#081313" floodOpacity=".34" />
          </filter>
        </defs>
        <rect x="2" y="2" width="196" height="276" rx="20" fill="#fff8e5" filter={`url(#card-shadow-${id})`} />
        <rect x="9" y="9" width="182" height="262" rx="15" fill={card.color === "Wild" ? "#15233c" : `url(#card-bg-${id})`} />
        {card.color === "Wild" ? (
          <>
            <path d="M9 9h182v131H9z" fill="#e34f43" />
            <path d="M9 140h182v131H9z" fill="#4fc796" />
            <path d="M9 9h91v262H9z" fill="#f3c85d" opacity=".97" />
            <path d="M100 9h91v262h-91z" fill="#6da5ed" opacity=".96" />
            <path d="M9 140h182v131H9z" fill="#4fc796" opacity=".92" />
            <path d="M9 9h182v262H9z" fill="#17233d" opacity=".14" />
          </>
        ) : null}
        <path d="M26 66c37-32 74-38 145-6" fill="none" stroke="rgba(255,255,255,.34)" strokeWidth="2.5" />
        <path d="M174 214c-41 31-79 36-148 6" fill="none" stroke="rgba(255,255,255,.27)" strokeWidth="2.5" />
        <text x="25" y="40" fill={palette.ink} fontSize="19" fontWeight="900" fontFamily="system-ui, sans-serif">{label}</text>
        <text x="100" y="170" fill={palette.ink} fontSize={card.kind.startsWith("number-") ? "86" : "64"} fontWeight="950" textAnchor="middle" fontFamily="system-ui, sans-serif">{glyphFor(card)}</text>
        <text x="175" y="251" fill={palette.ink} fontSize="19" fontWeight="900" textAnchor="end" transform="rotate(180 175 251)" fontFamily="system-ui, sans-serif">{label}</text>
      </svg>
    </Tag>
  );
}
