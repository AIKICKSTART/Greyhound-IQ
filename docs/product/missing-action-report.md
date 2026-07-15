# GreyhoundIQ missing-action report

Status: inventory complete; behavior verification open  
Review snapshot: 2026-07-14 AEST  
Owner: Product engineering

## Current evidence

`docs/product/action-inventory.md` and the machine-readable registry map all 97 registered screen cells to route-scoped action contracts or tested zero-action exclusions. This proves the discovered source surface is inventoried; per-action ownership, permission, validation, loading, success, failure, idempotency and audit evidence remains incomplete.

## Highest-risk missing action evidence

- Authentication start/callback/recovery and protected-route denial.
- Marketplace draft, media, publish, edit, enquiry, save, boost, archive and ownership actions.
- Feed create/edit/delete/comment/react/save/report and sponsored-placement actions.
- Account profile/privacy/security/team/export/deletion and billing actions.
- Moderator versus administrator mutations, last-owner/last-admin protection and audit events.
- Upload, private download, webhook, background-job, realtime and AI-tool actions.

Disabled or “Coming soon” controls must be non-interactive or have an implemented result; a visible control without a verified outcome remains a gap.

## Closure criteria

Bind every interactive control to a registered handler or destination, server-side authorization policy, validation schema, resource limit, feedback state, negative tests and trace ID. This report is complete as an inventory output; the actions remain release-blocking until those individual contracts pass.
