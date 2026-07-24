#!/usr/bin/env bash
# GreyhoundIQ production monitoring setup (P6-B).
# Log metrics and alert policies are deterministically reconciled by stable name.
# Duplicate alert-policy display names fail closed for operator review.
#
# Prereqs: gcloud authed and the exact production project, host, service and
# notification-channel resource name supplied explicitly by the operator.
set -euo pipefail

: "${PROJECT:?Set PROJECT to the approved production Google Cloud project ID}"
: "${PROD_HOST:?Set PROD_HOST to the approved production hostname}"
: "${PROD_SERVICE:?Set PROD_SERVICE to the production Cloud Run service name}"
: "${NOTIFICATION_CHANNEL:?Set NOTIFICATION_CHANNEL to the reviewed Cloud Monitoring channel resource name}"

if [[ ! "$PROJECT" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]]; then
  echo "PROJECT must be a safe Google Cloud project ID." >&2
  exit 1
fi
if [[ ! "$PROD_HOST" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "PROD_HOST contains unsafe hostname characters." >&2
  exit 1
fi
if [[ ! "$PROD_SERVICE" =~ ^[a-z]([a-z0-9-]{0,47}[a-z0-9])?$ ]]; then
  echo "PROD_SERVICE must be a safe Cloud Run service name." >&2
  exit 1
fi

CHANNEL="$NOTIFICATION_CHANNEL"
channel_prefix="projects/$PROJECT/notificationChannels/"
case "$CHANNEL" in
  "$channel_prefix"*) ;;
  *)
    echo "NOTIFICATION_CHANNEL must belong to PROJECT and use the full channel resource name." >&2
    exit 1
    ;;
esac
channel_id="${CHANNEL#"$channel_prefix"}"
if [[ ! "$channel_id" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "NOTIFICATION_CHANNEL must end in one safe non-empty channel ID." >&2
  exit 1
fi
echo "Notification channel: $CHANNEL"

if [[ "${GCP_MONITORING_VALIDATE_ONLY:-}" == "1" ]]; then
  echo "Monitoring inputs valid; no Google Cloud command was run."
  exit 0
fi

# Discovery is a mutation-free preflight. A failed list must never be mistaken
# for an absent resource and followed by create/update calls.
if ! uptime_inventory="$(gcloud monitoring uptime list-configs \
    --project="$PROJECT" \
    --format='value(displayName,name)')"; then
  echo "Could not list uptime checks; refusing monitoring mutations." >&2
  exit 1
fi
if ! metric_names="$(gcloud logging metrics list \
    --project="$PROJECT" \
    --format='value(name)')"; then
  echo "Could not list log metrics; refusing monitoring mutations." >&2
  exit 1
fi
if ! policy_inventory="$(gcloud beta monitoring policies list \
    --project="$PROJECT" \
    --format='value(displayName,name)')"; then
  echo "Could not list alert policies; refusing monitoring mutations." >&2
  exit 1
fi

matching_resource_names() {
  local inventory="$1" display_name="$2"
  awk -F '\t' -v wanted="$display_name" '$1 == wanted { print $2 }' <<< "$inventory"
}

# 1) Uptime check on prod readiness endpoint.
uptime_names="$(matching_resource_names "$uptime_inventory" "GreyhoundIQ prod readiness")"
if [[ "$uptime_names" == *$'\n'* ]]; then
  echo "Duplicate uptime checks require operator review: GreyhoundIQ prod readiness" >&2
  exit 1
fi
if [[ -z "$uptime_names" ]]; then
  UPTIME_NAME="$(gcloud monitoring uptime create "GreyhoundIQ prod readiness" \
    --project="$PROJECT" \
    --resource-type=uptime-url \
    --resource-labels="project_id=$PROJECT,host=$PROD_HOST" \
    --protocol=https --path="/api/health/ready" --port=443 \
    --status-classes=2xx --validate-ssl=true \
    --period=1 --timeout=10 \
    --format='value(name)')"
else
  echo "Uptime check already exists, skipping."
  UPTIME_NAME="$uptime_names"
fi
UPTIME_ID="${UPTIME_NAME##*/}"
if [[ ! "$UPTIME_ID" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "Uptime check returned an invalid resource name." >&2
  exit 1
fi
echo "Uptime check id: $UPTIME_ID"

# 2) Log-based metrics. Existing definitions are updated instead of silently
# accepting drift behind a matching metric name.
reconcile_log_metric() {
  local name="$1" description="$2" filter="$3" action="create"
  if grep -qx "$name" <<< "$metric_names"; then
    action="update"
  fi
  gcloud logging metrics "$action" "$name" \
    --project="$PROJECT" \
    --description="$description" \
    --log-filter="$filter"
}

reconcile_log_metric \
  "greyhoundiq_prod_db_query_failures" \
  "Prod DB safe_query_failed or P2024 connection-pool errors (web-prod)" \
  "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$PROD_SERVICE\" AND (jsonPayload.event=\"db.safe_query_failed\" OR jsonPayload.message=~\"P2024\" OR textPayload=~\"db.safe_query_failed\" OR textPayload=~\"P2024\")"

reconcile_log_metric \
  "greyhoundiq_prod_rate_limit_prune_attention" \
  "Prod aggregate maintenance reported a failed, stalled or capped rate-limit cleanup" \
  "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$PROD_SERVICE\" AND jsonPayload.event=\"aggregate_refresh.rate_limit_prune_attention\""

reconcile_log_metric \
  "greyhoundiq_prod_aggregate_refresh_completed" \
  "Prod aggregate maintenance completed every materialized view" \
  "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$PROD_SERVICE\" AND jsonPayload.event=\"aggregate_refresh.run_completed\""

reconcile_log_metric \
  "greyhoundiq_prod_aggregate_scheduler_failures" \
  "Prod aggregate-refresh Cloud Scheduler attempts that finished unsuccessfully" \
  "resource.type=\"cloud_scheduler_job\" AND resource.labels.job_id=\"greyhoundiq-prod-aggregate-refresh\" AND jsonPayload.@type=\"type.googleapis.com/google.cloud.scheduler.logging.AttemptFinished\" AND jsonPayload.status!=\"OK\""

reconcile_log_metric \
  "greyhoundiq_prod_scheduled_task_attention" \
  "Prod scheduled task execution failed or an overlapping run was rejected" \
  "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$PROD_SERVICE\" AND (jsonPayload.event=\"scheduled_task.failed\" OR jsonPayload.event=\"scheduled_task.overlap\")"

reconcile_log_metric \
  "greyhoundiq_prod_results_completeness_attention" \
  "Prod completed races missing results after 30 minutes or replay after 90 minutes" \
  "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$PROD_SERVICE\" AND jsonPayload.event=\"live_sync.completeness_alert\""

reconcile_log_metric \
  "greyhoundiq_prod_scheduler_failures" \
  "Prod GreyhoundIQ Cloud Scheduler attempts that finished unsuccessfully" \
  "resource.type=\"cloud_scheduler_job\" AND resource.labels.job_id=~\"^greyhoundiq-prod-\" AND jsonPayload.@type=\"type.googleapis.com/google.cloud.scheduler.logging.AttemptFinished\" AND jsonPayload.status!=\"OK\""

reconcile_log_metric \
  "greyhoundiq_prod_usage_delivery_attention" \
  "Prod usage delivery retried, dead-lettered, lost a lease or retained an unsafe backlog" \
  "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$PROD_SERVICE\" AND jsonPayload.event=\"usage_delivery.attention\""

scheduled_task_absence=(
  "account-deletion:7200"
  "agent-cleanup:7200"
  "aggregate-refresh:5400"
  "call-maintenance:1200"
  "community-readiness:1800"
  "dog-profile-sync:900"
  "listing-expiry:7200"
  "live-sync:1200"
  "media-maintenance:1200"
  "memory-decay:108000"
  "notification-delivery:1200"
  "usage-delivery:600"
)

for definition in "${scheduled_task_absence[@]}"; do
  task_id="${definition%%:*}"
  metric_task_id="${task_id//-/_}"
  reconcile_log_metric \
    "greyhoundiq_prod_scheduled_${metric_task_id}_completed" \
    "Prod ${task_id} scheduled task completion" \
    "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$PROD_SERVICE\" AND jsonPayload.event=\"scheduled_task.completed\" AND jsonPayload.taskId=\"$task_id\""
done

# 3) Alert policies. Stable display names are created or replaced deterministically.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ch_json="\"$CHANNEL\""

cat > "$TMP/5xx.json" <<EOF
{ "displayName": "GreyhoundIQ prod Cloud Run 5xx ratio >5%", "combiner": "OR",
  "conditions": [{ "displayName": "prod 5xx response ratio > 5% (5m)",
    "conditionThreshold": {
      "filter": "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\" AND resource.label.service_name=\"$PROD_SERVICE\" AND metric.label.response_code_class=\"5xx\"",
      "aggregations": [{"alignmentPeriod":"300s","perSeriesAligner":"ALIGN_RATE","crossSeriesReducer":"REDUCE_SUM","groupByFields":["resource.label.service_name"]}],
      "denominatorFilter": "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\" AND resource.label.service_name=\"$PROD_SERVICE\"",
      "denominatorAggregations": [{"alignmentPeriod":"300s","perSeriesAligner":"ALIGN_RATE","crossSeriesReducer":"REDUCE_SUM","groupByFields":["resource.label.service_name"]}],
      "comparison": "COMPARISON_GT", "thresholdValue": 0.05, "duration": "300s", "trigger": {"count": 1} } }],
  "notificationChannels": [${ch_json}] }
EOF

cat > "$TMP/latency.json" <<EOF
{ "displayName": "GreyhoundIQ prod p95 latency >3s", "combiner": "OR",
  "conditions": [{ "displayName": "prod p95 request latency > 3s (10m)",
    "conditionThreshold": {
      "filter": "metric.type=\"run.googleapis.com/request_latencies\" AND resource.type=\"cloud_run_revision\" AND resource.label.service_name=\"$PROD_SERVICE\"",
      "aggregations": [{"alignmentPeriod":"300s","perSeriesAligner":"ALIGN_PERCENTILE_95","crossSeriesReducer":"REDUCE_MEAN","groupByFields":["resource.label.service_name"]}],
      "comparison": "COMPARISON_GT", "thresholdValue": 3000, "duration": "600s", "trigger": {"count": 1} } }],
  "notificationChannels": [${ch_json}] }
EOF

# instance_count: API rejects COMPARISON_GTE, so ">7" expresses ">=8" for integer counts.
cat > "$TMP/instances.json" <<EOF
{ "displayName": "GreyhoundIQ prod instance count >=8", "combiner": "OR",
  "conditions": [{ "displayName": "prod container instances >= 8 (near maxScale 10)",
    "conditionThreshold": {
      "filter": "metric.type=\"run.googleapis.com/container/instance_count\" AND resource.type=\"cloud_run_revision\" AND resource.label.service_name=\"$PROD_SERVICE\"",
      "aggregations": [{"alignmentPeriod":"300s","perSeriesAligner":"ALIGN_MAX","crossSeriesReducer":"REDUCE_MAX","groupByFields":["resource.label.service_name"]}],
      "comparison": "COMPARISON_GT", "thresholdValue": 7, "duration": "300s", "trigger": {"count": 1} } }],
  "notificationChannels": [${ch_json}] }
EOF

cat > "$TMP/dbfail.json" <<EOF
{ "displayName": "GreyhoundIQ prod DB query failures >5/5m", "combiner": "OR",
  "conditions": [{ "displayName": "prod db.safe_query_failed / P2024 > 5 in 5m",
    "conditionThreshold": {
      "filter": "metric.type=\"logging.googleapis.com/user/greyhoundiq_prod_db_query_failures\" AND resource.type=\"cloud_run_revision\"",
      "aggregations": [{"alignmentPeriod":"300s","perSeriesAligner":"ALIGN_SUM","crossSeriesReducer":"REDUCE_SUM"}],
      "comparison": "COMPARISON_GT", "thresholdValue": 5, "duration": "0s", "trigger": {"count": 1} } }],
  "notificationChannels": [${ch_json}] }
EOF

cat > "$TMP/ratelimit-prune.json" <<EOF
{ "displayName": "GreyhoundIQ prod rate-limit cleanup needs attention", "combiner": "OR",
  "documentation": { "mimeType": "text/markdown", "content": "Owner: SRE on-call. Runbook: docs/architecture/incident-response-controls.md#rate-limit-cleanup-backlog. First action: protect database capacity and inspect prune status before changing the batch ceiling." },
  "userLabels": { "owner": "sre", "service": "aggregate-maintenance" },
  "conditions": [{ "displayName": "rate-limit cleanup failed, stalled or retained backlog",
    "conditionThreshold": {
      "filter": "metric.type=\"logging.googleapis.com/user/greyhoundiq_prod_rate_limit_prune_attention\" AND resource.type=\"cloud_run_revision\"",
      "aggregations": [{"alignmentPeriod":"3600s","perSeriesAligner":"ALIGN_SUM","crossSeriesReducer":"REDUCE_SUM"}],
      "comparison": "COMPARISON_GT", "thresholdValue": 0, "duration": "0s", "trigger": {"count": 1} } }],
  "notificationChannels": [${ch_json}] }
EOF

cat > "$TMP/aggregate-missing.json" <<EOF
{ "displayName": "GreyhoundIQ prod aggregate refresh completion missing", "combiner": "OR",
  "documentation": { "mimeType": "text/markdown", "content": "Owner: SRE on-call. Runbook: docs/architecture/incident-response-controls.md#rate-limit-cleanup-backlog. First action: inspect the aggregate Scheduler attempt and Cloud Run request before retrying." },
  "userLabels": { "owner": "sre", "service": "aggregate-maintenance" },
  "conditions": [{ "displayName": "no complete aggregate-maintenance run for 90 minutes",
    "conditionAbsent": {
      "filter": "metric.type=\"logging.googleapis.com/user/greyhoundiq_prod_aggregate_refresh_completed\" AND resource.type=\"cloud_run_revision\"",
      "aggregations": [{"alignmentPeriod":"3600s","perSeriesAligner":"ALIGN_SUM","crossSeriesReducer":"REDUCE_SUM"}],
      "duration": "5400s", "trigger": {"count": 1} } }],
  "notificationChannels": [${ch_json}] }
EOF

cat > "$TMP/aggregate-scheduler-failure.json" <<EOF
{ "displayName": "GreyhoundIQ prod aggregate Scheduler attempt failed", "combiner": "OR",
  "documentation": { "mimeType": "text/markdown", "content": "Owner: SRE on-call. Runbook: docs/architecture/incident-response-controls.md#rate-limit-cleanup-backlog. First action: inspect AttemptFinished status and target logs; do not start an overlapping retry." },
  "userLabels": { "owner": "sre", "service": "aggregate-maintenance" },
  "conditions": [{ "displayName": "aggregate-refresh Scheduler failure detected",
    "conditionThreshold": {
      "filter": "metric.type=\"logging.googleapis.com/user/greyhoundiq_prod_aggregate_scheduler_failures\" AND resource.type=\"cloud_scheduler_job\"",
      "aggregations": [{"alignmentPeriod":"300s","perSeriesAligner":"ALIGN_SUM","crossSeriesReducer":"REDUCE_SUM"}],
      "comparison": "COMPARISON_GT", "thresholdValue": 0, "duration": "0s", "trigger": {"count": 1} } }],
  "notificationChannels": [${ch_json}] }
EOF

cat > "$TMP/scheduled-task-attention.json" <<EOF
{ "displayName": "GreyhoundIQ prod scheduled task needs attention", "combiner": "OR",
  "documentation": { "mimeType": "text/markdown", "content": "Owner: SRE on-call. Runbook: docs/architecture/incident-response-controls.md#scheduled-task-failure-or-missed-run. First action: identify the task and confirm whether its lock rejected an overlap before replaying it." },
  "userLabels": { "owner": "sre", "service": "scheduled-tasks" },
  "conditions": [{ "displayName": "scheduled task failed or rejected overlap",
    "conditionThreshold": {
      "filter": "metric.type=\"logging.googleapis.com/user/greyhoundiq_prod_scheduled_task_attention\" AND resource.type=\"cloud_run_revision\"",
      "aggregations": [{"alignmentPeriod":"300s","perSeriesAligner":"ALIGN_SUM","crossSeriesReducer":"REDUCE_SUM"}],
      "comparison": "COMPARISON_GT", "thresholdValue": 0, "duration": "0s", "trigger": {"count": 1} } }],
  "notificationChannels": [${ch_json}] }
EOF

cat > "$TMP/results-completeness-attention.json" <<EOF
{ "displayName": "GreyhoundIQ prod race results need attention", "combiner": "OR",
  "documentation": { "mimeType": "text/markdown", "content": "Owner: racing data on-call. First action: inspect the provider, track and age-bucket completeness fields, then trigger one authorised idempotent results sync." },
  "userLabels": { "owner": "racing-data", "service": "live-sync" },
  "conditions": [{ "displayName": "results or replay completeness threshold exceeded",
    "conditionThreshold": {
      "filter": "metric.type=\"logging.googleapis.com/user/greyhoundiq_prod_results_completeness_attention\" AND resource.type=\"cloud_run_revision\"",
      "aggregations": [{"alignmentPeriod":"300s","perSeriesAligner":"ALIGN_SUM","crossSeriesReducer":"REDUCE_SUM"}],
      "comparison": "COMPARISON_GT", "thresholdValue": 0, "duration": "0s", "trigger": {"count": 1} } }],
  "notificationChannels": [${ch_json}] }
EOF

cat > "$TMP/scheduler-failure.json" <<EOF
{ "displayName": "GreyhoundIQ prod Scheduler attempt failed", "combiner": "OR",
  "documentation": { "mimeType": "text/markdown", "content": "Owner: SRE on-call. Runbook: docs/architecture/incident-response-controls.md#scheduled-task-failure-or-missed-run. First action: inspect AttemptFinished and the matching application event; never bypass the application lock for a retry." },
  "userLabels": { "owner": "sre", "service": "scheduled-tasks" },
  "conditions": [{ "displayName": "GreyhoundIQ Scheduler failure detected",
    "conditionThreshold": {
      "filter": "metric.type=\"logging.googleapis.com/user/greyhoundiq_prod_scheduler_failures\" AND resource.type=\"cloud_scheduler_job\"",
      "aggregations": [{"alignmentPeriod":"300s","perSeriesAligner":"ALIGN_SUM","crossSeriesReducer":"REDUCE_SUM"}],
      "comparison": "COMPARISON_GT", "thresholdValue": 0, "duration": "0s", "trigger": {"count": 1} } }],
  "notificationChannels": [${ch_json}] }
EOF

cat > "$TMP/usage-delivery-attention.json" <<EOF
{ "displayName": "GreyhoundIQ prod usage delivery needs attention", "combiner": "OR",
  "documentation": { "mimeType": "text/markdown", "content": "Owner: billing platform on-call. Runbook: docs/architecture/incident-response-controls.md#usage-delivery-backlog-or-dead-letter. First action: inspect retry, dead-letter and oldest-pending counts before replaying or changing concurrency." },
  "userLabels": { "owner": "billing-platform", "service": "usage-delivery" },
  "conditions": [{ "displayName": "usage delivery retry, dead letter, lease loss or unsafe backlog",
    "conditionThreshold": {
      "filter": "metric.type=\"logging.googleapis.com/user/greyhoundiq_prod_usage_delivery_attention\" AND resource.type=\"cloud_run_revision\"",
      "aggregations": [{"alignmentPeriod":"300s","perSeriesAligner":"ALIGN_SUM","crossSeriesReducer":"REDUCE_SUM"}],
      "comparison": "COMPARISON_GT", "thresholdValue": 0, "duration": "0s", "trigger": {"count": 1} } }],
  "notificationChannels": [${ch_json}] }
EOF

cat > "$TMP/uptime.json" <<EOF
{ "displayName": "GreyhoundIQ prod readiness failed", "combiner": "OR",
  "conditions": [{ "displayName": "prod /api/health/ready uptime check failing",
    "conditionThreshold": {
      "filter": "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND metric.label.check_id=\"$UPTIME_ID\"",
      "aggregations": [{"alignmentPeriod":"300s","perSeriesAligner":"ALIGN_NEXT_OLDER","crossSeriesReducer":"REDUCE_COUNT_FALSE","groupByFields":["resource.label.host"]}],
      "comparison": "COMPARISON_GT", "thresholdValue": 1, "duration": "300s", "trigger": {"count": 1} } }],
  "notificationChannels": [${ch_json}] }
EOF

reconcile_policy() {
  local file="$1" name policy_names
  name="$(grep -o '"displayName": "[^"]*"' "$file" | head -1 | sed 's/"displayName": "//;s/"//')"
  policy_names="$(matching_resource_names "$policy_inventory" "$name")"
  if [[ -z "$policy_names" ]]; then
    gcloud beta monitoring policies create --project="$PROJECT" --policy-from-file="$file"
  elif [[ "$policy_names" == *$'\n'* ]]; then
    echo "Duplicate alert policies require operator review: $name" >&2
    exit 1
  else
    gcloud beta monitoring policies update "$policy_names" \
      --project="$PROJECT" \
      --policy-from-file="$file"
  fi
}

for f in 5xx latency instances dbfail ratelimit-prune aggregate-missing aggregate-scheduler-failure scheduled-task-attention results-completeness-attention scheduler-failure uptime; do
  reconcile_policy "$TMP/$f.json"
done
reconcile_policy "$TMP/usage-delivery-attention.json"

for definition in "${scheduled_task_absence[@]}"; do
  task_id="${definition%%:*}"
  absence_seconds="${definition##*:}"
  metric_task_id="${task_id//-/_}"
  policy_file="$TMP/scheduled-missing-$task_id.json"
  cat > "$policy_file" <<EOF
{ "displayName": "GreyhoundIQ prod ${task_id} completion missing", "combiner": "OR",
  "documentation": { "mimeType": "text/markdown", "content": "Owner: SRE on-call. Runbook: docs/architecture/incident-response-controls.md#scheduled-task-failure-or-missed-run. First action: inspect Scheduler state and the last task event, then use one authorised idempotent replay only after confirming no active lock." },
  "userLabels": { "owner": "sre", "service": "scheduled-tasks" },
  "conditions": [{ "displayName": "${task_id} completion absent for ${absence_seconds} seconds",
    "conditionAbsent": {
      "filter": "metric.type=\"logging.googleapis.com/user/greyhoundiq_prod_scheduled_${metric_task_id}_completed\" AND resource.type=\"cloud_run_revision\"",
      "aggregations": [{"alignmentPeriod":"300s","perSeriesAligner":"ALIGN_SUM","crossSeriesReducer":"REDUCE_SUM"}],
      "duration": "${absence_seconds}s", "trigger": {"count": 1} } }],
  "notificationChannels": [${ch_json}] }
EOF
  reconcile_policy "$policy_file"
done

echo "Monitoring setup complete."
