import { createHash } from "node:crypto";

export const STAGING_LOAD_PROFILE_NAMES = [
  "smoke",
  "baseline",
  "ramp",
  "spike-3x",
  "spike-10x",
  "soak",
] as const;

export type StagingLoadProfileName = (typeof STAGING_LOAD_PROFILE_NAMES)[number];
export type StagingLoadLane =
  | "public"
  | "authenticated"
  | "mutations"
  | "internal-write"
  | "realtime"
  | "media"
  | "call-token"
  | "pool-saturation";

export type StagingLoadSample = {
  label: string;
  status: number;
  ms: number;
  ok: boolean;
};

export type StagingLoadStage = {
  name: string;
  iterations: number;
  concurrency: number;
};

export type StagingLoadProfile = {
  name: StagingLoadProfileName;
  stages: StagingLoadStage[];
  requiredLanes: StagingLoadLane[];
  thresholds: {
    maximumErrorRate: number;
    p95Milliseconds: number;
    p99Milliseconds: number;
  };
};

export type StagingLoadSummary = {
  count: number;
  failures: number;
  errorRate: number;
  p50Milliseconds: number;
  p95Milliseconds: number;
  p99Milliseconds: number;
  maximumMilliseconds: number;
  statuses: Record<string, number>;
};

const FIXED_PROFILES: Record<Exclude<StagingLoadProfileName, "smoke">, StagingLoadProfile> = {
  baseline: {
    name: "baseline",
    stages: [{ name: "baseline", iterations: 20, concurrency: 8 }],
    requiredLanes: ["public", "authenticated"],
    thresholds: {
      maximumErrorRate: 0.01,
      p95Milliseconds: 2_000,
      p99Milliseconds: 5_000,
    },
  },
  ramp: {
    name: "ramp",
    stages: [
      { name: "ramp-1x", iterations: 5, concurrency: 4 },
      { name: "ramp-2x", iterations: 5, concurrency: 8 },
      { name: "ramp-3x", iterations: 5, concurrency: 12 },
    ],
    requiredLanes: ["public", "authenticated"],
    thresholds: {
      maximumErrorRate: 0.01,
      p95Milliseconds: 2_500,
      p99Milliseconds: 6_000,
    },
  },
  "spike-3x": {
    name: "spike-3x",
    stages: [
      { name: "warm", iterations: 3, concurrency: 4 },
      { name: "spike-3x", iterations: 15, concurrency: 12 },
    ],
    requiredLanes: ["public", "authenticated", "pool-saturation"],
    thresholds: {
      maximumErrorRate: 0.02,
      p95Milliseconds: 3_000,
      p99Milliseconds: 7_500,
    },
  },
  "spike-10x": {
    name: "spike-10x",
    stages: [
      { name: "warm", iterations: 3, concurrency: 4 },
      { name: "spike-10x", iterations: 15, concurrency: 40 },
    ],
    requiredLanes: ["public", "authenticated", "pool-saturation"],
    thresholds: {
      maximumErrorRate: 0.05,
      p95Milliseconds: 5_000,
      p99Milliseconds: 10_000,
    },
  },
  soak: {
    name: "soak",
    stages: [{ name: "soak", iterations: 300, concurrency: 8 }],
    requiredLanes: [
      "public",
      "authenticated",
      "mutations",
      "realtime",
      "pool-saturation",
    ],
    thresholds: {
      maximumErrorRate: 0.01,
      p95Milliseconds: 2_500,
      p99Milliseconds: 6_000,
    },
  },
};

export function resolveStagingLoadProfile(
  value: string | undefined,
  smoke: { iterations: number; concurrency: number } = {
    iterations: 5,
    concurrency: 4,
  },
): StagingLoadProfile {
  const name = value?.trim() || "smoke";
  if (!STAGING_LOAD_PROFILE_NAMES.includes(name as StagingLoadProfileName)) {
    throw new Error(
      `LOAD_PROFILE must be one of ${STAGING_LOAD_PROFILE_NAMES.join(", ")}`,
    );
  }
  if (name === "smoke") {
    return {
      name,
      stages: [{ name: "smoke", ...smoke }],
      requiredLanes: ["public"],
      thresholds: {
        maximumErrorRate: 0,
        p95Milliseconds: 60_000,
        p99Milliseconds: 60_000,
      },
    };
  }
  return structuredClone(FIXED_PROFILES[name as Exclude<StagingLoadProfileName, "smoke">]);
}

export function stagingLoadPreflightFindings(input: {
  profile: StagingLoadProfile;
  targetOrigin: string;
  environment: string;
  sourceSha: string;
  imageDigest: string;
  configuredLanes: StagingLoadLane[];
}) {
  const findings = missingRequiredLanes(
    input.profile.requiredLanes,
    input.configuredLanes,
  ).map((lane) => `required lane is not configured: ${lane}`);

  if (input.profile.name !== "smoke") {
    const host = new URL(input.targetOrigin).hostname.toLowerCase();
    if (input.environment !== "staging") {
      findings.push("non-smoke profiles require LOAD_ENVIRONMENT=staging");
    }
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
      findings.push("non-smoke profiles cannot target loopback");
    }
    if (!/^[0-9a-f]{40}$/.test(input.sourceSha)) {
      findings.push("non-smoke profiles require a 40-character LOAD_SOURCE_SHA");
    }
    if (!/^sha256:[0-9a-f]{64}$/.test(input.imageDigest)) {
      findings.push("non-smoke profiles require LOAD_IMAGE_DIGEST=sha256:<64 hex>");
    }
  }

  return findings;
}

export function missingRequiredLanes(
  required: readonly StagingLoadLane[],
  present: readonly StagingLoadLane[],
) {
  const coverage = new Set(present);
  return required.filter((lane) => !coverage.has(lane));
}

export function summarizeStagingLoad(samples: readonly StagingLoadSample[]) {
  const byLabel: Record<string, StagingLoadSummary> = {};
  const groups = new Map<string, StagingLoadSample[]>();
  for (const sample of samples) {
    groups.set(sample.label, [...(groups.get(sample.label) ?? []), sample]);
  }
  for (const [label, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    byLabel[label] = summarize(group);
  }
  return { overall: summarize(samples), byLabel };
}

export function stagingLoadThresholdFindings(
  profile: StagingLoadProfile,
  summary: StagingLoadSummary,
) {
  const findings: string[] = [];
  if (summary.count === 0) findings.push("no HTTP samples were recorded");
  if (summary.errorRate > profile.thresholds.maximumErrorRate) {
    findings.push(
      `error rate ${summary.errorRate} exceeds ${profile.thresholds.maximumErrorRate}`,
    );
  }
  if (summary.p95Milliseconds > profile.thresholds.p95Milliseconds) {
    findings.push(
      `p95 ${summary.p95Milliseconds}ms exceeds ${profile.thresholds.p95Milliseconds}ms`,
    );
  }
  if (summary.p99Milliseconds > profile.thresholds.p99Milliseconds) {
    findings.push(
      `p99 ${summary.p99Milliseconds}ms exceeds ${profile.thresholds.p99Milliseconds}ms`,
    );
  }
  return findings;
}

export function stagingLoadConfigDigest(value: unknown) {
  return `sha256:${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

export function stableJson(value: unknown) {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

function summarize(samples: readonly StagingLoadSample[]): StagingLoadSummary {
  const times = samples.map((sample) => sample.ms).sort((a, b) => a - b);
  const failures = samples.filter((sample) => !sample.ok).length;
  const statuses: Record<string, number> = {};
  for (const sample of samples) {
    const status = String(sample.status);
    statuses[status] = (statuses[status] ?? 0) + 1;
  }
  return {
    count: samples.length,
    failures,
    errorRate: samples.length === 0 ? 0 : failures / samples.length,
    p50Milliseconds: percentile(times, 50),
    p95Milliseconds: percentile(times, 95),
    p99Milliseconds: percentile(times, 99),
    maximumMilliseconds: times.at(-1) ?? 0,
    statuses,
  };
}

function percentile(values: readonly number[], percent: number) {
  if (values.length === 0) return 0;
  const index = Math.ceil((percent / 100) * values.length) - 1;
  return values[Math.max(0, Math.min(index, values.length - 1))];
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, sortValue(item)]),
  );
}
