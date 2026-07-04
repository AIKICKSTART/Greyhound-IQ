CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "actorProfileId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "href" TEXT,
  "targetType" TEXT,
  "targetId" TEXT,
  "metadataJson" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Notification_userId_readAt_createdAt_idx"
  ON "Notification"("userId", "readAt", "createdAt");

CREATE INDEX "Notification_userId_createdAt_idx"
  ON "Notification"("userId", "createdAt");

CREATE INDEX "Notification_targetType_targetId_idx"
  ON "Notification"("targetType", "targetId");
