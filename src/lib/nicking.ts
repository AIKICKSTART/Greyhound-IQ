export type NickVerdict = "over" | "under" | "mixed";

/**
 * Compare a cross's winners-rate (strike) to each parent's overall progeny
 * winners-rate baseline. "over" when the cross beats both parents, "under" when
 * below both, "mixed" otherwise. Null when the cross strike or every baseline is
 * unavailable — never a fabricated verdict. Pure; used by the litter tables.
 */
export function nickVerdict(
  strike: number | null,
  sireBaseline: number | null,
  damBaseline: number | null,
): NickVerdict | null {
  if (strike === null) return null;
  const baselines = [sireBaseline, damBaseline].filter(
    (b): b is number => b !== null,
  );
  if (baselines.length === 0) return null;
  if (baselines.every((b) => strike > b)) return "over";
  if (baselines.every((b) => strike < b)) return "under";
  return "mixed";
}
