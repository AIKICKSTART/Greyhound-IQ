import { normaliseRaceDateInput } from "@/lib/race-time";

export function resolveRaceSearchDate(
  value: string | null | undefined,
  searchQuery: string | null,
  defaultDate: string,
) {
  const explicitDate = normaliseRaceDateInput(value);
  return {
    selectedDate: explicitDate ?? defaultDate,
    dateInputValue: explicitDate ?? "",
    isGlobalSearch: Boolean(searchQuery && !explicitDate),
  };
}
