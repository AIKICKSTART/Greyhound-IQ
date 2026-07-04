ALTER TABLE "Notification"
  ADD COLUMN "deliveryStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "lastDeliveryAttemptAt" TIMESTAMP(3),
  ADD COLUMN "lastDeliveryError" TEXT;

CREATE INDEX "Notification_deliveryStatus_deliveryAttempts_createdAt_idx"
  ON "Notification"("deliveryStatus", "deliveryAttempts", "createdAt");
