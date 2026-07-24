#!/usr/bin/env bash
set -euo pipefail

run_sync() {
  local scope="$1"
  local days="$2"

  docker exec -i greyhoundiq-app-1 node - "$scope" "$days" <<'NODE'
const [scope, days] = process.argv.slice(2);
const allowedScopes = new Set(["upcoming", "results"]);
if (!allowedScopes.has(scope) || !/^\d+$/.test(days)) {
  throw new Error("invalid fixed live-sync arguments");
}

const response = await fetch(
  `http://127.0.0.1:8080/api/internal/live-sync?scope=${scope}&days=${days}`,
  {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": process.env.INTERNAL_API_SECRET,
    },
    body: "{}",
    signal: AbortSignal.timeout(360_000),
  },
);
const body = await response.text();
let result = {};
try {
  result = JSON.parse(body);
} catch {}

console.log(JSON.stringify({
  scope,
  days: Number(days),
  status: response.status,
  ok: response.ok,
  skipped: result.skipped ?? null,
  provider: result.provider ?? null,
  meetings: result.meetings ?? 0,
  races: result.races ?? 0,
  runners: result.runners ?? 0,
  results: result.results ?? 0,
  replays: result.replays ?? 0,
  replayCandidates: result.replayCandidates ?? 0,
  replayResolved: result.replayResolved ?? 0,
  replayErrors: result.replayErrors ?? 0,
}));

if (!response.ok) process.exit(1);
NODE
}

case "${1:-primary}" in
  primary)
    status=0
    run_sync upcoming 31 || status=1
    run_sync results 1 || status=1
    exit "$status"
    ;;
  catchup)
    run_sync results 2
    ;;
  *)
    echo "Usage: $0 [primary|catchup]" >&2
    exit 2
    ;;
esac
