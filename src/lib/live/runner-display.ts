type RunnerDisplaySource = {
  runnerTrainerName?: string | null;
  dogTrainerName?: string | null;
  sourceRawJson?: string | null;
};

type RunnerWeightSource = {
  runnerWeight?: number | null;
  formWeight?: number | null;
  sourceRawJson?: string | null;
};

export function resolveRunnerTrainerName(source: RunnerDisplaySource) {
  const linkedName =
    cleanDisplayText(source.runnerTrainerName) ??
    cleanDisplayText(source.dogTrainerName);
  if (linkedName) return linkedName;

  const raw = parseSourceObject(source.sourceRawJson);
  if (!raw) return null;

  const directName =
    cleanDisplayText(raw.trainerName) ??
    cleanDisplayText(raw.trainer) ??
    cleanDisplayText(recordValue(raw.trainer)?.name);
  if (directName) return directName;

  return trainerNameFromProfileUrl(cleanDisplayText(raw.trainerProfileUrl));
}

export function resolveRunnerWeight(source: RunnerWeightSource) {
  for (const candidate of [
    source.runnerWeight,
    source.formWeight,
    numericSourceValue(source.sourceRawJson, "resultWeight"),
    numericSourceValue(source.sourceRawJson, "weight"),
    numericSourceValue(source.sourceRawJson, "dogWeight"),
  ]) {
    if (
      typeof candidate === "number" &&
      Number.isFinite(candidate) &&
      candidate >= 15 &&
      candidate <= 60
    ) {
      return candidate;
    }
  }
  return null;
}

function trainerNameFromProfileUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value, "https://www.thedogs.com.au");
    if (url.protocol !== "https:" || url.hostname !== "www.thedogs.com.au") {
      return null;
    }
    const match = url.pathname.match(/^\/trainers\/[^/]+\/([^/]+)\/?$/i);
    if (!match?.[1]) return null;
    const tokens = decodeURIComponent(match[1])
      .split(/[-_]+/)
      .map((token) => token.trim())
      .filter(Boolean);
    if (tokens.length < 2) return null;
    return tokens
      .map((token) => token[0]?.toUpperCase() + token.slice(1).toLowerCase())
      .join(" ");
  } catch {
    return null;
  }
}

function numericSourceValue(value: string | null | undefined, key: string) {
  const raw = parseSourceObject(value);
  if (!raw) return null;
  const candidate = raw[key];
  if (typeof candidate === "number") return candidate;
  if (typeof candidate !== "string" || !candidate.trim()) return null;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSourceObject(value: string | null | undefined) {
  if (!value) return null;
  try {
    return recordValue(JSON.parse(value));
  } catch {
    return null;
  }
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cleanDisplayText(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned && cleaned.length <= 120 ? cleaned : null;
}
