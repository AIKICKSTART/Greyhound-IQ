# Race Provider Deployment Smoke Checks

Use this checklist when account or billing changes ship so race-provider
connectivity is not regressed by unrelated release work. Do not paste secrets,
tokens, API keys, database URLs, or private provider responses into release
notes, issues, screenshots, or logs.

## Scope

Preserve these connections across preview, staging, and Google Cloud VPS
production deployments:

- Topaz licensed feed configuration.
- TheDogs national public racecards, results, replays, raw archive, and dog
  profile import paths.
- Watchdog Victoria/GRV racecards, results, tips, and replay IDs.
- FastTrack prototype fallback when public feeds are disabled.
- Archive/import database replay jobs for historical race and dog-profile data.

Account and billing releases must not change provider env vars, live-sync
schedules, archive/import scripts, database connection limits, or data-source
precedence unless the release explicitly owns that migration.

## Before Deploy

- Confirm the deployment target is using the intended database/storage
  environment: staging for previews and pre-launch testing, production only for
  the production launch.
- Confirm the Google Cloud VPS runtime, scheduler, and any remaining preview
  host contain the expected provider env var names from `.env.example`; verify
  names only, never values.
- Confirm account or billing env changes did not delete or rename:
  `TOPAZ_API_KEY`, `TOPAZ_API_BASE`, `TOPAZ_OWNING_AUTHORITY_CODE`,
  `TOPAZ_TIME_ZONE`, `THEDOGS_PROVIDER_ENABLED`, `THEDOGS_BASE_URL`,
  `THEDOGS_MAX_MEETINGS`, `THEDOGS_CONCURRENCY`, `THEDOGS_TIME_ZONE`,
  `WATCHDOG_PROVIDER_ENABLED`, `WATCHDOG_BASE_URL`,
  `WATCHDOG_MAX_MEETINGS`, `WATCHDOG_CONCURRENCY`,
  `WATCHDOG_FETCH_TIMEOUT_MS`, `FASTTRACK_PROTOTYPE_ENABLED`,
  `FASTTRACK_BASE_URL`, or `FASTTRACK_MAX_MEETINGS`.
- Confirm `.github`, VPS cron/systemd timers, or other scheduler changes did
  not disable `Live Racing Sync` or the `/api/internal/live-sync` backup call.
- Confirm no migration in the release drops, truncates, renames, or rewrites
  live/archive provenance fields such as `sourceProvider`, `sourceId`, or
  `sourceRawJson`.

## After Deploy

- Run the standard deployment smoke gate against the deployed URL:

```bash
SMOKE_BASE_URL="https://<deployment-url>" npm run test:smoke
```

- Open `/api/health/feeds` on the deployed app and confirm:
  - `status` is `configured`, or `waiting_for_credentials` only when the
    target intentionally lacks a blocking credential.
  - `activeProvider` includes the expected combination of `thedogs`, `topaz`,
    `watchdog`, or `fasttrack-prototype` for that environment.
  - Feed entries for `thedogs`, `topaz`, `watchdog`, and
    `fasttrack-prototype` are still present.
  - `data.database` is `ok`.
  - `liveProviders` contains recent live-sourced provider rows when the target
    database already has synced racing data.
- Trigger or wait for the next `Live Racing Sync` run, then confirm
  `/api/health/feeds` updates `latestRaceTime`, `latestResultAt`,
  `upcomingMeetings`, `upcomingRaces`, and `upcomingRunners` as expected for
  the racing calendar.
- Run the live coverage audit after production sync:

```bash
npm run audit:live-race-coverage -- 7
```

- For TheDogs archive/import continuity, run read-only or bounded operator
  checks before restarting any long-running worker:

```bash
npm run status:thedogs:harvest
npm run supervise:thedogs:imports -- --check-once
npm run supervise:thedogs:race-day-archive -- --check-once
npm run supervise:thedogs:dog-profile-import -- --check-once
```

## Provider Expectations

- TheDogs remains enabled by default and provides the all-Australia public
  baseline for racecards and results.
- Topaz is additive when `TOPAZ_API_KEY` is configured; do not block deployment
  solely because a non-production target lacks a licensed key.
- Watchdog remains additive for Victoria/GRV enrichment and should not replace
  TheDogs national coverage.
- FastTrack is a bounded prototype fallback only. It should be active only when
  public/licensed providers are intentionally disabled or unavailable.
- Archive/import jobs are operator workloads, not request-time app functions.
  Do not run multi-year backfills inside deployment smoke testing.

## Rollback Signals

Stop the rollout or roll back the deployment when any of these appear after an
account or billing change:

- `/api/health/feeds` is unreachable, returns a server error, or reports
  `data.database` as `error`.
- Expected provider feed entries disappear from `/api/health/feeds`.
- `activeProvider` drops a provider that is configured for the environment.
- Standard smoke checks fail for `/api/health`, `/api/health/ready`, or
  `/api/health/feeds`.
- Live sync logs show missing provider env names, auth failures, unexpected
  provider disablement, or repeated database connection exhaustion.
- Archive/import check-once commands report database unavailability, active
  worker conflicts, source ID mismatches, or corrupt archive samples.
