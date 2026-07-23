export const RACE_METRIC_UNAVAILABLE_LABEL = "Not available" as const;

export type RaceMetricPresentation = {
  state: "measured" | "missing";
  text: string;
};

const countFormatter = new Intl.NumberFormat("en-AU");

export function formatRaceMetric(
  value: number | null | undefined,
): RaceMetricPresentation {
  if (value == null || !Number.isFinite(value)) {
    return { state: "missing", text: RACE_METRIC_UNAVAILABLE_LABEL };
  }
  return { state: "measured", text: countFormatter.format(value) };
}

export function formatRaceScheduleSummary({
  meetings,
  races,
}: {
  meetings: number | null | undefined;
  races: number | null | undefined;
}) {
  const meetingCount = formatRaceMetric(meetings);
  const raceCount = formatRaceMetric(races);
  if (meetingCount.state === "missing" || raceCount.state === "missing") {
    return "Meeting and race totals are not available for this schedule.";
  }
  return `${meetingCount.text} meetings / ${raceCount.text} races on this schedule.`;
}
