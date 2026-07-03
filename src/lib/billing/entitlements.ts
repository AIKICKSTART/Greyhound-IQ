export const ENTITLEMENT_KEYS = [
  "race_detail_views_per_month",
  "prediction_runs_per_month",
  "agent_runs_per_month",
  "agent_token_budget_per_month",
  "api_calls_per_month",
  "api_keys",
  "exports_per_month",
  "uploads_per_month",
  "upload_file_size_bytes",
  "storage_bytes",
  "retention_days",
  "priority_jobs",
  "advanced_prediction_agents",
] as const;

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];
export type BillingTier = "free" | "pro" | "pro_plus";
export type EntitlementLimitValue = number | boolean;
export type EntitlementLimits = Record<
  EntitlementKey,
  EntitlementLimitValue
>;
export type TierEntitlementLimits = Record<BillingTier, EntitlementLimits>;

const MIB = 1024 ** 2;
const GIB = 1024 ** 3;

// Launch defaults based on the SaaS plan's limited/moderate/higher tier bands.
export const DEFAULT_TIER_ENTITLEMENT_LIMITS = {
  free: {
    race_detail_views_per_month: 25,
    prediction_runs_per_month: 0,
    agent_runs_per_month: 0,
    agent_token_budget_per_month: 0,
    api_calls_per_month: 0,
    api_keys: 0,
    exports_per_month: 5,
    uploads_per_month: 10,
    upload_file_size_bytes: 25 * MIB,
    storage_bytes: GIB,
    retention_days: 30,
    priority_jobs: false,
    advanced_prediction_agents: false,
  },
  pro: {
    race_detail_views_per_month: 500,
    prediction_runs_per_month: 100,
    agent_runs_per_month: 100,
    agent_token_budget_per_month: 1_000_000,
    api_calls_per_month: 0,
    api_keys: 0,
    exports_per_month: 100,
    uploads_per_month: 250,
    upload_file_size_bytes: 250 * MIB,
    storage_bytes: 10 * GIB,
    retention_days: 365,
    priority_jobs: false,
    advanced_prediction_agents: false,
  },
  pro_plus: {
    race_detail_views_per_month: 2_500,
    prediction_runs_per_month: 500,
    agent_runs_per_month: 500,
    agent_token_budget_per_month: 5_000_000,
    api_calls_per_month: 10_000,
    api_keys: 3,
    exports_per_month: 1_000,
    uploads_per_month: 1_000,
    upload_file_size_bytes: GIB,
    storage_bytes: 100 * GIB,
    retention_days: 730,
    priority_jobs: true,
    advanced_prediction_agents: true,
  },
} as const satisfies TierEntitlementLimits;
