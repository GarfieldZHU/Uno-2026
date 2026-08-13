export type TableEffect = "draw-two" | "draw-four" | "skip" | "reverse" | "wild" | null;

export function effectForAction(lastAction: string): TableEffect {
  if (lastAction.includes("played-draw-two")) return "draw-two";
  if (lastAction.includes("played-wild-draw-four")) return "draw-four";
  if (lastAction.includes("played-skip")) return "skip";
  if (lastAction.includes("played-reverse")) return "reverse";
  if (lastAction.includes("played-wild")) return "wild";
  return null;
}

export function drawInfoForAction(lastAction: string): { playerId: number; count: number } | null {
  const draw = /^player-(\d+)-drew-(\d+)$/.exec(lastAction);
  if (draw) return { playerId: Number(draw[1]), count: Number(draw[2]) };
  const unoPenalty = /^player-(\d+)-uno-penalty$/.exec(lastAction);
  if (unoPenalty) return { playerId: Number(unoPenalty[1]), count: 2 };
  return null;
}
