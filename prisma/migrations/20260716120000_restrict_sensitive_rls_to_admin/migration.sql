-- Trust-and-safety moderators must not inherit administrator access to account,
-- private-media, plan-management, or customer billing records. Keep the shared
-- moderator predicate for moderation surfaces and use this narrower predicate
-- only where the application already requires administrator authority.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.giq_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT public.giq_is_system()
    OR public.giq_current_role() = 'admin';
$$;

REVOKE ALL ON FUNCTION public.giq_is_admin() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_runtime') THEN
    GRANT EXECUTE ON FUNCTION public.giq_is_admin() TO greyhoundiq_runtime;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'greyhoundiq_app') THEN
    GRANT EXECUTE ON FUNCTION public.giq_is_admin() TO greyhoundiq_app;
  END IF;
END
$$;

ALTER POLICY giq_user_select
ON public."User"
USING (
  public.giq_is_admin()
  OR id = public.giq_current_user_id()
);

ALTER POLICY giq_user_update
ON public."User"
USING (
  public.giq_is_admin()
  OR id = public.giq_current_user_id()
)
WITH CHECK (
  public.giq_is_admin()
  OR id = public.giq_current_user_id()
);

-- Public Profile reads remain governed by the existing public-profile contract.
-- Cross-account base-row changes are administrator or owner only.
ALTER POLICY giq_profile_update
ON public."Profile"
USING (
  public.giq_is_admin()
  OR "userId" = public.giq_current_user_id()
)
WITH CHECK (
  public.giq_is_admin()
  OR "userId" = public.giq_current_user_id()
);

ALTER POLICY giq_media_select
ON public."MediaAsset"
USING (
  public.giq_is_admin()
  OR "uploaderId" = public.giq_current_user_id()
  OR "storageBucket" IN ('site-assets', 'public-user-media')
  OR EXISTS (
    SELECT 1
    FROM public."MessageMedia" attachment
    JOIN public."Message" message ON message.id = attachment."messageId"
    WHERE attachment."mediaId" = "MediaAsset".id
      AND public.giq_media_owned_by_actor(message."senderActorId", "MediaAsset".id)
      AND (
        (message."senderId" = public.giq_current_profile_id()
          AND message."deletedBySenderAt" IS NULL)
        OR (message."recipientId" = public.giq_current_profile_id()
          AND message."deletedByRecipientAt" IS NULL)
      )
  )
);

ALTER POLICY giq_media_update
ON public."MediaAsset"
USING (
  public.giq_is_admin()
  OR "uploaderId" = public.giq_current_user_id()
)
WITH CHECK (
  public.giq_is_admin()
  OR "uploaderId" = public.giq_current_user_id()
);

ALTER POLICY giq_media_delete
ON public."MediaAsset"
USING (
  public.giq_is_admin()
  OR "uploaderId" = public.giq_current_user_id()
);

ALTER POLICY giq_plan_write
ON public."Plan"
USING (public.giq_is_admin())
WITH CHECK (public.giq_is_admin());

ALTER POLICY giq_price_catalog_write
ON public."PriceCatalog"
USING (public.giq_is_admin())
WITH CHECK (public.giq_is_admin());

ALTER POLICY giq_plan_entitlement_write
ON public."PlanEntitlement"
USING (public.giq_is_admin())
WITH CHECK (public.giq_is_admin());

-- Older AlloyDB rehearsal restores predate the split read/write policies and
-- use one legacy *_access policy per billing table. Drop either catalog shape,
-- then create the same canonical policy pair on every environment.
DROP POLICY IF EXISTS giq_billing_customer_access ON public."BillingCustomer";
DROP POLICY IF EXISTS giq_billing_customer_read ON public."BillingCustomer";
DROP POLICY IF EXISTS giq_billing_customer_write ON public."BillingCustomer";
CREATE POLICY giq_billing_customer_read ON public."BillingCustomer" FOR SELECT
USING ("userId" = public.giq_current_user_id() OR public.giq_is_admin());
CREATE POLICY giq_billing_customer_write ON public."BillingCustomer" FOR ALL
USING (public.giq_is_admin()) WITH CHECK (public.giq_is_admin());

DROP POLICY IF EXISTS giq_subscription_access ON public."Subscription";
DROP POLICY IF EXISTS giq_subscription_read ON public."Subscription";
DROP POLICY IF EXISTS giq_subscription_write ON public."Subscription";
CREATE POLICY giq_subscription_read ON public."Subscription" FOR SELECT
USING ("userId" = public.giq_current_user_id() OR public.giq_is_admin());
CREATE POLICY giq_subscription_write ON public."Subscription" FOR ALL
USING (public.giq_is_admin()) WITH CHECK (public.giq_is_admin());

DROP POLICY IF EXISTS giq_entitlement_snapshot_access ON public."EntitlementSnapshot";
DROP POLICY IF EXISTS giq_entitlement_snapshot_read ON public."EntitlementSnapshot";
DROP POLICY IF EXISTS giq_entitlement_snapshot_write ON public."EntitlementSnapshot";
CREATE POLICY giq_entitlement_snapshot_read ON public."EntitlementSnapshot" FOR SELECT
USING ("userId" = public.giq_current_user_id() OR public.giq_is_admin());
CREATE POLICY giq_entitlement_snapshot_write ON public."EntitlementSnapshot" FOR ALL
USING (public.giq_is_admin()) WITH CHECK (public.giq_is_admin());

DROP POLICY IF EXISTS giq_invoice_access ON public."InvoiceRecord";
DROP POLICY IF EXISTS giq_invoice_read ON public."InvoiceRecord";
DROP POLICY IF EXISTS giq_invoice_write ON public."InvoiceRecord";
CREATE POLICY giq_invoice_read ON public."InvoiceRecord" FOR SELECT
USING ("userId" = public.giq_current_user_id() OR public.giq_is_admin());
CREATE POLICY giq_invoice_write ON public."InvoiceRecord" FOR ALL
USING (public.giq_is_admin()) WITH CHECK (public.giq_is_admin());

DROP POLICY IF EXISTS giq_payment_access ON public."PaymentRecord";
DROP POLICY IF EXISTS giq_payment_read ON public."PaymentRecord";
DROP POLICY IF EXISTS giq_payment_write ON public."PaymentRecord";
CREATE POLICY giq_payment_read ON public."PaymentRecord" FOR SELECT
USING ("userId" = public.giq_current_user_id() OR public.giq_is_admin());
CREATE POLICY giq_payment_write ON public."PaymentRecord" FOR ALL
USING (public.giq_is_admin()) WITH CHECK (public.giq_is_admin());

DROP POLICY IF EXISTS giq_refund_access ON public."RefundRecord";
DROP POLICY IF EXISTS giq_refund_read ON public."RefundRecord";
DROP POLICY IF EXISTS giq_refund_write ON public."RefundRecord";
CREATE POLICY giq_refund_read ON public."RefundRecord" FOR SELECT
USING ("userId" = public.giq_current_user_id() OR public.giq_is_admin());
CREATE POLICY giq_refund_write ON public."RefundRecord" FOR ALL
USING (public.giq_is_admin()) WITH CHECK (public.giq_is_admin());

DROP POLICY IF EXISTS giq_credit_note_access ON public."CreditNoteRecord";
DROP POLICY IF EXISTS giq_credit_note_read ON public."CreditNoteRecord";
DROP POLICY IF EXISTS giq_credit_note_write ON public."CreditNoteRecord";
CREATE POLICY giq_credit_note_read ON public."CreditNoteRecord" FOR SELECT
USING ("userId" = public.giq_current_user_id() OR public.giq_is_admin());
CREATE POLICY giq_credit_note_write ON public."CreditNoteRecord" FOR ALL
USING (public.giq_is_admin()) WITH CHECK (public.giq_is_admin());

DROP POLICY IF EXISTS giq_billing_event_access ON public."BillingEvent";
DROP POLICY IF EXISTS giq_billing_event_read ON public."BillingEvent";
DROP POLICY IF EXISTS giq_billing_event_write ON public."BillingEvent";
CREATE POLICY giq_billing_event_read ON public."BillingEvent" FOR SELECT
USING ("userId" = public.giq_current_user_id() OR public.giq_is_admin());
CREATE POLICY giq_billing_event_write ON public."BillingEvent" FOR ALL
USING (public.giq_is_admin()) WITH CHECK (public.giq_is_admin());

DROP POLICY IF EXISTS giq_usage_event_access ON public."UsageEvent";
DROP POLICY IF EXISTS giq_usage_event_read ON public."UsageEvent";
DROP POLICY IF EXISTS giq_usage_event_write ON public."UsageEvent";
CREATE POLICY giq_usage_event_read ON public."UsageEvent" FOR SELECT
USING ("userId" = public.giq_current_user_id() OR public.giq_is_admin());
CREATE POLICY giq_usage_event_write ON public."UsageEvent" FOR ALL
USING (public.giq_is_admin()) WITH CHECK (public.giq_is_admin());

DROP POLICY IF EXISTS giq_usage_outbox_access ON public."UsageOutbox";
DROP POLICY IF EXISTS giq_usage_outbox_read ON public."UsageOutbox";
DROP POLICY IF EXISTS giq_usage_outbox_write ON public."UsageOutbox";
CREATE POLICY giq_usage_outbox_read ON public."UsageOutbox" FOR SELECT
USING ("userId" = public.giq_current_user_id() OR public.giq_is_admin());
CREATE POLICY giq_usage_outbox_write ON public."UsageOutbox" FOR ALL
USING (public.giq_is_admin()) WITH CHECK (public.giq_is_admin());

DROP POLICY IF EXISTS giq_usage_aggregate_access ON public."UsageAggregate";
DROP POLICY IF EXISTS giq_usage_aggregate_read ON public."UsageAggregate";
DROP POLICY IF EXISTS giq_usage_aggregate_write ON public."UsageAggregate";
CREATE POLICY giq_usage_aggregate_read ON public."UsageAggregate" FOR SELECT
USING ("userId" = public.giq_current_user_id() OR public.giq_is_admin());
CREATE POLICY giq_usage_aggregate_write ON public."UsageAggregate" FOR ALL
USING (public.giq_is_admin()) WITH CHECK (public.giq_is_admin());

ALTER POLICY giq_webhook_event_system
ON public."WebhookEvent"
USING (public.giq_is_admin())
WITH CHECK (public.giq_is_admin());

COMMIT;
