# GreyhoundIQ — Data Model v1

> Source: `docs/GreyhoundIQ-Architecture-Premium.html` (section 3) + existing `prisma/schema.prisma`
> Status: Architecture spec. Prisma migration scripts in `prisma/migrations/` (to be generated in Phase 1).
> Database: Supabase Postgres 15, ap-southeast-2 (Sydney), Pro plan.

---

## Conventions

- **Primary keys:** `cuid()` for all internal models; store the external WorkOS identity on `User.workosUserId`
- **Timestamps:** `createdAt @default(now())` and `updatedAt @updatedAt` on every model
- **Soft delete:** `deletedAt DateTime?` where the data is recoverable (messages, posts)
- **Hard delete:** only via scheduled jobs after grace period
- **Cascade rules:** Explicit on every relation. `Cascade` only when child has no independent value.
- **Indexes:** Every foreign key indexed. Every frequently-filtered field indexed. Compound indexes for common query patterns.
- **Extensions required:** `pgvector` (Phase 2 for memory embeddings), `citext` (case-insensitive email), `pg_trgm` (username search), `pgcrypto` (default for `gen_random_uuid()`)

---

## Existing models (unchanged)

These already exist in `prisma/schema.prisma`. Listed here for context; not changing them in this migration.

| Model | Purpose |
|-------|---------|
| `Dog` | Greyhound record (name, ear brand, sex, colour, trainer, sire/dam) |
| `Trainer` | Trainer with name, state, license |
| `Track` | Track with name, state, surface, circumference, Isolynx flag |
| `Meeting` | Race meeting at a track on a date |
| `Race` | Single race (number, time, distance, grade) |
| `Runner` | Entry in a race (box, weight, starting price) |
| `Result` | Race result (finishing position, time, margin, sectionals) |
| `FormEntry` | Historical form entry for a dog (date, track, finish, time) |
| `AgentRun` | Generic agent run record (already exists; will be extended, not replaced) |

---

## New models (Phase 1+)

### 3.1 Identity & profiles

#### `User` (NEW, WorkOS identity record)
```prisma
model User {
  id                String   @id @default(cuid())
  workosUserId      String   @unique       // WorkOS user id
  email             String   @unique
  emailVerifiedAt   DateTime?
  displayName       String?
  avatarUrl         String?
  subscriptionTier  String   @default("free")  // free | pro | pro_plus
  stripeCustomerId  String?  @unique
  stripeSubscriptionId String? @unique
  isAdmin           Boolean  @default(false)
  isBanned          Boolean  @default(false)
  bannedReason      String?
  acceptedTermsAt   DateTime?
  lastSeenAt        DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  profile           Profile?
  ownedDogs         DogOwnership[]
  threadsAuthored   Thread[]        @relation("ThreadAuthor")
  postsAuthored     Post[]          @relation("PostAuthor")
  listingsCreated   Listing[]       @relation("ListingCreator")
  conversationsAsA  Conversation[]  @relation("ConvA")
  conversationsAsB  Conversation[]  @relation("ConvB")
  messagesSent      Message[]       @relation("MsgSender")
  messagesReceived  Message[]       @relation("MsgRecipient")
  agentRuns         AgentRun[]
  memoryEntries     MemoryEntry[]
  uploadedMedia     MediaAsset[]
  reportsFiled      Report[]        @relation("Reporter")
  reportsAgainst    Report[]        @relation("Reported")
  refreshTokens     RefreshToken[]
  sessions          UserSession[]
  apiKeys           ApiKey[]
  watchlists        Watchlist[]
  alertRules        AlertRule[]

  @@index([workosUserId])
  @@index([subscriptionTier])
  @@index([isBanned])
}
```

**Notes:**
- `workosUserId` is the canonical link to WorkOS/AuthKit; `id` (cuid) is used internally
- `lastSeenAt` updated by application presence on every websocket connect
- `acceptedTermsAt` set on first signup (required for ToS compliance)

#### `Profile`
```prisma
model Profile {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  bio             String?
  state           String?           // NSW | VIC | QLD | SA | WA | TAS | ACT | NT
  kennelName      String?
  kennelPrefix    String?           // e.g. "KARELLA"
  role            String   @default("member")  // member | breeder | trainer | admin
  verified        Boolean  @default(false)
  website         String?
  showEmail       Boolean  @default(false)
  showOwnedDogs   Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

#### `UserSession`
```prisma
model UserSession {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshTokenHash String  @unique
  userAgent       String?
  ip              String?
  expiresAt       DateTime
  revokedAt       DateTime?
  createdAt       DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}
```

#### `RefreshToken`
```prisma
model RefreshToken {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash   String   @unique
  scope       String   // "web" | "cli" | "api"
  expiresAt   DateTime
  revokedAt   DateTime?
  createdAt   DateTime @default(now())

  @@index([userId])
}
```

**Why two session tables:** `UserSession` = active browser session, 30-day rolling. `RefreshToken` = short-lived (7-day) tokens for CLI/API consumers.

---

### 3.2 Community

#### `ForumCategory`
```prisma
model ForumCategory {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String?
  sortOrder   Int      @default(0)
  threads     Thread[]
  createdAt   DateTime @default(now())
}
```

#### `Thread`
```prisma
model Thread {
  id         String   @id @default(cuid())
  categoryId String
  category   ForumCategory @relation(fields: [categoryId], references: [id])
  authorId   String
  author     User     @relation("ThreadAuthor", fields: [authorId], references: [id])
  title      String
  pinned     Boolean  @default(false)
  locked     Boolean  @default(false)
  views      Int      @default(0)
  posts      Post[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([categoryId, pinned, updatedAt])
  @@index([authorId])
}
```

#### `Post`
```prisma
model Post {
  id            String   @id @default(cuid())
  threadId      String
  thread        Thread   @relation(fields: [threadId], references: [id], onDelete: Cascade)
  authorId      String
  author        User     @relation("PostAuthor", fields: [authorId], references: [id])
  body          String
  editedAt      DateTime?
  hiddenAt      DateTime?
  hiddenReason  String?
  createdAt     DateTime @default(now())

  @@index([threadId, createdAt])
  @@index([authorId])
  @@index([hiddenAt])
}
```

#### `Listing`
```prisma
model Listing {
  id          String   @id @default(cuid())
  creatorId   String
  creator     User     @relation("ListingCreator", fields: [creatorId], references: [id])
  type        String   // pup_for_sale | dog_for_sale | stud_service | wanted | share
  title       String
  description String
  price       Float?
  currency    String?  @default("AUD")
  state       String?  // NSW | VIC | ... | NT
  dogId       String?
  dog         Dog?     @relation(fields: [dogId], references: [id])
  status      String   @default("active")  // active | sold | withdrawn | expired
  expiresAt   DateTime?
  media       ListingMedia[]
  views       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([creatorId, status, createdAt])
  @@index([type, status])
  @@index([state, status])
  @@index([dogId])
  @@index([expiresAt])
}
```

**Why 90-day expiry:** Marketplace listings that never get removed become junk. 90-day default, creator can renew.

---

### 3.3 Messaging & rich media

#### `Conversation`
```prisma
model Conversation {
  id              String   @id @default(cuid())
  participantAId String
  participantBId String
  participantA   User     @relation("ConvA", fields: [participantAId], references: [id])
  participantB   User     @relation("ConvB", fields: [participantBId], references: [id])
  lastMessageAt   DateTime?
  blockedById    String?
  blockedAt      DateTime?
  createdAt      DateTime @default(now())
  messages       Message[]

  @@unique([participantAId, participantBId])
  @@index([lastMessageAt])
}
```

**Canonical A-B ordering:** smaller `id` is A, larger is B. Prevents duplicate conversations between same two users.

#### `Message`
```prisma
model Message {
  id                String   @id @default(cuid())
  conversationId    String
  conversation      Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderId          String
  sender            User     @relation("MsgSender", fields: [senderId], references: [id])
  body              String?
  media             MessageMedia[]
  readAt            DateTime?
  deletedBySenderAt DateTime?
  deletedByRecipientAt DateTime?
  createdAt         DateTime @default(now())

  @@index([conversationId, createdAt])
}
```

#### `MediaAsset`
```prisma
model MediaAsset {
  id              String   @id @default(cuid())
  uploaderId      String
  uploader        User     @relation(fields: [uploaderId], references: [id])
  storageBucket   String
  storagePath     String
  mimeType        String
  sizeBytes       Int
  widthPx         Int?
  heightPx        Int?
  durationSec     Float?
  scanStatus      String   @default("pending")  // pending | clean | infected | error
  scanCompletedAt DateTime?
  sha256          String                        // content-addressed for dedup
  expiresAt       DateTime?                     // for ephemeral media
  createdAt       DateTime @default(now())

  messageAttachments MessageMedia[]
  listingAttachments ListingMedia[]

  @@unique([sha256, uploaderId])
  @@index([uploaderId, createdAt])
  @@index([scanStatus])
}
```

#### `MessageMedia` (join table)
```prisma
model MessageMedia {
  messageId String
  message   Message    @relation(fields: [messageId], references: [id], onDelete: Cascade)
  mediaId   String
  media     MediaAsset @relation(fields: [mediaId], references: [id])
  position  Int

  @@id([messageId, mediaId])
}
```

#### `ListingMedia` (join table)
```prisma
model ListingMedia {
  listingId String
  listing   Listing    @relation(fields: [listingId], references: [id], onDelete: Cascade)
  mediaId   String
  media     MediaAsset @relation(fields: [mediaId], references: [id])
  position  Int

  @@id([listingId, mediaId])
}
```

**Storage buckets:**
- `messages` (private, per-conversation RLS)
- `listings` (public-read)
- `avatars` (public-read)
- `agent-outputs` (private)

---

### 3.4 Dog ownership

```prisma
model DogOwnership {
  id        String   @id @default(cuid())
  dogId     String
  dog       Dog      @relation(fields: [dogId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      String   // owner | breeder | trainer | co-owner
  status    String   @default("pending")  // pending | approved | rejected
  reviewedBy String?  // admin user id
  reviewedAt DateTime?
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([dogId, userId, role])
  @@index([dogId, status])
  @@index([userId, status])
}
```

---

### 3.5 Agent memory (per-user)

```prisma
model MemoryEntry {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  kind            String   // episodic | semantic | preference | unfinished
  content         String
  source          String   // conversation | explicit_user_input | agent_inference | tool_observation
  sourceRef       String?
  importance      Float    @default(0.5)
  lastAccessedAt  DateTime @default(now())
  accessCount     Int      @default(0)
  // Phase 2: pgvector embedding
  // embedding      Unsupported("vector(1536)")?
  supersededById  String?
  supersededAt    DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId, kind])
  @@index([userId, importance(sort: Desc)])
}
```

#### `ConversationContext`
```prisma
model ConversationContext {
  id              String   @id @default(cuid())
  userId          String
  agentType       String   // race-analyst | breeding-advisor | form-reader | general
  lastMessageAt   DateTime @default(now())
  pendingAction   String?  // JSON: { type, prompt, context }
  windowSize      Int      @default(50)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([userId, agentType])
}
```

#### `AgentRun` (already exists; extended)
```prisma
model AgentRun {
  id                String   @id @default(cuid())
  userId            String?
  user              User?    @relation(fields: [userId], references: [id])
  agentType         String
  inputJson         String
  outputJson        String?
  toolInvocations   String?
  createdMemoryIds  String?  // JSON array
  status            String   @default("pending")  // pending | running | completed | failed | cancelled | limit_exceeded
  error             String?
  promptTokens      Int?
  completionTokens  Int?
  durationMs        Int?
  harnessPid        Int?
  harnessSessionId  String?
  createdAt         DateTime @default(now())
  completedAt       DateTime?

  @@index([userId, createdAt(sort: Desc)])
  @@index([agentType, status])
  @@index([status])
}
```

---

### 3.6 AI & DNA

#### `GeneticProfile`
```prisma
model GeneticProfile {
  id              String   @id @default(cuid())
  dogId           String   @unique
  dog             Dog      @relation(fields: [dogId], references: [id])
  coiSelf         Float?   // dog's own inbreeding coefficient
  carrierFlags    String?  // JSON: known recessive carrier markers
  traitMarkers    String?  // JSON: performance/conformation estimates
  pedigreeDepth   Int      @default(5)
  computedAt      DateTime @default(now())
  computedVersion String   // model version
}
```

#### `DnaMatch`
```prisma
model DnaMatch {
  id            String   @id @default(cuid())
  sireId        String
  damId         String
  coi           Float    // Wright's coefficient (%)
  riskFlags     String?  // JSON: flagged recessive overlaps
  projWinPct    Float?
  projPlacePct  Float?
  projFastPct   Float?
  earningsIndex Float?
  simRuns       Int      @default(1000)
  modelVersion  String
  createdAt     DateTime @default(now())

  @@unique([sireId, damId, modelVersion])
  @@index([sireId])
  @@index([damId])
}
```

#### `RacePrediction`
```prisma
model RacePrediction {
  id           String   @id @default(cuid())
  raceId       String
  dogId        String
  winProb      Float
  predPosition Int?
  confidence   Float
  factorsJson  String?  // per-runner factor attributions
  modelVersion String
  createdAt    DateTime @default(now())

  @@unique([raceId, dogId, modelVersion])
  @@index([raceId])
  @@index([dogId])
}
```

---

### 3.7 Watchlists & alerts (Phase 2)

#### `Watchlist`
```prisma
model Watchlist {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  items     WatchlistItem[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}
```

#### `WatchlistItem`
```prisma
model WatchlistItem {
  id           String   @id @default(cuid())
  watchlistId  String
  watchlist    Watchlist @relation(fields: [watchlistId], references: [id], onDelete: Cascade)
  entityType   String   // dog | sire | trainer | track
  entityId     String
  addedAt      DateTime @default(now())

  @@unique([watchlistId, entityType, entityId])
  @@index([entityType, entityId])
}
```

#### `AlertRule`
```prisma
model AlertRule {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  trigger     String   // race.scheduled | race.scratched | result.posted | listing.created
  watchlistId String?
  conditions  String?  // JSON
  channels    String   // comma-sep: email | web_push | sms
  enabled     Boolean  @default(true)
  lastFiredAt DateTime?
  createdAt   DateTime @default(now())

  @@index([userId, enabled])
}
```

---

### 3.5 Moderation and API keys

#### `Report`
```prisma
model Report {
  id            String   @id @default(cuid())
  reporterId    String
  reporter      User     @relation("Reporter", fields: [reporterId], references: [id])
  reportedId    String?
  reported      User?    @relation("Reported", fields: [reportedId], references: [id])
  targetType    String   // post | thread | listing | message | profile | user
  targetId      String
  reason        String   // spam | harassment | misinformation | illegal | other
  description   String?
  status        String   @default("open")  // open | resolved | dismissed
  resolvedBy    String?
  resolvedAt    DateTime?
  resolutionNotes String?
  createdAt     DateTime @default(now())

  @@index([status, createdAt])
  @@index([targetType, targetId])
}
```

#### `ApiKey`
```prisma
model ApiKey {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  keyHash     String   @unique  // SHA-256 of the actual key
  prefix      String             // first 8 chars for display
  scopes      String             // comma-sep
  lastUsedAt  DateTime?
  expiresAt   DateTime?
  revokedAt   DateTime?
  createdAt   DateTime @default(now())

  @@index([userId])
}
```

### 3.5.1 Prompt-eval pipeline (added in architecture v2 — section 15.5)

```prisma
model PromptEvalSet {
  id          String   @id @default(cuid())
  version     String   @unique  // "v2026-07-01"
  raceCount   Int
  createdAt   DateTime @default(now())
  results     PromptEvalResult[]
  notes       String?             // what changed, why refreshed
}

model PromptEvalResult {
  id              String   @id @default(cuid())
  evalSetId       String
  evalSet         PromptEvalSet @relation(fields: [evalSetId], references: [id], onDelete: Cascade)
  promptHash      String         // git SHA of the prompt file
  branchName      String         // "main", "feat/race-prompt-v2", etc.
  brierScore      Float
  logLoss         Float
  top1HitRate     Float          // 0.0 - 1.0
  top3HitRate     Float
  passFail        String         // "pass" | "fail" | "warning"
  regressedMetrics String?      // JSON: { "brierScore": -0.07, ... } (negative = regressed)
  runDurationMs   Int
  createdAt       DateTime @default(now())

  @@index([evalSetId, createdAt(sort: Desc)])
  @@index([promptHash])
}
```

### 3.5.2 Agent approval queue (added in architecture v2 — section 15.5)

```prisma
model AgentApproval {
  id            String   @id @default(cuid())
  runId         String   // AgentRun this is for
  agentType     String
  actionType    String   // send_email_at_scale | user.ban | user.delete | payment.charge | ...
  actionPayload String?  // JSON: details of what's being requested
  tier          Int      // 1 | 2 | 3
  status        String   @default("pending")  // pending | approved | rejected | expired
  requestedAt   DateTime @default(now())
  reviewedAt    DateTime?
  reviewedBy    String?  // admin user id
  expiresAt     DateTime @default(dbgenerated("(now() + interval '24 hours')"))
  notes         String?

  @@index([status, expiresAt])
  @@index([runId])
}
```

### 3.5.3 Model registry (added from Tech Opportunities — E21)

```prisma
model ModelRegistry {
  id           String   @id @default(cuid())
  name         String   // "race-win-probability" | "timesfm-form-trend"
  version      String   // "v1.0" | "v1.1-rc.2"
  status       String   @default("challenger")  // champion | challenger | archived
  framework    String   // "xgboost" | "timesfm" | "huggingface-autotrain"
  trainedAt    DateTime
  trainingData String   // description of data window + count
  metricsJson  String?  // JSON: { brier: 0.18, logLoss: 0.55, top1Hit: 0.31, ... }
  evalSetId    String?  // which PromptEvalSet this was scored against
  storagePath  String   // where the model weights live (S3-compatible or Hetzner Storage Box)
  sizeBytes    Int
  promotedAt   DateTime?
  promotedBy   String?
  notes        String?

  @@unique([name, version])
  @@index([name, status])
  @@index([evalSetId])
}
```

### 3.5.4 GEO audit results (added from Tech Opportunities — E24)

```prisma
model GeoAuditResult {
  id              String   @id @default(cuid())
  pageUrl         String
  pageTitle       String
  auditDate       DateTime @default(now())
  overallScore    Float    // 0.0 - 1.0 (citation probability)
  headingsScore   Float
  snippetScore    Float
  schemaScore     Float
  faqScore        Float
  issues          String?  // JSON array of { type: "missing_faq_schema", severity: "high", fix: "..." }
  suggestedFixes  String?  // JSON array
  evaluatorModel  String   // "claude-opus-4" | "gpt-5"
  evaluatorPrompt String?  // hash of the audit prompt

  @@index([pageUrl, auditDate(sort: Desc)])
  @@index([auditDate])
}
```

#### `AuditLog`
```prisma
model AuditLog {
  id         BigInt   @id @default(autoincrement())
  actorId    String?
  actorType  String   // user | agent | system | admin
  action     String   // e.g. "user.ban", "post.hide", "memory.read"
  targetType String?
  targetId   String?
  ip         String?
  userAgent  String?
  metadata   String?  // JSON
  createdAt  DateTime @default(now())

  @@index([actorId, createdAt])
  @@index([action, createdAt])
  @@index([targetType, targetId])
}
```

**Retention:** 2 years minimum. Append-only at the service layer (no UPDATE/DELETE in Prisma service code).


### 3.9 Ingestion tracking

#### `IngestionRun`
```prisma
model IngestionRun {
  id            String   @id @default(cuid())
  source        String   // topaz | betfair_hub | betfair_exchange | ga_studbook | isolynx
  jobType       String   // live_fields | results | backfill | pedigree
  status        String   @default("running")  // running | ok | partial | failed
  cursor        String?  // resume point for paginated/incremental
  rowsFetched   Int      @default(0)
  rowsWritten   Int      @default(0)
  rowsRejected  Int      @default(0)
  error         String?
  startedAt     DateTime @default(now())
  finishedAt    DateTime?

  @@index([source, jobType, startedAt(sort: Desc)])
  @@index([status])
}
```

#### `SourceRecord`
```prisma
model SourceRecord {
  id          String   @id @default(cuid())
  source      String
  sourceId    String   // vendor's native id
  entityType  String   // dog | race | result | sire | market
  entityId    String?  // resolved canonical id
  sha256      String   // content hash for change detection
  rawJson     String   // original payload (for replay + audit)
  fetchedAt   DateTime @default(now())

  @@unique([source, sourceId, sha256])
  @@index([entityType, entityId])
  @@index([source, fetchedAt])
}
```

---

## Entity relationship diagram

```
                    ┌──────────────┐
                    │ WorkOS/AuthKit│
                    └──────┬───────┘
                           │ workosUserId
                           ▼
                    ┌──────────────┐  1:1   ┌──────────┐
                    │     User     │◄──────►│ Profile  │
                    └─┬──┬──┬──┬───┘         └──────────┘
                      │  │  │  │
        ┌─────────────┘  │  │  └────────────┐
        │                │  │               │
        ▼                │  ▼               ▼
   ┌─────────┐           │ ┌──────────────┐ ┌──────────────┐
   │ Thread  │           │ │Conversation  │ │MemoryEntry   │
   │  (1:n)  │           │ │   (n:n)      │ │   (1:n)      │
   └────┬────┘           │ └──────┬───────┘ └──────────────┘
        │                │        │
        ▼                │        ▼
   ┌─────────┐           │   ┌─────────┐
   │  Post   │           │   │ Message │──► MessageMedia ──► MediaAsset
   └─────────┘           │   └─────────┘
                         │
   ┌──────────┐          │   ┌──────────┐
   │ Listing  │──────────┼──►│AgentRun  │
   │  (1:n)   │          │   └──────────┘
   └────┬─────┘          │
        │                │
        ▼                │   ┌──────────────┐
   ┌─────────────┐       │   │  Report       │
   │ListingMedia │       │   └──────────────┘
   └──────┬──────┘       │
          │              │   ┌──────────────┐
          └──────┬───────┘   │   AuditLog    │
                 ▼           └──────────────┘
          ┌──────────┐
          │MediaAsset│
          └──────────┘

   ┌─────────────┐   ┌──────────────┐   ┌──────────┐
   │   Dog       │──►│  FormEntry   │   │  Track   │
   └────┬────────┘   └──────────────┘   └────┬─────┘
        │                                     │
        ├──► DogOwnership ─► User            ├──► Meeting
        ├──► GeneticProfile                   │     │
        ├──► RacePrediction ◄── Race ◄───────┘     │
        └──► DnaMatch (sire/dam self-ref)         ▼
                                                IngestionRun ──► SourceRecord
```

---

## Migration plan (Prisma)

### Phase 1 (Foundation) — add to schema.prisma

1. `User` (new, with full FK relations)
2. `Profile`
3. `UserSession`, `RefreshToken`
4. `ForumCategory`, `Thread`, `Post`
5. `Listing`
6. `Conversation`, `Message`
7. `MediaAsset`, `MessageMedia`, `ListingMedia`
8. `DogOwnership`
9. `MemoryEntry`, `ConversationContext`
10. Extend `AgentRun`
11. `Report`, `AuditLog`, `ApiKey`
12. `IngestionRun`, `SourceRecord`

### Phase 2 (Memory)

13. `GeneticProfile`, `DnaMatch`, `RacePrediction`
14. `Watchlist`, `WatchlistItem`, `AlertRule`
15. `pgvector` extension; add `embedding Unsupported("vector(1536)")?` to `MemoryEntry`

### Migration steps

```bash
# 1. Add new models to prisma/schema.prisma
# 2. Create initial migration
npx prisma migrate dev --name add_community_messaging_auth_models

# 3. Apply to Supabase
npx prisma db push   # for prototyping; use migrate for prod
```

---

## RLS strategy (Supabase)

| Table | Read | Insert | Update | Delete |
|-------|------|--------|--------|--------|
| `User` | self OR public fields | — | self | — |
| `Profile` | self OR public fields | self (via trigger) | self | — |
| `Message` | sender OR recipient OR conversation participants | sender only | sender (own only) | sender (own only) |
| `Conversation` | participantA OR participantB | self OR service | participant | participant |
| `MediaAsset` | uploader OR (message attached + sender/recipient) | uploader | uploader | uploader |
| `MemoryEntry` | owner (userId = self) | self | self | self |
| `Post` | NOT hiddenAt OR author OR moderator | author | author (15min window) | author OR moderator |
| `Listing` | active OR (owner OR moderator) | creator | owner | owner |
| `Report` | reporter OR moderator | reporter | moderator | — |
| `AuditLog` | admin | system only | — | — |

**Service role key** bypasses RLS for cron jobs, agents, admin tooling. Never exposed to the browser.

---

## Indexes summary

Critical compound indexes:
- `Conversation`: `@@unique([participantAId, participantBId])`, `@@index([lastMessageAt])`
- `Message`: `@@index([conversationId, createdAt])`
- `MemoryEntry`: `@@index([userId, kind])`, `@@index([userId, importance(sort: Desc)])`
- `Listing`: `@@index([creatorId, status, createdAt])`, `@@index([type, status])`, `@@index([state, status])`
- `Thread`: `@@index([categoryId, pinned, updatedAt])`
- `Post`: `@@index([threadId, createdAt])`
- `SourceRecord`: `@@index([source, fetchedAt])`, `@@index([entityType, entityId])`
- `IngestionRun`: `@@index([source, jobType, startedAt(sort: Desc)])`

---

## Open questions (to confirm with Daniel)

1. **Listing fees** — confirmed v1 has no platform fee. Stripe Connect for Pro+?
2. **Public profile fields** — what's the default for `showOwnedDogs` for new profiles?
3. **PhotoDNA** — required by AU law, hard gate before launch. Confirm Supabase region supports it.
4. **AI prediction tiering** — confirmed Pro+ gets full predictions, Pro gets teaser only?
5. **Listing renewal limit** — confirmed unlimited?

These are listed in the architecture doc's "10 questions for you" section; the user stories reference answers.
