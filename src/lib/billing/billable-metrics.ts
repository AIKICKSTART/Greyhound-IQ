export const LAGO_BILLABLE_METRIC_KEYS = [
  "race_detail_view",
  "prediction_run",
  "agent_run",
  "agent_tokens",
  "api_call",
  "export_generated",
  "media_upload_bytes",
  "storage_gb_hours",
  "team_seat",
  "priority_job",
] as const;

export type LagoBillableMetricKey =
  (typeof LAGO_BILLABLE_METRIC_KEYS)[number];
