-- Bound the oldest-first account-deletion maintenance candidate scan.
-- PostgreSQL migrations are not transaction-wrapped by Prisma, so CONCURRENTLY
-- avoids blocking production reads and writes while this forward-only index is built.
CREATE INDEX CONCURRENTLY "User_isBanned_deletionRequestedAt_id_idx"
ON "User"("isBanned", "deletionRequestedAt", "id");
