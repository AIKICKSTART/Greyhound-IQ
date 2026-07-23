export const VERIFIED_EXTERNAL_LINK_EMBED_IDS = [
  "security.external-link-embed.scheme",
  "security.external-link-embed.noopener",
  "security.external-link-embed.referrer",
  "security.external-link-embed.embed-allowlist",
  "security.external-link-embed.sandbox",
  "security.external-link-embed.no-user-script",
] as const;

export const EXTERNAL_LINK_EMBED_EVIDENCE_PATHS = [
  "src/lib/account-validation.ts",
  "src/lib/custom-page-validation.ts",
  "src/lib/link-preview.ts",
  "src/lib/live/race-replay.ts",
  "src/lib/csp.ts",
  "src/app/races/[id]/page.tsx",
  "src/components/feed-post-card.tsx",
  "src/components/json-ld.tsx",
  "security/external-link-embed-evidence.test.ts",
] as const;

export const EXTERNAL_LINK_EMBED_MASTER_EVIDENCE = {
  ...Object.fromEntries(
    VERIFIED_EXTERNAL_LINK_EMBED_IDS.map((requirementId) => [
      requirementId,
      {
        status: "verified" as const,
        evidence: EXTERNAL_LINK_EMBED_EVIDENCE_PATHS,
      },
    ]),
  ),
  "security.external-link-embed.sri": {
    status: "not-applicable-with-justification" as const,
    evidence: EXTERNAL_LINK_EMBED_EVIDENCE_PATHS,
    notApplicableJustification:
      "The production source under src/, public/, and next.config.ts does not load a static third-party script or stylesheet. Dependencies are bundled and served from the application origin, so there is currently no browser-fetched asset to which SRI can be applied; the focused source scan fails if one is introduced.",
  },
} as const;
