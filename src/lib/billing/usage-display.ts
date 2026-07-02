import {
  DEFAULT_TIER_ENTITLEMENT_LIMITS,
  type BillingTier,
  type EntitlementLimits,
  type EntitlementKey,
  type EntitlementLimitValue,
} from "@/lib/billing/entitlements";

type UsageLimitMeta = {
  label: string;
  format: "number" | "bytes" | "days" | "boolean";
};

export type UsageLimitDisplay = {
  key: EntitlementKey;
  label: string;
  value: string;
};

export const BILLING_TIER_LABELS = {
  free: "Free",
  pro: "Pro",
  pro_plus: "Pro+",
} as const satisfies Record<BillingTier, string>;

const USAGE_LIMIT_META = {
  race_detail_views_per_month: {
    label: "Race detail views / month",
    format: "number",
  },
  prediction_runs_per_month: {
    label: "Prediction runs / month",
    format: "number",
  },
  agent_runs_per_month: {
    label: "Agent runs / month",
    format: "number",
  },
  agent_token_budget_per_month: {
    label: "Agent token budget / month",
    format: "number",
  },
  api_calls_per_month: {
    label: "API calls / month",
    format: "number",
  },
  api_keys: {
    label: "API keys",
    format: "number",
  },
  exports_per_month: {
    label: "Exports / month",
    format: "number",
  },
  uploads_per_month: {
    label: "Uploads / month",
    format: "number",
  },
  upload_file_size_bytes: {
    label: "Upload file size",
    format: "bytes",
  },
  storage_bytes: {
    label: "Storage",
    format: "bytes",
  },
  retention_days: {
    label: "Retention",
    format: "days",
  },
  priority_jobs: {
    label: "Priority jobs",
    format: "boolean",
  },
  advanced_prediction_agents: {
    label: "Advanced prediction agents",
    format: "boolean",
  },
} as const satisfies Record<EntitlementKey, UsageLimitMeta>;

export function getUsageLimitDisplay(tier: BillingTier): UsageLimitDisplay[] {
  return formatUsageLimitDisplay(DEFAULT_TIER_ENTITLEMENT_LIMITS[tier]);
}

export function formatUsageLimitDisplay(
  limits: EntitlementLimits
): UsageLimitDisplay[] {
  return Object.entries(USAGE_LIMIT_META).map(([key, meta]) => {
    const entitlementKey = key as EntitlementKey;

    return {
      key: entitlementKey,
      label: meta.label,
      value: formatLimit(limits[entitlementKey], meta.format),
    };
  });
}

function formatLimit(value: EntitlementLimitValue, format: UsageLimitMeta["format"]) {
  if (format === "boolean") {
    return value ? "Included" : "Not included";
  }

  if (typeof value !== "number") {
    return "Not included";
  }

  if (format === "bytes") {
    return formatBytes(value);
  }

  if (format === "days") {
    return `${value.toLocaleString("en-AU")} days`;
  }

  return value.toLocaleString("en-AU");
}

function formatBytes(bytes: number) {
  const gib = bytes / 1024 ** 3;
  if (gib >= 1) {
    return `${formatUnit(gib)} GB`;
  }

  const mib = bytes / 1024 ** 2;
  return `${formatUnit(mib)} MB`;
}

function formatUnit(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
