# File upload and download review

Status: **Partially verified — live storage/scanner evidence missing**  
Evidence date: 2026-07-13  
Owner: media security

## Observed flow

1. `POST /api/media/sign-upload` requires the current user, applies 20 requests/minute per user, parses `mediaSignUploadSchema`, checks context, tier file-size/monthly/storage quotas, builds a server path and creates a two-hour provider upload. Production uses a GCS V4 signed `PUT` with its signed `Content-Type`; the Supabase development adapter retains `x-upsert` compatibility.
2. The database records uploader, generated logical bucket/path, declared MIME/size and `scanStatus=pending`. Production maps `site-assets`, `public-user-media`, and `private-user-media` to distinct private Australian GCS buckets. User media resolves to `private-user-media`, and database authorization remains authoritative because bucket names and `users/<dbUserId>/...` keys are server generated.
3. `POST /api/media/[id]/finalize` requires the current user, limits five/minute per user/media, rechecks uploader/not-deleted, stored size, detected head bytes, MIME/entitlement/quota and retains scanner authority. Client `scanStatus` is not trusted.
4. Maintenance claims bounded pending records, checks stored type/size, scans through ClamAV in production by default, quarantines until clean, purges infected/invalid originals and generates bounded image/video/audio derivatives through FFmpeg.
5. Delivery uses ownership/visibility checks and 15-minute provider-signed URLs or the authorized application proxy; local upload returns 410. Deletion tombstones the owned row, audits, and attempts original/derivative storage removal.

## Accepted formats and source limits

Images JPEG/PNG/WebP/AVIF: 10 MiB; video MP4/WebM/QuickTime: 200 MiB; audio MP4/WebM/Ogg: 5 MiB; PDF: 25 MiB. Captions must be UTF-8 `text/vtt`, at most 256 KiB, contain a valid WEBVTT header and at least one increasing cue. Filenames are 1–160 characters and object paths are server generated. Images are inspected with a 4,100-byte head; dimensions are capped at 20,000 and declared duration at one hour. Entitlement limits can be lower.

## Evidence and gaps

Source tests cover media service/validation, provider selection, GCS bucket/URL mapping, signed upload headers and storage operations, but deployed endpoint and scanner evidence is still required. Before cutover, every existing Supabase object must be copied to the matching GCS logical bucket with the identical key, then object counts, total bytes and content hashes must reconcile. Because `MediaAsset` stores provider-neutral bucket/key coordinates, a verified key-preserving copy needs no row rewrite. Run a final delta copy before setting `OBJECT_STORAGE_PROVIDER=gcs`; retain the source until authorized live reads, uploads, profile images, dog cards, captions, derivatives and deletes pass. Race replay provider URLs and raw historical database/archive buckets are separate pipelines and are not migrated by the application object-storage adapter.
