# GreyhoundIQ — API Architecture v1

> Source: `docs/GreyhoundIQ-Architecture-Premium.html`
> Format: REST route reference + auth + rate limits + data contracts.
> All routes JSON. All auth via Supabase session cookie (HTTP-only, SameSite=Lax, Secure in prod).

---

## Conventions

- **Base path:** `/api` (Next.js Route Handlers)
- **Auth header:** Session cookie `sb-access-token` (managed by `@supabase/ssr`)
- **Content-Type:** `application/json; charset=utf-8` for all responses
- **Error shape:**
  ```json
  { "error": { "code": "stable.code.here", "message": "human readable", "details": {} } }
  ```
- **Pagination:** Cursor-based, `?cursor=<opaque>&limit=<n>` (max `limit = 100`)
- **Date format:** ISO 8601 UTC (`2026-06-29T12:34:56.000Z`)
- **Rate limit headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` (on 429)
- **Idempotency:** `Idempotency-Key` header for mutating endpoints; 24h dedup window
- **Versioning:** Routes may add `Accept: application/vnd.greyhoundiq.v2+json` in Phase 2. v1 is implicit.
- **Internal endpoints:** `/api/internal/*` requires `X-Internal-Secret` header (shared env var, never exposed to browser)

---

## Auth & identity

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | none | Email + password sign up, sends verification email |
| POST | `/api/auth/signin` | none | Sign in, returns session cookie |
| POST | `/api/auth/signout` | session | Revoke current session |
| POST | `/api/auth/magic-link` | none | Request magic link by email |
| GET | `/api/auth/callback` | oauth code | OAuth callback (Google) |
| GET | `/api/auth/session` | session | Returns current session + user |
| POST | `/api/auth/refresh` | refresh | Rotate refresh token |

**Rate limits:**
- Signup: 5/hr per IP
- Sign-in: 10/min per IP, 10 fails/15min per email (lockout)
- Magic link: 5/hr per email
- OAuth callback: no limit (Google enforces)

---

## Users & profiles

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users/me` | session | Returns `User` + `Profile` |
| PATCH | `/api/users/me` | session | Update profile fields |
| GET | `/api/users/me/export` | session | Request data export (APP 12) |
| POST | `/api/users/me/delete` | session | Trigger account deletion |
| GET | `/api/users/:handle` | public | Public profile (respects `showEmail`) |
| GET | `/api/users/:handle/dogs` | public | Owned dogs (respects `showOwnedDogs`) |
| POST | `/api/users/:id/ban` | admin | Ban user |
| POST | `/api/users/:id/unban` | admin | Unban user |

**Schemas:**
- `User`: `{ id, supabaseUserId, email, displayName, avatarUrl, subscriptionTier, isAdmin, isBanned, lastSeenAt, createdAt }`
- `Profile`: `{ userId, bio, state, kennelName, kennelPrefix, role, verified, website, showEmail, showOwnedDogs }`

**`GET /api/users/me` response:**
```json
{
  "user": { "id": "...", "email": "...", "displayName": "Daniel", "subscriptionTier": "pro", ... },
  "profile": { "userId": "...", "bio": "...", "state": "NSW", "role": "breeder", "verified": true }
}
```

---

## Media (Supabase Storage proxies)

All media flows through Supabase Storage. Clients upload directly to signed URLs; server tracks `MediaAsset` rows.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/media/sign-upload` | session | Request signed upload URL (valid 10 min) |
| POST | `/api/media/:id/finalize` | session | Mark upload complete; triggers ClamAV scan |
| GET | `/api/media/:id/url` | varies | Get signed read URL (1h expiry, RLS-checked) |
| DELETE | `/api/media/:id` | uploader | Soft-delete media |
| GET | `/api/media/:id` | uploader | Get media metadata |

**Request `POST /api/media/sign-upload`:**
```json
{
  "mimeType": "image/jpeg",
  "sizeBytes": 3145728,
  "filename": "aston-queen-jan.jpg"
}
```

**Response:**
```json
{
  "mediaId": "abc123",
  "uploadUrl": "https://...supabase.co/storage/v1/object/upload/sign/...",
  "storagePath": "messages/abc123/photo.jpg",
  "expiresAt": "2026-06-29T13:00:00Z"
}
```

**Constraints:**
- MIME types: `image/jpeg | image/png | image/webp | video/mp4 | video/webm | audio/mp4 | audio/webm | audio/ogg`
- Max sizes: image 10MB, video 200MB, audio 5MB (or 5min duration)
- Quota per tier: 1GB / 10GB / 100GB
- Server-side: EXIF stripped, SHA-256 content-addressed, virus scan before `MediaAsset.scanStatus = clean`

---

## Messaging (1:1)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/conversations` | session | List my conversations (paginated, recent first) |
| POST | `/api/conversations` | session | Create or get conversation with user |
| GET | `/api/conversations/:id` | participant | Get conversation + last 50 messages |
| GET | `/api/conversations/:id/messages` | participant | Get messages (paginated) |
| POST | `/api/conversations/:id/messages` | participant | Send a message (text + media) |
| POST | `/api/conversations/:id/read` | participant | Mark all messages as read |
| DELETE | `/api/conversations/:id/messages/:msgId` | sender | Soft-delete a message |
| POST | `/api/conversations/:id/block` | participant | Block other user |
| DELETE | `/api/conversations/:id/block` | participant | Unblock |

**`POST /api/conversations/:id/messages` request:**
```json
{
  "body": "Saw your dog run Saturday",
  "mediaIds": ["abc123", "def456"]
}
```

**`POST /api/conversations` request** (to start a new conversation):
```json
{ "recipientId": "user_xyz" }
```

**`Message` schema:**
- `{ id, conversationId, senderId, body, media: MediaAsset[], readAt, createdAt }`

**Realtime:**
- Supabase Realtime channel per conversation: `conversation:{id}`
- Events: `message.created`, `message.read`, `message.deleted`, `conversation.updated`

**Rate limits:**
- Send message: 30/min per user
- Create conversation: 10/hr per user
- Block/unblock: 20/hr per user

---

## Forum

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/forum/categories` | public | List categories |
| GET | `/api/forum/categories/:slug/threads` | public | List threads in category (paginated) |
| POST | `/api/forum/categories/:slug/threads` | session | Create thread |
| GET | `/api/forum/threads/:id` | public | Get thread + posts |
| POST | `/api/forum/threads/:id/posts` | session | Reply to thread |
| PATCH | `/api/forum/posts/:id` | author (15 min) | Edit post |
| DELETE | `/api/forum/posts/:id` | author or mod | Soft-delete post |
| POST | `/api/forum/posts/:id/hide` | mod | Hide post (sets `hiddenAt`) |
| POST | `/api/forum/threads/:id/pin` | mod | Pin thread |

**`POST /api/forum/categories/:slug/threads` request:**
```json
{ "title": "Best young sires for 2026?", "body": "Looking for a new..." }
```

**Validation:**
- Title: 5-200 chars
- Body: 20-20000 chars
- Markdown; server-side sanitized (DOMPurify or similar)
- View count: incremented on GET, deduped per user/day via Redis-like cache (or DB row)

---

## Marketplace

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/listings` | public | Browse listings (filterable by type, state, dog) |
| POST | `/api/listings` | session | Create listing |
| GET | `/api/listings/:id` | public | Get listing details |
| PATCH | `/api/listings/:id` | owner | Edit listing |
| POST | `/api/listings/:id/renew` | owner | Extend expiry by 90 days |
| POST | `/api/listings/:id/sold` | owner | Mark as sold |
| POST | `/api/listings/:id/withdraw` | owner | Withdraw listing |
| GET | `/api/listings/:id/messages` | owner | List inquiry messages |

**`GET /api/listings` query params:**
- `type=pup_for_sale|dog_for_sale|stud_service|wanted|share`
- `state=NSW|VIC|QLD|SA|WA|TAS|ACT|NT`
- `q=<text>` (searches title + description)
- `cursor=<opaque>&limit=20`
- `sort=created_at|price|expires_at`

**Constraints:**
- Up to 10 images + 1 video per listing
- Default 90-day expiry
- Owner can renew unlimited times
- Free for v1 (no platform fee)

---

## Dogs, races, results (read API for AI agents)

These endpoints back the public web UI and the AI agent tools. Most are public read-only; mutations happen via ingestion.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dogs` | public | Search dogs (paginated) |
| GET | `/api/dogs/:id` | public | Dog profile (form, pedigree, trainer) |
| GET | `/api/dogs/:id/form` | public | Recent form entries (paginated) |
| GET | `/api/dogs/:id/pedigree` | public | 5-generation pedigree tree |
| GET | `/api/races` | public | Races by date/track |
| GET | `/api/races/:id` | public | Race details + runners |
| GET | `/api/races/:id/prediction` | session (Pro+) | AI prediction for race |
| GET | `/api/tracks` | public | List tracks |
| GET | `/api/trainers` | public | Search trainers |
| GET | `/api/sires` | public | Sire statistics |

**`GET /api/dogs` query params:**
- `q=<text>` (search by name)
- `earBrand=<text>`
- `trainerId=<cuid>`
- `cursor=<opaque>&limit=20`

**Response:**
```json
{
  "items": [
    {
      "id": "dog_abc",
      "name": "Aston Queen",
      "earBrand": "AQ-23-001",
      "colour": "Black",
      "sex": "F",
      "trainer": { "id": "t1", "name": "Jason Thompson" },
      "sire": { "id": "s1", "name": "Barcia Bale" },
      "formCount": 24
    }
  ],
  "nextCursor": "eyJpZCI6Ii4uLiJ9"
}
```

**Rate limits (public):**
- `/api/dogs`, `/api/races`, `/api/tracks`: 60/min per IP
- `/api/races/:id/prediction`: 20/min per user (tier-gated server-side)
- All others: 120/min per IP

---

## Agents (Hermes harness)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/agents/:type/run` | session | Run agent of type `race-analyst\|breeding-advisor\|form-reader\|moderator` |
| GET | `/api/agents/runs/:id` | session + owner | Get run status + output |
| POST | `/api/agents/runs/:id/cancel` | session + owner | Cancel running agent |
| GET | `/api/agents/runs` | session | List my agent runs |
| GET | `/api/agents/context` | session | Get current conversation context for an agent |

**`POST /api/agents/race-analyst/run` request:**
```json
{
  "input": "Top 3 picks for R5 The Meadows Friday",
  "conversationContextId": "ctx_abc"
}
```

**Response (immediate, run is async):**
```json
{
  "runId": "run_xyz",
  "status": "pending",
  "createdAt": "2026-06-29T13:00:00Z"
}
```

**`GET /api/agents/runs/:id` response (completed):**
```json
{
  "runId": "run_xyz",
  "agentType": "race-analyst",
  "status": "completed",
  "input": "Top 3 picks...",
  "output": {
    "selections": [
      { "dogId": "dog_1", "name": "Aston Queen", "winProb": 0.18, "factors": [...] }
    ]
  },
  "promptTokens": 2400,
  "completionTokens": 800,
  "durationMs": 4200,
  "harnessSessionId": "hermes-abc",
  "createdMemoryIds": ["mem_1", "mem_2"]
}
```

**Rate limits per tier:**
- Free: 3/day, 5k tokens
- Pro: 10/hr, 50k tokens/run
- Pro+: 100/hr, 50k tokens/run

**Cancellation:**
- Server tracks `harnessPid`, sends SIGTERM, then SIGKILL after 5s
- `status = "cancelled"`, `completedAt = now()`
- User sees cancellation in UI via Realtime

---

## Memory (per-user agent memory)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/memory` | session | List my memory entries (filterable by kind) |
| GET | `/api/memory/:id` | session + owner | Get memory entry |
| POST | `/api/memory` | session | Create memory (typically agent-driven) |
| DELETE | `/api/memory/:id` | session + owner | Soft-delete memory |
| POST | `/api/memory/:id/supersede` | session | Mark memory as replaced by a newer one |

**`MemoryEntry` schema:**
```json
{
  "id": "mem_1",
  "kind": "episodic | semantic | preference | unfinished",
  "content": "Wants R5 The Meadows Friday selection, working till 6pm",
  "source": "conversation | explicit_user_input | agent_inference | tool_observation",
  "sourceRef": "ctx_abc",
  "importance": 0.9,
  "lastAccessedAt": "2026-06-29T12:00:00Z",
  "accessCount": 3,
  "supersededById": null,
  "createdAt": "2026-06-29T12:00:00Z"
}
```

---

## Ingestion (internal + admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/internal/ingest/:source` | internal | Trigger source ingestion (cron calls this) |
| GET | `/api/admin/ingestion/runs` | admin | List recent ingestion runs |
| GET | `/api/admin/ingestion/sources` | admin | Per-source health dashboard |
| POST | `/api/admin/ingestion/:source/disable` | admin | Disable a source adapter |

**Internal request header:** `X-Internal-Secret: <env>`

**Sources:** `topaz | betfair_hub | betfair_exchange | ga_studbook | isolynx`

**Cron schedule:**
- Live fields (Topaz): every 2 min, race days only
- Results (Topaz): every 5 min, post-race
- History (Betfair Hub): nightly 02:00 AEST
- Pedigree (GA Stud Book): weekly Sunday 03:00 AEST

---

## Moderation & reports

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/reports` | session | File a report |
| GET | `/api/reports` | mod | List open reports |
| POST | `/api/reports/:id/resolve` | mod | Resolve (with action) |

**`POST /api/reports` request:**
```json
{
  "targetType": "post | thread | listing | message | profile | user",
  "targetId": "post_abc",
  "reason": "spam | harassment | misinformation | illegal | other",
  "description": "Optional 500-char context"
}
```

**`POST /api/reports/:id/resolve` request:**
```json
{
  "action": "dismiss | hide_content | warn_user | ban_user | delete_content",
  "notes": "False positive — user apologized in DMs"
}
```

---

## Watchlists (Phase 2)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/watchlists` | session | List my watchlists |
| POST | `/api/watchlists` | session | Create watchlist |
| POST | `/api/watchlists/:id/items` | session | Add dog/sire/trainer/track |
| DELETE | `/api/watchlists/:id/items/:itemId` | session | Remove item |
| GET | `/api/watchlists/:id/feed` | session | Get recent activity for watchlist |

**Use case:** Track Aston Queen + Barcia Bale + Jason Thompson + Wentworth Park; get notifications on runs/results/listings.

---

## Alerts (Phase 2)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/alerts/rules` | session | List my alert rules |
| POST | `/api/alerts/rules` | session | Create rule (keyed to watchlist) |
| PATCH | `/api/alerts/rules/:id` | session | Update rule |
| DELETE | `/api/alerts/rules/:id` | session | Delete rule |

**Rule example:**
- Trigger: `race.scheduled` | `race.scratched` | `result.posted` | `listing.created`
- Channels: `email | web_push | sms`
- Conditions: `{"watchlistId": "w_abc", "minWinProb": 0.10}`

---

## Health & observability

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | public | Liveness (always 200 if process up) |
| GET | `/api/health/ready` | public | Readiness (checks DB + storage + localai) |
| GET | `/api/internal/metrics` | internal | Prometheus-format metrics |
| GET | `/api/internal/errors` | internal | Recent error reports (for Sentry mirroring) |

---

## Admin (added in architecture v2)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/approvals` | admin | List pending agent approvals |
| POST | `/api/admin/approvals/:id/approve` | admin | Approve a tier 3 action |
| POST | `/api/admin/approvals/:id/reject` | admin | Reject a tier 3 action |
| GET | `/api/admin/eval/results` | admin | List recent prompt-eval runs |
| POST | `/api/admin/eval/refresh` | admin | Refresh held-out eval set |
| GET | `/api/admin/eval/compare` | admin | Compare current vs main branch metrics |
| POST | `/api/admin/breeding/resync-graph` | admin | Full Cognee graph resync |
| GET | `/api/admin/agents/sandbox-status` | admin | List active agent containers |

## Models & ML (added in v3 — Technology Opportunities)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/models` | admin | List all models in registry |
| GET | `/api/admin/models/:id` | admin | Get model details + metrics |
| POST | `/api/admin/models/:id/promote` | admin | Promote challenger → champion |
| POST | `/api/admin/models/:id/archive` | admin | Archive a model |
| POST | `/api/internal/models/retrain` | internal | Trigger AutoTrain retraining (cron calls this) |
| POST | `/api/races/:id/forecast` | session (Pro+) | Get TimesFM forecast for the race |
| POST | `/api/dogs/:id/form-forecast` | session (Pro+) | Get TimesFM form trend for a dog |

## Observability (added in v3)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/internal/metrics` | internal | Prometheus scrape endpoint |
| GET | `/api/admin/observability/traces` | admin | Recent OTel traces (filterable by runId) |
| GET | `/api/admin/observability/spans/:traceId` | admin | All spans for a trace |
| GET | `/api/admin/observability/token-usage` | admin | Token usage by agent type / tier / day |

## GEO audits (added in v3)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/geo/audits` | admin | List GEO audit results |
| POST | `/api/internal/geo/run-audit` | internal | Trigger weekly GEO audit |
| GET | `/api/admin/geo/scores` | admin | Per-page GEO score history |

---

## Error codes (stable)

| Code | HTTP | When |
|------|------|------|
| `auth.unauthorized` | 401 | No/invalid session |
| `auth.forbidden` | 403 | Authenticated but lacks permission |
| `auth.locked` | 423 | Too many failed sign-ins |
| `validation.required` | 400 | Missing field |
| `validation.format` | 400 | Field has wrong format |
| `validation.range` | 400 | Number out of range |
| `resource.not_found` | 404 | ID doesn't exist |
| `resource.conflict` | 409 | Duplicate (e.g. unique constraint) |
| `resource.expired` | 410 | Listing or session expired |
| `rate_limit.exceeded` | 429 | Per-tier or per-IP limit hit |
| `quota.exceeded` | 413 | Storage or token quota |
| `upload.rejected` | 415 | MIME not allowed, virus, etc. |
| `upload.too_large` | 413 | File exceeds max size |
| `payment.required` | 402 | Tier-gated feature, must upgrade |
| `agent.limit_exceeded` | 429 | Per-run token/time/rate limit |
| `agent.cancelled` | 410 | User cancelled mid-run |
| `internal.error` | 500 | Unhandled server error |
| `internal.timeout` | 504 | Upstream/agent timeout |
| `internal.unavailable` | 503 | Dependency down (Supabase, Hermes CLI) |

---

## Cross-cutting concerns

### Request validation
Every route uses Zod schemas. Validation errors return `validation.required` or `validation.format` with `details` listing each invalid field.

### Authentication middleware
Centralized in `src/lib/auth/middleware.ts`:
```ts
export function requireAuth(): User;            // throws auth.unauthorized
export function requireAdmin(): User;           // throws auth.forbidden
export function requireOwnership<T>(getter): T; // throws auth.forbidden
```

### Rate limiting
- Per-IP: 120/min default for unauthenticated, 600/min for authenticated
- Per-user: tier-based (Free < Pro < Pro+)
- Per-endpoint: custom where needed (e.g. 30/min for message send)
- Storage: Redis (Upstash free tier) for distributed counting; fallback to in-memory for single-VPS

### CORS
- Same-origin only by default
- For the future mobile app: allow specific origins via `ACCESS_CONTROL_ALLOW_ORIGIN` env

### Webhooks (outbound, future)
- Stripe subscription events → `POST /api/webhooks/stripe`
- Supabase auth events → `POST /api/webhooks/supabase`
- All webhooks verify signature via shared secret

---

## OpenAPI spec (future)

This doc is the source of truth; an `openapi.yaml` will be generated from the route handlers using `zod-to-openapi`. Tracked in Phase 2.

---

## Versioning & deprecation

- All routes return a `Sunset` header if deprecated
- v1 routes are stable for the lifetime of v1
- New versions live at `/api/v2/*` when needed (target: never — extend in place)
