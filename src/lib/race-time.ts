export const RACE_TIME_ZONE = "Australia/Sydney";

const datePartsFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: RACE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateTimePartsFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: RACE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const raceTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: RACE_TIME_ZONE,
});

const raceDayFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: RACE_TIME_ZONE,
});

const raceLongDayFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: RACE_TIME_ZONE,
});

const raceShortDayFormatter = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  timeZone: RACE_TIME_ZONE,
});

const raceDateTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: RACE_TIME_ZONE,
});

const raceDetailTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: RACE_TIME_ZONE,
});

type RaceDateParts = {
  year: number;
  month: number;
  day: number;
};

export function formatRaceTime(date: Date) {
  return raceTimeFormatter.format(date);
}

export function formatRaceDateTime(date: Date) {
  return raceDateTimeFormatter.format(date);
}

export function formatRaceDetailTime(date: Date) {
  return raceDetailTimeFormatter.format(date);
}

export function formatRaceDateInput(date: Date) {
  const parts = partsMap(datePartsFormatter, date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function orderRaceDates<T extends { date: string }>(
  dates: readonly T[],
  today: string,
) {
  return [...dates].sort((left, right) => {
    const leftIsPast = left.date < today;
    const rightIsPast = right.date < today;
    if (leftIsPast !== rightIsPast) return leftIsPast ? 1 : -1;
    return leftIsPast
      ? right.date.localeCompare(left.date)
      : left.date.localeCompare(right.date);
  });
}

export function formatRaceDayLabel(date: string) {
  return raceDayFormatter.format(raceDateForDisplay(date));
}

export function formatLongRaceDayLabel(date: Date) {
  return raceLongDayFormatter.format(date);
}

export function formatShortRaceDayLabel(date: string) {
  return raceShortDayFormatter.format(raceDateForDisplay(date));
}

export function normaliseRaceDateInput(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parts = parseRaceDateInput(value);
  if (!parts) return null;
  const parsed = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return parsed.toISOString().slice(0, 10) === value ? value : null;
}

export function raceDateWindow(date: string) {
  const parts = parseRaceDateInput(date);
  if (!parts) throw new Error("Invalid race date");
  const next = addRaceDateDays(parts, 1);

  return {
    gte: zonedTimeToUtc(parts),
    lt: zonedTimeToUtc(next),
  };
}

export function raceClockTimeWindow(date: string, hour: number, minute: number) {
  const parts = parseRaceDateInput(date);
  if (!parts) throw new Error("Invalid race date");
  const gte = zonedTimeToUtc({ ...parts, hour, minute });
  const lt = new Date(gte.getTime() + 60_000);
  return { gte, lt };
}

export function raceDateTimeToUtc(
  date: string,
  hour: number,
  minute: number,
  second = 0
) {
  const parts = parseRaceDateInput(date);
  if (!parts) throw new Error("Invalid race date");
  return zonedTimeToUtc({ ...parts, hour, minute, second });
}

function raceDateForDisplay(date: string) {
  const parts = parseRaceDateInput(date);
  if (!parts) throw new Error("Invalid race date");
  return zonedTimeToUtc({ ...parts, hour: 12 });
}

function parseRaceDateInput(value: string): RaceDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function addRaceDateDays(parts: RaceDateParts, days: number): RaceDateParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function zonedTimeToUtc({
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0,
}: RaceDateParts & { hour?: number; minute?: number; second?: number }) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = timeZoneOffsetMs(utcGuess);
  const firstPass = new Date(utcGuess.getTime() - offset);
  const verifiedOffset = timeZoneOffsetMs(firstPass);

  return verifiedOffset === offset
    ? firstPass
    : new Date(utcGuess.getTime() - verifiedOffset);
}

function timeZoneOffsetMs(date: Date) {
  const parts = partsMap(dateTimePartsFormatter, date);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - date.getTime();
}

function partsMap(formatter: Intl.DateTimeFormat, date: Date) {
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [
        part.type,
        part.type === "hour" && part.value === "24" ? "00" : part.value,
      ])
  ) as Record<string, string>;
}
