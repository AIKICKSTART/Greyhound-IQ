/**
 * Pure filtering / distance / opening-hours logic for the Vet Finder.
 *
 * Ported from the standalone prototype (script.js): serviceFilters,
 * matchesServiceFilter, STATE_TIMEZONES, opening-hours parsing, haversine
 * distance and the filter+sort pipeline. No DOM, no React — safe to import
 * from client components and unit tests alike.
 */

import type { VetLocation } from "@/data/vet-locations";

export interface ServiceFilter {
  value: string;
  label: string;
  keywords: string[];
}

/** Service facets derived at runtime by keyword match against `services`. */
export const SERVICE_FILTERS: ServiceFilter[] = [
  {
    value: "greyhound-racing",
    label: "Specialist greyhound & racing care",
    keywords: ["greyhound", "on-track", "racing wa", "canine sports", "injury care"],
  },
  {
    value: "emergency",
    label: "Emergency & after-hours",
    keywords: ["emergency", "after-hours", "critical care"],
  },
  {
    value: "surgery-orthopaedics",
    label: "Surgery & orthopaedics",
    keywords: ["surgery", "surgical", "orthopaedic", "orthopedic", "fracture"],
  },
  {
    value: "diagnostics",
    label: "Diagnostics & imaging",
    keywords: ["diagnostic", "imaging", "radiology", "radiography", "x-ray", "ultrasound", "pathology"],
  },
  {
    value: "reproduction",
    label: "Reproduction services",
    keywords: ["reproduction", "insemination", "semen", "fertility", "breeding"],
  },
  {
    value: "rehabilitation",
    label: "Rehabilitation & therapies",
    keywords: ["rehabilitation", "hydrotherapy", "physiotherapy", "therapy", "acupuncture"],
  },
  {
    value: "general-care",
    label: "General veterinary care",
    keywords: ["veterinary care", "general practice", "preventative", "vaccination", "health check"],
  },
];

/** Each clinic's hours are evaluated in its own state timezone, not the viewer's. */
export const STATE_TIMEZONES: Record<string, string> = {
  NSW: "Australia/Sydney",
  ACT: "Australia/Sydney",
  VIC: "Australia/Melbourne",
  QLD: "Australia/Brisbane",
  SA: "Australia/Adelaide",
  WA: "Australia/Perth",
  TAS: "Australia/Hobart",
  NT: "Australia/Darwin",
};

const DAY_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/** "open" | "closed" | null (hours not published or not parseable). */
export type OpeningStatus = "open" | "closed" | null;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface VetFilterState {
  query: string;
  service: string;
  state: string;
  openNow: boolean;
  radiusKm: number;
  userCoordinates: Coordinates | null;
}

export type VetResult = VetLocation & { distanceKm?: number };

function normalise(value: string | undefined): string {
  return String(value ?? "").trim().toLocaleLowerCase("en-AU");
}

export function matchesServiceFilter(location: VetLocation, selectedFilter: string): boolean {
  if (!selectedFilter) return true;
  const filter = SERVICE_FILTERS.find((item) => item.value === selectedFilter);
  if (!filter) return true;
  const searchableServices = normalise((location.services ?? []).join(" "));
  return filter.keywords.some((keyword) => searchableServices.includes(keyword));
}

function parseTimeToken(token: string): number | null {
  const match = token.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!match) return null;
  let hours = Number(match[1]) % 12;
  if (match[3].toLowerCase() === "pm") hours += 12;
  return hours * 60 + Number(match[2] ?? 0);
}

interface ParsedLine {
  days: number[];
  ranges: [number, number][];
}

// One line like "Mon–Fri: 8:00 am – 5:00 pm" -> { days, ranges }
function parseHoursLine(line: string): ParsedLine | null {
  const text = String(line ?? "").trim();
  if (!text) return null;
  if (/24\s*(hours|\/\s*7)|open 7 days|365 days/i.test(text)) {
    return { days: [0, 1, 2, 3, 4, 5, 6], ranges: [[0, 1439]] };
  }

  const daySpec = text.includes(":") ? text.slice(0, text.indexOf(":")) : "";
  const dayTokens = [...daySpec.matchAll(/mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?/gi)]
    .map((match) => DAY_INDEX[match[0].slice(0, 3).toLowerCase()]);
  if (!dayTokens.length) return null;

  let days = [...new Set(dayTokens)];
  if (dayTokens.length === 2 && /[–—-]|to/i.test(daySpec.replace(/[a-z]/gi, ""))) {
    const [from, to] = dayTokens;
    days = [];
    for (let day = from; day <= to; day += 1) days.push(day);
  }

  if (/closed/i.test(text)) return { days, ranges: [] };

  const ranges: [number, number][] = [];
  const rangeRegex = /(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*[–—-]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/gi;
  let match: RegExpExecArray | null;
  while ((match = rangeRegex.exec(text))) {
    const start = parseTimeToken(match[1]);
    const end = parseTimeToken(match[2]);
    if (start !== null && end !== null) ranges.push([start, end]);
  }
  return ranges.length ? { days, ranges } : null;
}

// Schedule parsing is pure but not free; cache per location object (no mutation
// of the readonly record — a WeakMap keyed on identity).
const scheduleCache = new WeakMap<VetLocation, Map<number, [number, number][]> | null>();

function openingSchedule(location: VetLocation): Map<number, [number, number][]> | null {
  const cached = scheduleCache.get(location);
  if (cached !== undefined) return cached;
  const schedule = new Map<number, [number, number][]>();
  (location.openingHours ?? []).forEach((line) => {
    const parsed = parseHoursLine(line);
    if (!parsed) return;
    parsed.days.forEach((day) => {
      schedule.set(day, [...(schedule.get(day) ?? []), ...parsed.ranges]);
    });
  });
  const result = schedule.size ? schedule : null;
  scheduleCache.set(location, result);
  return result;
}

function clinicLocalMinutes(location: VetLocation, now: Date): { day: number; minutes: number } {
  const timeZone = STATE_TIMEZONES[location.state] ?? "Australia/Sydney";
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  const day = DAY_INDEX[get("weekday").slice(0, 3).toLowerCase()] ?? 0;
  return { day, minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")) };
}

/** "open" | "closed" | null when hours are absent or not parseable. */
export function openingStatus(location: VetLocation, now: Date = new Date()): OpeningStatus {
  const schedule = openingSchedule(location);
  if (!schedule) return null;
  const { day, minutes } = clinicLocalMinutes(location, now);
  return (schedule.get(day) ?? []).some(([start, end]) => minutes >= start && minutes <= end)
    ? "open"
    : "closed";
}

export function haversineDistance(from: Coordinates, to: Coordinates): number {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const collator = new Intl.Collator("en-AU", { sensitivity: "base", numeric: true, ignorePunctuation: true });

function compareClinicNames(a: VetLocation, b: VetLocation): number {
  return (
    collator.compare(a.name ?? "", b.name ?? "") ||
    collator.compare(a.suburb ?? "", b.suburb ?? "") ||
    collator.compare(a.id ?? "", b.id ?? "")
  );
}

/** Full filter + sort pipeline: text, service, state, open-now, radius, distance sort. */
export function filterVets(locations: VetLocation[], filters: VetFilterState): VetResult[] {
  const query = normalise(filters.query);

  const matches = locations.filter((location) => {
    const searchText = normalise(
      [
        location.name,
        location.address,
        location.suburb,
        location.postcode,
        location.state,
        location.area,
        ...(location.services ?? []),
      ].join(" ")
    );
    const matchesQuery = !query || searchText.includes(query);
    const matchesService = matchesServiceFilter(location, filters.service);
    const matchesState = !filters.state || location.state === filters.state;
    const matchesOpen = !filters.openNow || openingStatus(location) === "open";
    return matchesQuery && matchesService && matchesState && matchesOpen;
  });

  if (!filters.userCoordinates) {
    return [...matches].sort(compareClinicNames);
  }

  const origin = filters.userCoordinates;
  let withDistance: VetResult[] = matches.map((location) => ({
    ...location,
    distanceKm: haversineDistance(origin, {
      latitude: location.latitude,
      longitude: location.longitude,
    }),
  }));
  if (filters.radiusKm > 0) {
    withDistance = withDistance.filter(
      (location) => (location.distanceKm ?? Infinity) <= filters.radiusKm
    );
  }
  return withDistance.sort(
    (a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0) || compareClinicNames(a, b)
  );
}

/** Datalist suggestions: every published suburb and postcode. */
export function buildSuggestions(locations: VetLocation[]): string[] {
  return [
    ...new Set(locations.flatMap((location) => [location.suburb, location.postcode]).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "en-AU", { numeric: true }));
}

/** Human distance label, tabular-friendly. */
export function formatDistance(distanceKm: number): string {
  return distanceKm < 10 ? `${distanceKm.toFixed(1)} km` : `${Math.round(distanceKm)} km`;
}
