# Historical Cloud Run migration plan — retired

Status: **not a deployment instruction**

Retired: 2026-07-16

This document previously described a single-region Cloud Run and Supabase migration for an earlier Google Cloud account. It contains historical service names, domains, deployment results, Supabase dependencies, secret mappings, and trial-account assertions that do not apply to GreyhoundIQ's new production account.

Do not run its former scripts, workflows, scheduler commands, or infrastructure steps. In particular, the legacy deployment workflow, `gcp-cloud-run-deploy.ps1`, and `gcp-scheduler-sync.sh` cannot provision or promote the selected production target.

The only authoritative target is [the Australia production architecture](./architecture/greyhoundiq-australia-production-architecture.md). It requires:

- equivalent Sydney and Melbourne application cells behind the global external Application Load Balancer, with Cloud Armor, explicit CDN allowlisting, service health, and blocked public origins;
- AlloyDB PostgreSQL with a Sydney HA primary, Melbourne secondary/read capacity, rehearsed Prisma/RLS compatibility, backup/restore, planned switchover, fenced promotion, and reconciliation;
- Australian dual-region Cloud Storage, an application-owned realtime replacement, and AU-restricted asynchronous delivery;
- two independent regional self-hosted LiveKit cells with room-home assignment and regional HA Redis, not the prior single-node proof of concept;
- preserved and independently verified WorkOS and Stripe integration, with no live-charge, credential-rotation, or DNS action without explicit approval;
- separate, reviewed production infrastructure and immutable deployment automation. The repository's green-staging Terraform baseline is deliberately not a production foundation.

The production architecture remains selected but unverified. No historical claim in this retired document is evidence of resources in the new account.
