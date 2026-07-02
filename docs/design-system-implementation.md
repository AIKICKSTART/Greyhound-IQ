# GreyhoundIQ Design System Implementation

## Source Archive

- Archive: `C:\Users\verri\Downloads\GreyhoundIQ Design System (2).zip`
- Extracted reference: `C:\Users\verri\AppData\Local\Temp\greyhoundiq-full-design-system-20260702-032818`
- HTML reference captures: `E:\greyhoundiq\output\design-system-html-audit`
- Full archive audit: `E:\greyhoundiq\output\design-system-full-audit`
- Live route captures: `E:\greyhoundiq\output\live-route-screenshots`
- Focused implementation QA: `E:\greyhoundiq\output\design-system-qa-v3`
- Final browser check: `E:\greyhoundiq\output\design-system-final-check`

## Full Archive HTML Audit

The refreshed audit captured every HTML file from the supplied archive through a temporary local static server.

- Source HTML files: 21
- Archive image/SVG/raster files: 56
- Static HTML contact sheet: `E:\greyhoundiq\output\design-system-full-audit\http-html-contact-sheet.png`
- Interactive website-kit contact sheet: `E:\greyhoundiq\output\design-system-full-audit\ui-kit-screen-contact-sheet.png`
- Live app desktop/mobile contact sheets: `E:\greyhoundiq\output\design-system-full-audit\live-app`
- Inventory JSON: `E:\greyhoundiq\output\design-system-full-audit\archive-file-inventory.json`
- Capture summary JSON: `E:\greyhoundiq\output\design-system-full-audit\http-capture-summary.json`

Captured archive HTML files:

- `components/core/core.card.html`
- `components/core/icons.card.html`
- `components/feedback/feedback.card.html`
- `components/racing/racing.card.html`
- `guidelines/brand-logo.card.html`
- `guidelines/brand-metals.card.html`
- `guidelines/colors-boxes.card.html`
- `guidelines/colors-brand.card.html`
- `guidelines/colors-surfaces.card.html`
- `guidelines/motion.card.html`
- `guidelines/spacing-radii.card.html`
- `guidelines/spacing-scale.card.html`
- `guidelines/type-body.card.html`
- `guidelines/type-display.card.html`
- `guidelines/type-numerals.card.html`
- `guidelines/type-pairing.card.html`
- `templates/race-hero/RaceHero.dc.html`
- `templates/social-16x9/Social16x9.dc.html`
- `templates/social-9x16/Social9x16.dc.html`
- `ui_kits/website/index.html`
- `uploads/0092-audiowide-x-inter/demo.html`

The interactive `ui_kits/website/index.html` was also captured through the nav states: Home, Races, Results, Dogs, Tracks, Breeding, Agents, Forum, Listings, and Pricing.

Archive issue found during screenshot capture:

- `templates/social-16x9/Social16x9.dc.html` and `templates/social-9x16/Social9x16.dc.html` contain a raw placeholder image request for `assets/{{ bgImage }}` before the design-canvas script applies props.
- `templates/social-9x16/Social9x16.dc.html` defaults to `wentworth-track-hero.webp`, but that exact file is absent from the archive assets. The app has a local equivalent at `public/images/wentworth-track-hero.webp`.

## Implemented System Surfaces

- Global material classes in `src/app/globals.css` for panels, subpanels, form controls, segmented controls, metric cards, icon plates, table shells, status pills, listing media, footer rules, and action buttons.
- Archive brand assets copied into `public/images`, `public/images/brand`, app icons, and metadata icon paths.
- Header, page hero, footer, landing feature cards, pricing cards, marketplace, agents, account, messages, forum, racecards, track pages, dog detail pages, and listing detail pages now share the `giq-*` material grammar.
- Racing box order is preserved as 8 pink, 7 black, 6 green, 5 yellow, 4 blue, 3 white/silver, 2 striped, 1 red.
- Reusable React design-system layer added at `src/components/giq`, matching the archive manifest names while reusing global app styles.

## Component Manifest Parity

| Archive component | App implementation |
| --- | --- |
| Badge | `src/components/giq/badge.tsx` |
| Button | `src/components/giq/button.tsx` |
| Card | `src/components/giq/card.tsx` |
| GIQ_ICONS | `src/components/giq/icon.tsx` |
| Icon | `src/components/giq/icon.tsx` |
| IconButton | `src/components/giq/icon-button.tsx` |
| Input | `src/components/giq/form-controls.tsx` |
| Logo | `src/components/giq/logo.tsx` |
| Select | `src/components/giq/form-controls.tsx` |
| StatusPill | `src/components/giq/status-pill.tsx` |
| Tabs | `src/components/giq/tabs.tsx` |
| Accordion | `src/components/giq/accordion.tsx` |
| Alert | `src/components/giq/alert.tsx` |
| Modal | `src/components/giq/modal.tsx` |
| Tooltip | `src/components/giq/tooltip.tsx` |
| BOX_COLOURS | `src/components/giq/box-number.tsx` via `src/lib/box-colours.ts` |
| BoxNumber | `src/components/giq/box-number.tsx` |
| MeetingCard | `src/components/giq/meeting-card.tsx` |
| RunnerRow | `src/components/giq/runner-row.tsx` |

## Verification

Commands run:

```powershell
npm run typecheck
npm run lint
npm run build
```

Final browser spot-check covered `/`, `/listings`, `/agents`, `/races`, `/forum`, and `/pricing` at `http://127.0.0.1:3000`.

Checks passed:

- All checked routes returned status 200.
- No broken images were detected.
- No console errors were detected on public checked routes.
- No references to retired hero/header assets were found in rendered HTML.
- Source scans found no remaining old hardcoded surface/input patterns in `src/app` or `src/components`.

Protected routes such as `/account`, `/messages`, and `/listings/new` can produce WorkOS CORS noise on localhost when unauthenticated because they route through sign-in. That is auth environment behavior, not a design-system rendering failure.
