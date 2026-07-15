export const MIGRATION_INDEX_CREATION_REVIEW_REQUIREMENT_ID =
  "security.migration-review.index-creation";

export type MigrationIndexSource = Readonly<{
  path: string;
  source: string;
}>;

export type MigrationIndexRecord = Readonly<{
  path: string;
  line: number;
  name: string;
  relation: string;
  signature: string;
  strategy:
    | "existing-relation-concurrent"
    | "existing-relation-reviewed-immediate"
    | "existing-relation-unreviewed"
    | "new-relation-immediate";
}>;

export type ReviewedExistingRelationIndexBatch = Readonly<{
  path: string;
  signatures: readonly string[];
  disposition: string;
}>;

const PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION =
  "These exact non-concurrent indexes are accepted only for the pre-production migration history. They do not prove an online production build; before any equivalent production change, use CONCURRENTLY or an approved measured maintenance window with an abort plan.";

export const REVIEWED_EXISTING_RELATION_INDEX_BATCHES = [
  {
    path: "prisma/migrations/20260630170000_supabase_storage/migration.sql",
    signatures: [
      'CREATE INDEX "MediaAsset_linkedEntityType_linkedEntityId_idx" ON "MediaAsset"("linkedEntityType", "linkedEntityId");',
      'CREATE INDEX "MediaAsset_storageBucket_createdAt_idx" ON "MediaAsset"("storageBucket", "createdAt");',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260630190000_add_live_data_provenance/migration.sql",
    signatures: [
      'CREATE INDEX "Meeting_lastSyncedAt_idx" ON "Meeting"("lastSyncedAt");',
      'CREATE INDEX "Meeting_sourceProvider_idx" ON "Meeting"("sourceProvider");',
      'CREATE INDEX "Race_lastSyncedAt_idx" ON "Race"("lastSyncedAt");',
      'CREATE INDEX "Race_sourceProvider_idx" ON "Race"("sourceProvider");',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260630193000_add_live_upsert_uniques/migration.sql",
    signatures: [
      'CREATE UNIQUE INDEX "Meeting_trackId_meetingDate_key" ON "Meeting"("trackId", "meetingDate");',
      'CREATE UNIQUE INDEX "Race_meetingId_raceNumber_key" ON "Race"("meetingId", "raceNumber");',
      'CREATE UNIQUE INDEX "Runner_raceId_boxNumber_key" ON "Runner"("raceId", "boxNumber");',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260630201000_expand_live_data_storage/migration.sql",
    signatures: [
      'CREATE INDEX IF NOT EXISTS "Result_lastSyncedAt_idx" ON "Result"("lastSyncedAt");',
      'CREATE INDEX IF NOT EXISTS "Result_sourceProvider_idx" ON "Result"("sourceProvider");',
      'CREATE INDEX IF NOT EXISTS "Runner_sourceProvider_idx" ON "Runner"("sourceProvider");',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260630202500_add_form_entry_live_unique/migration.sql",
    signatures: [
      'CREATE UNIQUE INDEX IF NOT EXISTS "FormEntry_dogId_raceId_key" ON "FormEntry"("dogId", "raceId");',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260630214000_add_dog_profile_history/migration.sql",
    signatures: [
      'CREATE INDEX "Dog_sourceProvider_idx" ON "Dog"("sourceProvider");',
      'CREATE UNIQUE INDEX "Dog_sourceProvider_sourceId_key" ON "Dog"("sourceProvider", "sourceId");',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260701065000_make_race_video_per_race/migration.sql",
    signatures: [
      'CREATE INDEX IF NOT EXISTS "RaceVideo_sourceProvider_sourceId_idx" ON "RaceVideo"("sourceProvider", "sourceId");',
      'CREATE UNIQUE INDEX IF NOT EXISTS "RaceVideo_raceId_sourceProvider_kind_key" ON "RaceVideo"("raceId", "sourceProvider", "kind");',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260703001500_add_webhook_event_hash_retry_count/migration.sql",
    signatures: [
      'CREATE INDEX "WebhookEvent_provider_eventType_payloadHash_idx" ON "WebhookEvent"("provider", "eventType", "payloadHash");',
      'CREATE UNIQUE INDEX "WebhookEvent_provider_payloadHash_key" ON "WebhookEvent"("provider", "payloadHash");',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260703163000_add_marketplace_foundations/migration.sql",
    signatures: [
      'CREATE INDEX "Listing_categoryId_idx" ON "Listing"("categoryId");',
      'CREATE INDEX "Listing_listingType_idx" ON "Listing"("listingType");',
      'CREATE INDEX "Listing_moderationStatus_idx" ON "Listing"("moderationStatus");',
      'CREATE INDEX "Listing_profileId_status_idx" ON "Listing"("profileId", "status");',
      'CREATE INDEX "Listing_reviewedById_reviewedAt_idx" ON "Listing"("reviewedById", "reviewedAt");',
      'CREATE INDEX "Listing_status_categoryId_state_createdAt_idx" ON "Listing"("status", "categoryId", "state", "createdAt");',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260703170000_add_listing_search_fts/migration.sql",
    signatures: [
      'CREATE INDEX IF NOT EXISTS "ListingSearchIndex_searchText_fts_idx" ON "ListingSearchIndex" USING GIN (to_tsvector(\'english\', COALESCE("searchText", \'\')));',
      'CREATE INDEX IF NOT EXISTS "ListingSearchIndex_searchText_trgm_idx" ON "ListingSearchIndex" USING GIN ("searchText" gin_trgm_ops);',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260703172000_add_notification_delivery_state/migration.sql",
    signatures: [
      'CREATE INDEX "Notification_deliveryStatus_deliveryAttempts_createdAt_idx" ON "Notification"("deliveryStatus", "deliveryAttempts", "createdAt");',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260704120000_add_race_search_indexes/migration.sql",
    signatures: [
      'CREATE INDEX IF NOT EXISTS "Dog_name_trgm_idx" ON "Dog" USING GIN ("name" gin_trgm_ops);',
      'CREATE INDEX IF NOT EXISTS "Race_distance_idx" ON "Race" ("distance");',
      'CREATE INDEX IF NOT EXISTS "Race_grade_trgm_idx" ON "Race" USING GIN ("grade" gin_trgm_ops);',
      'CREATE INDEX IF NOT EXISTS "Race_name_trgm_idx" ON "Race" USING GIN ("name" gin_trgm_ops);',
      'CREATE INDEX IF NOT EXISTS "Race_raceNumber_idx" ON "Race" ("raceNumber");',
      'CREATE INDEX IF NOT EXISTS "Track_name_trgm_idx" ON "Track" USING GIN ("name" gin_trgm_ops);',
      'CREATE INDEX IF NOT EXISTS "Track_state_trgm_idx" ON "Track" USING GIN ("state" gin_trgm_ops);',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260708191000_add_search_indexes/migration.sql",
    signatures: [
      'CREATE INDEX IF NOT EXISTS "Dog_name_trgm_idx" ON "Dog" USING gin ("name" gin_trgm_ops);',
      'CREATE INDEX IF NOT EXISTS "FeedPost_status_visibility_pinnedAt_createdAt_idx" ON "FeedPost" ("status", "visibility", "pinnedAt", "createdAt");',
      'CREATE INDEX IF NOT EXISTS "Listing_status_moderationStatus_expiresAt_createdAt_idx" ON "Listing" ("status", "moderationStatus", "expiresAt", "createdAt");',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260708230000_dog_ownership_verification/migration.sql",
    signatures: [
      'CREATE INDEX "DogOwnership_status_idx" ON "DogOwnership"("status");',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260708240000_dog_name_prefix_index/migration.sql",
    signatures: [
      'CREATE INDEX IF NOT EXISTS "Dog_lower_name_prefix_idx" ON "Dog" (lower("name") text_pattern_ops);',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260710120000_add_feed_post_author_page/migration.sql",
    signatures: [
      'CREATE INDEX "FeedPost_authorPageId_createdAt_idx" ON "FeedPost"("authorPageId", "createdAt");',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260710130000_add_missing_foreign_key_indexes/migration.sql",
    signatures: [
      'CREATE INDEX IF NOT EXISTS "DogOwnership_profileId_status_createdAt_idx" ON "DogOwnership"("profileId", "status", "createdAt");',
      'CREATE INDEX IF NOT EXISTS "Dog_trainerId_idx" ON "Dog"("trainerId");',
      'CREATE INDEX IF NOT EXISTS "FormEntry_trackId_date_idx" ON "FormEntry"("trackId", "date");',
      'CREATE INDEX IF NOT EXISTS "Listing_dogId_status_createdAt_idx" ON "Listing"("dogId", "status", "createdAt");',
      'CREATE INDEX IF NOT EXISTS "Post_authorId_createdAt_idx" ON "Post"("authorId", "createdAt");',
      'CREATE INDEX IF NOT EXISTS "Report_reportedId_createdAt_idx" ON "Report"("reportedId", "createdAt");',
      'CREATE INDEX IF NOT EXISTS "Runner_trainerId_idx" ON "Runner"("trainerId");',
      'CREATE INDEX IF NOT EXISTS "Thread_authorId_createdAt_idx" ON "Thread"("authorId", "createdAt");',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260710131000_add_remaining_foreign_key_indexes/migration.sql",
    signatures: [
      'CREATE INDEX IF NOT EXISTS "CallInvite_callRoomId_toProfileId_status_createdAt_idx" ON "CallInvite"("callRoomId", "toProfileId", "status", "createdAt");',
      'CREATE INDEX IF NOT EXISTS "DogOwnership_reviewedByProfileId_idx" ON "DogOwnership"("reviewedByProfileId");',
      'CREATE INDEX IF NOT EXISTS "OrganizationInvitation_invitedByUserId_idx" ON "OrganizationInvitation"("invitedByUserId");',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260710134000_add_social_actor_media_foundation/migration.sql",
    signatures: [
      'CREATE INDEX "ConversationParticipant_actorId_archivedAt_updatedAt_idx" ON "ConversationParticipant"("actorId", "archivedAt", "updatedAt");',
      'CREATE INDEX "Conversation_participantAActorId_idx" ON "Conversation"("participantAActorId");',
      'CREATE INDEX "Conversation_participantBActorId_idx" ON "Conversation"("participantBActorId");',
      'CREATE INDEX "FeedComment_authorActorId_createdAt_idx" ON "FeedComment"("authorActorId", "createdAt");',
      'CREATE INDEX "FeedPost_authorActorId_status_createdAt_idx" ON "FeedPost"("authorActorId", "status", "createdAt");',
      'CREATE INDEX "FeedReaction_actorId_createdAt_idx" ON "FeedReaction"("actorId", "createdAt");',
      'CREATE INDEX "MediaAsset_processingStatus_createdAt_idx" ON "MediaAsset"("processingStatus", "createdAt");',
      'CREATE INDEX "Message_body_trgm_idx" ON "Message" USING GIN (body gin_trgm_ops);',
      'CREATE INDEX "Message_recipientActorId_createdAt_idx" ON "Message"("recipientActorId", "createdAt");',
      'CREATE INDEX "Message_senderActorId_createdAt_idx" ON "Message"("senderActorId", "createdAt");',
      'CREATE INDEX "Notification_actorId_createdAt_idx" ON "Notification"("actorId", "createdAt");',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260710138000_actor_scoped_conversations/migration.sql",
    signatures: [
      'CREATE UNIQUE INDEX "Conversation_profile_actor_pair_key" ON "Conversation"( "participantAId", "participantBId", "participantAActorId", "participantBActorId" );',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260715072000_fence_billing_webhook_reducers/migration.sql",
    signatures: [
      'CREATE INDEX "WebhookEvent_status_updatedAt_idx" ON "WebhookEvent"("status", "updatedAt");',
      'CREATE UNIQUE INDEX "BillingEvent_webhookEventId_key" ON "BillingEvent"("webhookEventId");',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
  {
    path: "prisma/migrations/20260715110000_add_usage_outbox_delivery_lease/migration.sql",
    signatures: [
      'CREATE INDEX "UsageOutbox_status_leaseExpiresAt_idx" ON "UsageOutbox"("status", "leaseExpiresAt");',
    ],
    disposition: PREPRODUCTION_IMMEDIATE_INDEX_DISPOSITION,
  },
] as const satisfies readonly ReviewedExistingRelationIndexBatch[];

export function auditMigrationIndexCreation(
  sources: readonly MigrationIndexSource[],
  reviews: readonly ReviewedExistingRelationIndexBatch[] =
    REVIEWED_EXISTING_RELATION_INDEX_BATCHES,
) {
  const parsed: Array<Omit<MigrationIndexRecord, "strategy"> & { newRelation: boolean; concurrent: boolean }> = [];
  const issues: string[] = [];
  let occurrences = 0;

  if (sources.length < 1) issues.push("INDEX_CREATION_SOURCE_INVENTORY_VACUOUS");
  for (const source of sources.toSorted((left, right) =>
    left.path.localeCompare(right.path),
  )) {
    const sql = maskSqlComments(source.source);
    const sourceOccurrences = [
      ...sql.matchAll(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/gi),
    ].length;
    const matches = [...sql.matchAll(indexPattern())];
    occurrences += sourceOccurrences;
    if (matches.length !== sourceOccurrences) {
      issues.push(
        `INDEX_CREATION_PARSE_COVERAGE_MISMATCH:${source.path}:${matches.length}/${sourceOccurrences}`,
      );
    }
    for (const match of matches) {
      const name = normalizeIdentifier(match[4]);
      const relation = normalizeIdentifier(match[6]);
      parsed.push({
        path: source.path,
        line: lineForOffset(source.source, match.index),
        name,
        relation,
        signature: normalizeIndexSql(match[0]),
        newRelation: relationCreatedBefore(sql, relation, match.index),
        concurrent: Boolean(match[2]),
      });
    }
  }
  if (occurrences < 1) issues.push("INDEX_CREATION_INVENTORY_VACUOUS");

  const reviewPaths = reviews.map(({ path }) => path);
  const reviewByPath = new Map(reviews.map((review) => [review.path, review]));
  if (new Set(reviewPaths).size !== reviewPaths.length) {
    issues.push("INDEX_CREATION_REVIEW_PATH_DUPLICATE");
  }
  if (reviews.some(({ disposition }) => disposition.trim().length < 120)) {
    issues.push("INDEX_CREATION_DISPOSITION_INCOMPLETE");
  }
  if (
    reviews.some(
      ({ signatures }) =>
        signatures.length < 1 || new Set(signatures).size !== signatures.length,
    )
  ) {
    issues.push("INDEX_CREATION_REVIEW_SIGNATURES_INVALID");
  }

  const immediateByPath = new Map<string, string[]>();
  for (const record of parsed) {
    if (record.newRelation || record.concurrent) continue;
    const signatures = immediateByPath.get(record.path) ?? [];
    signatures.push(record.signature);
    immediateByPath.set(record.path, signatures);
  }
  for (const [path, signatures] of immediateByPath) {
    const review = reviewByPath.get(path);
    if (!review) {
      issues.push(`INDEX_CREATION_EXISTING_RELATION_UNREVIEWED:${path}`);
      continue;
    }
    if (!sameStrings(signatures, review.signatures)) {
      issues.push(`INDEX_CREATION_REVIEW_DRIFT:${path}`);
    }
  }
  for (const review of reviews) {
    if (!immediateByPath.has(review.path)) {
      issues.push(`INDEX_CREATION_REVIEW_STALE:${review.path}`);
    }
  }

  const records: MigrationIndexRecord[] = parsed.map((record) => {
    let strategy: MigrationIndexRecord["strategy"];
    if (record.newRelation) strategy = "new-relation-immediate";
    else if (record.concurrent) strategy = "existing-relation-concurrent";
    else {
      const review = reviewByPath.get(record.path);
      strategy =
        review &&
        sameStrings(immediateByPath.get(record.path) ?? [], review.signatures)
          ? "existing-relation-reviewed-immediate"
          : "existing-relation-unreviewed";
    }
    return {
      path: record.path,
      line: record.line,
      name: record.name,
      relation: record.relation,
      signature: record.signature,
      strategy,
    };
  });

  return {
    occurrences,
    records,
    existingImmediateBatches: [...immediateByPath.entries()]
      .map(([path, signatures]) => ({ path, signatures: signatures.toSorted() }))
      .toSorted((left, right) => left.path.localeCompare(right.path)),
    issues: [...new Set(issues)].toSorted(),
  };
}

export const MIGRATION_INDEX_CREATION_REVIEW_MASTER_EVIDENCE = {
  [MIGRATION_INDEX_CREATION_REVIEW_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: [
      "prisma/migrations",
      "security/migration-index-creation-review-evidence.ts",
      "security/migration-index-creation-review-evidence.test.ts",
    ],
  },
};

export const MIGRATION_INDEX_CREATION_REVIEW_SCOPE =
  "Complete source review of every CREATE INDEX in the ordered Prisma migration history. Immediate creation is accepted automatically only while the target table or materialized view is new and empty in the same migration; existing-relation indexes must use CONCURRENTLY or match an exact reviewed migration-path and normalized-SQL signature batch. Reviewed non-concurrent builds are pre-production exceptions and do not prove online production safety, lock duration, deployed table size or maintenance-window readiness.";

function indexPattern() {
  return /\bCREATE\s+(UNIQUE\s+)?INDEX\s+(CONCURRENTLY\s+)?(IF\s+NOT\s+EXISTS\s+)?((?:"[^"]+"|[a-z_][a-z0-9_$]*))\s+ON\s+(ONLY\s+)?((?:"[^"]+"|[a-z_][a-z0-9_$]*)(?:\.(?:"[^"]+"|[a-z_][a-z0-9_$]*))?)[\s\S]*?;/gi;
}

function relationCreatedBefore(source: string, relation: string, offset: number) {
  const before = source.slice(0, offset);
  return [...before.matchAll(
    /\bCREATE\s+(?:TABLE|MATERIALIZED\s+VIEW)(?:\s+IF\s+NOT\s+EXISTS)?\s+((?:"[^"]+"|[a-z_][a-z0-9_$]*)(?:\.(?:"[^"]+"|[a-z_][a-z0-9_$]*))?)/gi,
  )].some((match) => normalizeIdentifier(match[1]) === relation);
}

function normalizeIndexSql(statement: string) {
  return statement.replace(/\s+/g, " ").trim();
}

function normalizeIdentifier(identifier: string) {
  return identifier
    .split(".")
    .map((part) => part.trim().replace(/^"|"$/g, ""))
    .join(".");
}

function sameStrings(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.toSorted().every((value, index) => value === right.toSorted()[index])
  );
}

function maskSqlComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\r\n]/g, " "))
    .replace(/--[^\r\n]*/g, (comment) => " ".repeat(comment.length));
}

function lineForOffset(source: string, offset: number) {
  return source.slice(0, offset).split(/\r?\n/).length;
}
