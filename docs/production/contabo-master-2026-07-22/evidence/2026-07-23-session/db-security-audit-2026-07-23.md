# GreyhoundsIQ database, performance and security audit — 2026-07-23 (in progress)

Scope per owner directive: diagnose the current issue and root cause, then full DB
performance, schema/relationship, entitlement and RLS/API security audit against
live production (Contabo `217.216.76.124`, DB `giq_production_stage11_20260718_r2`,
21 GB). All collection so far is read-only; no production mutation.

## 1. Original issue — root cause (FIXED)

**Symptom:** breeding/test-mating search returned duplicate dogs; stats and
ancestry missing ("Not available", 3% completeness, empty crosses).

**Root cause (two defects):**
1. **Identity fragmentation.** The same real dog exists as separate `Dog` rows per
   source (`thedogs`/`watchdog` racing, `galtd` studbook, 136,115 legacy unsourced
   rows) with no runtime link. All read paths keyed on one `Dog.id`, so each UI
   surface saw only one fragment. Evidence: Fernando Bale = 2 rows (galtd row with
   deep pedigree, thedogs row with 44 starts + 1,914 racing progeny), zero bridge.
2. **Id validation bug.** `/api/breeding/cross*` rejected legacy `hist_dog_*` ids
   (pattern lacked underscore) → 400 → "zero data" for e.g. Ritza Trish.

**Fix (deployed r5, commit `1dcf1a0d`):** conservative query-time identity
clustering in `src/lib/dog-identity.ts` (same normalized name; same-provider rows
never merge; whelp years >1 apart never merge; ambiguous rows stay solo; sex is
display-only because studbook sex labels are known-noisy). Applied to breeding
search dedupe, 5-gen pedigree walk, progeny records (sire pages, dam pages,
cross), pair progeny and partner picks — with progeny deduped across sources.
No database rows merged; identity repair remains gated behind PedigreeMergeLedger.

**Verified live:** Fernando Bale one search hit (was 2); Fernando × Sweet It Is
pair progeny 0 → 2; Fernando progeny 1,914 → 2,780 (deduped union) at 60.8%
strike; Cumbria Jack empty → 36 starts/25 wins + 37% tree; Cumbria × Ritza Trish
"zero data" → 13 shared ancestors with line-breeding counts. Twin-fetch query
uses `Dog_lower_name_prefix_idx` (0.45 ms EXPLAIN ANALYZE).

## 2. Performance baseline (before, public curl from workstation)

| Route | Status | Time | Bytes |
| --- | ---: | ---: | ---: |
| / | 200 | 1.43s | 432KB |
| /races | 200 | 2.68s | 639KB |
| /results | 200 | 3.87s | 1.66MB |
| /dogs | 200 | 0.18s | 111KB |
| /breeding | 200 | 0.52s | 242KB |
| /statistics | 200 | 1.06s | 183KB |
| /tracks | 200 | 0.56s | 651KB |
| /marketplace | 200 | 0.20s | 322KB |
| /pricing | 200 | 0.09s | 148KB |

Sub-second already: /dogs /breeding /tracks /marketplace /pricing /statistics(~1s).
Over target: `/results` (worst), `/races`, `/`.

### Findings
- **pg_stat_statements not installed** — no per-query visibility. Enabling needs
  `shared_preload_libraries` + postgres container restart (owner approval gate).
- Large avg seq scans: Runner 618 scans × 2.9M rows, FormEntry 226 × 4.2M,
  Result 368 × 1.6M, Race 1,275 × 676K. Correlates with /results and /races.
- `/results`: data cached (60s recent / 5min filters) but renders ~100 fully
  hydrated race cards server-side → 1.66MB HTML. Optimisation path: smaller
  default page + progressive load, not indexes.
- Connections healthy: 29 of 150.
- 7 FKs missing leading indexes (all pedigree-import tables:
  DogSourceIdentity/PedigreeAssertion/PedigreeMergeLedger) — cheap index adds,
  low runtime impact today.

## 3. Schema and integrity

- 0 orphaned `Runner.dogId`; 0 dangling `Dog.sireId/damId` references.
- 3 `NOT VALID` constraints on FeedPost/FeedReaction — `VALIDATE CONSTRAINT`
  pending (brief share lock; safe window recommended).
- Duplicate entities: root-caused above; runtime bridging live; durable merge
  remains ledger-gated by design.
- 115/115 tables have PKs; 209 FKs valid (per 2026-07-23 QA evidence, re-confirmed
  structurally this session).

## 4. Entitlements

- Tier source of truth: `User.subscriptionTier` (free/pro/pro_plus), read
  server-side via `getCurrentUser()`; `hasTier()` gates.
- Live distribution: 13 free / 7 pro_plus / 1 pro (21 users).
- **Subscription table is empty** — every paid tier is a manual founder grant;
  the Stripe → subscription → tier path has never executed in production.
  The owner's "payment allocates correct rights" end-to-end test is still open
  (safe two-account Stripe test-mode plan exists from the earlier payment audit).
- Test Mating now Pro-gated at page AND API (negative tests: anon → 403
  `tier.pro_required` on `/api/breeding/cross` and `/partners`; page renders
  upsell; pricing lists the feature under $20 Pro). Free-tier browser matrix
  still to run with a real free account.

## 5. RLS / API security

- RLS enabled AND forced on every public table except `_prisma_migrations`
  (internal); 246 policies — live VPS catalog now verified, closing the prior
  "not independently proven" gap.
- **7 SECURITY DEFINER functions with `search_path=public`** (hardening fix =
  pin empty search_path + schema-qualify): giq_is_storage_admin,
  giq_call_room_current_profile_can_join / _has_access / _is_creator,
  giq_current_profile_role, giq_org_current_user_is_member / _is_owner.
  Newer functions (e.g. giq_profile_account_active) already pin `''`.
- Roles: `service_role` has BYPASSRLS (server-only by design); runtime role
  `greyhoundiq_runtime` non-super, non-bypass. No unexpected superusers.
- Console/network sweep found `POST /api/realtime/token → 415` on authed pages —
  functional defect (likely content-type handling), realtime channel token not
  issued from this path. Needs fix + retest.

## 6. Known-red test

`scripts/check-account-deletion-finalize-postgres.test.ts` fails: recorded
evidence hashes for `src/lib/db.ts`, `db-context.ts`, `account-service.ts` no
longer match sources (drift from earlier account/db edits shipped without
regenerating evidence). Pre-existing on branch; regeneration requires the local
prod-mirror database (127.0.0.1:55734) and a fresh verification run.
Note: earlier "suite green" claims this session were invalid — piped tails
masked exit codes; suite is red on exactly this test.

## Remaining audit work

1. Free/expired-tier negative matrix with real accounts (UI + API).
2. Stripe test-mode payment → entitlement allocation end-to-end.
3. `/results` + `/races` payload optimisation; EXPLAIN on their queries;
   re-measure against sub-second target.
4. pg_stat_statements enablement (needs approved restart) + slow-query monitor.
5. SECURITY DEFINER search_path hardening migration (recovery point exists:
   pre-r4 dump, off-VPS, sha `83aa6724…9828`).
6. VALIDATE the 3 NOT VALID feed constraints.
7. Fix `/api/realtime/token` 415.
8. Regenerate account-deletion finalize evidence with local DB.
9. Pedigree-import FK indexes.
10. Load/concurrency check + monitoring/alerting review.

## 7. GRV FastTrack as a test-mating data source (assessed 2026-07-23 evening)

FastTrack (fasttrack.grv.org.au) publicly exposes exactly the record types our
test-mating gaps need: **Litter Search**, **Stud Dog Service Search**, leading
sire/dam statistics, and per-dog registry pages (whelp dates, colours, ear
brands, pedigree links) for Victorian greyhounds.

**Terms & Conditions verdict (read this session): blocked for harvesting.**
The T&C prohibit copying, reproducing, downloading or storing site contents and
explicitly prohibit incorporating any part of the site into another web site
without GRV's written consent; Race Information downloads are limited to
GRV-approved persons; any other use requires a separate written agreement via
GRV's E-Business Manager. Under the repo's fail-closed source contract this
matches the GreyhoundRecorder outcome: **no scraping, no bulk acquisition.**

**Sanctioned path:** request a written data agreement from GRV (E-Business
Manager) and/or apply for GRV's official Topaz API access, scoped to breeding
records (litters, services, registry identities). Recorded under P0-018-class
authority tracking; owner action required to initiate contact.
