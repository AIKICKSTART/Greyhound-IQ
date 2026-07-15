# File upload and download review

Status: **Partially verified — live storage/scanner evidence missing**  
Evidence date: 2026-07-13  
Owner: media security

## Observed flow

1. `POST /api/media/sign-upload` requires the current user, applies 20 requests/minute per user, parses `mediaSignUploadSchema`, checks context, tier file-size/monthly/storage quotas, builds a server path and creates a two-hour Supabase signed upload.
2. The database records uploader, generated bucket/path, declared MIME/size and `scanStatus=pending`. Only `site-assets` is public; user media resolves to `private-user-media`.
3. `POST /api/media/[id]/finalize` requires the current user, limits five/minute per user/media, rechecks uploader/not-deleted, stored size, detected head bytes, MIME/entitlement/quota and retains scanner authority. Client `scanStatus` is not trusted.
4. Maintenance claims bounded pending records, checks stored type/size, scans through ClamAV in production by default, quarantines until clean, purges infected/invalid originals and generates bounded image/video/audio derivatives through FFmpeg.
5. Private delivery uses ownership/visibility checks and 15-minute signed URLs; local upload returns 410. Deletion tombstones the owned row, audits, and attempts original/derivative storage removal.

## Accepted formats and source limits

Images JPEG/PNG/WebP/AVIF: 10 MiB; video MP4/WebM/QuickTime: 200 MiB; audio MP4/WebM/Ogg: 5 MiB; PDF: 25 MiB. Captions must be UTF-8 `text/vtt`, at most 256 KiB, contain a valid WEBVTT header and at least one increasing cue. Filenames are 1–160 characters and object paths are server generated. Images are inspected with a 4,100-byte head; dimensions are capped at 20,000 and declared duration at one hour. Entitlement limits can be lower.

## Evidence and gaps

Source tests cover media service/validation/storage paths, but the endpoint registry marks sign-upload, finalize, blob/URL delivery, caption routes and maintenance Not verified; only status/update/delete are partially verified. CSRF/origin controls, cross-owner route negatives, signature/magic coverage for every format, PDF active-content handling, scanner definition freshness in deployed Cloud Run, quarantine bucket policies, metadata stripping, provider timeout/retry, durable cleanup of failed deletes/abandoned uploads, signed-URL revocation and storage audit evidence remain unverified. Owner: media security and cloud platform; reason: no authorised deployed storage/scanner configuration or runtime test account was supplied. Release remains blocked.

