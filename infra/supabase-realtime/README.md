# GreyhoundIQ self-hosted Supabase Realtime

This staging service keeps the remaining Supabase dependency self-hosted in
Google Cloud. It runs only the two capabilities GreyhoundIQ still uses:

- Supabase Realtime for Broadcast and Presence;
- PostgREST for the bounded private-topic grant and revoke RPCs.

Auth remains WorkOS, object storage remains GCS, and the application database
remains the separate Stage 11 AlloyDB database. The Realtime engine uses the
dedicated `giq_realtime_stage11` database in the same Sydney AlloyDB cluster.

The public gateway exposes only `/realtime/v1/*`, the two `giq_*` grant RPCs,
and `/health`. Realtime tenant-management endpoints and the rest of PostgREST
are not public.

Staging scales to zero when idle. An active WebSocket request keeps its instance
allocated; production minimum instances remain a measured launch decision.

Secrets are stored in Google Secret Manager and referenced by the Cloud Run
service. Do not place their values in this directory or in deployment logs.

## Deployment order

1. Run `init.sql` against the dedicated Realtime database as its administrative
   bootstrap user.
2. Deploy `cloud-run-staging.yaml` and make one Realtime connection so the
   upstream sequential tenant migrations reach the PostgreSQL 16 compatibility
   boundary.
3. Run `alloydb-compat.sql`, then reconnect so Realtime completes its remaining
   tenant migrations and creates the daily message partitions.
4. Apply `scripts/sql/supabase-private-realtime-policies.sql` to the Realtime
   database.
5. Verify public Broadcast, authorized private Broadcast, and denial of a
   private subscription without a matching topic grant.

`alloydb-compat.sql` is pinned to Realtime v2.116.1. Re-check it against the
upstream tenant migrations before changing the Realtime image tag.
