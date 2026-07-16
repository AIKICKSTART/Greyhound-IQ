const MEDIA_BOUNDARY_EVIDENCE = [
  "src/lib/billing/entitlement-service.ts",
  "src/lib/billing/entitlement-service.test.ts",
  "src/lib/billing/entitlements.ts",
  "src/lib/media-service.ts",
  "src/lib/media-service.test.ts",
  "src/lib/object-storage.ts",
  "src/lib/object-storage.test.ts",
  "src/app/api/media/[id]/blob/route.ts",
  "src/app/api/media/[id]/url/route.ts",
  "security/media-boundary-evidence.test.ts",
] as const;

const VERIFIED_MEDIA_BOUNDARY_IDS = [
  "security.server-authority.entitlement",
  "security.resource-control.storage-quota",
  "security.upload-validation.total-storage-quota",
  "security.endpoint-test-resource-abuse.upload-quotas",
  "security.object-authorization.file-id",
  "security.release.17.private-downloads-authorised",
] as const;

export const MEDIA_BOUNDARY_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_MEDIA_BOUNDARY_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: MEDIA_BOUNDARY_EVIDENCE },
  ]),
);
