CREATE TABLE "TermsAcceptance" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "termsVersion" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TermsAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConsentEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "consentType" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "version" TEXT,
  "source" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConsentEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketingPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'email',
  "optedIn" BOOLEAN NOT NULL DEFAULT false,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingPreference_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TermsAcceptance"
  ADD CONSTRAINT "TermsAcceptance_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConsentEvent"
  ADD CONSTRAINT "ConsentEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketingPreference"
  ADD CONSTRAINT "MarketingPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "TermsAcceptance_userId_termsVersion_key" ON "TermsAcceptance"("userId", "termsVersion");
CREATE INDEX "TermsAcceptance_userId_acceptedAt_idx" ON "TermsAcceptance"("userId", "acceptedAt");
CREATE INDEX "TermsAcceptance_acceptedAt_idx" ON "TermsAcceptance"("acceptedAt");

CREATE INDEX "ConsentEvent_userId_consentType_occurredAt_idx" ON "ConsentEvent"("userId", "consentType", "occurredAt");
CREATE INDEX "ConsentEvent_occurredAt_idx" ON "ConsentEvent"("occurredAt");

CREATE UNIQUE INDEX "MarketingPreference_userId_channel_key" ON "MarketingPreference"("userId", "channel");
CREATE INDEX "MarketingPreference_channel_optedIn_idx" ON "MarketingPreference"("channel", "optedIn");
