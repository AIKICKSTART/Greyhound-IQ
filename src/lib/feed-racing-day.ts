// Reads the JSON id array stored in Profile.racingDayTrackIds. Tolerates null,
// legacy junk, and non-string entries; always returns a clean, bounded id list.
export function parseRacingDayTrackIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const ids = parsed.filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return [...new Set(ids)].slice(0, 100);
}
