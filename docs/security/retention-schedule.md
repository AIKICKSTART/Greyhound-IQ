# Retention schedule

Status: **Policy defined; enforcement work remains release-gated**  
Evidence date: 2026-07-15  
Owner: Privacy Owner

GreyhoundIQ must not keep personal information merely because it may become useful. The policy follows the OAIC APP 11 principle that information no longer needed for a permitted purpose should be destroyed or de-identified, subject to Australian-law or court-order retention. Finance records use a provisional five-year baseline because the ATO states that most business records are kept for five years. Australian privacy and finance counsel must confirm the final launch policy and any provider-contract exceptions.

Official references:

- [OAIC APP 11 security, destruction and de-identification](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information)
- [ATO record-keeping guidance: most records for five years](https://www.ato.gov.au/api/public/content/0-53cc7a8e-0668-4c9d-95d7-eb841eb09c04)

The executable source of truth is `security/retention-schedule.ts`. Every schedule names the retained scope, live purpose, trigger, finite post-trigger maximum, disposition, systems, owner, legal-hold rule, enforcement status and annual review cadence.

| Record class | Trigger | Maximum after trigger | Disposal summary |
|---|---|---:|---|
| User profiles | Verified deletion or purpose ending | 30 days | Delete identifiers; review de-identification risk |
| Sessions | Expiry, logout, revocation or suspension/deletion | 30 days | Revoke and delete residual metadata |
| Authentication events | Event occurrence | 400 days | Delete detail; retain non-identifying trends |
| Posts and comments | User/moderator removal or account finalisation | 30 days | Purge content, caches and search documents |
| Messages and media | Deletion/finalisation or last purpose ending | 30 days | Delete content, attachments and derivatives |
| Listings | Archive/deletion or dispute closure | 365 days | Delete listing content; separate finance/audit retention |
| Enquiries and support tickets | Closure | 730 days | Delete correspondence; de-identify trends |
| Moderation records | Decision/appeal closure | 1,095 days | Delete evidence; pseudonymise analytics |
| Audit logs | Event occurrence | 2,555 days | Expire archive; retain non-identifying metrics |
| Security logs | Event occurrence | 400 days | Delete searchable and archived events |
| Billing records and invoices | Settlement/adjustment/dispute closure | 1,825 days | Retain minimum confirmed finance record |
| Webhook payloads | Receipt | Raw 30 days; receipt 400 days | Reduce raw content, then delete receipt |
| Racing-data snapshots | Ingestion | 730 days | Delete raw/provider-only fields subject to licence |
| AI prompts and responses | Run completion/failure | 30 days | Delete content and provider copy where supported |
| Exports | Generation | 1 day | Delete archive and expire signed access |
| Deleted-account data | Verified deletion request | 30 days | Finalise graph/provider/object deletion |
| Backups | Backup creation | 35 days | Cryptographically expire rolling copy |

## Launch blockers retained

This document closes only the requirement to **define** retention. It does not prove disposal automation, provider configuration, backup expiry, legal-hold workflow or restore behaviour. Before launch:

1. Privacy and finance owners approve the values and provider/licensing exceptions.
2. Each primary table, search index, cache, object prefix and provider receives an idempotent purge owner and scheduled job.
3. Raw Lago webhook payload reduction is implemented and tested at 30 days.
4. Google Cloud log buckets, database backups, object versions, WorkOS, Stripe, Lago, email, realtime and AI providers are configured to the approved limits.
5. Account deletion and export expiry are tested across primary, cache, search, object, provider and backup copies.
6. Legal holds use scoped approval, expiry, periodic review and recorded release; they never become a general retention bypass.
