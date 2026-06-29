# GreyhoundIQ — UI Component Build Plan (v2 — Final)

> Built 2026-06-29. All tasks complete.

## Goal
Make GreyhoundIQ production-ready: every page cinematic, branded, with
real data and proper error/loading states. Use the existing shadcn
primitives and lucide icons — no new deps.

## Rules (Ponytail)
1. **Reuse before create.** Every new UI element first checks shadcn ui/*
   and the existing components (meeting-card, runner-row, page-hero).
2. **No new dependencies.** The stack covers it.
3. **One file per reusable component** (`page-hero.tsx`). Feature-specific
   sections live in the page file.
4. **Mark simplifications** with `ponytail:` comments.
5. **Build + smoke test after each task.**

---

## Final State

### Routes (14 total, all 200 except 404)

| Route | Type | Hero image | Status |
|-------|------|------------|--------|
| `/` | Dynamic | `hero-breaking-from-boxes.png` | ✅ Cinematic hero + 4 image feature cards + comparison + meetings |
| `/races` | Dynamic | `hero-breaking-from-boxes.png` | ✅ PageHero + MeetingCard grid |
| `/races/[id]` | Dynamic | (in-page meta) | ✅ Race detail with runner table + box colors + form |
| `/dogs` | Static | `feature-pricing-product.png` | ✅ PageHero + search interface |
| `/dogs/[id]` | Dynamic | (header stats) | ✅ Stats grid + 3-gen pedigree + form table |
| `/tracks` | Dynamic | `feature-advanced-stats.png` | ✅ PageHero + track grid w/ anchor links |
| `/results` | Dynamic | `feature-ai-predictions.png` | ✅ PageHero + per-track results |
| `/breeding` | Static | `feature-breeding-analytics.png` | ✅ PageHero + 4 feature cards + sire leaderboard |
| `/statistics` | Static | `feature-advanced-stats.png` | ✅ PageHero + box bias bar chart + trainer leaderboard + track records |
| `/pricing` | Static | (no hero) | ✅ 3-tier pricing + comparison |
| `/about` | Static | `feature-breeding-analytics.png` | ✅ PageHero + story + 4 value cards |
| `/contact` | Static | `feature-ai-predictions.png` | ✅ PageHero + 3 channels + responsible gambling |
| `/not-found` | Static | (no hero) | ✅ Branded 404 page |
| `/api/dogs/search` | API | — | ✅ Server route |

### New components

| File | Purpose |
|------|---------|
| `src/components/page-hero.tsx` | Reusable cinematic hero w/ image, gradient, badge, title, subtitle |
| `src/app/not-found.tsx` | Branded 404 with "Off-track" headline |
| `src/app/error.tsx` | Client error boundary, branded |
| `src/app/global-error.tsx` | Root error boundary, minimal HTML |
| `src/app/loading.tsx` | Skeleton loading state |

### Brand integration (complete)

- Real logo files in `public/images/` (logo-main, logo-wordmark, logo-mark-new)
- Real cinematic photos (hero + 4 feature cards + og-image)
- Brand colors in globals.css: deep green #0B5C1E, mid green #145A2D, bright green #2BAE5A, orange #F97316, amber #F89838, near-black #040A04
- metadataBase set to https://greyhoundiq.com.au
- OG image + Twitter card configured
- Site header + footer use real logos
- HTML reports (business-plan.html, architecture.html) branded

### Prisma schema (fixed)
- 9 broken relations repaired (User→Community removed, Dog→Ownership/Listings added, Profile.messagesReceived added)
- Stale SQLite migrations + dev.db removed
- provider = "postgresql" for Supabase

### Graceful DB handling
- `safeQuery()` wrapper in `src/lib/db.ts` catches connection failures
- All query functions return empty arrays/null on DB error
- App renders empty states instead of 500s
- Static pages never hit the DB (200 always)

### Build & smoke test

- `CI=true node node_modules/next/dist/bin/next build` → 14 routes, 0 errors
- All routes return 200 (bad routes return custom 404)
- All images serve 200

---

## Still TODO (depends on user)

1. **Supabase connection**: add DATABASE_URL to .env, then `npm run bootstrap`
2. **Real image generation**: 3 UI mockups still need vision analysis to inform
   future iterations (current build uses our feature card photos instead)
3. **Video animation prompt** for breeding card: subagent was dispatched but hit
   429s. The breeding page is built with the still image as hero.

---

## File map (production state)

```
src/
├── app/
│   ├── about/page.tsx          (NEW)
│   ├── api/dogs/search/route.ts
│   ├── breeding/page.tsx       (REBUILT w/ hero + leaderboard)
│   ├── contact/page.tsx        (NEW)
│   ├── dogs/page.tsx           (REBUILT w/ PageHero)
│   ├── dogs/[id]/page.tsx      (existing, works)
│   ├── error.tsx               (NEW error boundary)
│   ├── global-error.tsx        (NEW root error boundary)
│   ├── icon.png
│   ├── layout.tsx              (branded, metadataBase added)
│   ├── loading.tsx             (NEW skeleton)
│   ├── not-found.tsx           (NEW branded 404)
│   ├── page.tsx                (REBUILT w/ cinematic hero + 4 image cards)
│   ├── pricing/page.tsx        (existing, works)
│   ├── races/page.tsx          (REBUILT w/ PageHero)
│   ├── races/[id]/page.tsx     (existing, works)
│   ├── results/page.tsx        (REBUILT w/ PageHero)
│   ├── statistics/page.tsx      (REBUILT w/ PageHero + box bias chart + leaderboards)
│   └── tracks/page.tsx         (REBUILT w/ PageHero + anchor IDs)
├── components/
│   ├── dog-search.tsx
│   ├── meeting-card.tsx
│   ├── page-hero.tsx           (NEW reusable hero)
│   ├── runner-row.tsx
│   ├── site-footer.tsx         (footer links fixed to /about /contact /pricing)
│   ├── site-header.tsx         (real logo)
│   └── ui/                     (12 shadcn primitives)
└── lib/
    ├── db.ts                   (safeQuery wrapper)
    ├── queries.ts              (all 8 queries use safeQuery)
    └── utils.ts

public/
├── images/                     (11 brand images)
├── architecture.html           (branded)
├── business-plan.html          (branded)
├── favicon.ico
└── icon.png

prisma/
├── schema.prisma               (postgresql, 9 relations fixed)
└── seed.ts                     (400 dogs, 18 trainers, 12 sires, real AU tracks)

docs/
├── image-prompts.md            (6 cinematic prompts for future image gen)
└── mockup-prompts.md

.hermes/plans/
└── 2026-06-29_ui-component-build.md  (this file)
```
