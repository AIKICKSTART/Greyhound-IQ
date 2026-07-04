CREATE TABLE "ConversationParticipant" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReadMessageId" TEXT,
  "mutedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessageDeliveryReceipt" (
  "messageId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MessageDeliveryReceipt_pkey" PRIMARY KEY ("messageId", "profileId")
);

CREATE TABLE "MessageReadReceipt" (
  "messageId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MessageReadReceipt_pkey" PRIMARY KEY ("messageId", "profileId")
);

CREATE TABLE "MessageReaction" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "reactionType" TEXT NOT NULL DEFAULT 'like',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserPresence" (
  "profileId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'offline',
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserPresence_pkey" PRIMARY KEY ("profileId")
);

CREATE TABLE "UserBlock" (
  "id" TEXT NOT NULL,
  "blockerProfileId" TEXT NOT NULL,
  "blockedProfileId" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessageModerationAction" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "actorProfileId" TEXT,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MessageModerationAction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ConversationParticipant"
  ADD CONSTRAINT "ConversationParticipant_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationParticipant"
  ADD CONSTRAINT "ConversationParticipant_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MessageDeliveryReceipt"
  ADD CONSTRAINT "MessageDeliveryReceipt_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageDeliveryReceipt"
  ADD CONSTRAINT "MessageDeliveryReceipt_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MessageReadReceipt"
  ADD CONSTRAINT "MessageReadReceipt_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageReadReceipt"
  ADD CONSTRAINT "MessageReadReceipt_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MessageReaction"
  ADD CONSTRAINT "MessageReaction_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageReaction"
  ADD CONSTRAINT "MessageReaction_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserPresence"
  ADD CONSTRAINT "UserPresence_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserBlock"
  ADD CONSTRAINT "UserBlock_blockerProfileId_fkey"
  FOREIGN KEY ("blockerProfileId") REFERENCES "Profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserBlock"
  ADD CONSTRAINT "UserBlock_blockedProfileId_fkey"
  FOREIGN KEY ("blockedProfileId") REFERENCES "Profile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserBlock"
  ADD CONSTRAINT "UserBlock_no_self_block"
  CHECK ("blockerProfileId" <> "blockedProfileId");

ALTER TABLE "MessageModerationAction"
  ADD CONSTRAINT "MessageModerationAction_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageModerationAction"
  ADD CONSTRAINT "MessageModerationAction_actorProfileId_fkey"
  FOREIGN KEY ("actorProfileId") REFERENCES "Profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ConversationParticipant_conversationId_profileId_key"
  ON "ConversationParticipant"("conversationId", "profileId");
CREATE INDEX "ConversationParticipant_profileId_archivedAt_updatedAt_idx"
  ON "ConversationParticipant"("profileId", "archivedAt", "updatedAt");
CREATE INDEX "ConversationParticipant_lastReadMessageId_idx"
  ON "ConversationParticipant"("lastReadMessageId");
CREATE INDEX "MessageDeliveryReceipt_profileId_deliveredAt_idx"
  ON "MessageDeliveryReceipt"("profileId", "deliveredAt");
CREATE INDEX "MessageReadReceipt_profileId_readAt_idx"
  ON "MessageReadReceipt"("profileId", "readAt");
CREATE UNIQUE INDEX "MessageReaction_messageId_profileId_reactionType_key"
  ON "MessageReaction"("messageId", "profileId", "reactionType");
CREATE INDEX "MessageReaction_profileId_createdAt_idx"
  ON "MessageReaction"("profileId", "createdAt");
CREATE INDEX "UserPresence_status_lastSeenAt_idx"
  ON "UserPresence"("status", "lastSeenAt");
CREATE UNIQUE INDEX "UserBlock_blockerProfileId_blockedProfileId_key"
  ON "UserBlock"("blockerProfileId", "blockedProfileId");
CREATE INDEX "UserBlock_blockerProfileId_createdAt_idx"
  ON "UserBlock"("blockerProfileId", "createdAt");
CREATE INDEX "UserBlock_blockedProfileId_createdAt_idx"
  ON "UserBlock"("blockedProfileId", "createdAt");
CREATE INDEX "MessageModerationAction_messageId_createdAt_idx"
  ON "MessageModerationAction"("messageId", "createdAt");
CREATE INDEX "MessageModerationAction_actorProfileId_createdAt_idx"
  ON "MessageModerationAction"("actorProfileId", "createdAt");
CREATE INDEX "MessageModerationAction_action_createdAt_idx"
  ON "MessageModerationAction"("action", "createdAt");

INSERT INTO "ConversationParticipant" (
  "id",
  "conversationId",
  "profileId",
  "role",
  "joinedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'cp-a-' || "id",
  "id",
  "participantAId",
  'member',
  "createdAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Conversation"
ON CONFLICT ("conversationId", "profileId") DO NOTHING;

INSERT INTO "ConversationParticipant" (
  "id",
  "conversationId",
  "profileId",
  "role",
  "joinedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'cp-b-' || "id",
  "id",
  "participantBId",
  'member',
  "createdAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Conversation"
ON CONFLICT ("conversationId", "profileId") DO NOTHING;

INSERT INTO "MessageDeliveryReceipt" ("messageId", "profileId", "deliveredAt")
SELECT "id", "recipientId", "createdAt"
FROM "Message"
WHERE "conversationId" IS NOT NULL
ON CONFLICT ("messageId", "profileId") DO NOTHING;

INSERT INTO "MessageReadReceipt" ("messageId", "profileId", "readAt")
SELECT "id", "recipientId", "readAt"
FROM "Message"
WHERE "conversationId" IS NOT NULL
  AND "readAt" IS NOT NULL
ON CONFLICT ("messageId", "profileId") DO NOTHING;

UPDATE "ConversationParticipant" participant
SET "lastReadMessageId" = latest."id"
FROM (
  SELECT DISTINCT ON ("conversationId", "recipientId")
    "id",
    "conversationId",
    "recipientId"
  FROM "Message"
  WHERE "conversationId" IS NOT NULL
    AND "readAt" IS NOT NULL
  ORDER BY "conversationId", "recipientId", "createdAt" DESC
) latest
WHERE participant."conversationId" = latest."conversationId"
  AND participant."profileId" = latest."recipientId";
