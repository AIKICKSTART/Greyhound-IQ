# Contabo production master ledger

> **Release update (2026-07-23 evening AEST):** app image `vps-admin-feed-messenger-r4-20260723` (commit `a51ec9cf`) is live — admin mobile controls, Public/Friends feed toggle, home pricing conversion, races search chips, marketplace demo overlays, messenger dock polish. App-swap only; both 2026-07-23 migrations were already applied. Fresh 3.9 GB recovery dump taken and copied off-VPS first. See [evidence/2026-07-23-session/r4-release-evidence-2026-07-23.md](./evidence/2026-07-23-session/r4-release-evidence-2026-07-23.md).

> **Current QA status (2026-07-23):** the off-VPS release candidate builds cleanly and the fresh serial route audit passes 97/99 registered routes. Only two unseeded community-thread fixtures fail the route gate; the production safety and independent-review gates remain unresolved. No production database write, restart or deployment was performed. See [production-qa-evidence-2026-07-23.md](./production-qa-evidence-2026-07-23.md) for the exact results and blockers.

The authoritative ledger is [task-ledger.json](./task-ledger.json). It begins with the 18 Priority Zero replay tasks, then global safety controls and A-K execution/deliverable tasks. A-K work that requires a proven historical/replay baseline is explicitly blocked by `P0-016`.

No production mutation was run while creating this ledger. Supplied recovery and live-service observations remain attached to their tasks, but an observation does not advance a task while any declared prerequisite is unfinished. The generator therefore normalises such tasks to `BLOCKED` and records every adjustment in its validation output. The 15 required fields are structurally present on every task; incomplete tasks intentionally retain pending evidence, retest and completion values until their acceptance criteria actually pass.

## Validation

Regenerate and validate from the repository root with:

```powershell
node docs/production/contabo-master-2026-07-22/build-ledger.mjs
```

- Tasks: **425**
- Unique task IDs: **425**
- Required fields per task: **15**
- Duplicate IDs: **0**
- Missing fields: **0**
- Unknown dependencies: **0**
- Dependency cycles: **0**
- Non-blocked tasks with unfinished prerequisites: **0**
- Active tasks without an evidence path: **0**
- Missing explicit A001-A045/B001-B045/C001-C021 IDs: **0**
- Unsupported `DONE` claims: **0**
- Priority Zero first: **yes**

## Counts by workstream

| Workstream | Tasks |
| --- | ---: |
| P0 | 18 |
| GLOBAL | 23 |
| A | 45 |
| B | 45 |
| C | 90 |
| D | 37 |
| E | 25 |
| F | 32 |
| G | 17 |
| H | 33 |
| I | 6 |
| J | 8 |
| K | 46 |

## Counts by status

| Status | Tasks |
| --- | ---: |
| TODO | 26 |
| IN PROGRESS | 0 |
| BLOCKED | 398 |
| READY FOR VERIFICATION | 1 |
| RETEST REQUIRED | 0 |
| DONE | 0 |

## Evidence boundary

The recovery package evidence is recorded at `G:\CLever bee Backup\04-database\final-live-pitr-20260722T093600AEST`. Its `source-verification.tsv` fixes the recovery-point counts at Runner 5,298,108 and Result 4,664,787; it does not freeze current live totals. The reported 140-entry checksum pass and manifest SHA-256 `137445b54b55a9c4ca15aac4a365ac3a3b2ff18c5f9c74b2e66b3b8463beec` are retained verbatim.

P0 source discovery must remain official, lawful and fail closed. Public availability or HTTP 2xx does not prove playable media or rights to embed, download, bulk acquire or rehost. Provider-wide gap filling is externally blocked until written permission or approved API scope exists. Race/RaceVideo currently lack the required append-only playback/licence/confidence/evidence/replacement-lineage and quarantine contract, so linkage repair remains blocked. No replay may be linked or repaired by name alone. Production repair tasks require a verified fresh recovery point, explicit approval, exact identity assertions, rollback evidence and a complete retest.

## Clarified replay delivery scope

The requested production behavior is now limited to exact canonical public-source links and provider-supported iframes. GreyhoundsIQ will not download, retain, proxy as its own media or rehost replay files. A verified public YouTube/Vimeo player may be used when the exact authority-owned video permits embedding; a first-party page that blocks framing, or any unresolved player, must fall back to a clear **Watch on official source** link. Missing commercial/bulk/download/rehost authority remains recorded in `P0-018` but no longer blocks this narrower link/iframe workflow.

## Current VPS release evidence

The app-only replay/photo-finish release, database invariants, provider playback checks, five-minute sync evidence and finalized 841,615-race base inventory are recorded in [replay-photo-release-evidence-2026-07-22.md](./replay-photo-release-evidence-2026-07-22.md). The zero-filled month/source provenance companion and remaining browser/mobile task matrix are not complete.

## 2026-07-23 session status (public + blocked host)

Live public observation (no host mutations): site online, `/api/health/ready` reports `database: ok`, breeding tallies and race cards render. Host-level A010–A011 exact `Runner`/`Result` counts and Docker/UFW audits remain **blocked** because SSH port 22 is unreachable from workstation IP `202.171.188.71` (likely fail2ban after key probes).

Full write-up, screenshots, and read-only host gate script:

- [evidence/2026-07-23-session/recovery-status-2026-07-23.md](./evidence/2026-07-23-session/recovery-status-2026-07-23.md)
- [evidence/2026-07-23-session/readonly-host-gate.sh](./evidence/2026-07-23-session/readonly-host-gate.sh)
- [evidence/2026-07-23-session/screenshots/](./evidence/2026-07-23-session/screenshots/)
