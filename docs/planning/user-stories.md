# GreyhoundIQ — User Stories v1

> Source: `docs/GreyhoundIQ-Architecture-Premium.html` (Architecture Review · Draft v1 · 28 June 2026)
> Owner: Daniel Fleuren (AI Kick Start)
> Format: Given/When/Then for each story. Grouped by phase, epics within phase.
> Phases mirror the architecture doc's 4-phase build plan: Foundation, Memory, Community, Polish.

---

## Index

- [Phase 1 — Foundation (Weeks 1–2)](#phase-1--foundation-weeks-12)
  - [E1 · Supabase & Auth](#e1--supabase--auth)
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

### E1 · Supabase & Auth

#### US-1.1 — Sign up with email + password
**As a** new visitor
**I want to** create an account with email and password
**So that** I can use GreyhoundIQ's messaging, agents, and personalised features

**Acceptance criteria:**
- A user can submit email + password (min 12 chars, complexity check) on `/signup`
- Email is verified via a Resend-sent magic link before the account is active
- A `User` row is created in Prisma with `supabaseUserId = auth.users.id` mirror
- Rate limit: max 5 signups per IP per hour (CAPTCHA after 3)
- Generic error message on auth failure (no account enumeration)
- `isBanned` users see a generic "we can't create an account right now" message

**Given** I am a new visitor on `/signup`
**When** I enter a valid email + 12+ char password and click "Create account"
**Then** I see a "Check your email" screen and receive a verification email within 60s

#### US-1.2 — Sign in with email + password
**As a** registered user
**I want to** sign in with my email and password
**So that** I can access my account

**Acceptance criteria:**
- Auth uses Supabase Auth directly (no NextAuth wrapper)
- Session stored in HTTP-only cookies via `@supabase/ssr`
- Access token TTL: 1 hour; refresh token rotates on every API call
- After 10 failed attempts in 15 min, account is locked for 15 min
- All auth events written to `AuditLog` (`action: "auth.signin.success" | "auth.signin.fail"`)

**Given** I have a verified account and enter correct credentials
**When** I click "Sign in"
**Then** I land on `/` with a sticky session, and `User.lastSeenAt` is updated

#### US-1.3 — Sign in with Google OAuth
**As a** user who prefers Google
**I want to** sign in with my Google account
**So that** I don't need another password

**Acceptance criteria:**
- OAuth flow via Supabase, scoped to `email profile`
- On success, User row created (or linked via email if existing)
- OAuth callback URL whitelisted to `https://greyhoundiq.com.au/auth/callback` only
- Open redirect attempts → 400

**Given** I click "Continue with Google" and authorize the app
**When** Google redirects me to `/auth/callback`
**Then** a session is established and I'm routed to `/`

#### US-1.4 — Magic link sign-in (opt-in)
**As a** user who doesn't want to remember a password
**I want to** request a magic link by email
**So that** I can sign in without a password

**Acceptance criteria:**
- Magic link is single-use, expires in 15 min
- New account is auto-created on first magic-link sign-in (after email verification of the link itself)
- Rate limit: max 5 magic-link requests per email per hour

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
