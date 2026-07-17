const DOWNLOAD_CONTROL_EVIDENCE = [
  "src/lib/media-service.ts",
  "src/lib/media-service.test.ts",
  "src/lib/object-storage.ts",
  "src/lib/object-storage.test.ts",
  "src/lib/storage-paths.ts",
  "src/lib/storage-paths.test.ts",
  "src/app/api/media/[id]/blob/route.ts",
  "src/app/api/media/[id]/url/route.ts",
  "src/app/api/users/me/export/route.ts",
  "src/lib/user-export-policy.ts",
  "security/download-control-evidence.test.ts",
] as const;

const verified = (requirementId: string) => [
  requirementId,
  { status: "verified" as const, evidence: DOWNLOAD_CONTROL_EVIDENCE },
] as const;

export const DOWNLOAD_CONTROL_MASTER_EVIDENCE = Object.fromEntries([
  verified("security.download-control.ownership-visibility"),
  [
    "security.download-control.tenant",
    {
      status: "not-applicable-with-justification" as const,
      notApplicableJustification:
        "No organization-owned downloadable object exists in the current schema. Media delivery is isolated by user ownership or explicit profile/content audience, and account exports are current-user scoped; organization download isolation becomes mandatory before such an object is introduced.",
      evidence: DOWNLOAD_CONTROL_EVIDENCE,
    },
  ],
  verified("security.download-control.signed-url"),
  verified("security.download-control.disposition"),
  verified("security.download-control.mime"),
  verified("security.download-control.path"),
  verified("security.download-control.private-url"),
  verified("security.download-control.revocation"),
  verified("security.download-control.deleted-blocked"),
  verified("security.download-control.large-export-rate"),
]);
