# GreyhoundIQ — Security & Threat Model v1

> Source: `docs/GreyhoundIQ-Architecture-Premium.html` (sections 5, 6, 8.2, 10, 12)
> Status: Architecture spec. Penetration test ($5k-$15k) booked before launch.
> Compliance: Australian Privacy Principles (APPs), Payment Card Industry DSS via Stripe, 18+ gambling-adjacent content.

---

## Security principles

1. **Default deny.** No user gets access to anything without explicit policy granting it.
2. **RLS on every table.** The database is the last line of defense. If the service layer has a bug, RLS stops the leak.
3. **Service role key is sacred.** Used only in cron jobs, agent harness subprocesses, admin tooling. Never in browser code, never logged, never in URL params.
4. **Fail closed.** When in doubt, refuse. No "degraded" auth modes.
5. **Audit everything sensitive.** `AuditLog` row for every user ban, content hide, memory read, role grant.
6. **PII never leaves the database.** It's served to the browser only as needed, never logged in plaintext.

---

## Trust boundaries

```
┌─────────────────────────────────────────────────────────────────────┐
│  BROWSER (untrusted)                                                │
│  - User session cookie only                                          │
│  - Supabase anon key (low privilege)                                 │
│  - All queries go through RLS                                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS (TLS 1.3)
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│  NEXT.JS SERVER (trusted but vulnerable to app bugs)                │
│  - Validates all input via Zod                                       │
│  - Service layer enforces business logic                             │
│  - Uses SUPABASE_SERVICE_ROLE_KEY only for admin/cron/agents        │
│  - Prisma + Supabase JS client                                       │
└────────────────────────────┬────────────────────────────────────────┘
                             │ TLS to Supabase
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│  SUPABASE (managed, Sydney region)                                  │
│  - RLS enforced                                                      │
│  - Service role bypasses RLS (audit all uses)                        │
│  - Auth handles sign-in / OAuth / session refresh                    │
│  - Storage holds media; signed URLs for private buckets              │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│  HERMES AGENT CLI (subprocess)                                       │
│  - Runs as low-privilege user `agent`                                │
│  - No shell                                                          │
│  - Whitelisted tools only                                            │
│  - Service role key in env (separate from web)                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Threat catalog (from architecture doc section 12.1)

### 1. Credential attacks

| Attack | Mitigation |
|--------|-----------|
| Brute force | Supabase rate limit: 30 req/IP/5min on auth endpoints; account lockout after 10 fails/15min |
| Credential stuffing | CAPTCHA after 3 failed attempts; rate limit per IP (5/hr for signups) |
| Password spraying | Account lockout; rate limit per email; generic error messages |
| Email bombing (signup spam) | CAPTCHA on signup; Resend rate limit; Resend webhook to detect abuse |
| **2FA / TOTP** | **Out of scope v1 — Phase 2** |

### 2. Session hijacking

| Attack | Mitigation |
|--------|-----------|
| XSS reading token | HTTP-only cookies; short access tokens (1h); refresh rotation |
| Token theft via CSRF | SameSite=Lax cookies; double-submit cookie for state-changing requests; Origin header check |
| Man-in-the-middle | TLS 1.3 only; HSTS preload; certificate pinning in mobile (Phase 2) |
| Session fixation | New session ID on login; old session invalidated |

### 3. Authorization bypass (IDOR)

| Attack | Mitigation |
|--------|-----------|
| Read others' messages | RLS on `Message` (`sender OR recipient`); service layer re-checks |
| Edit others' posts | RLS + service guard; 15-min edit window; mod override |
| View others' memory | RLS: only `userId = self`; service role never reads without audit log |
| **Read others' DNA matches** | **RLS: only `sireId` or `damId` owner**; service layer filter |

### 4. Injection attacks

| Attack | Mitigation |
|--------|-----------|
| SQL injection | Prisma parameterizes every query; no raw SQL except in adapters (with parameterization) |
| NoSQL injection (Supabase) | Supabase client uses parameterized queries |
| XSS | All user content sanitized server-side (DOMPurify-equivalent); CSP headers |
| **Prompt injection** | **Agents use structured tool calls, not raw SQL or shell**; `User` content is untrusted input; tool output is wrapped in markers for the agent to distinguish |
| Path traversal | All storage paths constructed from IDs only; no user input in paths |

### 5. CSRF

| Attack | Mitigation |
|--------|-----------|
| Forged state-changing requests | SameSite=Lax cookies; double-submit cookie pattern; `Origin` header check on POST/PATCH/DELETE |
| Open redirect (OAuth) | Whitelist callback URLs to `https://greyhoundiq.com.au/auth/callback`; reject anything else |

### 6. Abuse

| Attack | Mitigation |
|--------|-----------|
| Spam posts | Moderator agent (every 30min); rate limit 5 posts/hr; CAPTCHA on first post |
| Spam messages | Rate limit 30/min; new account cooldown (24h, max 10 messages) |
| Marketplace fraud | Verified seller badge (admin manual); no platform fee; report flow |
| API scraping | Pagination caps (max 100/page); rate limit per IP; CAPTCHA on abuse |
| Mass account creation | CAPTCHA on signup; email verification required before any action |
| **Harassment** | **Block user feature; report flow; moderator agent; admin ban with audit** |

### 7. Data exfiltration

| Attack | Mitigation |
|--------|-----------|
| Dump DB via API | Pagination caps; rate limits; service layer enforces max rows per query |
| Mass downloads | Storage signed URL expiry (1h); bandwidth caps per user |
| **Dump via agent tool calls** | **Agent tool calls rate-limited per user; tool invocations logged in `AgentRun.toolInvocations`** |

### 8. Storage abuse

| Attack | Mitigation |
|--------|-----------|
| Use us as free CDN | Per-user storage quota (1GB / 10GB / 100GB); signed URL expiry (1h) |
| Massive file upload to fill disk | Max file sizes (image 10MB, video 200MB, audio 5MB or 5min) |
| Path traversal in storage keys | Server constructs paths from IDs only |

### 9. Malware & illegal content

| Attack | Mitigation |
|--------|-----------|
| Upload infected file | ClamAV scan in Edge Function before `MediaAsset.scanStatus = clean` |
| Executable disguised as image | Strict MIME sniffing server-side; not trusting client header |
| **CSAM** | **PhotoDNA integration — REQUIRED by AU law, hard gate before launch** |
| **Threats / illegal** | **Reporting system; immediate ban on confirmed; ACSC reporting** |

### 10. Account takeover

| Attack | Mitigation |
|--------|-----------|
| Phishing | Email is from verified domain only; DKIM/DMARC enforced; user education |
| SIM swap | Email change requires email confirmation; session revoke on email change |
| Stolen session | Short access TTL (1h); refresh rotation; device fingerprinting (Phase 2) |
| Credential stuffing (account-level) | Per-account lockout; CAPTCHA after fails |

### 11. Supply chain

| Attack | Mitigation |
|--------|-----------|
| Malicious npm package | Dependabot; lockfile review on every PR; pinned versions; `npm audit` in CI |
| Compromised agent skill | SkillSpector scan in CI for 3rd-party skills; no shell for agents |
| Malicious MCP server | MCP whitelist; per-server auth; reviewed by maintainer |

### 12. Insider threat

| Attack | Mitigation |
|--------|-----------|
| Rogue admin | `AuditLog` for every admin action; admin actions require 2FA (Phase 2); separate admin pool |
| Stolen service role key | Service role in env var only; never logged; rotated quarterly |
| Malicious agent output | Agent outputs run through filter; secrets stripped; cross-user data filter linter |

### 13. AI-specific threats

| Attack | Mitigation |
|--------|-----------|
| Prompt injection | Agents use structured tool calls (not raw user input); output filters strip user IDs from other accounts; agent context is read-only with respect to other users |
| Model exfiltration via prompts | Tools are whitelisted; tool descriptions are reviewed; agent config is version-controlled |
| Hallucinated predictions | Predictions carry a confidence score; UI shows it; never auto-act on low confidence |
| Stale predictions | `RacePrediction.invalidatedAt` on field changes; rebuild on next cron |
| **Runaway cost** | **50k tokens/run, 5 min duration, per-tier rate limits; abort on overage** |

---

## RLS policies (canonical examples)

### `User` — self + public fields

```sql
alter table "User" enable row level security;

create policy "user_read_public" on "User" for select using (true);
-- Public fields only; sensitive fields (email) filtered server-side

create policy "user_update_self" on "User" for update using (
  auth.uid() = "User"."supabaseUserId"
);

create policy "user_admin_all" on "User" for all using (
  exists (select 1 from "User" u where u."supabaseUserId" = auth.uid() and u."isAdmin" = true)
);
```

### `Message` — only sender + recipient

```sql
create policy "message_read_participants" on "Message" for select using (
  exists (
    select 1 from "Conversation" c
    where c.id = "Message"."conversationId"
    and (c."participantAId" = (select id from "User" where "supabaseUserId" = auth.uid())
         or c."participantBId" = (select id from "User" where "supabaseUserId" = auth.uid()))
  )
);

create policy "message_insert_self" on "Message" for insert with check (
  "senderId" = (select id from "User" where "supabaseUserId" = auth.uid())
);

create policy "message_update_own" on "Message" for update using (
  "senderId" = (select id from "User" where "supabaseUserId" = auth.uid())
);
```

### `MemoryEntry` — only owner (and service role for agents)

```sql
create policy "memory_read_self" on "MemoryEntry" for select using (
  "userId" = (select id from "User" where "supabaseUserId" = auth.uid())
);

create policy "memory_write_self" on "MemoryEntry" for insert with check (
  "userId" = (select id from "User" where "supabaseUserId" = auth.uid())
);
```

---

## Storage RLS

| Bucket | Read | Write |
|--------|------|-------|
| `messages` | Conversation participants only (via signed URL proxy) | Uploader (self) |
| `listings` | Public | Owner only |
| `avatars` | Public | Owner only |
| `agent-outputs` | Owner only | Service role only |

All private buckets serve content through `/api/media/:id/url` which generates a signed URL after a server-side RLS check.

---

## Auth security

| Threat | Mitigation |
|--------|-----------|
| Credential stuffing | Supabase rate limit + CAPTCHA after N failures |
| Session theft via XSS | HTTP-only cookies, short access tokens (1h), refresh rotation |
| CSRF | SameSite=Lax + double-submit cookie + Origin check |
| Password spraying | Account lockout after 10 fails/15min |
| Account enumeration | Generic error messages ("invalid credentials") on auth |
| Open redirect (OAuth) | Whitelist callback URLs to our domains only |
| Email bombing | CAPTCHA on signup; rate limit per IP; Resend abuse webhook |
| Stolen session | Short tokens; device fingerprinting (Phase 2) |

**Auth config:**
- Argon2id password hashing (Supabase default)
- Min 12 chars, complexity check
- Magic links expire in 15 min, single-use
- OAuth: Google (P1), Apple (P2)
- Session storage: HTTP-only cookies via `@supabase/ssr`
- Access token TTL: 1 hour
- Refresh token: rotation on every API call

---

## Agent / harness security

The Hermes CLI harness is the highest-risk new surface. Threat model:

| Threat | Mitigation |
|--------|-----------|
| **Prompt injection** | Agents use structured tool calls, not raw SQL or shell. User input is wrapped in markers. Tool output is escaped. |
| **Tool calling unauthorised APIs** | Tools are whitelisted in agent config. Adding a tool requires code review. |
| **Subprocess escape** | Run as dedicated low-privilege user `agent`. No shell. `spawn('hermes', args, { shell: false })`. |
| **Subprocess escape (Deeper)** | **Added in v2 — every `hermes agent` subprocess runs in Docker with `--read-only --security-opt=no-new-privileges --network=none`. Default-deny egress (only `db.supabase.co`, `api.supabase.co`, `api.resend.com`). Container destroyed after run.** |
| **Token exfiltration via response** | Post-process responses to strip credentials, secrets, foreign user IDs. |
| **Runaway cost** | Hard limits: 50k tokens/run, 5 min duration, per-tier rate limits. Hard stop. |
| **Cross-user data leakage** | Every tool that reads user data filters by `currentUser.id`. Enforced by a linter rule. |
| **Tool calling circular reference** | Max tool-call depth: 5. Max tool calls per run: 20. |
| **Long-running runaway** | 5 min hard timeout; SIGTERM; 5s grace; SIGKILL. |
| **Cancellation race** | Race-safe: harnessPid stored, SIGKILL wrapped in try/catch. |
| **Autonomous destructive action (e.g. one-click RCE)** | **Added in v2 — Tier 3 actions (`send_email_at_scale`, `user.ban`, `user.delete`, `payment.charge`, `agent.run_self_modify`) require human approval via `AgentApproval` queue before execution. Tier 2 actions require approval for batch ops. See US-2.16.** |
| **Compromised Mem0 / Cognee / LocalAI services** | **Added in v2 — All three run in the same Docker network as the agent harness, no external network access. Mem0 only stores/reads from Supabase via service-role key (rotated quarterly). Cognee writes only to `pgvector` extension on Supabase. LocalAI bound to localhost via Caddy reverse proxy with mTLS.** |

### Agent tool whitelist (v1)

```
Core:
- get_user
- update_user_profile
- search_dogs
- get_dog
- get_dog_form
- get_race
- get_track
- list_user_conversations
- send_message
- get_recent_results

Memory:
- get_memory
- search_memory  (Phase 2 with embeddings)
- save_memory
- update_memory_importance

Breeding:
- get_dna_match
- compute_dna_match  (caches result)
- get_sire_stats
- get_dam_stats

Predictions:
- get_race_prediction  (Pro+ only)
- explain_race_prediction  (Pro+ only)

Internal:
- mark_agent_run_complete
- save_agent_run_output
- emit_audit_log
```

**NOT in whitelist (require code change):**
- send_email
- charge_payment
- ban_user
- modify_user_tier
- write_to_external_api

---

## File / media security

| Threat | Mitigation |
|--------|-----------|
| Malware upload | ClamAV scan in Edge Function before `MediaAsset.scanStatus = clean` |
| Executable disguised | Strict MIME sniffing (not trusting client header) |
| CSAM | **PhotoDNA integration, hard legal gate before launch** |
| Path traversal | Server constructs paths from IDs only |
| Storage abuse | Per-user quota; signed URL expiry (1h) |
| EXIF privacy leak | Strip EXIF on image processing (`sharp` withMetadata: false) |
| Unauth reads | Private buckets require RLS-checked signed URLs |
| Replay attacks | Signed URLs include nonce; idempotency key on finalize |

---

## Network security

| Layer | Control |
|-------|---------|
| TLS | TLS 1.3 only; HSTS preload; certificate transparency monitoring |
| HSTS | `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` |
| CSP | `Content-Security-Policy: default-src 'self'; img-src 'self' https://*.supabase.co; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'` (refine per app) |
| X-Frame-Options | `DENY` |
| X-Content-Type-Options | `nosniff` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` |
| CORS | Same-origin only; mobile app later gets explicit allowlist |
| Rate limit | Per-IP, per-user, per-endpoint; tier-based for Pro+ |

---

## Audit logging

`AuditLog` model captures every sensitive action:

| Action | When |
|--------|------|
| `auth.signin.success` / `auth.signin.fail` | Every sign-in attempt |
| `auth.signup` | New account created |
| `auth.magic_link.send` | Magic link requested |
| `user.ban` / `user.unban` | Admin moderation |
| `user.delete` | Account deletion requested |
| `post.hide` / `post.delete` | Moderation actions |
| `message.delete` | Soft-delete |
| `memory.read` | Agent reads another user's memory (should never happen) |
| `memory.write` | Agent creates memory |
| `agent.run.start` / `agent.run.cancel` | Agent lifecycle |
| `agent.tool_call` | Every tool invocation by an agent |
| `media.upload` | Upload finalized |
| `media.delete` | Soft-delete |
| `listing.create` / `listing.sold` | Marketplace actions |
| `role.grant` | Admin role changes |
| `api_key.create` / `api_key.revoke` | API key management |

Always log: actor (user/agent/system/admin), target (type + id), IP, user-agent, timestamp, metadata JSON.

**Retention:** 2 years minimum. Append-only at the service layer.

---

## Australian Privacy Principles (APPs) compliance

| APP | Requirement | Implementation |
|-----|-------------|----------------|
| 1 | Accountability | Privacy policy on site; APP 1 designated person (Daniel) |
| 2 | Anonymity | Anonymous browsing supported; no auth required for public pages |
| 3 | Collection | Only collect what's needed; signup collects email + display name only |
| 4 | Unsolicited info | If received, destroy or de-identify within reasonable time |
| 5 | Notification | Privacy policy explains what we collect; consent on signup |
| 6 | Use/disclosure | Data only used for stated purposes; documented in privacy policy |
| 7 | Direct marketing | No marketing emails without consent; unsubscribe one-click |
| 8 | Cross-border | Supabase Sydney (ap-southeast-2); no transfer outside AU |
| 9 | Adoption/use | Encryption at rest (Supabase default); TLS in transit |
| 10 | Quality | Data validation at every input; quarantine bad rows in ingestion |
| 11 | Security | RLS, encryption, audit logs, access controls |
| 12 | Access | `/api/me/export` for data export (data download within 30 days) |
| 13 | Correction | `/settings/profile` edit form; admin manual correction |
| 14 | Accuracy | Always pull fresh from canonical source; ingest validation |

---

## Responsible gambling compliance

GreyhoundIQ is **18+ only**. Specific obligations:

- ✅ Signup requires age affirmation
- ✅ 18+ banner site-wide (footer + every page footer)
- ✅ Responsible gambling link to `gamblinghelponline.org.au` (1800 858 858)
- ✅ No "bet now" CTAs or affiliate bookmaker links
- ✅ Data platform only — we do not place bets, accept wagers, or provide betting advice
- ✅ Disclaimers on every prediction: "Statistical estimates, not guarantees. Bet responsibly."
- ✅ PhotoDNA integration before launch (required by AU law for any user-generated media)

---

## What is NOT in v1 security (explicitly)

- 2FA / TOTP — Phase 2
- SSO / SAML — no enterprise use case yet
- Bug bounty program — after public launch
- SIEM / SOC — overkill at this scale
- DLP — not needed
- BYOK encryption — not needed
- E2E message encryption — TLS + at-rest sufficient for community
- PhotoDNA integration — required for AU law, blocker for launch

---

## Pre-launch security checklist

- [ ] RLS enabled on every table
- [ ] All Supabase API keys rotated since dev
- [ ] Service role key only in env vars (never in code)
- [ ] CORS, CSP, HSTS, X-Frame-Options configured
- [ ] Rate limits on every endpoint
- [ ] ClamAV integration tested with EICAR test file
- [ ] PhotoDNA integration tested
- [ ] Backup + recovery tested
- [ ] Incident response runbook written
- [ ] Penetration test completed ($5k-$15k budget)
- [ ] Bug bounty program ready to launch
- [ ] All audit log actions verified
- [ ] Privacy policy + ToS linked from every page footer
- [ ] Responsible gambling compliance verified
- [ ] 18+ age gate on signup

---

## Incident response

| Severity | Examples | Response time | Notification |
|----------|----------|---------------|--------------|
| Critical | Active data breach, RLS bypass, auth bypass | < 1 hour | OAIC (if APP 11), all users within 72h |
| High | Service outage > 1h, persistent XSS | < 4 hours | Status page; users if data affected |
| Medium | Bug in payment flow, minor data leak | < 24 hours | Affected users |
| Low | Cosmetic bug, typo | Next sprint | None |

**Runbook location:** `docs/runbooks/incident-response.md` (to be written before launch)

**Status page:** `https://status.greyhoundiq.com.au` (Phase 2)

---

## Security contact

For security issues: `security@greyhoundiq.com.au` (PGP key on website)

For general: `support@greyhoundiq.com.au`
