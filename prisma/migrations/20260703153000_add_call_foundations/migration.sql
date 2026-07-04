CREATE TABLE "CallRoom" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT,
  "createdByProfileId" TEXT NOT NULL,
  "roomName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "startsAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CallRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CallParticipant" (
  "id" TEXT NOT NULL,
  "callRoomId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'participant',
  "joinedAt" TIMESTAMP(3),
  "leftAt" TIMESTAMP(3),
  "lastTokenIssuedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CallParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CallInvite" (
  "id" TEXT NOT NULL,
  "callRoomId" TEXT NOT NULL,
  "fromProfileId" TEXT NOT NULL,
  "toProfileId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CallInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CallEvent" (
  "id" TEXT NOT NULL,
  "callRoomId" TEXT NOT NULL,
  "profileId" TEXT,
  "eventType" TEXT NOT NULL,
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CallEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CallReport" (
  "id" TEXT NOT NULL,
  "callRoomId" TEXT NOT NULL,
  "reporterProfileId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CallReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CallPermission" (
  "callRoomId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "canJoin" BOOLEAN NOT NULL DEFAULT true,
  "canInvite" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CallPermission_pkey" PRIMARY KEY ("callRoomId", "profileId")
);

ALTER TABLE "CallRoom"
  ADD CONSTRAINT "CallRoom_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CallRoom"
  ADD CONSTRAINT "CallRoom_createdByProfileId_fkey"
  FOREIGN KEY ("createdByProfileId") REFERENCES "Profile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CallParticipant"
  ADD CONSTRAINT "CallParticipant_callRoomId_fkey"
  FOREIGN KEY ("callRoomId") REFERENCES "CallRoom"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallParticipant"
  ADD CONSTRAINT "CallParticipant_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CallInvite"
  ADD CONSTRAINT "CallInvite_callRoomId_fkey"
  FOREIGN KEY ("callRoomId") REFERENCES "CallRoom"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallInvite"
  ADD CONSTRAINT "CallInvite_fromProfileId_fkey"
  FOREIGN KEY ("fromProfileId") REFERENCES "Profile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CallInvite"
  ADD CONSTRAINT "CallInvite_toProfileId_fkey"
  FOREIGN KEY ("toProfileId") REFERENCES "Profile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CallEvent"
  ADD CONSTRAINT "CallEvent_callRoomId_fkey"
  FOREIGN KEY ("callRoomId") REFERENCES "CallRoom"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallEvent"
  ADD CONSTRAINT "CallEvent_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CallReport"
  ADD CONSTRAINT "CallReport_callRoomId_fkey"
  FOREIGN KEY ("callRoomId") REFERENCES "CallRoom"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallReport"
  ADD CONSTRAINT "CallReport_reporterProfileId_fkey"
  FOREIGN KEY ("reporterProfileId") REFERENCES "Profile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CallPermission"
  ADD CONSTRAINT "CallPermission_callRoomId_fkey"
  FOREIGN KEY ("callRoomId") REFERENCES "CallRoom"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallPermission"
  ADD CONSTRAINT "CallPermission_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "CallRoom_roomName_key" ON "CallRoom"("roomName");
CREATE INDEX "CallRoom_conversationId_status_createdAt_idx" ON "CallRoom"("conversationId", "status", "createdAt");
CREATE INDEX "CallRoom_createdByProfileId_createdAt_idx" ON "CallRoom"("createdByProfileId", "createdAt");
CREATE INDEX "CallRoom_status_createdAt_idx" ON "CallRoom"("status", "createdAt");
CREATE UNIQUE INDEX "CallParticipant_callRoomId_profileId_key" ON "CallParticipant"("callRoomId", "profileId");
CREATE INDEX "CallParticipant_profileId_createdAt_idx" ON "CallParticipant"("profileId", "createdAt");
CREATE INDEX "CallInvite_toProfileId_status_expiresAt_idx" ON "CallInvite"("toProfileId", "status", "expiresAt");
CREATE INDEX "CallInvite_fromProfileId_createdAt_idx" ON "CallInvite"("fromProfileId", "createdAt");
CREATE INDEX "CallEvent_callRoomId_createdAt_idx" ON "CallEvent"("callRoomId", "createdAt");
CREATE INDEX "CallEvent_profileId_createdAt_idx" ON "CallEvent"("profileId", "createdAt");
CREATE INDEX "CallEvent_eventType_createdAt_idx" ON "CallEvent"("eventType", "createdAt");
CREATE INDEX "CallReport_status_createdAt_idx" ON "CallReport"("status", "createdAt");
CREATE INDEX "CallReport_callRoomId_createdAt_idx" ON "CallReport"("callRoomId", "createdAt");
CREATE INDEX "CallReport_reporterProfileId_createdAt_idx" ON "CallReport"("reporterProfileId", "createdAt");
CREATE INDEX "CallPermission_profileId_canJoin_idx" ON "CallPermission"("profileId", "canJoin");
