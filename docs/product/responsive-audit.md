# GreyhoundIQ responsive audit

Status: incomplete; Design Lab workspace and architecture report verified across 13 breakpoint and boundary widths from 360px through 1920px, while the product-wide matrix remains open  
Review snapshot: 2026-07-14 AEST  
Owner: Product engineering

## Current evidence

- Production-parity review includes representative desktop and compact navigation observations.
- The source-bound loopback artifact [`latest.json`](../../output/design-lab-responsive-workspace/latest.json) records 104/104 passing cases across all seven Design Lab workspace areas and the linked architecture report at 360, 390, 768, 820, 821, 1024, 1152, 1279, 1280, 1535, 1536, 1680 and 1920px. It enters the visible Architecture iframe at eight desktop widths instead of auditing only its parent page.
- The report exposes 35 table/card pairs and 15 visual/semantic diagram pairs. Wide desktop tables and diagrams remain in contained keyboard-focusable scroll regions; every visible diagram label measured at least 12px in both standalone and embedded evidence. Compact table labels retain an 11px floor, and the 15 mobile flows preserve all 189 semantic steps.
- The audit checks table row/header parity against each compact record collection, direct and embedded page overflow, report-mode breakpoint transitions, browser exceptions and mutating requests.
- `scripts/audit-design-lab-responsive-workspace.ts` fails closed on source, audit-script, compiled-report, canonical-report-source or report-builder digest drift and writes evidence atomically. This is local-source evidence, not a deployed-image or production attestation.
- Component tests cover selected mobile header, dock, help, meeting-card and Marketplace interactions.

## Known gaps

- The required 11-width product matrix has not run across all 90 screens and relevant states.
- Tablet navigation, landscape phones, zoom, long text, large data, keyboard overlays and safe-area insets are not proven product-wide.
- Production compact navigation previously omitted About and Contact and retained an open drawer after desktop expansion; local fixes need deployed browser evidence.
- Forms, media, dialogs, admin controls, charts and dense Marketplace cards outside the Design Lab workspace still need explicit overflow and target-size tests.

## Acceptance test

Test each representative layout class at 320, 360, 390, 414, 480, 768, 834, 1024, 1280, 1440 and 1920 CSS pixels, including portrait/landscape where relevant. Assert no unintended horizontal scroll, unreachable controls, obscured focus, clipped validation, broken media or layout shift beyond the agreed budget. Until the immutable candidate passes, this report is produced but responsive readiness fails.
