// Deterministic card-tier engine. Same stats → same tier, always (so a card is
// reproducible). Thresholds are first-pass defaults — tune per real AU racing
// benchmarks. Pure function, no I/O, unit-testable.

export type CardTier =
  | "elite_legend"
  | "champion"
  | "top_performer"
  | "winner"
  | "placegetter"
  | "prospect";

export type CardTierResult = {
  tier: CardTier;
  label: string;
  stars: number;
  accent: string; // hex
  badges: string[];
};

export type DogCardStats = {
  careerStarts: number | null;
  careerWins: number | null;
  winPercentage: number | null;
  prizeMoney: number | null;
  placings?: number | null; // 2nds+3rds if known
};

const GOLD = "#E1AB37";
const PURPLE = "#A127CE";
const SILVER = "#C8D0CD";
const BRONZE = "#B0702F";

export function computeCardTier(stats: DogCardStats): CardTierResult {
  const wins = stats.careerWins ?? 0;
  const starts = stats.careerStarts ?? 0;
  const prize = stats.prizeMoney ?? 0;
  const winPct = stats.winPercentage ?? (starts > 0 ? (wins / starts) * 100 : 0);
  const placings = stats.placings ?? 0;

  const badges: string[] = [];
  if (prize >= 100_000) badges.push("$100k+ earner");
  else if (prize >= 50_000) badges.push("$50k+ earner");
  else if (prize >= 20_000) badges.push("$20k+ earner");
  if (winPct >= 40) badges.push("40%+ strike");
  if (wins >= 10) badges.push(`${wins} wins`);

  if (prize >= 50_000 || wins >= 20) {
    return { tier: "elite_legend", label: "Elite Legend", stars: 5, accent: GOLD, badges };
  }
  if (prize >= 20_000 || wins >= 12) {
    return { tier: "champion", label: "Champion", stars: 4, accent: GOLD, badges };
  }
  if (wins >= 6 || winPct >= 40 || prize >= 8_000) {
    return { tier: "top_performer", label: "Top Performer", stars: 3, accent: PURPLE, badges };
  }
  if (wins >= 1) {
    return { tier: "winner", label: "Winner", stars: 2, accent: PURPLE, badges };
  }
  if (starts > 0 || placings > 0) {
    return { tier: "placegetter", label: "Placegetter", stars: 1, accent: SILVER, badges };
  }
  return { tier: "prospect", label: "Prospect", stars: 0, accent: BRONZE, badges };
}
