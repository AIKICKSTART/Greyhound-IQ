# Contabo production recovery status — 2026-07-23 session

**Authority:** Contabo VPS `vmi3457792` / `217.216.76.124` is the final production target.  
**Safety:** No database rebuild, rollback, volume delete, or service stop was performed. No secrets were printed.

## Executive status

| Gate | Status | Notes |
| --- | --- | --- |
| Public site online | **PASS (observed)** | HTTPS 200, Caddy reverse proxy, live race cards for 23 July 2026 |
| App + DB readiness | **PASS (observed)** | `/api/health` ok; `/api/health/ready` `database: ok` |
| Exact Runner/Result recovery counts (A010–A011) | **BLOCKED — no host shell** | SSH port 22 unreachable from workstation after failed key probes; cannot run `psql` count queries |
| Fresh recovery point (A025–A029) | **BLOCKED — no host shell** | Requires host access after exact count validation |
| Host/Docker/UFW audit (B*) | **BLOCKED — no host shell** | Public port probes only |
| Full RLS / PostgREST / Realtime audit (E/F) | **BLOCKED — no host shell** | |
| Training video capture (I) | **NOT STARTED** | Deferred until workflows pass and SSH/DB gates clear |

**Bottom line:** Production is already serving live traffic with a healthy application database connection. The prompt’s “app stopped during recovery” state is **stale relative to public observation**. Host-level recovery gates and exact table counts remain **unverified in this session** because SSH is blocked from this workstation.

## Drift from prompt baseline (public + prior evidence)

| Item | Prompt baseline (recovery-time) | Observed / recorded |
| --- | --- | --- |
| App service | Intentionally stopped | **Running** (public health ready) |
| Image tag | `greyhoundiq/web:vps-stage11-r2-20260722` | Later release evidence records `greyhoundiq/web:vps-replay-photo-forward-20260722` (see `replay-photo-release-evidence-2026-07-22.md`). Live image digest **not re-confirmed** without shell. |
| Runner exact | `5,298,108` at PITR freeze | Prior post-sync observation at 2026-07-22 20:13 AEST: `Runner=5,299,624` (live ingest growth expected after freeze) |
| Result exact | `4,664,787` at PITR freeze | Prior post-sync observation: `Result=4,665,423` |
| Race rows | (not fixed in prompt A-gate) | Prior release evidence: `841,615` races at app switch; live cards still serving |

Interpretation: A010/A011 exact equality applies to the **recovery freeze / PITR validation point**, not necessarily to a live system after scheduled sync. Exact current counts still require a single authorised `COUNT(*)` on the Contabo Postgres container.

## Workstation access failure (blocker)

- Key present: `~/.ssh/id_ed25519_greyhoundsiq_contabo` (comment `greyhoundsiq-contabo-20260722`)
- Expected user (package docs): `deploy` (also historically `root` during bootstrap)
- Public source IP of this workstation: **`202.171.188.71`**
- Sequence:
  1. Early attempts: `Permission denied (publickey)` for several users
  2. `deploy` once returned `Connection reset`
  3. Later: **TCP 22 closed/filtered / connect timeout** (consistent with fail2ban after multi-user probes or temporary Contabo filter)
- **No further SSH attempts should be made** until the IP is unbanned and the correct authorised key/user is confirmed on the host.

### Required owner action to unblock A–F host gates

On Contabo (console/VNC or an already-authorised session), run **only**:

```bash
# 1) Unban this workstation if fail2ban holds it
sudo fail2ban-client status sshd
sudo fail2ban-client set sshd unbanip 202.171.188.71

# 2) Confirm deploy key login works from this workstation
# (do not open password auth; do not expose 5432)

# 3) Then re-run the read-only script:
# docs/production/contabo-master-2026-07-22/evidence/2026-07-23-session/readonly-host-gate.sh
```

## Public network / TLS / port evidence (this session)

Captured from workstation `202.171.188.71` at ~2026-07-22 17:00–17:05 UTC (23 July AEST morning).

### DNS

| Name | A record |
| --- | --- |
| `greyhoundsiq.com.au` | `217.216.76.124` |
| `www.greyhoundsiq.com.au` | `217.216.76.124` |
| `livekit.greyhoundsiq.com.au` | `217.216.76.124` |
| `realtime.greyhoundsiq.com.au` | DNS fail |
| `api.greyhoundsiq.com.au` | DNS fail |

### External TCP

| Port | Result | Expected |
| --- | --- | --- |
| 22 | CLOSED/FILTERED from this IP | Open for authorised SSH only |
| 80 | OPEN | Yes |
| 443 | OPEN | Yes |
| 5432 | CLOSED/FILTERED | Must stay private — **PASS from outside** |
| 7880 | CLOSED/FILTERED | Must stay private — **PASS from outside** |
| 7881 | OPEN | LiveKit RTC |

### HTTP / HTTPS

- `http://greyhoundsiq.com.au/` → **308** to `https://greyhoundsiq.com.au/`
- `https://greyhoundsiq.com.au/` → **200** (~422 KB HTML), `Via: 1.1 Caddy`
- Security headers observed: HSTS (`max-age=31536000; includeSubDomains`), CSP with `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, COOP/CORP, Permissions-Policy, Referrer-Policy

### Health

```json
{"status":"ok","service":"greyhoundiq-web","timestamp":"2026-07-22T17:00:16.939Z"}
{"status":"ready","checks":{"database":"ok"},"timestamp":"2026-07-22T17:00:17.180Z"}
```

### Public route matrix (status / latency / bytes)

| Path | Status | Latency (approx) | Bytes |
| --- | ---: | ---: | ---: |
| `/` | 200 | 1176 ms | 422506 |
| `/races` | 200 | 1285 ms | 606204 |
| `/dogs` | 200 | 105 ms | 109630 |
| `/breeding` | 200 | 125 ms | 234760 |
| `/tracks` | 200 | 556 ms | 607084 |
| `/vets` | 200 | 129 ms | 328479 |
| `/agents` | 200 | 129 ms | 122842 |
| `/marketplace` | 200 | 319 ms | 314421 |
| `/pricing` | 200 | 166 ms | 147792 |
| `/statistics` | 200 | 201 ms | 182777 |
| `/results` | 200 | **4994 ms** | 1665334 |
| `/sign-in` | 200 | 2383 ms | 118992 |
| `/contact` | 200 | 135 ms | 113219 |
| `/api/health` | 200 | 226 ms | 82 |
| `/api/health/ready` | 200 | 93 ms | 84 |

**Defect candidate (performance, not downtime):** `/results` ~5 s TTFB/body and 1.6 MB payload — track under workstream C/G as capacity/UX, not as recovery failure.

## Browser evidence (Chrome DevTools MCP)

Screenshots:

- `screenshots/home-desktop.png`
- `screenshots/breeding-desktop.png`
- `screenshots/home-mobile-390.png`

### Home (desktop a11y snapshot)

- Title: `GreyhoundIQ — Australian Greyhound Racing Intelligence`
- Primary nav includes: Home, Racing, Tracks, Dogs, **Breeding**, **Vets**, Agents, Marketplace, Pricing
- Today’s races: **Thursday 23 July**, **15 meetings · 161 races**
- Live meetings observed include Cannington (WA), Shepparton (VIC), Ladbrokes Q Straight (QLD), Richmond Straight (NSW), Mount Gambier (SA)
- Console errors on home load: **none** (error/warn filter empty)

### Breeding (desktop a11y snapshot)

Rendered production breeding tallies (application queries against live DB):

| Metric | Value |
| --- | ---: |
| Greyhounds mapped | **261,653** |
| Breeding dogs | **68,283** |
| With pedigree links | **59,027** |
| Studbook volumes | **8** |

Sire leaderboard samples (progeny / winners / win% / prize from wins):

| Rank | Sire | Progeny | Winners | Strike | Prize |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 | Barcia Bale | 2398 | 1459 | 60.8% | $12.5M |
| 2 | Fernando Bale | 1914 | 1117 | 58.4% | $15.3M |
| 3 | Magic Sprite | 1169 | 630 | 53.9% | $3.2M |

Litter nicking tables and `/breeding/cross` entry points are present. This is **strong public evidence** that breeding + pedigree data paths work, but it is **not** a substitute for full pedigree FK integrity SQL (workstream D).

## Prior verified release evidence (not re-run this session)

Source: `docs/production/contabo-master-2026-07-22/replay-photo-release-evidence-2026-07-22.md`

- App-only release on Contabo without DB restore/migration/rollback
- Protected race/video fingerprints unchanged across switch
- Official YouTube/Vimeo iframe + provider external-link behaviour verified in browser
- Live sync after release exited 0 with monotonic protected counts

## Workstream J (cost comparison)

Existing planning artefact: `docs/production/contabo-master-2026-07-22/cost-comparison-2026-07-22.md`

Decision retained: keep Contabo single-VPS production under current budget; do not migrate for temporary cloud credits. Physical DC location for the paid instance still needs Contabo panel confirmation.

## Task ledger note

Master ledger: `docs/production/contabo-master-2026-07-22/task-ledger.json` (425 tasks; 398 BLOCKED / 26 TODO / 0 DONE at last generate).

This session **does not** mass-flip tasks to DONE. Evidence paths above should be attached when regenerating ledger after SSH validation.

## Safe next commands (host only, after SSH restored)

See `readonly-host-gate.sh` in this folder. Order:

1. Read-only host + docker + ufw + compose config  
2. Read-only `psql` database names, sizes, Runner/Result counts  
3. Compare counts to PITR freeze and post-sync expectations  
4. **Only if counts/structure pass:** create offline backup to a path **outside** `greyhoundiq_postgres_data`  
5. **Only after backup verified:** controlled start of any still-stopped dependents (may already be up)

## Explicit non-actions this session

- Did not stop, restart, recreate, or scale any production container  
- Did not run `pg_restore`, `DROP`, `TRUNCATE`, Prisma migrate, or volume prune  
- Did not open PostgreSQL publicly  
- Did not weaken UFW  
- Did not record credentials  
- Did not claim full production sign-off  
