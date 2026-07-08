#!/usr/bin/env bash
# GreyhoundIQ production monitoring setup (P6-B).
# Idempotent-ish: uptime check / log metric / alert policies are keyed by
# displayName, so re-running warns on duplicates instead of clobbering. Delete
# the existing resource first if you need to change its shape.
#
# Prereqs: gcloud authed, project set, an email notification channel exists.
# Region for services: australia-southeast1. Prod domain: greyhoundsiq.com.au.
set -euo pipefail

PROJECT="cosmic-reserve-500915-u1"
PROD_HOST="greyhoundsiq.com.au"
PROD_SERVICE="greyhoundiq-web-prod"

# Reuse the first email notification channel. Alerts are still created (and
# visible in console) even if this is empty, they just won't notify.
CHANNEL="$(gcloud beta monitoring channels list \
  --project="$PROJECT" --format='value(name)' | head -1)"
echo "Notification channel: ${CHANNEL:-<none>}"

# 1) Uptime check on prod readiness endpoint.
if ! gcloud monitoring uptime list-configs --project="$PROJECT" \
      --format='value(displayName)' | grep -qx "GreyhoundIQ prod readiness"; then
  gcloud monitoring uptime create "GreyhoundIQ prod readiness" \
    --project="$PROJECT" \
    --resource-type=uptime-url \
    --resource-labels="project_id=$PROJECT,host=$PROD_HOST" \
    --protocol=https --path="/api/health/ready" --port=443 \
    --status-classes=2xx --validate-ssl=true \
    --period=1 --timeout=10
else
  echo "Uptime check already exists, skipping."
fi
UPTIME_ID="$(gcloud monitoring uptime list-configs --project="$PROJECT" \
  --filter='displayName="GreyhoundIQ prod readiness"' \
  --format='value(name)' | head -1 | sed 's#.*/##')"
echo "Uptime check id: $UPTIME_ID"

# 2) Log-based metric: DB pool failures on prod web service.
if ! gcloud logging metrics list --project="$PROJECT" \
      --format='value(name)' | grep -qx "greyhoundiq_prod_db_query_failures"; then
  gcloud logging metrics create greyhoundiq_prod_db_query_failures \
    --project="$PROJECT" \
    --description="Prod DB safe_query_failed or P2024 connection-pool errors (web-prod)" \
    --log-filter="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$PROD_SERVICE\" AND (jsonPayload.event=\"db.safe_query_failed\" OR jsonPayload.message=~\"P2024\" OR textPayload=~\"db.safe_query_failed\" OR textPayload=~\"P2024\")"
else
  echo "Log metric already exists, skipping."
fi

# 3) Alert policies. Written to a temp dir then created if displayName is new.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ch_json="\"$CHANNEL\""
[ -z "$CHANNEL" ] && ch_json=""

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

cat > "$TMP/uptime.json" <<EOF
{ "displayName": "GreyhoundIQ prod readiness failed", "combiner": "OR",
  "conditions": [{ "displayName": "prod /api/health/ready uptime check failing",
    "conditionThreshold": {
      "filter": "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND metric.label.check_id=\"$UPTIME_ID\"",
      "aggregations": [{"alignmentPeriod":"300s","perSeriesAligner":"ALIGN_NEXT_OLDER","crossSeriesReducer":"REDUCE_COUNT_FALSE","groupByFields":["resource.label.host"]}],
      "comparison": "COMPARISON_GT", "thresholdValue": 1, "duration": "300s", "trigger": {"count": 1} } }],
  "notificationChannels": [${ch_json}] }
EOF

existing="$(gcloud beta monitoring policies list --project="$PROJECT" --format='value(displayName)')"
for f in 5xx latency instances dbfail uptime; do
  name="$(grep -o '"displayName": "[^"]*"' "$TMP/$f.json" | head -1 | sed 's/"displayName": "//;s/"//')"
  if echo "$existing" | grep -qx "$name"; then
    echo "Policy already exists, skipping: $name"
  else
    gcloud beta monitoring policies create --project="$PROJECT" --policy-from-file="$TMP/$f.json"
  fi
done

echo "Monitoring setup complete."
