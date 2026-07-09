-- $500 concierge design service. Forward-only.
-- CustomPage.bespoke: team-built pages exempt from self-serve count limits.
-- CustomDesignRequest: created on Stripe payment success; buyer reads own row,
-- moderators/system manage the lifecycle.

ALTER TABLE "CustomPage" ADD COLUMN "bespoke" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "CustomDesignRequest" (
    "id" TEXT NOT NULL,
    "buyerProfileId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'aud',
    "stripeSessionId" TEXT,
    "stripePaymentId" TEXT,
    "notes" TEXT,
    "assignedAdminId" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomDesignRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomDesignRequest_stripeSessionId_key" ON "CustomDesignRequest"("stripeSessionId");
CREATE INDEX "CustomDesignRequest_status_createdAt_idx" ON "CustomDesignRequest"("status", "createdAt");
CREATE INDEX "CustomDesignRequest_buyerProfileId_idx" ON "CustomDesignRequest"("buyerProfileId");

ALTER TABLE "CustomDesignRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomDesignRequest" FORCE ROW LEVEL SECURITY;

CREATE POLICY giq_custom_design_request_select ON "CustomDesignRequest" FOR SELECT USING (
  public.giq_is_system()
  OR public.giq_is_moderator()
  OR "buyerProfileId" = public.giq_current_profile_id()
);
CREATE POLICY giq_custom_design_request_write ON "CustomDesignRequest" FOR ALL USING (
  public.giq_is_system() OR public.giq_is_moderator()
) WITH CHECK (
  public.giq_is_system() OR public.giq_is_moderator()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "CustomDesignRequest" TO greyhoundiq_runtime;
  END IF;
END;
$$;
