const TRACK_NAME_ALIASES = new Map([
  ["meadows", "The Meadows"],
  ["meadows (mep)", "The Meadows"],
  ["sandown (sap)", "Sandown"],
  ["sandown park", "Sandown"],
]);

export function canonicalTrackName(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return TRACK_NAME_ALIASES.get(trackNameAliasKey(trimmed)) ?? trimmed;
}

export function trackNameAliasKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
