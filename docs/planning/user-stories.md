# GreyhoundIQ — User Stories v1

> Source: `docs/GreyhoundIQ-Architecture-Premium.html` (Architecture Review · Draft v1 · 28 June 2026)
> Owner: Daniel Fleuren (AI Kick Start)
> Format: Given/When/Then for each story. Grouped by phase, epics within phase.
> Phases mirror the architecture doc's 4-phase build plan: Foundation, Memory, Community, Polish.

---

## Index

- [Phase 1 — Foundation (Weeks 1–2)](#phase-1--foundation-weeks-12)
  - [E1 · WorkOS Auth & User Identity](#e1--workos-auth--user-identity)
  - [E2 · Data Ingestion Spine](#e2--data-ingestion-spine)
  - [E3 · Media Upload](#e3--media-upload)
  - [E4 · 1:1 Messaging](#e4--11-messaging)
- [Phase 2 — Memory (Weeks 2–3)](#phase-2--memory-weeks-23)
  - [E5 · Agent Memory](#e5--agent-memory)
  - [E6 · Hermes Agent Harness](#e6--hermes-agent-harness)
  - [E7 · Core Agents](#e7--core-agents)
- [Phase 3 — Community (Weeks 3–4)](#phase-3--community-weeks-34)
  - [E8 · Forum](#e8--forum)
  - [E9 · Marketplace](#e9--marketplace)
  - [E10 · Dog Ownership](#e10--dog-ownership)
  - [E11 · Moderation](#e11--moderation)
- [Phase 4 — Polish (Weeks 4–5)](#phase-4--polish-weeks-45)
  - [E12 · Voice & Video Messages](#e12--voice--video-messages)
  - [E13 · Auditing & Compliance](#e13--auditing--compliance)
  - [E14 · Data Portability & Account Deletion](#e14--data-portability--account-deletion)
- [Cross-cutting stories](#cross-cutting-stories)
- [Out of scope (explicitly excluded)](#out-of-scope)

---

## Phase 1 — Foundation (Weeks 1–2)

**Phase exit criterion:** Two users can sign up, message each other with text + image.

### E1 · WorkOS Auth & User Identity

#### US-1.1 — Sign up with WorkOS
**As a** new visitor
**I want to** create an account through WorkOS AuthKit
**So that** I can use GreyhoundIQ's messaging, agents, and personalised features

**Acceptance criteria:**
- `/sign-in` redirects to the WorkOS AuthKit hosted sign-up/sign-in flow
- WorkOS owns credentials, verification, OAuth/passwordless provider config, and session cookies
- The app does not create or depend on non-WorkOS identity records
- On successful WorkOS callback, Prisma creates or links a local `User` with `User.workosUserId = WorkOS user id`
- Rate limit: max 5 signups per IP per hour (CAPTCHA after 3)
- Generic error message on auth failure (no account enumeration)
- `isBanned` users see a generic "we can't create an account right now" message

**Given** I am a new visitor on `/sign-in`
**When** I complete the WorkOS sign-up flow
**Then** I return to GreyhoundIQ with a local `User` row linked by `User.workosUserId`

#### US-1.2 — Sign in with WorkOS
**As a** registered user
**I want to** sign in through WorkOS AuthKit
**So that** I can access my account

**Acceptance criteria:**
- Auth uses WorkOS AuthKit via `@workos-inc/authkit-nextjs`
- The app validates sessions with `withAuth()` and bridges them to the local `User` row
- Supabase remains a data/storage/realtime backend only, not the identity provider
- Account lockout and credential policy are enforced by WorkOS configuration
- All auth events written to `AuditLog` (`action: "auth.signin.success" | "auth.signin.fail"`)

**Given** I have a verified WorkOS account
**When** I click "Sign in"
**Then** I land on `/` with a sticky session, and the local `User` is available by `User.workosUserId`

#### US-1.3 — Sign in with Google OAuth through WorkOS
**As a** user who prefers Google
**I want to** sign in with my Google account
**So that** I don't need another password

**Acceptance criteria:**
- Google OAuth, if enabled, is configured in WorkOS and scoped to `email profile`
- On success, `User` row created or linked by email, with `User.workosUserId` set
- WorkOS callback URL is whitelisted to the production `/callback` route
- Open redirect attempts → 400

**Given** I click "Continue with Google" in the WorkOS AuthKit flow
**When** WorkOS redirects me to `/callback`
**Then** a session is established and I'm routed to `/`

#### US-1.4 — Passwordless sign-in (opt-in)
**As a** user who doesn't want to remember a password
**I want to** request a WorkOS passwordless sign-in
**So that** I can sign in without a password

**Acceptance criteria:**
- Passwordless options are configured and sent by WorkOS only
- The app never creates identity-provider users outside WorkOS
- On success, the same WorkOS callback syncs `User.workosUserId`
- Rate limit: max 5 passwordless requests per email per hour

---

### E2 · Data Ingestion Spine

#### US-1.5 — Betfair Hub history backfill (free source)
**As a** platform operator
**I want to** ingest 5+ years of historical Betfair Hub CSV/ZIP data
**So that** GreyhoundIQ has form data on day one

**Acceptance criteria:**
- Adapter follows `SourceAdapter` interface (fetch / validate / normalize / dedup)
- Runs nightly via system cron hitting an internal endpoint with shared-secret header
- Every fetched raw payload stored in `SourceRecord.rawJson` for replay
- Idempotent: re-running never double-inserts (unique on `source + sourceId + sha256`)
- Failed rows quarantined; good rows committed; `IngestionRun.status = "partial"` if mixed

**Given** a nightly cron hits `/api/internal/ingest/betfair_hub`
**When** the adapter processes the new daily ZIP
**Then** new races/dogs/form are written, `IngestionRun.status` reflects outcome

#### US-1.6 — Topaz live fields (after licensing)
**As a** platform operator (post-licensing)
**I want to** ingest Topaz live race fields every 2 minutes on race days
**So that** `/races` always shows current fields

**Acceptance criteria:**
- Adapter implements Topaz auth (Topaz key + Betfair ANZ key)
- HTTP 429 → exponential backoff (1s, 2s, 4s, 8s, max 60s)
- Cross-references to existing dogs via `(name + whelp date + sire/dam)`; GA stud-book ID stored as cross-reference
- Source precedence: Topaz results > Betfair inferences > Isolynx times (never overwrites official)

**Given** Topaz returns 429 on a request
**When** the adapter retries
**Then** it backs off exponentially and the `IngestionRun` records the 429 with the retry count

#### US-1.7 — Accuracy dashboard
**As a** platform operator
**I want to** see data-quality metrics per source
**So that** I detect source outages and schema drift early

**Acceptance criteria:**
- `/admin/ingestion` shows per-source: last-run time, rows fetched/written/rejected, status
- Alert if row count drifts >20% week-over-week
- Alert if a vendor field that was present last week is now missing (schema drift)
- Last-30-day chart per source

---

### E3 · Media Upload

#### US-1.8 — Upload an image to a message
**As a** user in a conversation
**I want to** attach an image to my message
**So that** I can share a photo of a dog, a form, etc.

**Acceptance criteria:**
- File picker accepts `image/jpeg`, `image/png`, `image/webm`; rejects others with clear error
- Max file size: 10MB; max 4 images per message
- Direct-to-storage upload via signed URL (browser → Supabase Storage, not through our server)
- Server-side scan: ClamAV via Edge Function; `scanStatus` set to `clean` before `MediaAsset` can be attached
- EXIF stripped on processing (`sharp` with `withMetadata: false`)
- Quota: 1GB free, 10GB Pro, 100GB Pro+ — checked at upload finalize
- Content-addressed by SHA-256 for dedup

**Given** I select a 3MB JPEG of a dog
**When** the upload completes and ClamAV returns `clean`
**Then** the image shows in the message preview and the conversation updates in realtime

#### US-1.9 — Reject infected upload
**As a** user
**If** my upload is flagged as malware
**Then** I see "Upload rejected: file failed security scan" and the file is not attached

---

### E4 · 1:1 Messaging

#### US-1.10 — Send a text message
**As a** user
**I want to** send a text message to another user
**So that** we can have a private conversation

**Acceptance criteria:**
- I can find the other user by handle or display name
- New `Conversation` row created if none exists (canonical A-B ordering: smaller id is A)
- New `Message` row with `body`, `senderId`, `conversationId`
- `Conversation.lastMessageAt` updated via DB trigger
- Recipient sees the message within 2s via Supabase Realtime
- Both sender and recipient are online-visible: 1:1 only, not group
- Blocked users: sender sees "You can't message this user"

**Given** I am on `/messages` and select a contact
**When** I type "Hey, saw your dog run on Saturday" and hit send
**Then** the recipient sees the message within 2s, with a timestamp

#### US-1.11 — Read receipts
**As a** sender
**I want to** know when the recipient has read my message
**So that** I know whether to follow up

**Acceptance criteria:**
- When the recipient's client renders the message, it emits a `read` event
- Server updates `Message.readAt` for that user (each user has their own `readAt` if needed; v1 = single `readAt`)
- Sender sees a "Read" indicator on messages older than their last read
- No push notification (web push is Phase 2)

**Given** I sent a message at 10:00
**When** the recipient opens the conversation at 10:05
**Then** I see a "Read" badge on the message at 10:05

#### US-1.12 — Delete a message
**As a** sender
**I want to** delete a message I sent
**So that** I can correct mistakes

**Acceptance criteria:**
- Soft-delete: `Message.deletedBySenderAt = now()` — the message is hidden from sender's view
- If both sender and recipient have deleted, the row is hard-deleted by a daily cron
- Recipient still sees the message until they delete it on their side
- The conversation's `lastMessageAt` updates to the previous message's time

**Given** I sent "wrong time, see you Tuesday instead"
**When** I click "Delete" on that message
**Then** it disappears from my view; the recipient still sees it until they also delete

#### US-1.13 — Block a user
**As a** user
**I want to** block another user from messaging me
**So that** I don't receive unwanted contact

**Acceptance criteria:**
- `Conversation.blockedById` and `Conversation.blockedAt` set
- The blocked user cannot send new messages (server returns 403 on POST)
- The blocked user doesn't see me in their search
- I can unblock; the existing conversation becomes visible again

---

## Phase 2 — Memory (Weeks 2–3)

**Phase exit criterion:** User can have a multi-session conversation with the race analyst that picks up where they left off.

### E5 · Agent Memory

#### US-2.1 — Memory is created from a conversation
**As a** user chatting with the race analyst
**I want** the analyst to remember what we talked about
**So that** I can come back tomorrow and continue

**Acceptance criteria:**
- When a conversation ends (user idle 5min or explicit "done"), a summary is generated by the agent
- The summary is stored as a `MemoryEntry` with `kind = "episodic"`, `importance = 0.6`
- Unfinished actions (`pendingAction` in `ConversationContext`) are stored as `kind = "unfinished"`, `importance = 0.9`
- Stated preferences ("I always back box 1 in short races") are stored as `kind = "preference"`, `importance = 0.8`

**Given** I tell the race analyst "I need a winner for Race 5 at The Meadows on Friday but I'm working till 6"
**When** the conversation ends
**Then** a `MemoryEntry` is written: "Wants R5 The Meadows Friday selection, working till 6pm" with `kind = unfinished`, `importance = 0.9`

#### US-2.2 — Memory recall on next conversation
**As a** user opening a new conversation
**I want** the agent to remember prior context
**So that** I don't have to repeat myself

**Acceptance criteria:**
- Top 20 high-importance memories are loaded into the system prompt
- The `ConversationContext.pendingAction` is loaded if it exists
- Last 5 episodic memories are included verbatim
- Identity (display name, owned dogs, tier) is always included
- `accessCount` increments and `lastAccessedAt` updates on each retrieval

**Given** I had a prior conversation about a pending race selection
**When** I open a new conversation
**Then** the agent's first message is: "Last time you were picking a winner for R5 The Meadows on Friday. Want to continue?"

#### US-2.3 — Memory decay
**As a** system
**I want** unused memories to fade
**So that** the context window stays relevant

**Acceptance criteria:**
- Daily job (2am AEST) reduces `importance` by 0.05 per 30 days idle
- Floor at 0.1 (never fully deleted)
- `importance + 0.1` if accessed in last 14 days
- Memories below 0.2 are excluded from the top-20 retrieval

---

### E6 · Hermes Agent Harness

#### US-2.4 — Run an agent
**As a** user
**I want to** ask the race analyst a question
**So that** I get an AI-generated answer

**Acceptance criteria:**
- POST `/api/agents/race-analyst/run` creates an `AgentRun` row (`status = pending`)
- The harness loads memory, builds system prompt, spawns `hermes agent` subprocess (no shell, low-privilege user)
- Subprocess writes JSON output to a temp file
- Harness polls every 500ms or reads via stdio pipe
- `AgentRun.harnessPid` tracked for cancellation
- `AgentRun.status` updates to `completed` or `error`
- Output JSON validated against agent's declared output schema
- Output post-processed to strip secrets, foreign user IDs

**Given** I ask the race analyst "What are the top 3 picks for R5 The Meadows Friday?"
**When** the agent run completes
**Then** I see the picks in the chat within 30s, with a token count and duration shown

#### US-2.5 — Cancel a running agent
**As a** user
**I want to** cancel a long-running agent
**So that** I don't have to wait

**Acceptance criteria:**
- `POST /api/agents/runs/:id/cancel` sends SIGTERM to `harnessPid`
- If still running after 5s, SIGKILL
- `AgentRun.status = "cancelled"`, `completedAt = now()`
- The user sees a "Cancelled" indicator in the chat

#### US-2.6 — Token & runtime limits
**As a** system
**I want** to enforce hard limits on agent runs
**So that** a runaway agent doesn't blow the token budget

**Acceptance criteria:**
- 50k tokens max per run (hard stop)
- 5 min duration max
- Rate limit: 10 runs/hour for Pro, 100 runs/hour for Pro+
- Free tier: 3 runs/day, 5k tokens
- If limit hit: `status = "limit_exceeded"`, `error = "token_limit" | "duration_limit" | "rate_limit"`

---

### E7 · Core Agents

#### US-2.7 — Race Analyst agent
**As a** user
**I want to** ask the race analyst for picks
**So that** I get data-driven selections

**Acceptance criteria:**
- Loads `RacePrediction` for the requested race if available
- Falls back to live query of form + box bias + trainer stats
- Returns top 3 selections with confidence score
- Cites specific data points (last 5 starts, trainer strike rate, etc.)
- Disclaimers: "AI predictions are statistical estimates, not guarantees. Bet responsibly."

#### US-2.8 — Breeding Advisor agent
**As a** breeder
**I want to** ask the breeding advisor to testmate a sire × dam
**So that** I can make a breeding decision

**Acceptance criteria:**
- Loads `DnaMatch` for the requested pair if available
- Otherwise runs the COI computation + Monte-Carlo simulation
- Returns: COI %, risk flags, projected win/place/fast %, earnings index
- Caches result in `DnaMatch` (1000 sims cap, `modelVersion` tracked)

#### US-2.9 — Form Reader agent
**As a** user
**I want to** ask the form reader to explain a dog's recent form
**So that** I understand why the dog is/isn't running well

**Acceptance criteria:**
- Loads dog's `FormEntry` rows (last 20)
- Returns natural-language summary with pattern detection (improving/declining/track-specific)
- Cites the underlying form entries (date, track, finish, time)
- Honours the user's preferred depth (brief / detailed)

#### US-2.10 — Moderator agent
**As a** system
**I want** a moderator agent to scan new content for spam/abuse
**So that** harmful content is auto-flagged

**Acceptance criteria:**
- Runs every 30 min via cron
- Scans new `Post`, `Message`, `Listing` rows since last run
- Flags with `Report.status = "open"`, `resolutionNotes = "[auto] <reason>"`
- Hides content if confidence > 0.8 (set `hiddenAt` on the row)
- Sends a report to admins (email digest weekly)

---

## Phase 3 — Community (Weeks 3–4)

**Phase exit criterion:** A breeder can claim a dog, post in the forum, list a pup for sale, get notified of agent-moderated actions.

### E8 · Forum

#### US-3.1 — Create a thread
**As a** user
**I want to** start a thread in a category
**So that** I can discuss with the community

**Acceptance criteria:**
- Forum categories seeded: General, Breeding, Track Talk, Punting, Help
- Title: 5-200 chars; body: 20-20000 chars
- Markdown supported, sanitized server-side
- Author can pin their own thread only if admin
- View count incremented on every read (de-duped per user/day)
- Thread shows author, timestamp, reply count, last reply

**Given** I am on `/forum/breeding` and click "New thread"
**When** I submit a 50-char title and 500-char body
**Then** the thread appears at the top of the category

#### US-3.2 — Reply to a thread
**As a** user
**I want to** reply to a thread
**So that** I can participate

**Acceptance criteria:**
- Body 20-20000 chars
- Thread `updatedAt` updates to the last reply
- Moderator agent scans new replies for spam/abuse
- Edit allowed within 15 min of posting; `editedAt` set after

#### US-3.3 — Hide a post (moderator)
**As a** moderator
**I want to** hide a post that violates rules
**So that** the community stays healthy

**Acceptance criteria:**
- `Post.hiddenAt = now()`, `hiddenReason = "<reason>"`
- Post is invisible to non-moderators
- Author sees "This post was hidden by a moderator: <reason>"
- Author can appeal via report

---

### E9 · Marketplace

#### US-3.4 — Create a listing
**As a** user
**I want to** list a pup, dog, stud service, or share for sale
**So that** I can reach the community

**Acceptance criteria:**
- Listing types: `pup_for_sale | dog_for_sale | stud_service | wanted | share`
- Title 5-100 chars, description 20-5000 chars
- Price optional; currency defaults to AUD
- Up to 10 images, 1 video
- 90-day default expiry; creator can renew
- `status` defaults to `active`

**Given** I am a verified breeder with ownership of a dog
**When** I create a "pup for sale" listing with photos and a $5000 price
**Then** the listing is live, expires in 90 days, and visible at `/listings`

#### US-3.5 — Renew a listing
**As a** listing owner
**I want to** renew an expired listing
**So that** it stays active

**Acceptance criteria:**
- If `expiresAt < now()`, "Renew" button appears
- Renewing extends `expiresAt` by 90 days from now
- Unlimited renewals; no cost

#### US-3.6 — Mark as sold
**As a** listing owner
**I want to** mark a listing as sold
**So that** it stops appearing in browse

**Acceptance criteria:**
- `status = "sold"`, listing moves to "Sold" tab
- Conversation between buyer and seller is unblocked (if previously blocked)
- Sold listings searchable for 30 days, then archived

---

### E10 · Dog Ownership

#### US-3.7 — Claim a dog
**As a** user (breeder/trainer/owner)
**I want to** claim ownership of a dog in the database
**So that** I can manage it and have my ownership verified

**Acceptance criteria:**
- `DogOwnership` row created with `role = "owner" | "breeder" | "trainer" | "co-owner"`
- Claim requires manual admin approval (default) OR email match to known owner (fast-track)
- Until approved, claim shows as "pending" on the dog profile
- Approved claims show on dog profile: "Owned by [user]" badge
- User can list a pup for sale only on dogs they own

**Given** I am logged in and on `/dogs/<id>` and click "Claim ownership"
**When** I select role "breeder" and submit
**Then** the claim is pending; admin is notified; user sees "Your claim is pending review"

#### US-3.8 — Display ownership on dog profile
**As a** visitor
**I want to** see who owns a dog
**So that** I can verify provenance

**Acceptance criteria:**
- Approved ownership rows shown on `/dogs/<id>` with role badge
- Multiple owners supported (co-ownership)
- "Verified" badge on `Profile.verified` users
- Email hidden by default; `Profile.showEmail` controls visibility

---

### E11 · Moderation

#### US-3.9 — Report a post / message / listing / profile
**As a** user
**I want to** report content that violates rules
**So that** moderators can take action

**Acceptance criteria:**
- Report form with reason: `spam | harassment | misinformation | illegal | other`
- Optional description (max 500 chars)
- `Report` row created with `status = "open"`
- Reporter sees confirmation toast
- Reporter cannot report the same content twice in 24h

#### US-3.10 — Ban a user
**As an** admin
**I want to** ban a user
**So that** abusive users are removed

**Acceptance criteria:**
- `User.isBanned = true`, `bannedReason = "<reason>"`
- All sessions revoked (delete from `UserSession` and `RefreshToken`)
- User cannot sign in
- All messages, posts, listings are hidden but preserved (for audit)
- `AuditLog` entry: `actorId = admin.id`, `action = "user.ban"`

---

## Phase 4 — Polish (Weeks 4–5)

**Phase exit criterion:** Production launch.

### E12 · Voice & Video Messages

#### US-4.1 — Record a voice message
**As a** user
**I want to** record a voice message
**So that** I can speak instead of type

**Acceptance criteria:**
- MediaRecorder API captures opus/webm
- Max 5 min recording
- Waveform rendered client-side
- Server transcribes with Whisper (optional, opt-in)
- Same upload flow as images (signed URL, virus scan, quota)

**Given** I hold the record button for 8 seconds
**When** I release and send
**Then** the voice clip is uploaded, scanned, and delivered to the recipient with a player

#### US-4.2 — Record a video message
**As a** user
**I want to** record a short video
**So that** I can share motion content (a dog running, etc.)

**Acceptance criteria:**
- `video/mp4` or `video/webm`
- Max 60s, 200MB
- Thumbnail extracted at 1s mark via ffmpeg.wasm (Edge Function)
- Inline preview with poster

---

### E13 · Auditing & Compliance

#### US-4.3 — Audit log of sensitive actions
**As a** system
**I want to** log all sensitive actions
**So that** I have an audit trail

**Acceptance criteria:**
- Logged: user ban, post hide, message delete, memory read, admin role grant, API key issuance
- `AuditLog` row with actor, action, target, IP, user-agent, metadata
- Logs are append-only (no UPDATE, no DELETE in service layer)
- Retained 2 years minimum

#### US-4.4 — Privacy policy + ToS
**As a** user
**I want to** read the privacy policy
**So that** I know what data is collected

**Acceptance criteria:**
- `/privacy` and `/terms` pages live (already shipped at /terms and /privacy)
- Acceptance of ToS recorded on signup (`User.acceptedTermsAt`)
- Privacy policy linked from signup and footer
- APP 12 (access) compliance: users can export their data
- APP 13 (correction) compliance: profile edit form

---

### E14 · Data Portability & Account Deletion

#### US-4.5 — Export my data
**As a** user
**I want to** download a copy of my data
**So that** I have a portable record (APP 12)

**Acceptance criteria:**
- `/api/me/export` returns a JSON archive: profile, messages, posts, listings, memory entries
- Within 30 days of request, email link to download
- Archive deleted after 7 days

#### US-4.6 — Delete my account
**As a** user
**I want to** delete my account
**So that** my data is removed (right to be forgotten)

**Acceptance criteria:**
- `/api/me/delete` triggers soft-delete: `User.isBanned = true`, email anonymized
- 30-day recovery window (sign in restores)
- After 30 days, scheduled job: anonymize PII in messages/posts/listings; keep structural rows for analytics
- AuditLog entry: `action = "user.delete"`

---

## Cross-cutting stories

### CC-1 — All pages render in under 2 seconds on 4G
**Given** I am on a 4G connection
**When** I load any page on GreyhoundIQ
**Then** the page is interactive in <2s (LCP <2.5s per Lighthouse)

### CC-2 — All user-generated content is HTML/Markdown sanitized
**Given** I post content with `<script>alert('xss')</script>`
**When** the post is saved
**Then** the script tags are stripped, the rest is preserved

### CC-3 — All forms have client-side and server-side validation
**Given** I submit a form with invalid data
**When** the request reaches the server
**Then** server returns 400 with the same error message the client already showed

### CC-4 — Every authenticated page is SSR-protected
**Given** I am not signed in
**When** I visit `/messages`, `/api/agents/...`, `/me`, or any profile
**Then** I am redirected to `/login?return=<path>`

### CC-5 — Every API route returns JSON error responses with stable error codes
**Given** a server error
**When** the API responds
**Then** the response is `{"error": {"code": "stable.code", "message": "human readable"}}` with an appropriate HTTP status

### CC-6 — Rate limits on every public endpoint
**Given** I send 100 requests in 1 second
**When** the rate limit triggers
**Then** I receive 429 with `Retry-After: <seconds>` header

---

## E15 · Per-user agent memory (Mem0 on Supabase pgvector)

*Added in architecture v2 — section 15.5. The corpus identified this as the single highest value-to-effort move.*

#### US-2.11 — Per-user memory is stored as Mem0 + pgvector
**As a** user chatting with the race analyst
**I want** the agent to remember my preferences, owned dogs, and prior conversations
**So that** future conversations pick up where they left off

**Acceptance criteria:**
- Mem0 runs as a service on the Hetzner VPS (or as a Supabase Edge Function)
- Memory rows are stored in Supabase Postgres using the `vector(1536)` extension
- Embeddings generated via local sentence-transformers (data-sovereignty — no PII leaves the VPS)
- Schema uses `pgvector` for similarity search; the existing `MemoryEntry` table extends with an `embedding` column
- Mem0's auto-extraction runs after every conversation turn
- Memory decay: as before (importance 0.05/30 days idle, floor 0.1)
- Agent context assembly: top 20 high-importance + top 5 most-similar to current query

**Given** I told the race analyst "I always back box 1 in 5-furlong races at The Meadows"
**When** the conversation ends
**Then** a `MemoryEntry` is stored with `kind = preference`, `content = "User prefers box 1 in 5-furlong races at The Meadows"`, and a vector embedding

#### US-2.12 — Memory is queried by semantic similarity
**As a** user asking "what's a good pick for tonight?"
**I want** the agent to recall relevant memories
**So that** recommendations align with my preferences

**Acceptance criteria:**
- At conversation start, the current user message is embedded via sentence-transformers
- pgvector similarity search returns top 5 most-relevant memories above similarity threshold 0.7
- Combined with the top 20 by importance into a deduplicated set
- Included in the agent's system prompt as "What you remember about this user"
- Latency budget: 200ms total for embedding + similarity search

---

## E16 · Prompt-eval pipeline (CI gate on agent regressions)

*Added in architecture v2 — section 15.5. Race results are free, automatic ground truth.*

#### US-2.13 — Win-probability prompt changes are evaluated against past races
**As a** developer
**I want** every change to the win-probability prompt to be evaluated against a held-out set of past races
**So that** I can't accidentally regress prediction quality

**Acceptance criteria:**
- Held-out eval set: 500 most-recent completed races, frozen in version control
- For each race in eval set, run the new prompt and score:
  - **Calibration:** Brier score (mean squared error of predicted prob vs actual outcome)
  - **Log-loss:** lower is better
  - **Top-1 hit rate:** did the highest-probability runner win?
  - **Top-3 hit rate:** was the winner in the top 3?
- Run on every PR that touches `src/lib/agents/prompts/*` or `src/lib/agents/race-analyst/*`
- Block merge if any metric regresses >5% vs the main branch baseline
- Results reported as a PR comment + stored in `PromptEvalResult` table
- Run takes <5 minutes on a CI runner

**Given** I open a PR changing the race-analyst prompt
**When** CI runs the eval pipeline
**Then** within 5 minutes the PR is annotated with calibration / log-loss / top-K scores, and the merge is blocked if any metric regresses >5%

#### US-2.14 — Eval set is refreshed monthly
**As a** system
**I want** the held-out eval set to be replaced monthly with the most recent 500 races
**So that** the eval reflects current racing conditions

**Acceptance criteria:**
- Monthly cron (1st of month) refreshes the eval set: drop oldest 500, add newest 500
- Old eval set archived to `eval/race-archive/YYYY-MM.json`
- Refresh triggered manually via `/api/admin/eval/refresh` (admin only)
- New eval set versioned (`v2026-07-01`, etc.) for reproducibility

---

## E17 · Agent sandboxing + approval gates

*Added in architecture v2 — section 15.5. Corpus cited OpenClaw one-click RCE (CVE-2026-25253) as the cost of agent autonomy.*

#### US-2.15 — Agent tool calls are sandboxed in Docker
**As a** system
**I want** every Hermes agent subprocess to run in a default-deny Docker container
**So that** a compromised agent can't escape to the host

**Acceptance criteria:**
- Every `hermes agent` subprocess runs in `--read-only --security-opt=no-new-privileges --network=none` (with explicit egress for Supabase + Resend only)
- Container has no access to: env vars, host filesystem, host network, other containers
- Container is destroyed immediately after the run completes
- Read-only data mount at `/data` (e.g. CSV exports, no DB credentials)
- Network policy: only `db.supabase.co:5432`, `api.supabase.co`, `api.resend.com`
- Default-deny: any new network destination requires code review
- Logs streamed to host stdout for audit

#### US-2.16 — Tiered human approval on sensitive actions
**As a** system
**I want** sensitive agent actions to require human approval before executing
**So that** an agent can't autonomously ban users, charge payments, or send emails at scale

**Acceptance criteria:**
- Sensitive actions categorized: `tier1` (no approval needed, e.g. read dog data) / `tier2` (approval for batch ops) / `tier3` (always require approval)
- Tier 3 actions: `send_email_at_scale`, `user.ban`, `user.delete`, `payment.charge`, `agent.run_self_modify`
- Tier 2 actions: `agent.run_more_than_50k_tokens`, `media.upload_to_public_bucket`, `forum.post_on_behalf_of`
- Approval queue at `/admin/approvals` with approve / reject buttons
- Rejected action: agent run is marked `cancelled` with reason; memory entry logs the rejection
- Approved action: runs with full audit log
- Approval timeout: 24h, then auto-reject
- Telegram notification to admins on tier 3 requests

---

## E18 · n8n + Firecrawl ingestion

*Added in architecture v2 — section 15.5. Self-hosted n8n orchestrates Topaz/Betfair pulls; Firecrawl-via-MCP fills the gaps Topaz/Betfair don't reach.*

#### US-1.10 — n8n orchestrates data ingestion workflows
**As a** system
**I want** Topaz and Betfair pulls orchestrated by self-hosted n8n
**So that** the ingestion pipeline is visual, schedulable, and easy to extend

**Acceptance criteria:**
- n8n runs on Hetzner VPS (Docker container, port 5678, behind Caddy auth)
- Topaz live-fields workflow: trigger every 2 min on race days → fetch → validate → upsert → log
- Topaz results workflow: trigger every 5 min post-race → fetch → upsert → log
- Betfair Hub history workflow: trigger nightly → fetch → upsert → log
- Each workflow has a visual editor, retry policy, error handler
- Failed workflows page an admin (Telegram + UI alert)
- Workflow definitions version-controlled in `infra/n8n/workflows/`

#### US-1.11 — Firecrawl fills data gaps via MCP
**As a** system
**I want** to scrape stewards' reports, scratchings, and track notes from state body sites
**So that** our data covers what Topaz and Betfair don't

**Acceptance criteria:**
- Firecrawl MCP server runs locally (self-hosted on Hetzner)
- Source list: GRNSW stewards, GRV stewards, Tasracing scratchings
- Per-source scheduled crawl (nightly or on-demand)
- Extracted data normalised to canonical schema and upserted
- "Last scraped at" timestamp on each source for freshness tracking
- Quota: max 1000 pages/day per source (Firecrawl self-hosted limit)

---

## E19 · Cognee knowledge graph (breeding)

*Added in architecture v2 — section 15.5. Multi-hop DNA queries vector search can't answer.*

#### US-2.17 — Multi-hop pedigree queries
**As a** breeder
**I want** to ask "which available studs share no recessive-risk carriers with this bitch's line?"
**So that** I can make better breeding decisions

**Acceptance criteria:**
- Cognee knowledge graph stores: dogs, sires, dams, offspring, kennels, recessive-carrier flags
- Runs on the same Supabase Postgres (uses `vector` + `graph` extensions)
- Query: graph traversal over N degrees of separation, returning dogs matching the constraint
- Response includes: confidence, path explanation, alternative matches
- Cached for 24h per query (compute amortised)
- Tier-gated: Pro+ only (compute cost)

#### US-2.18 — Cognee graph stays in sync with Postgres
**As a** system
**I want** the Cognee graph to reflect new dog/sire/dam data within 5 minutes
**So that** the AI agent's answers are always current

**Acceptance criteria:**
- Event-driven sync: Prisma middleware on `Dog` / `GeneticProfile` / `DnaMatch` writes triggers a Cognee upsert
- Debounced 5 minutes to batch updates
- Manual full-resync via `/api/admin/breeding/resync-graph` (admin only)
- Drift detection: nightly diff between Postgres and Cognee; alert on >1% drift

---

## E20 · LocalAI + Whisper/Piper on Hetzner

*Added in architecture v2 — section 15.5. Data-sovereignty + voice features.*

#### US-2.19 — Embeddings are generated locally (no PII leaves VPS)
**As a** system
**I want** all user-data embeddings generated on the Hetzner VPS via LocalAI
**So that** no PII ever leaves Australian infrastructure

**Acceptance criteria:**
- LocalAI runs in Docker on the Hetzner VPS, port 8080
- Model: `text-embedding-3-small` (OpenAI-compatible) or `all-MiniLM-L6-v2` (sentence-transformers)
- Used for: memory embeddings, semantic search, breeding recommendations
- Latency: <100ms per embedding
- Rate limit: 100 req/sec (sufficient for our load)
- Fallback: if LocalAI is down, agent falls back to direct Supabase pgvector query without semantic ranking (graceful degradation)

#### US-2.20 — Voice messages are transcribed locally
**As a** user
**I want** my voice messages to be transcribed to text
**So that** they're searchable and accessible

**Acceptance criteria:**
- Whisper (large-v3 or distil-large-v3) runs on Hetzner VPS
- Triggered automatically on voice message upload (background job)
- Transcript stored as `Message.body` (text fallback) + `Message.transcript` (audio-specific)
- Searchable via full-text search
- Auto-generated captions for any audio uploaded
- Narrated form guides: user can request "narrate Aston Queen's last 5 starts" and get an audio response (TTS via Piper)

#### US-2.21 — TTS for narrated form guides via Piper/Voicebox
**As a** user
**I want** to hear a narrated summary of a dog's recent form
**So that** I can listen while driving or working out

**Acceptance criteria:**
- Piper (or Voicebox) TTS runs on Hetzner VPS alongside Whisper
- Voice prompts (e.g. "narrate Aston Queen's last 5 starts") spawn a background agent that:
  - Loads the dog's recent `FormEntry` rows
  - Generates a natural-language narration script via the LLM
  - Pipes the script through Piper → produces `audio/mp3` MediaAsset
  - Returns the audio URL in the agent response
- Generated audio is rate-limited (10/day/user for free, 50/day for Pro, unlimited for Pro+)
- Audio cached for 7 days; same narration query returns cached audio

---

## E21 · Win-probability ML model (Hugging Face + AutoTrain)

*Added from Technology Opportunities report (2026-06-29) — corpus identifies HF+AutoTrain as the realistic path to an actual prediction model on Topaz history without an ML hire. TimesFM provides the cheap baseline benchmark.*

#### US-2.22 — TimesFM form-trend baseline
**As a** system
**I want** TimesFM (Google's pretrained time-series foundation model) to forecast each dog's form trajectory
**So that** we have a zero-training baseline to benchmark our ML model against

**Acceptance criteria:**
- TimesFM runs in a Docker container on Hetzner VPS
- Inference API: `POST /forecast` with `dog_id`, returns projected sectional trajectory over next 5 races
- Latency: <500ms per forecast
- Used as the "naive baseline" in the prompt-eval pipeline (E16)
- No training required (zero-shot)
- Self-hosted weights to avoid Inference-API data egress
- Benchmarked against XGBoost baseline monthly; metrics stored in `PromptEvalResult` table

**Given** I want to know Aston Queen's projected form over the next 3 races
**When** the system calls `POST /forecast` with her recent form
**Then** TimesFM returns a forecast trajectory within 500ms

#### US-2.23 — Win-probability XGBoost model (Hugging Face AutoTrain)
**As a** system
**I want** an ML model that predicts the win probability for each runner in an upcoming race
**So that** the race-analyst agent has calibrated predictions to give users

**Acceptance criteria:**
- Model trained via Hugging Face AutoTrain on 5+ years of historical Topaz form + Betfair BSP data
- Features: box, distance, track, going, recent sectionals, trainer strike rate, days since last run, weight trend, class, weather
- Output: calibrated win probability per runner (sums to 1.0 across the field)
- Per-runner factor attributions (SHAP values) for explainability
- Model versioned (`v1.0`, `v1.1`, ...); predictions stored in `RacePrediction` with `modelVersion`
- Re-trained monthly via AutoTrain scheduled job
- Inference latency: <200ms per race (10 runners)
- Self-hosted weights; no Inference-API egress
- Calibration tracked in `PromptEvalResult` (Brier score, log-loss)

**Given** a race with 8 runners is declared
**When** the system runs inference
**Then** within 200ms each runner has a calibrated win probability with SHAP attributions

#### US-2.24 — AutoTrain retraining job
**As a** system
**I want** the win-probability model to retrain monthly on fresh race results
**So that** prediction quality doesn't decay as the racing conditions evolve

**Acceptance criteria:**
- Monthly cron (1st of month, 3am AEST) triggers AutoTrain retraining
- Training data: most recent 12 months of completed races (rolling window)
- Validation: held-out 1-month window, evaluated by Brier score
- New model promoted to `champion` only if Brier score beats the current champion
- Champion model loaded by the agent harness; challenger is shadow-tested for 2 weeks before promotion
- Model registry stored in `ModelRegistry` table (new)
- Audit log entry on every promotion

---

## E22 · Aider (git-native AI pair programmer)

*Added from Technology Opportunities report — dev workflow epic. "Aider" is a git-native terminal pair-programmer that fits our agent pattern.*

#### US-2.25 — Aider is available for in-repo coding tasks
**As a** developer (Daniel or a future team member)
**I want** Aider wired up for in-repo refactoring, test-writing, and PR-prep work
**So that** I can move faster on routine code changes

**Acceptance criteria:**
- Aider installed on the Hetzner VPS (Python venv, separate from the app)
- Wrapper script `scripts/aider.sh` that:
  - Activates the venv
  - Loads the repo tree map
  - Sets `--model` to MiniMax M3 via OpenRouter (or local fallback)
  - Auto-commits after each change with a Co-Authored-By trailer
- Default commit message format: `aider: <what changed>`
- `.aider.conf.yml` checked in: includes repo conventions, lint rules, and excluded paths
- Used in: refactors, doc updates, dependency bumps, test scaffolding
- NOT used in: schema changes (review by Daniel), auth/RBAC code (security-critical)

---

## E23 · Dify (self-hostable RAG pipeline)

*Added from Technology Opportunities report — alternative to Mem0+Cognee for one-shot RAG use cases. Pairs with Mem0 for agent memory + Cognee for graph; Dify for ad-hoc document Q&A.*

#### US-2.26 — Dify provides document Q&A for breeders
**As a** breeder
**I want** to ask "what's the GRV stewards' report say about scratching patterns in 2026?"
**So that** I can make decisions without reading 100 PDFs

**Acceptance criteria:**
- Dify runs in Docker on Hetzner VPS (port 5000)
- Document source: Firecrawl-crawled GRNSW / GRV / Tasracing PDFs and stewards' reports
- Indexed in pgvector (same store as Mem0 — different namespace)
- Query: natural-language question → top-k chunks → LLM answer with citations
- Citation clickable: opens the source PDF at the referenced page
- Rate limit: 20 queries/day for free, 200/day for Pro, unlimited for Pro+
- Tier-gated in `/breeding` and `/statistics` pages

---

## E24 · GEO citation audits (Generative Engine Optimization)

*Added from Technology Opportunities report — "GEO" = making pages answer-engine-citable. Beyond SEO, this is being citable by ChatGPT / Claude / Perplexity.*

#### US-2.27 — Pages are optimised for answer-engine citation
**As a** system
**I want** key pages to be structured so generative engines cite them directly
**So that** GreyhoundIQ surfaces in AI answers about greyhound racing

**Acceptance criteria:**
- Every key page (home, races, dogs, statistics, breeding, pricing, about, contact) has:
  - Clear, scannable headings (h1 → h2 → h3 with question-phrased headings for FAQ content)
  - Concise 40-60 word summary block at the top (citation snippet)
  - Author/date metadata in JSON-LD (`@type: Article`)
  - FAQ schema (`@type: FAQPage`) where applicable
- Audit pipeline runs weekly: crawls the site, sends each page to a Claude/GPT evaluation prompt
- Audit report lists pages with low citation probability + concrete fixes
- Audit results stored in `GeoAuditResult` table
- GEO score tracked per page over time

**Given** I ask Claude "best Australian greyhound racing data platforms"
**When** it generates an answer
**Then** GreyhoundIQ's home page or /pricing page is among the cited sources

---

## E25 · Observability (OpenTelemetry + Grafana)

*Added from Technology Opportunities report — beyond Sentry errors, we need OTel traces + Grafana dashboards for agent token/latency/error monitoring.*

#### US-2.28 — Agent runs are traced end-to-end
**As a** system
**I want** every agent run to emit OpenTelemetry spans for: prompt assembly, tool calls, LLM invocations, memory writes
**So that** I can see exactly where time and tokens are spent

**Acceptance criteria:**
- OpenTelemetry SDK in `nextjs`, `agents`, `localai`, `whisper`, `cognee` services
- OTel collector runs on Hetzner VPS (port 4317/4318)
- Spans for:
  - `agent.run` (top-level, durationMs, status, runId)
  - `agent.memory.load` (top-20 + similarity search duration)
  - `agent.tool_call` (tool name, args sanitized, result size, duration)
  - `agent.llm.call` (model, prompt_tokens, completion_tokens, duration)
- Grafana dashboards:
  - "Agent token usage by agent type and user tier" (last 24h)
  - "P95 agent run duration" (last 7d)
  - "Tool call success rate" (last 24h)
  - "Memory write rate per user" (detect runaway agents)
- Grafana alerts on P95 > 30s, error rate > 5%

#### US-2.29 — Grafana + Prometheus + Loki stack on Hetzner
**As a** system
**I want** a self-hosted observability stack on the Hetzner VPS
**So that** I have full control over telemetry and metrics retention

**Acceptance criteria:**
- Prometheus (port 9090) scrapes `/api/internal/metrics` every 15s
- Loki (port 3100) collects stdout from all containers
- Grafana (port 3000 internal) connects to Prometheus + Loki
- Retention: 30 days for metrics, 14 days for logs
- Dashboards auto-loaded from `infra/grafana/dashboards/` on container start
- Alertmanager routes alerts to Telegram via existing alerting channel
- Total stack memory footprint: < 2GB

---

## E26 · Open-weight model fallback (GLM-5.2 / Kimi K2.7 / Qwen 3)

*Added from Technology Opportunities report — MiniMax M3 leads open-weight, but a fallback model is needed for resilience and cost.*

#### US-2.30 — Agent falls back to a secondary model if MiniMax M3 is unavailable
**As a** system
**I want** the agent harness to fall back to a secondary open-weight model when MiniMax M3 is rate-limited or down
**So that** user-facing agent runs always succeed

**Acceptance criteria:**
- Configured fallback chain: `MiniMax M3` (primary) → `GLM-5.2` (fallback 1) → `Kimi K2.7` (fallback 2) → `Qwen 3` (fallback 3)
- Harness checks primary health (last success rate over 5 min); if < 95%, switches to fallback
- Fallback invocations recorded in `AgentRun.outputJson` with `model: "minimax-m3 | glm-5.2 | kimi-k2.7 | qwen-3"`
- All fallbacks billed to user's tier as if they were primary (no surprise overage)
- Fallback model latency benchmarked monthly; if a fallback is consistently faster/cheaper, promote it
- Models accessed via OpenRouter (single API key, multiple providers)

#### US-2.31 — DeepSeek-V4-Flash as cost-optimisation route (gated)
**As a** system
**I want** DeepSeek-V4-Flash available as a cost-optimisation route for SEO content generation and bulk memory extraction
**So that** I can reduce MiniMax M3 token spend on high-volume, low-stakes workloads

**Acceptance criteria:**
- **Gated behind AU data-sovereignty review** (Chinese provider — PII cannot touch DeepSeek until reviewed)
- If approved: cache-aware prompt structure (fixed prefix + variable suffix) to exploit DeepSeek's $0.0028/M cache-hit pricing
- Used for: SEO content generation, bulk memory extraction, agent system-prompt-only operations
- NOT used for: agent responses that touch user PII (memory, conversations, predictions)
- Rate-limited per-user; monthly cost cap ($200/mo for DeepSeek usage)
- Kill-switch: instant disable via env var `DEEPSEEK_ENABLED=false`

---

## Out of scope

The following are explicitly **excluded from v1** (per architecture doc section 18):

- Voice / video calling (WebRTC)
- Group chats (1:1 only)
- Stories / ephemeral content
- BYOK encryption
- Multi-tenancy
- Mobile native apps (web PWA only)
- GraphQL
- Microservices / Kubernetes
- 2FA / TOTP (Phase 2)
- SSO / SAML
- Bug bounty (after launch)
- SIEM / SOC
- DLP
- E2E message encryption (TLS + at-rest is sufficient for greyhound community)
- Multi-region replication
