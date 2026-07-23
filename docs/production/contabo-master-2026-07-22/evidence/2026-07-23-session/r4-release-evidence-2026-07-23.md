# r4 app release evidence — 2026-07-23 (evening AEST)

**Release:** `greyhoundiq/web:vps-admin-feed-messenger-r4-20260723` on Contabo VPS `vmi3457792` / `217.216.76.124`.
**Source:** commit `a51ec9cf` on `codex/onboarding-live-source` (pushed to GitHub). Built on-host from `git archive` tarball at `/opt/greyhoundiq/incoming/build-r4-20260723`.
**Replaced:** `greyhoundiq/web:vps-messenger-livekit-friends-r3-20260723` (image retained on host; compose backup at `docker-compose.yml.bak-r3-20260723`).

## Scope — app image swap only

Verified delta against the live r3 source tree (`diff -rq` on host): 38 modified + 10 new source files.

1. Admin founder controls: shared submit buttons with pending state, ARIA feedback, 44px targets across 7 pages; mobile responsive surface (tables → labelled cards ≤640px).
2. Feed: Public/Friends modes with toggle, server-side audience SQL filters, sign-in guard.
3. Home: pre-login pricing cards + CTA conversion section placed before Today's Races.
4. Races explorer: Filter → Search rename, responsive wrapping state/status chips.
5. Marketplace: "Demo card · Preview only" overlay + Pro custom-cards note on all six showcase cards.
6. Messenger dock/call polish: hub conversation dock, thread page, call-service, realtime-refresh.
7. `globals.css` styling pass.

**Database changes: none.** Migrations `20260723123000_add_messenger_layout_preference` and `20260723160000_fix_member_actor_visibility` were verified already applied in `_prisma_migrations` (rows 106–107) before the swap; `Profile.messengerLayout` column and `giq_profile_account_active()` confirmed present. No schema or data write occurred during this release.

## Gates (all passed before swap)

| Gate | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test:unit` | PASS |
| `npm run build` (local, demo env) | PASS |
| Docker image build (production env, on host) | PASS — required `--build-arg NEXT_PUBLIC_WORKOS_REDIRECT_URI/SUPABASE_URL/SUPABASE_ANON_KEY`; first attempt without args failed env validation by design |
| `docker compose config --quiet` | PASS |

## Post-swap verification (public, unauthenticated)

- Container healthy in ~15s; `/api/health/ready` → `database: ok`.
- Routes 200: `/`, `/races`, `/feed`, `/pricing`, `/dogs`, `/breeding`, `/admin` (shell), redirects intact for `/listings→/marketplace`, `/messages→sign-in`, `/sign-in→WorkOS`.
- Feature markers confirmed live: marketplace demo overlay, home "Start Free"/#pricing/plan=free, races "Search" labels.
- Browser pass (Chrome DevTools MCP), desktop 1440 + mobile 390: home hero/pricing, races (state chips wrap, no horizontal scroll), feed (Public/Friends toggle), marketplace (6 overlaid demo cards). Console: zero errors/warnings.

## Recovery point

Fresh pre-release dump taken before swap (no write depended on it; taken as safety):
`pg_dump -Fc -Z6 giq_production_stage11_20260718_r2` → `/opt/greyhoundiq/backups/pre-r4-recovery-20260723.dump`
3,902,112,764 bytes, SHA-256 `83aa6724e9147eb7d4623f8c673be20c28dd8d83698e4a0aa761964482459828`, off-VPS copy at `E:\greyhoundiq-backups\` (workstation). Pre-change `SocialActor` policy captured at `/opt/greyhoundiq/backups/pre-r4-socialactor-policy.txt`.

## Rollback

```bash
cd /opt/greyhoundiq
cp docker-compose.yml.bak-r3-20260723 docker-compose.yml
docker compose up -d app
```

No DB rollback required (no DB change in r4).

## Outstanding (unchanged by this release)

- Authenticated role/permission matrix, LiveKit end-to-end, Stripe live payment/entitlement test (two-account test-mode plan exists).
- Admin mobile founder pass on a real phone (structural/contract tested only).
- Two community-thread route-audit fixtures; Design Lab independent-review evidence.
- fail2ban note: workstation `202.171.188.71` ban expired on its own; SSH deploy-key access restored this session.
