-- Preserve the safe edge/request correlation identifier across the durable
-- signup handoff. It is nullable for existing rows and contains no identity
-- provider payload, email address, credential or other user content.
ALTER TABLE "SignupOutbox"
  ADD COLUMN "correlationId" VARCHAR(128);
