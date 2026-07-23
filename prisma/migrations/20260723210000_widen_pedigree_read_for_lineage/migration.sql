-- Widen read access to studbook pedigree records so lineage surfaces (dog
-- profiles, breeding pages, test mating) can present parsed-but-not-yet-
-- materialized assertions at read time. These are public studbook facts
-- (names, relationships, registry references) with no personal data.
-- 'rejected' and 'conflict' rows stay hidden; INSERT/UPDATE policies and
-- FORCE ROW LEVEL SECURITY are unchanged.

DROP POLICY IF EXISTS giq_pedigree_assertion_verified_read ON "PedigreeAssertion";
CREATE POLICY giq_pedigree_assertion_verified_read
  ON "PedigreeAssertion" FOR SELECT
  USING (
    public.giq_is_admin()
    OR "verificationStatus" IN ('parsed', 'verified')
  );

DROP POLICY IF EXISTS giq_dog_source_identity_verified_read ON "DogSourceIdentity";
CREATE POLICY giq_dog_source_identity_verified_read
  ON "DogSourceIdentity" FOR SELECT
  USING (
    public.giq_is_admin()
    OR "verificationStatus" IN ('parsed', 'verified')
  );
