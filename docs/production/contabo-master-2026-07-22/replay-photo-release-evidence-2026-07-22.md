# Replay and photo-finish VPS release evidence

This record covers the application-only GreyhoundIQ production release on
2026-07-22. It does not claim completion of the full 2006-present replay
inventory or full cross-browser/mobile coverage.

## Release identity

- VPS: `217.216.76.124`
- Stack directory: `/opt/greyhoundiq`
- Database: `giq_production_stage11_20260718_r2`
- Source baseline: `f9fb87957c68283c6ce162366c13892b3077f9c9`
- Application image: `greyhoundiq/web:vps-replay-photo-forward-20260722`
- Image ID: `sha256:217b0c9343d9bbd6920a1508169c47d64115a3c46cc6a32b92f559480ffe778f`
- Local image archive: `C:\Users\verri\Desktop\CLever bee Backup\08-clean-vps-deployment\images\greyhoundiq-web-vps-replay-photo-forward-20260722.tar`
- Archive size: `730,207,232` bytes
- Archive SHA-256: `4c1ca4cc192939a67620b56b3772f5cddd9f1e176fb9c0e6103dbf7ca1221ad9`
- VPS app start: `2026-07-22T09:52:01Z` / `2026-07-22 19:52:01 AEST`

The image was built from the clean release worktree with production public
browser values held only in process memory. Build provenance was disabled. The
Docker build ran the Next.js 16.2.10 production build and TypeScript gate to
completion.

## Released behavior

- Official YouTube and Vimeo replay identifiers render through their supported
  privacy-preserving iframe players.
- Racing Queensland, The Dogs, Tasracing and non-YouTube Watchdog records use a
  visible `Watch on official source` link rather than proxying or rehosting
  provider media.
- A valid legacy `Race.replayUrl` remains available when present RaceVideo rows
  are invalid or not allowlisted.
- GRV photo-finish images render only from the exact HTTPS Azure blob origin;
  credentials, ports, query strings, fragments and foreign origins fail closed.
- Five-minute sync conflict handling is fill-only for Race replay/photo fields
  and protected RaceVideo source/media fields. Existing non-null values win;
  null gaps may be filled; `lastSyncedAt` still advances.

No schema, migration, restore, `pg_restore`, Prisma migration or database
rollback command was run for this release.

## Code gates

- Official-source replay/photo test: passed.
- Fill-only replay sync regression test: passed.
- Existing replay parser checks: passed.
- Full clean-worktree typecheck: passed.
- Full clean-worktree lint: passed.
- Docker production build: passed.
- `git diff --check`: passed.
- Independent seven-file release review: approved after two no-degrade defects
  were corrected and retested.

## Deployment invariants

The live-sync timer was stopped before the switch. Compose recreated only the
`app` service with `--no-deps --no-build --pull never`. PostgreSQL, PostgREST,
Realtime, Realtime Gateway, LiveKit and Caddy retained the same container IDs,
image IDs and start times.

Immediately before and after the app switch, the protected database snapshot
was identical:

| Metric | Before | After |
| --- | ---: | ---: |
| Race rows | 841,615 | 841,615 |
| Race replay URL rows | 441,323 | 441,323 |
| Race photo-finish URL rows | 361,724 | 361,724 |
| RaceVideo rows | 469,071 | 469,071 |
| RaceVideo page URL rows | 469,071 | 469,071 |
| RaceVideo stream URL rows | 293,964 | 293,964 |
| Race replay/photo fingerprint | 1,899,334,925,685,380,361 | 1,899,334,925,685,380,361 |
| RaceVideo protected fingerprint | 8,028,850,462,658,851,482 | 8,028,850,462,658,851,482 |

The application readiness endpoint and `/results` both returned successfully.
The production Compose file was then atomically changed only from the prior app
tag to the new app tag. Its post-change SHA-256 is
`c3c1a4e8dc5945ad9336261622112ba95f71f005e294c91f2c155c2345a1e1b9`.
The transferred VPS tar and superseded VPS app tag were removed after
verification; `/opt/greyhoundiq/incoming` is empty.

## Browser evidence

Browser checks against the public VPS deployment produced no application-error
page.

| Check | Evidence |
| --- | --- |
| Results | `/results` rendered `Race Results`, contained 2026-07-22 data and linked current race pages. |
| Watchdog / YouTube | Race `dc6a9a26-3c55-4521-8142-eba1f122224e` loaded a `youtube-nocookie.com` frame. Playback reached ready state 4, was not paused and advanced beyond 0 seconds. |
| Greyhounds WA / Vimeo | Race `a052374d-c6fd-4893-a8fb-e3775d49b807` loaded the official Vimeo player. Playback reached ready state 4, was not paused and advanced to 16.45 seconds of a 54.56-second replay. |
| SA official YouTube | Race `cmr0fpsuo0086epzsylujdbre` rendered official YouTube replay frames and canonical source links. |
| Racing Queensland | Race `0153ebf4-0ab1-4895-ae32-1d0c77980fe0` rendered the canonical Racing Queensland link; that provider page opened with the matching Capalaba race title. |
| The Dogs | Race `0004a18c-7b4c-4a14-8f36-6ecee5694e68` rendered the canonical provider link; the page opened as Richmond 8 October 2012 Race 8. |
| Tasracing | Race `030971d5-df7a-472b-9ba9-5962a8223d3d` rendered the canonical provider link; the Hobart 7 July page opened successfully. |
| Photo finish | Race `438a179e-33dc-4f16-a891-fe01ea32dcc3` loaded the official GRV image completely at intrinsic size 2001 by 338 pixels. |

## Post-release live sync

The first controlled run exited with status 0 and zero replay errors. Its
before/after counts were monotonic:

`841615|441323|361724|469071|469071|293964`

to:

`841615|441324|361724|469072|469072|293964`

This added one missing Race replay URL and one RaceVideo record without reducing
any protected count. Subsequent scheduled runs at the five-minute calendar
boundary also exited successfully with zero replay errors. At 2026-07-22
20:13 AEST the current counts were:

`Race=841615, Race.replayUrl=441331, Race.photoFinishUrl=361729, RaceVideo=469081, RaceVideo.pageUrl=469081, RaceVideo.streamUrl=293964, Runner=5299624, Result=4665423`.

The timer was active/waiting after its 20:10 AEST run with the next trigger at
20:15 AEST.

## Results alias follow-up release

The latest provider-safe, application-only follow-up release is
`greyhoundiq/web:vps-results-alias-forward-20260722` with image ID
`sha256:947a93964f21d90345d96d42dc0670d56df2b2bb12642d1399cc41068994d957`.
Its clean local archive is
`D:\GreyhoundIQ Backup\08-clean-vps-deployment\images\greyhoundiq-web-vps-results-alias-forward-20260722.tar`
(`730,209,280` bytes; SHA-256
`3322FC8AFEEC8F8F3818882E6753ACC03A75F5151E6E44755BD037326B8BF264`).
The exact deployed source is also preserved at
`D:\GreyhoundIQ Backup\08-clean-vps-deployment\source\greyhoundiq-vps-results-alias-forward-source-20260722.tar.gz`
(`83,285,801` bytes; SHA-256
`AE2E00A55FDE7F876F8F27DF5E553B571C0F7E010F679DE9CFFFFA655C485C10`).
Its 2,637 entries include the required Dockerfile, package files, queries,
sync, track-name and tests, with zero credential, build or cache entries. This
preserves the live source without overwriting the dirty main worktree.

The candidate returned HTTP 200 from both `/api/health/ready` and `/results`.
The protected racing snapshot was exactly equal before and after the app
switch:

`841615|441351|361760|4170799429261637282626|469124|469124|293964|-5414978867252277767096|5299625|-15183525959574090988678|4665706|5652786285455080470180|261653|76954|77|14026|760b8586d5bfca0dbc2310872bf6ca1d|da150fe3aded5d496135633eb4841285`

All six non-app container IDs remained unchanged. The Compose SHA-256 changed
only with the verified app update, from
`43954bb55d36e2e493a61c97193be92aab8604998032f9de2356878742c78254` to
`d6df8cdb1f730206d8b629ebcc537999e04f89209360b589f155ccb1459b250d`.
After successful verification, the transferred tar, rollback Compose copy and
superseded app tag were removed. The five-minute timer remains active and
enabled, and the public readiness and results endpoints return HTTP 200.

The post-release scheduler service completed successfully with
`ExecMainStatus=0` and became inactive at `14:51:07 CEST`. Its latest results
run processed 25 meetings, 301 races, 2,405 runners and 1,919 results, with 10
replay candidates and zero replay errors. The upcoming-race pass processed 64
meetings and 732 races with 5,934 runners and zero replay errors.

Public browser verification rendered 50 result cards, no `Meadows (MEP)`
cards or filter options, one canonical `The Meadows` option, and six runners in
The Meadows R10. The browser reported no warnings or errors. South Australia
and Western Australia still had zero RaceVideo rows for today's races, so this
release does not claim complete same-day replay coverage. LiveKit reachability
was verified, but authenticated access and media transport were not.

The failed D-drive inventory partial was removed after its format failure, and
the corrected control-byte CSV export format passed independent review. The
fresh isolated, read-only export at
`D:\GreyhoundIQ Backup\05-replay-audit\replay-inventory-20260722T222502AEST`
then finalized with 841,615 lines, 841,615 unique race IDs and 440,612
anomalies. Its manifest explicitly records `playbackVerified=false`.

Independent manifest-bound rehashing passed for all four output files:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `race-replay-inventory.restricted.jsonl.gz` | 1,628,598,215 | `3bc5e90b2d6b6c401c19e5ab5a6bbd8c6aec628e2dc39d1286287fdea2baa653` |
| `replay-aggregates.json` | 96,382 | `10edb1fa544a23aa3a6172ce54b3ec8805ab36d1e4729710204b55d83d04b271` |
| `replay-anomalies.jsonl.gz` | 42,219,997 | `29e39ab73a2cdd0160f83a8ab9ee8cfcf460122b7903a0e1ffd86826c6ce5d94` |
| `export-context.json` | 1,132 | `daeb57a84537d026ac84bd36707e9936c6ac127589256b5681d29b59de198ddb` |

The aggregate records 446,173 races with video candidates, 441,308 with a
legacy reference and 447,226 with stored replay evidence. Stored candidate
coverage is 53.013908% and stored evidence coverage is 53.139024%; verified
playback coverage is `null`, so neither percentage is verified replay
coverage. The inventory contains 149,863 identity conflicts.

The final `verify.mjs` CLI rerun failed closed with `EEXIST` when its `wx`
write attempted to replace the already finalized anomaly file; it did not
modify that file, and the independent manifest hashes passed afterward. No
companion was created because the known source dump had moved to G: and that
drive physically disconnected during hashing. Companion generation remains
blocked until G: is reconnected.

## Remaining limits

- This is a representative production release check, not verification of every
  replay in the database.
- The inventory export is complete; its zero-filled month/source provenance
  companion must finish after G: reconnects before exact corpus-wide coverage
  can be stated.
- Mobile playback, seeking, audio, completion and every supported browser remain
  ledger tasks and are not claimed complete here.
- No last-resort direct database insert was performed.
