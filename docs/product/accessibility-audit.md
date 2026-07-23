# GreyhoundIQ accessibility audit

Status: incomplete; static contracts only, no release acceptance  
Review snapshot: 2026-07-14 AEST  
Owner: Product engineering

## Scope completed

- Route and component contract tests check selected semantic labels, focus and focus-visible contracts, mobile navigation, touch-target classes and reduced-motion-safe prototype contracts. These are source-level assertions, not assistive-technology execution evidence.
- The Design Lab registry requires keyboard focus, semantic labels and 44-pixel primary touch targets in its family acceptance language.
- Focused tests exist for site-header navigation, the mobile dock, interactive help, meeting cards and selected Marketplace gestures.

## Evidence gaps

- No current automated accessibility scan covers all 90 registered screens.
- No screen-reader journey has been captured for public, member, seller, moderator or administrator workflows.
- Keyboard order, focus restoration, error announcement, modal/drawer trapping, form instructions, table semantics and live-region behavior are not proven product-wide.
- Color contrast, 200% zoom, forced colors, text spacing and reduced-motion behavior lack a complete browser matrix.
- Dynamic loading, empty, error, permission and destructive-confirmation states are not fully represented in Design Lab fixtures.

## Acceptance test

Run WCAG 2.2 AA-oriented automated scans plus manual keyboard, screen-reader, zoom, contrast and reduced-motion journeys on the immutable staging candidate. Record violations by route/state, owner and retest. Critical journeys must have zero serious or critical unresolved findings; any exception requires explicit risk ownership. Until then this audit output exists, but accessibility readiness fails.
