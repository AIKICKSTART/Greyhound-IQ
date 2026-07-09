// Presentational: renders a status/severity string as a giq-status-pill with a
// tone picked from the value. No logic beyond string-matching for colour.
const RED = new Set([
  "failed",
  "error",
  "infected",
  "banned",
  "removed",
  "rejected",
  "critical",
  "urgent",
  "closed",
]);
const PURPLE = new Set([
  "pending",
  "pending_review",
  "open",
  "review",
  "pending_scan",
  "triaged",
  "in_progress",
  "degraded",
  "high",
  "sent",
]);
const GOLD = new Set([
  "active",
  "ok",
  "processed",
  "resolved",
  "approved",
  "received",
  "pro",
  "pro_plus",
]);

// ponytail: keyword tone map; extend the sets above if a new status shows up.
function toneClass(value: string): string {
  const key = value.trim().toLowerCase();
  if (RED.has(key)) return "giq-status-pill-red";
  if (PURPLE.has(key)) return "giq-status-pill-purple";
  if (GOLD.has(key)) return "giq-status-pill-gold";
  return "";
}

export function StatusPill({ value }: { value: string }) {
  return <span className={`giq-status-pill ${toneClass(value)}`}>{value}</span>;
}
