# GreyhoundIQ — Final Polish Audit

Inspected: `E:\greyhoundiq\src\` — 17 routes, 12 components, app/layout, app/manifest, app/sitemap.
Prioritized by **impact × effort**. All fixes ≤ 30 min.

---

## 1. 🔴 Pricing CTAs are dead buttons (highest-impact win)

**File:** `src/app/pricing/page.tsx:137` and `:208`
**Problem:** Two `<button>` elements ("Start Free", "Go Pro", "Go Pro+", "Create free account") render as styled buttons but have **no `onClick` and no wrapping `<Link>`**. Clicking them does literally nothing — no auth route exists, no `/signup`, no Stripe Checkout. A paid funnel dead-ends on the page that exists *only* to convert.
**Fix:** Wrap each CTA in `next/link` to `/contact?plan=pro` (or `/api/checkout?plan=pro`) until Stripe Checkout is wired. Alternatively, disable + label "Coming soon" with `disabled` + `aria-disabled="true"`. Quickest: change all four `<button>…</button>` to `<Link href={"/contact?plan=" + plan.name.toLowerCase()} …</Link>`. (15 min)
**Time:** ~15 min
**Why #1:** A broken primary CTA on the pricing page is the single worst-polish issue — visitors ready to pay bounce at the last step. This is also a missed conversion funnel.

---

## 2. 🔴 "Tap a track" subtitle lies — track cards aren't clickable

**Files:** `src/app/tracks/page.tsx:25` (`subtitle="…Tap a track to see recent meetings…"`) + `src/app/tracks/page.tsx:34-55` (cards are `<div>` with no link)
**Problem:** The hero promises "Tap a track to see recent meetings" but each card is a bare `<div>` with `id={track.name.toLowerCase().replace(/\s+/g, "-")}` (line 37). This anchors to themselves — there's no /tracks/[id] route. Users tap and nothing happens. Compare to `meeting-card.tsx:28` which generates links to `/tracks#…`, but those anchors don't actually point to anything meaningful on the destination page.
**Fix:** Three reasonable options (pick one):
- (a) Wrap each `<div>` inner content in a `<Link href={`/races?track=${track.id}`}>` filtered view (best — matches user intent; user expects to see races at that track, and `/races` already exists).
- (b) Drop the word "Tap" from the subtitle.
- (c) Build a `/tracks/[id]` detail route (biggest effort).
**Recommended:** (a) — add `import Link from "next/link"` and wrap the heading + meta in a Link. (15 min)
**Time:** ~15 min
**Why #2:** Direct user expectation mismatch on a route that exists entirely to drive exploration.

---

## 3. 🟡 Footer is missing Terms of Service & Privacy Policy

**File:** `src/components/site-footer.tsx:23-29`
**Problem:** Footer has "About / Contact / Pricing" but for a paid SaaS taking card payments, **Terms of Service and Privacy Policy are legally expected** (Stripe TOS reference both). For a gambling-adjacent data product targeting Australian consumers, Privacy Policy is mandatory under the *Privacy Act 1988*. There are also no social links or email signup, but those are cosmetic. This is a launch blocker for many App Store / Google Play placements and looks unprofessional to anyone reading the footer.
**Fix:** Add a 4th section "Legal" with `Terms of Service` and `Privacy Policy` linking to `/legal/terms` and `/legal/privacy`. Create two short placeholder pages (200–400 words each, using the About copy + a few standard clauses). Even *placeholder* pages signal "we're a serious business." Both pages combined: ~30 min if you have the text drafted already.
**Time:** ~30 min for both pages + footer link
**Why #3:** Looks unprofessional to investors, payment processors, and users. Plain text placeholder pages are fine for launch.

---

## 4. 🟡 Missing metadata descriptions on 4 pages hurts SEO

**Files:**
- `src/app/dogs/page.tsx:7` (only sets `title`, no description)
- `src/app/dogs/[id]/page.tsx:6-16` (`generateMetadata` sets title but no description)
- `src/app/races/page.tsx:7`
- `src/app/races/[id]/page.tsx:6-19`
- `src/app/results/page.tsx:7`
- `src/app/tracks/page.tsx:6`
- `src/app/statistics/page.tsx:4`
- `src/app/breeding/page.tsx:5`

**Problem:** Without a `description`, search engines auto-generate from body copy (often truncated awkwardly), Twitter/Facebook/OG previews degrade. With dynamic `[id]` pages, every dog and race page lacks a description even though they have titles.
**Fix:** Generic template that takes a name and builds a sentence — e.g. for `dogs/[id]/page.tsx`:
```ts
description: dog
  ? `Full career form, recent starts, pedigree, and trainer info for ${dog.name}.`
  : "Greyhound profile on GreyhoundIQ."
```
And for each top-level page that's missing one, add:
```ts
description: "[Page] — GreyhoundIQ. [1-sentence value prop]"
```
**Time:** ~15 min (10 small edits)
**Why #4:** Trivial effort, free SEO/social-card lift across the entire site. The dynamic-route pages are the highest-value (one edit improves infinite URLs).

---

## 5. 🟡 Mobile menu has no accessible name and no visible focus styles site-wide

**File:** `src/components/site-header.tsx:25-28`
```tsx
<SheetTrigger className="…">
  <Menu className="h-5 w-5" />
</SheetTrigger>
```
**Problem:** A bare `<Menu>` icon button with no `aria-label`. Screen reader users hear "button" with no context. Also, `globals.css` has **zero `:focus-visible` styles** anywhere — keyboard users can't see where focus is on the nav links, the inputs, the pricing buttons, anything. Confirmed via grep: `globals.css` has no `focus-visible|outline|:focus` selectors outside the shadcn Button component (which is barely used — pricing uses raw `<button>` tags).
**Fix:**
- Add `aria-label="Open navigation menu"` to the SheetTrigger.
- Add a single global rule in `globals.css` (last block, ~10 lines):
```css
*:focus-visible {
  outline: 2px solid hsl(142 60% 48%);
  outline-offset: 2px;
  border-radius: 6px;
}
button:focus-visible, a:focus-visible {
  outline-offset: 3px;
}
```
**Time:** ~10 min
**Why #5:** Two accessibility wins for the price of one small patch — biggest bang-per-line in the audit. Required for any WCAG conformance and a baseline user expectation in 2026.

---

## 6. 🟡 Empty-state copy references a dev command that won't exist for end users

**Files:**
- `src/app/page.tsx:91-100` ("Run `npm run seed` to load sample data.")
- `src/app/results/page.tsx:39-46` (same)
- `src/app/tracks/page.tsx:28-31` (same)

**Problem:** If the production DB is ever empty (data sync issue, cold start, scraping outage), the homepage shows a literal `npm run seed` command. End users have no idea what that means; it leaks dev workflow into production UI. Same problem on `/results` and `/tracks`.
**Fix:** Replace with user-friendly messaging:
```tsx
<p>No meetings today. Check back closer to race time, or <Link href="/races" className="text-[hsl(142_60%_48%)] hover:underline">browse upcoming races</Link>.</p>
```
Keep the internal `npm run seed` hint only on `/admin` or in `loading.tsx` if needed. (10 min)
**Time:** ~10 min
**Why #6:** Defensive against the one incident where your scraper breaks and a user sees the empty state instead of races.

---

## 7. 🟡 (Optional) PageHero `Image` alt is empty — could be more descriptive

**File:** `src/components/page-hero.tsx:39-46`
**Problem:** Every hero `<Image alt="" />` uses an empty alt. That's *technically* correct for decorative images (WCAG 2.1 §1.1.1), so not a bug — but two of them are used as the primary visual identity of the page (the title is over them). If SEO/Google Images is a goal, descriptive alts help.
**Fix:** Either (a) leave as decorative — fine, or (b) accept a `imageAlt?: string` prop and pass page-specific alts. Skip if (a) was deliberate.
**Time:** 0–15 min depending on choice
**Why optional:** Defensible as-is; only do this if SEO is a launch goal.

---

## Summary Table

| # | Finding | File | Impact | Time |
|---|---------|------|--------|------|
| 1 | Pricing buttons have no action | pricing/page.tsx:137, :208 | 🔴 Critical | 15 min |
| 2 | "Tap a track" → non-clickable cards | tracks/page.tsx:25, :34 | 🔴 Critical | 15 min |
| 3 | No Terms/Privacy Policy links | site-footer.tsx:23 | 🟡 High | 30 min |
| 4 | Missing meta descriptions | 8 pages | 🟡 High | 15 min |
| 5 | No menu aria-label, no focus styles | site-header.tsx:25, globals.css | 🟡 High | 10 min |
| 6 | Dev-leaking empty-state copy | page.tsx:91, results, tracks | 🟡 Med | 10 min |

**Top 5 ship-ready, ~85 min total.** #7 is optional polish.

---
### What I did

I read 15 source files in `E:\greyhoundiq\src\` (root layout, all 7 top-level pages, the 4 dynamic routes, all 4 components, manifest, sitemap, globals.css). Searched for missing focus styles, broken CTAs, missing descriptions, and dead links.

### Files read (no modifications made — audit only)
- `src/app/layout.tsx`, `src/components/site-header.tsx`, `src/components/site-footer.tsx`
- `src/app/page.tsx`, `src/app/dogs/page.tsx`, `src/app/dogs/[id]/page.tsx`
- `src/app/races/page.tsx`, `src/app/races/[id]/page.tsx`
- `src/app/results/page.tsx`, `src/app/tracks/page.tsx`
- `src/app/breeding/page.tsx`, `src/app/statistics/page.tsx`
- `src/app/pricing/page.tsx`, `src/app/about/page.tsx`, `src/app/contact/page.tsx`
- `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/loading.tsx`, `src/app/global-error.tsx`
- `src/app/manifest.ts`, `src/app/sitemap.ts`, `src/components/page-hero.tsx`, `src/components/meeting-card.tsx`, `src/components/runner-row.tsx`, `src/components/dog-search.tsx`
- `src/app/globals.css`

### File created
- `E:\greyhoundiq\.hermes\audit-final-polish.md` — full written audit with prioritized findings, file:line references, code-level fixes, and time estimates.

### No issues / blockers
All inspections read cleanly. Build state assumed clean (per context); one follow-up suggestion would be a Lighthouse / axe-core run after fixes #1, #2, #5 ship.
