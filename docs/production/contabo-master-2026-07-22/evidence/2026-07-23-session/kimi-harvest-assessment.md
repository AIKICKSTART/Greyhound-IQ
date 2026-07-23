# Kimi pedigree harvest — usefulness assessment (2026-07-23)

Source: `C:\Users\verri\Downloads\Kimi_Agent_Pedigree Data via API.zip` (founder-harvested, 95MB extracted).
Contents: `greyhound_pedigrees.db` (SQLite) + `gph` Python harvester (resumable crawler, 106 tests) + recon docs.

## What the DB actually contains (verified locally)

| Table | Rows | Notes |
|---|---|---|
| dogs | 3,775 | 1,415 with whelp year; countries mostly unset / IE 320 / AU 97 |
| pedigree_edges | 2,297 | fasttrack 1,557 + gbgb 740; 1,147 distinct children |
| mating_records | 3,008 | REAL stud-service records (service date + Natural/Frozen/AI type) — a data type production does not have |
| fetch_queue | 18,814 | harvest barely started: fasttrack 97 done / 5,041 pending; gbgb 245 done / 13,425 pending; icc 6 pending |

## Overlap vs production (run 2026-07-23 on VPS, read-only, ROLLBACK)

- 2,297 distinct harvested parent links; 549 child names exist in prod `Dog`.
- **1,193 links land on prod dogs whose parent slot is currently EMPTY** (589 sire + 604 dam) — direct gap-fill for test-mating completeness.
- 531 of the harvested parent names already exist as prod dogs → most fills link to known dogs, not new stubs.
- **2,987 of 3,008 mating records have BOTH sire and dam matched in prod** — near-perfect join.

## Verdict

- Data volume is small (harvest ~2% complete) but per-row quality/relevance is high.
- Highest-value ingest: `mating_records` (novel data — real service dates/types) and the 1,193 empty-slot parent links, via the existing `PedigreeAssertion` layer (status `parsed`, new sourceProvider per origin) — same pattern as the GALTD importer, no Dog mutation.
- The toolchain matters more than the snapshot: ICC full-5-gen-per-page source, GBGB open JSON API adapter (UK — overlaps the RapidAPI plan, but free), Topaz API stub (the sanctioned GRV path; needs X-API-Key from automation@betfair.com.au).

## Provenance caution (founder decision needed before import)

- `fasttrack` rows (1,557 edges + all 3,008 matings) were scraped from GRV FastTrack — the source we classified ToS-blocked pending the written-consent / Topaz path (grv-data-request-draft.md). Importing them into the public product before consent lands contradicts the fail-closed sourcing stance.
- `gbgb` rows (740 edges) come from GBGB's open public JSON API — low risk.
- Recommended order: import gbgb rows now; hold fasttrack rows until the GRV/Topaz authorisation exists (the harvester can then legitimately re-fetch via Topaz anyway).
