# GreyhoundIQ — Planning Documents Index

> Source: `docs/GreyhoundIQ-Architecture-Premium.html` (28 June 2026)
> Audience: Daniel Fleuren, AI Kick Start, future contributors
> Status: Planning phase complete; implementation begins after the 10 architecture questions are answered

---

## What's in this folder

The architecture doc was reviewed and expanded into 6 production-grade planning documents. Each one is build-ready and self-contained.

| # | Document | Purpose | Size |
|---|----------|---------|------|
| 1 | **[user-stories.md](user-stories.md)** | 49 user stories with Given/When/Then acceptance criteria, grouped by 4 build phases and 14 epics | ~25 KB |
| 2 | **[api-architecture.md](api-architecture.md)** | REST route reference with auth, rate limits, data contracts, error codes, cron schedule | ~18 KB |
| 3 | **[data-model.md](data-model.md)** | Prisma schema for 20+ new models, ERD, RLS policies, index strategy, migration plan | ~27 KB |
| 4 | **[security-threat-model.md](security-threat-model.md)** | Threat catalog (13 categories), RLS examples, agent harness security, APPs compliance, pre-launch checklist | ~22 KB |
| 5 | **[operations-deployment.md](operations-deployment.md)** | Hetzner VPS topology, CI/CD pipeline, 12 background jobs, monitoring, capacity plan, scaling stages | ~14 KB |
| 6 | **[testing-strategy.md](testing-strategy.md)** | Test pyramid, Vitest/Playwright/k6 setup, per-layer coverage targets, manual checklist, pre-launch gate | ~13 KB |

---

## How they fit together

```
ARCHITECTURE DOC (input)
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│                  PLANNING DOCS                            │
│                                                          │
│  USER STORIES  ──►  API ARCHITECTURE  ──►  DATA MODEL   │
│       │                  │                     │         │
│       │  Defines        │  Endpoints          │  Schema  │
│       │  acceptance     │  contracts          │  for     │
│       │  criteria       │                     │  the     │
│       │                 │                     │  stories │
│       └────┬────────────┴────────┬────────────┘         │
│            │                     │                       │
│            ▼                     ▼                       │
│      TESTING STRATEGY    SECURITY THREAT MODEL          │
│      (validates          (secures the                   │
│       everything)         everything)                   │
│                                                          │
│       OPERATIONS & DEPLOYMENT                            │
│       (runs the everything)                              │
└──────────────────────────────────────────────────────────┘
        │
        ▼
   IMPLEMENTATION
```

---

## Reading order

For Daniel (approving the plan):
1. **user-stories.md** — see what we're building
2. **api-architecture.md** — see the surface
3. **data-model.md** — see the structure
4. **security-threat-model.md** — see the risks
5. **testing-strategy.md** — see the validation
6. **operations-deployment.md** — see the runtime

For a new engineer joining mid-project:
1. **data-model.md** — understand the data
2. **api-architecture.md** — understand the API
3. **user-stories.md** — understand the goals
4. **testing-strategy.md** — understand the bar
5. **security-threat-model.md** — understand the threats
6. **operations-deployment.md** — understand the runtime

For an AI agent (me) implementing:
1. `user-stories.md` — what user needs to do
2. `data-model.md` — what schema to add
3. `api-architecture.md` — what endpoint to build
4. `testing-strategy.md` — what tests to write
5. `security-threat-model.md` — what RLS / auth to add
6. `operations-deployment.md` — what to deploy + monitor

---

## Phase overview

Mirrors the architecture doc's 4-phase build plan:

### Phase 1 — Foundation (Weeks 1–2)

**Exit criterion:** Two users can sign up, message each other with text + image.

- E1 Supabase & Auth (4 stories)
- E2 Data Ingestion Spine (3 stories)
- E3 Media Upload (2 stories)
- E4 1:1 Messaging (4 stories)

**Dependencies built first:** Postgres schema migration → Supabase project setup → Auth providers → RLS policies → Storage buckets → Realtime channels → message endpoints.

### Phase 2 — Memory (Weeks 2–3)

**Exit criterion:** User can have a multi-session conversation with the race analyst that picks up where they left off.

- E5 Agent Memory (3 stories)
- E6 Hermes Agent Harness (3 stories)
- E7 Core Agents (4 stories)

**Dependencies:** Phase 1 complete. Add: memory tables, conversation context, agent harness subprocess spawn, four agent configs.

### Phase 3 — Community (Weeks 3–4)

**Exit criterion:** A breeder can claim a dog, post in the forum, list a pup for sale, get notified of agent-moderated actions.

- E8 Forum (3 stories)
- E9 Marketplace (3 stories)
- E10 Dog Ownership (2 stories)
- E11 Moderation (2 stories)

**Dependencies:** Phase 2 complete. Add: forum schema, listing schema, dog ownership claim flow, moderator agent wired to all content tables.

### Phase 4 — Polish (Weeks 4–5)

**Exit criterion:** Production launch.

- E12 Voice & Video Messages (2 stories)
- E13 Auditing & Compliance (2 stories)
- E14 Data Portability & Account Deletion (2 stories)

**Dependencies:** Phase 3 complete. Add: voice/video recording, audit log for all sensitive actions, APPs compliance, account deletion flow.

---

## Key technical decisions (locked from architecture doc)

1. **Prisma + Supabase client both** — one DB, two adapters. Prisma owns complex queries; Supabase owns realtime + storage.
2. **Per-user agent memory** — flat rows (no graph DB). pgvector in Phase 2.
3. **1:1 messaging only** — no group chats.
4. **No E2E encryption** — server can read messages.
5. **Single-region (Sydney)** — no multi-region for v1.
6. **Hetzner VPS** for app; Supabase for DB; Stripe for payments; Resend for email; Sentry for errors.
7. **Hermes CLI on MiniMax M3** — no separate LLM API costs.

---

## Open questions (must answer before Phase 1)

From architecture doc section 17, the 10 questions. Most have reasonable defaults from the planning docs; only the truly blocking ones need explicit answers:

| # | Question | Default in plans | Need answer? |
|---|----------|------------------|--------------|
| 1 | Hosting (Vercel vs Hetzner vs Supabase edge) | Hetzner VPS confirmed (Daniel has one) | ✅ Resolved |
| 2 | Multi-region later? | No for v1 | Later decision |
| 3 | MiniMax M3 token plan constraints? | None known | **Confirm** |
| 4 | Breeder verification (manual vs auto) | Manual with fast-track | **Confirm** |
| 5 | Media pricing | 1GB / 10GB / 100GB | **Confirm** |
| 6 | Marketplace fees | No fee in v1 | ✅ Resolved |
| 7 | Video hosting | Self-host via Supabase Storage | **Confirm** |
| 8 | Voice transcription | Whisper @ $0.006/min | Later decision |
| 9 | Penetration test budget | $5k-$15k pre-launch | **Confirm budget** |
| 10 | Launch sequencing | Private beta (20 testers) → public | **Confirm** |

---

## Production readiness checklist (final gate)

When implementation is complete and tests pass:

- [ ] All 49 user stories implemented
- [ ] All API endpoints documented + tested
- [ ] Data model migrated to Supabase
- [ ] RLS policies in place + tested
- [ ] Security scan: no Snyk high/critical
- [ ] Penetration test: no critical/high findings
- [ ] All APPs compliant
- [ ] All cron jobs running on schedule
- [ ] Backups verified
- [ ] Monitoring + alerts configured
- [ ] Runbooks written
- [ ] 18+ compliance verified
- [ ] PhotoDNA integration complete
- [ ] Private beta (20+ users) successful
- [ ] Daniel signs off

→ **Then: production launch.**

---

## Status

- [x] user-stories.md — **62 user stories** across 26 epics in 4 phases
- [x] api-architecture.md — ~80 REST routes, auth, rate limits, error codes
- [x] data-model.md — Prisma schema for 24+ new models + ERD + RLS policies
- [x] security-threat-model.md — 15 threat categories, RLS, agent sandbox, APPs
- [x] operations-deployment.md — Hetzner + Supabase + 17 internal services
- [x] testing-strategy.md — Test pyramid, mock all v3 services
- [x] planning README (this file)

**Architecture v2 deltas (from agent corpus re-read):**
- 10 new user stories (E15-E20): Mem0+pgvector, prompt-eval pipeline, agent sandboxing, n8n+Firecrawl, Cognee graph, LocalAI+Whisper
- 2 new Prisma tables: `PromptEvalSet` / `PromptEvalResult`, `AgentApproval`
- 5 new service components: n8n, localai, whisper, firecrawl, cognee, mem0
- 3 new security mitigations: agent Docker sandbox, tier 3 approval gate, internal mTLS
- VPS upgrade path: cx22 → cx32 (+$30/mo) to host new compute
- Cost-to-revenue ratio: 1.6% → 2.3% (still healthy)

**Technology Opportunities v3 deltas (2026-06-29):**
- 12 more user stories (E21-E26): TimesFM+HF AutoTrain ML pipeline, Aider dev workflow, Dify RAG, GEO citation audits, OTel+Grafana, open-weight model fallback
- 2 new Prisma tables: `ModelRegistry`, `GeoAuditResult`
- 8 new service components: timesfm, autotrain, dify, aider, prometheus, loki, grafana, otel-collector
- New admin endpoints: `/api/admin/models/*`, `/api/admin/observability/*`, `/api/admin/geo/*`
- VPS upgrade: cx32 → cx42 (+$60/mo) to host TimesFM + AutoTrain + Grafana stack
- Cost-to-revenue ratio: 2.3% → 4.2% (still healthy, monitor as we scale)
- 3 documented open-source fallback model options (GLM-5.2, Kimi K2.7, Qwen 3) for resilience

**Planning phase complete.** Ready for implementation once the 10 architecture questions are answered.
