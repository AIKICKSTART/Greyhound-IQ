-- Lease ownership is separate because the base SignupOutbox migration has
-- already been applied in local development. This migration is forward-only.
ALTER TABLE "SignupOutbox"
  ADD COLUMN "leaseToken" TEXT;
