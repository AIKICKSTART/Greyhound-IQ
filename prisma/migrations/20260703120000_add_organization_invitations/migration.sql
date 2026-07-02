CREATE TABLE "OrganizationInvitation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "invitedByUserId" TEXT,
  "emailHash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrganizationInvitation"
  ADD CONSTRAINT "OrganizationInvitation_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationInvitation"
  ADD CONSTRAINT "OrganizationInvitation_invitedByUserId_fkey"
  FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "OrganizationInvitation_tokenHash_key" ON "OrganizationInvitation"("tokenHash");
CREATE INDEX "OrganizationInvitation_organizationId_status_idx" ON "OrganizationInvitation"("organizationId", "status");
CREATE INDEX "OrganizationInvitation_emailHash_status_idx" ON "OrganizationInvitation"("emailHash", "status");
CREATE INDEX "OrganizationInvitation_expiresAt_idx" ON "OrganizationInvitation"("expiresAt");
