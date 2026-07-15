/**
 * Binding Design Lab operating model.
 *
 * This source describes responsibilities and proof boundaries only. It never
 * proves that a Google Cloud service is deployed or that a release is ready.
 * Real managed-service parity is earned only in protected GCP staging.
 */

export const DESIGN_LAB_OPERATING_CAPABILITY_IDS = [
  "experience-simulation",
  "feature-proving",
  "training-video-studio",
  "preproduction-digital-twin",
  "production-operations-desk",
  "release-authority",
] as const;

export type DesignLabOperatingCapabilityId =
  (typeof DESIGN_LAB_OPERATING_CAPABILITY_IDS)[number];

export const DESIGN_LAB_ENVIRONMENT_IDS = [
  "local",
  "protected-gcp-staging",
  "production",
] as const;

export type DesignLabEnvironmentId =
  (typeof DESIGN_LAB_ENVIRONMENT_IDS)[number];

export const DESIGN_LAB_ADMIN_PLANE_IDS = [
  "standard-staff-admin",
  "founder-platform-owner",
] as const;

export type DesignLabAdminPlaneId =
  (typeof DESIGN_LAB_ADMIN_PLANE_IDS)[number];

export const DESIGN_LAB_PRODUCT_BOUNDARY_IDS = [
  "web",
  "ios-ipados",
  "android",
  "shared-backend",
] as const;

export type DesignLabProductBoundaryId =
  (typeof DESIGN_LAB_PRODUCT_BOUNDARY_IDS)[number];

/** Stable task IDs consumed by the pre-production release registry. */
export const DESIGN_LAB_OPERATING_MODEL_GATE_IDS = {
  simulation: "PREPROD.DESIGN_LAB.SIMULATION",
  training: "PREPROD.TRAINING.VIDEO_STUDIO",
  content: "PREPROD.CONTENT.CMS_BLOG_NEWS",
  support: "PREPROD.SUPPORT.FORUM_QA_REQUESTS",
  observability: "PREPROD.OBSERVABILITY.COST_DESK",
  migration: "PREPROD.DATA.ALLOYDB_BOOTSTRAP_PROVIDER_REHYDRATION",
  managedStaging: "PREPROD.GCP.MANAGED_SERVICE_PARITY",
  ownerAccess: "PREPROD.ACCESS.OWNER_CONTROL_PLANE",
  mobileBoundary: "PREPROD.MOBILE.SOURCE_DEPLOYMENT_BOUNDARY",
  mobileIdentity: "PREPROD.MOBILE.IDENTITY_NOTIFICATIONS",
  mobileRuntime: "PREPROD.MOBILE.OFFLINE_MEDIA_COMPATIBILITY",
  mobileRelease: "PREPROD.MOBILE.RELEASE_STORE_COMPLIANCE",
  mobileDeviceEvidence: "PREPROD.MOBILE.DEVICE_EVIDENCE",
} as const;

export type DesignLabOperatingModelGateId =
  (typeof DESIGN_LAB_OPERATING_MODEL_GATE_IDS)[keyof typeof DESIGN_LAB_OPERATING_MODEL_GATE_IDS];

type ManagedServiceBoundary = {
  database: string;
  apiGateway: string;
  edgeAndCdn: string;
};

export type DesignLabEnvironmentContract = {
  id: DesignLabEnvironmentId;
  label: string;
  posture: "simulation" | "managed-proof" | "live-operations";
  dataBoundary: string;
  designLabAccess: string;
  writePolicy:
    | "local-fixtures-only"
    | "controlled-staging-only"
    | "read-only-default";
  proofAuthority:
    | "simulation-only"
    | "managed-service-parity"
    | "operational-observation-only";
  realManagedServiceProof: boolean;
  services: ManagedServiceBoundary;
  allowedEvidence: readonly string[];
  prohibitedClaims: readonly string[];
};

/**
 * Environment matrix for local simulation, protected GCP proof and live
 * operations. Production is never an experimentation or parity-test target.
 */
export const DESIGN_LAB_ENVIRONMENTS: readonly DesignLabEnvironmentContract[] = [
  {
    id: "local",
    label: "Local Design Lab",
    posture: "simulation",
    dataBoundary:
      "Public racing-provider data and synthetic private fixtures only; no production database rows or credentials.",
    designLabAccess:
      "Developer-local access to synthetic fixtures and loopback services.",
    writePolicy: "local-fixtures-only",
    proofAuthority: "simulation-only",
    realManagedServiceProof: false,
    services: {
      database:
        "Loopback PostgreSQL compatibility simulation; this is not AlloyDB proof.",
      apiGateway:
        "OpenAPI, application proxy and local rate-limit simulation; this is not Cloud Endpoints ESPv2 proof.",
      edgeAndCdn:
        "Cache-header, route-policy and browser-cache simulation; this is not Cloud CDN or Cloud Armor proof.",
    },
    allowedEvidence: [
      "UI states and responsive experience",
      "Synthetic role and fixture journeys",
      "Application, Prisma and OpenAPI contract tests",
      "Deterministic training capture rehearsal",
    ],
    prohibitedClaims: [
      "AlloyDB compatibility verified",
      "API gateway parity verified",
      "Cloud CDN or Cloud Armor parity verified",
      "Production capacity or failover verified",
    ],
  },
  {
    id: "protected-gcp-staging",
    label: "Protected GCP staging",
    posture: "managed-proof",
    dataBoundary:
      "Synthetic private data plus approved public racing-provider data; there is no production customer dataset or Supabase database snapshot to migrate for MVP.",
    designLabAccess:
      "Protected workforce access through least privilege, JIT grants, reauthentication and auditable test runs.",
    writePolicy: "controlled-staging-only",
    proofAuthority: "managed-service-parity",
    realManagedServiceProof: true,
    services: {
      database:
        "Real AlloyDB for PostgreSQL rehearsal with Prisma, migrations, RLS, pooling, backup, restore and promotion tests.",
      apiGateway:
        "Real production-selected API gateway path using Cloud Endpoints with ESPv2 and the exact OpenAPI candidate.",
      edgeAndCdn:
        "Real external load balancer, Cloud Armor and allowlisted Cloud CDN behavior with origin isolation.",
    },
    allowedEvidence: [
      "Managed-service compatibility and policy tests",
      "Load, spike, soak, failure and recovery evidence",
      "Empty-database bootstrap and provider rehydration evidence",
      "Alert delivery, cost ceilings and incident-control exercises",
    ],
    prohibitedClaims: [
      "Production customer journey proven",
      "Production data copied into Design Lab",
      "Evidence applies to a different source or image digest",
    ],
  },
  {
    id: "production",
    label: "Production operations",
    posture: "live-operations",
    dataBoundary:
      "Live customer data remains inside production services; Design Lab receives only approved redacted operational metadata.",
    designLabAccess:
      "Read-only by default through the operations desk; privileged actions use separate protected workflows.",
    writePolicy: "read-only-default",
    proofAuthority: "operational-observation-only",
    realManagedServiceProof: false,
    services: {
      database:
        "Live AlloyDB target is observed through redacted health and SLO signals, never queried by Design Lab for feature proving.",
      apiGateway:
        "Live gateway is observed through redacted traffic, quota and error telemetry; policy changes require protected approval.",
      edgeAndCdn:
        "Live edge is observed through redacted cache, WAF and origin metrics; experiments and load tests are prohibited.",
    },
    allowedEvidence: [
      "Redacted SLO, incident, deployment and cost telemetry",
      "Immutable revision and evidence-digest binding",
      "Approved rollback and emergency-control outcomes",
    ],
    prohibitedClaims: [
      "Production is a test environment",
      "Design Lab UI can approve or execute a release",
      "Default production access permits writes",
      "Live customer rows may be copied for simulation or training",
    ],
  },
];

export type DesignLabOperatingCapability = {
  id: DesignLabOperatingCapabilityId;
  label: string;
  purpose: string;
  environments: readonly DesignLabEnvironmentId[];
  outputs: readonly string[];
  gateIds: readonly DesignLabOperatingModelGateId[];
  productionBoundary: string;
};

/** Six capabilities that together define what Design Lab owns and cannot do. */
export const DESIGN_LAB_OPERATING_CAPABILITIES: readonly DesignLabOperatingCapability[] = [
  {
    id: "experience-simulation",
    label: "Experience simulation",
    purpose:
      "Exercise complete user journeys, roles, fixtures, states and responsive layouts without customer data.",
    environments: ["local", "protected-gcp-staging"],
    outputs: [
      "Role and state scenario manifests",
      "Responsive and accessibility review evidence",
      "Synthetic journey defect reports",
    ],
    gateIds: [
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.simulation,
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileDeviceEvidence,
    ],
    productionBoundary:
      "Production may be observed through approved telemetry only; it is never the simulation target.",
  },
  {
    id: "feature-proving",
    label: "Feature proving",
    purpose:
      "Prove feature behavior, permissions, failure states and provider contracts before release.",
    environments: ["local", "protected-gcp-staging"],
    outputs: [
      "Executable acceptance evidence",
      "Negative authorization and recovery cases",
      "Candidate-bound provider and managed-service results",
    ],
    gateIds: [
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.simulation,
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.managedStaging,
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileIdentity,
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileRuntime,
    ],
    productionBoundary:
      "Local results prove source contracts only; real AlloyDB, gateway and CDN parity is staging-only.",
  },
  {
    id: "training-video-studio",
    label: "Training-video studio",
    purpose:
      "Turn approved deterministic captures into operator and customer training with governed scripts and narration.",
    environments: ["local", "protected-gcp-staging"],
    outputs: [
      "Source-bound capture manifests",
      "Remotion compositions",
      "ElevenLabs narration manifests",
      "Captioned, reviewed training artifacts",
    ],
    gateIds: [
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.training,
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileDeviceEvidence,
    ],
    productionBoundary:
      "Training captures use synthetic or approved masked fixtures and never record live customer sessions.",
  },
  {
    id: "preproduction-digital-twin",
    label: "Preproduction digital twin",
    purpose:
      "Rehearse the production-selected topology, migration, load, failure and recovery contracts safely.",
    environments: ["local", "protected-gcp-staging"],
    outputs: [
      "Environment-parity manifest",
      "Empty-database bootstrap and provider rehydration reconciliation",
      "Load, failover, restore and rollback evidence",
    ],
    gateIds: [
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.migration,
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.managedStaging,
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileRuntime,
    ],
    productionBoundary:
      "Only protected GCP staging can prove selected managed services; local remains a contract simulator.",
  },
  {
    id: "production-operations-desk",
    label: "Production operations desk",
    purpose:
      "Present redacted service health, incidents, costs, content and support queues with safe first actions.",
    environments: ["protected-gcp-staging", "production"],
    outputs: [
      "Read-only SLO and cost views",
      "Incident and rollback context",
      "Content, support and account-request queues",
    ],
    gateIds: [
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.content,
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.support,
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.observability,
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileRuntime,
    ],
    productionBoundary:
      "Production is read-only by default; every write leaves the desk for a protected, scoped workflow.",
  },
  {
    id: "release-authority",
    label: "Release authority",
    purpose:
      "Bind verified evidence to the exact commit, image, configuration and migration before human approval.",
    environments: ["protected-gcp-staging", "production"],
    outputs: [
      "Fail-closed release verdict",
      "Immutable candidate and evidence digest",
      "Protected approval and rollback record",
    ],
    gateIds: [
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.managedStaging,
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.ownerAccess,
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileBoundary,
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileRelease,
      DESIGN_LAB_OPERATING_MODEL_GATE_IDS.mobileDeviceEvidence,
    ],
    productionBoundary:
      "Design Lab reports readiness but cannot approve, self-promote or deploy; the protected GitHub production environment remains authoritative.",
  },
];

export const DESIGN_LAB_TRAINING_VIDEO_STUDIO = {
  captureManifestRequiredFields: [
    "captureId",
    "sourceSha",
    "candidateImageDigest",
    "route",
    "role",
    "fixtureId",
    "state",
    "viewport",
    "locale",
    "scriptPath",
    "frameManifestPath",
    "redactionReview",
    "capturedAt",
    "evidenceDigest",
  ],
  renderer: "Remotion",
  narrationProvider: "ElevenLabs",
  controls: [
    "Approved script and pronunciation review",
    "Non-secret voice-profile reference",
    "Synthetic or approved masked fixtures only",
    "Captions and accessibility review",
    "Candidate and asset digests",
    "Human editorial approval before publishing",
  ],
} as const;

type PrivilegedControlSet = {
  mfa: "phishing-resistant";
  reauthentication: true;
  justInTime: true;
  reasonRequired: true;
  auditRequired: true;
};

export type DesignLabAdminPlane = {
  id: DesignLabAdminPlaneId;
  label: string;
  scope: string;
  productionDefault: "read-only";
  canSelfPromote: false;
  roleManagement: "denied" | "two-person-jit-only";
  controls: PrivilegedControlSet;
  twoPersonApprovalFor: readonly ["destructive", "high-spend"];
  allowed: readonly string[];
  denied: readonly string[];
};

/** Two non-overlapping administration planes with no self-promotion path. */
export const DESIGN_LAB_ADMIN_PLANES: readonly DesignLabAdminPlane[] = [
  {
    id: "standard-staff-admin",
    label: "Scoped standard staff administration",
    scope:
      "Job-scoped moderation, content, support and account-request queues only.",
    productionDefault: "read-only",
    canSelfPromote: false,
    roleManagement: "denied",
    controls: {
      mfa: "phishing-resistant",
      reauthentication: true,
      justInTime: true,
      reasonRequired: true,
      auditRequired: true,
    },
    twoPersonApprovalFor: ["destructive", "high-spend"],
    allowed: [
      "Assigned queue reads",
      "Policy-bounded moderation and support actions after JIT elevation",
      "Redacted operational context required for the assigned task",
    ],
    denied: [
      "Role or IAM changes",
      "Self-promotion",
      "Direct database, secret or billing-owner access",
      "Unapproved destructive or high-spend execution",
    ],
  },
  {
    id: "founder-platform-owner",
    label: "Founder / platform-owner control plane",
    scope:
      "Platform-wide release, IAM, spend, resilience and emergency governance through a separate protected plane.",
    productionDefault: "read-only",
    canSelfPromote: false,
    roleManagement: "two-person-jit-only",
    controls: {
      mfa: "phishing-resistant",
      reauthentication: true,
      justInTime: true,
      reasonRequired: true,
      auditRequired: true,
    },
    twoPersonApprovalFor: ["destructive", "high-spend"],
    allowed: [
      "Read-only cross-system health and cost posture",
      "Time-bound predefined or custom-role elevation",
      "Protected release, rollback and emergency workflows",
    ],
    denied: [
      "Permanent primitive Owner or Editor access",
      "Self-promotion or self-approval",
      "Shared credentials or unmanaged service-account keys",
      "Direct production experimentation",
    ],
  },
];

export const DESIGN_LAB_BREAK_GLASS = {
  enabledByDefault: false,
  eligiblePlane: "founder-platform-owner" as const,
  activation: "Declared incident with two-person approval",
  maximumDurationMinutes: 60,
  controls: [
    "Separate phishing-resistant emergency identity",
    "Minimum scoped predefined or custom role",
    "Mandatory incident, reason and intended action",
    "Immediate security and on-call notification",
    "Immutable audit trail and session evidence",
    "Automatic expiry and credential revocation",
    "Post-incident review before closure",
  ],
} as const;

export const DESIGN_LAB_RELEASE_AUTHORITY = {
  authority: "GitHub protected production environment",
  designLabCanApprove: false,
  requiresImmutableCandidate: true,
  requiresEvidenceDigest: true,
  requiresSuccessfulCi: true,
  requiresHumanApproval: true,
  productionDefault: "read-only" as const,
} as const;

export type DesignLabProductBoundary = {
  id: DesignLabProductBoundaryId;
  label: string;
  clientKind: "web" | "native" | "service";
  sourceBoundary: string;
  deploymentBoundary: string;
  implementationAllowedInThisRepository: boolean;
  designLabResponsibility: string;
};

/**
 * Product source and deployment boundaries. Native clients are never embedded,
 * built or deployed from this Next.js web repository.
 */
export const DESIGN_LAB_PRODUCT_BOUNDARIES: readonly DesignLabProductBoundary[] = [
  {
    id: "web",
    label: "Web application",
    clientKind: "web",
    sourceBoundary: "Next.js web UI source in E:/greyhoundiq.",
    deploymentBoundary:
      "Web revision and static assets; excludes native packages and signing material.",
    implementationAllowedInThisRepository: true,
    designLabResponsibility:
      "Track responsive web journeys, contracts and release evidence.",
  },
  {
    id: "ios-ipados",
    label: "iOS and iPadOS application",
    clientKind: "native",
    sourceBoundary:
      "Separate native-client repository owned by the mobile team; no native source belongs in E:/greyhoundiq.",
    deploymentBoundary:
      "Independent Apple build, signing, TestFlight and App Store release pipeline.",
    implementationAllowedInThisRepository: false,
    designLabResponsibility:
      "Track shared-contract compatibility plus simulator and real-device evidence only.",
  },
  {
    id: "android",
    label: "Android phone and tablet application",
    clientKind: "native",
    sourceBoundary:
      "Separate native-client repository owned by the mobile team; no native source belongs in E:/greyhoundiq.",
    deploymentBoundary:
      "Independent Android build, signing, Play internal-test and production release pipeline.",
    implementationAllowedInThisRepository: false,
    designLabResponsibility:
      "Track shared-contract compatibility plus emulator and real-device evidence only.",
  },
  {
    id: "shared-backend",
    label: "Shared backend and API",
    clientKind: "service",
    sourceBoundary:
      "Server and API modules form a distinct source boundary; native clients consume published contracts, never server implementation.",
    deploymentBoundary:
      "Independent backend service and gateway revisions; never packaged into a client artifact.",
    implementationAllowedInThisRepository: true,
    designLabResponsibility:
      "Track API, auth, error, telemetry and compatibility contracts across every client.",
  },
];

/** The only implementation-neutral artifacts shared between product codebases. */
export const DESIGN_LAB_SHARED_CROSS_PRODUCT_ARTIFACTS = [
  "OpenAPI contract",
  "Generated request and response models",
  "Synthetic fixtures",
  "Authentication conventions",
  "Error contract",
  "Telemetry conventions",
  "Client and API compatibility matrix",
] as const;

export const DESIGN_LAB_FORBIDDEN_CROSS_PRODUCT_SHARING = [
  "Web or native UI implementation",
  "Native application source",
  "Signing credentials",
  "Store release credentials",
] as const;

/**
 * Cross-product mobile release contract. Store-policy details remain explicitly
 * pending an official-documentation review; this record does not invent policy.
 */
export const DESIGN_LAB_MOBILE_CONTRACT = {
  deliveryPhase: "post-mvp" as const,
  webMvpReleaseBlocking: false,
  deferralDecisionDate: "2026-07-15",
  platforms: ["ios", "ipados", "android-phone", "android-tablet"],
  accountOwnership: {
    appleDeveloper: "organisation-owned",
    googlePlayDeveloper: "organisation-owned",
    verification: "not-verified",
  },
  credentialBoundary: {
    signingAndReleaseSeparated: true,
    storedInWebRepository: false,
    designLabCanUseCredentials: false,
  },
  authentication: {
    protocol: "OIDC authorization code with PKCE",
    userAgent: "system browser",
    callbacks: "verified universal links and Android app links",
    tokenStorage: "platform secure storage (Keychain or Keystore)",
    sessionControls: [
      "refresh-token rotation",
      "server-side revocation",
      "lost-device session termination",
    ],
  },
  notifications: {
    providers: ["APNs", "FCM"],
    controls: [
      "per-device registration and revocation",
      "no sensitive content in notification payloads",
      "consent and preference enforcement",
    ],
  },
  runtimeProof: [
    "offline startup and cached-state boundaries",
    "reconnect and token-refresh storms",
    "background and foreground transitions",
    "media upload, playback and interruption recovery",
    "minimum-supported API compatibility and remote kill switch",
    "crash-free sessions and Android ANR telemetry",
  ],
  releaseTracks: [
    "TestFlight internal and staged rollout",
    "Play internal testing and staged rollout",
    "version halt, rollback and server-side compatibility controls",
  ],
  evidenceTargets: [
    "Design Lab simulator or emulator evidence",
    "real iPhone and iPad evidence",
    "real Android phone and tablet evidence",
  ],
  reviewAreas: [
    "privacy disclosures and data deletion",
    "moderation and account-request handling",
    "accessibility",
    "payment and subscription policy",
  ],
  storePolicyVerification: "pending-official-documentation-review",
  architectureDecision: {
    status: "undecided",
    requirement:
      "Native versus cross-platform implementation requires a separate reviewed ADR before a mobile codebase is created.",
  },
  externalMutationAllowed: false,
} as const;

/** Returns structural violations; every result is release-blocking. */
export function findDesignLabOperatingModelIssues() {
  const issues: string[] = [];
  const capabilityIds = DESIGN_LAB_OPERATING_CAPABILITIES.map((item) => item.id);
  const environmentIds = DESIGN_LAB_ENVIRONMENTS.map((item) => item.id);
  const planeIds = DESIGN_LAB_ADMIN_PLANES.map((item) => item.id);
  const productBoundaryIds = DESIGN_LAB_PRODUCT_BOUNDARIES.map(
    (item) => item.id,
  );
  const staging = DESIGN_LAB_ENVIRONMENTS.find(
    (item) => item.id === "protected-gcp-staging",
  );

  if (new Set(capabilityIds).size !== capabilityIds.length) {
    issues.push("Operating capability IDs are not unique.");
  }
  if (new Set(environmentIds).size !== environmentIds.length) {
    issues.push("Environment IDs are not unique.");
  }
  if (new Set(planeIds).size !== planeIds.length) {
    issues.push("Admin-plane IDs are not unique.");
  }
  if (new Set(productBoundaryIds).size !== productBoundaryIds.length) {
    issues.push("Product-boundary IDs are not unique.");
  }
  if (
    DESIGN_LAB_ENVIRONMENTS.some(
      (item) => item.realManagedServiceProof !== (item === staging),
    )
  ) {
    issues.push("Managed-service proof must be exclusive to protected GCP staging.");
  }
  if (
    DESIGN_LAB_ADMIN_PLANES.some(
      (plane) =>
        plane.canSelfPromote ||
        plane.productionDefault !== "read-only" ||
        !plane.controls.justInTime ||
        !plane.controls.reauthentication ||
        !plane.controls.reasonRequired ||
        !plane.controls.auditRequired,
    )
  ) {
    issues.push("An admin plane violates the privileged-access baseline.");
  }
  if (DESIGN_LAB_RELEASE_AUTHORITY.designLabCanApprove) {
    issues.push("Design Lab cannot be a production approval authority.");
  }
  if (
    DESIGN_LAB_PRODUCT_BOUNDARIES.some(
      (boundary) =>
        boundary.clientKind === "native" &&
        boundary.implementationAllowedInThisRepository,
    )
  ) {
    issues.push("Native client implementation cannot live in the web repository.");
  }
  if (
    DESIGN_LAB_MOBILE_CONTRACT.storePolicyVerification !==
      "pending-official-documentation-review" ||
    DESIGN_LAB_MOBILE_CONTRACT.externalMutationAllowed
  ) {
    issues.push("Mobile policy verification or external-mutation boundary drifted.");
  }
  const declaredGateIds = new Set(
    Object.values(DESIGN_LAB_OPERATING_MODEL_GATE_IDS),
  );
  const capabilityGateIds = new Set(
    DESIGN_LAB_OPERATING_CAPABILITIES.flatMap((item) => item.gateIds),
  );
  if (
    declaredGateIds.size !== capabilityGateIds.size ||
    [...declaredGateIds].some((gateId) => !capabilityGateIds.has(gateId))
  ) {
    issues.push("Operating-model gate IDs are not fully owned by capabilities.");
  }
  return issues;
}

export const DESIGN_LAB_OPERATING_MODEL_SUMMARY = Object.freeze({
  capabilities: DESIGN_LAB_OPERATING_CAPABILITIES.length,
  environments: DESIGN_LAB_ENVIRONMENTS.length,
  adminPlanes: DESIGN_LAB_ADMIN_PLANES.length,
  productBoundaries: DESIGN_LAB_PRODUCT_BOUNDARIES.length,
  managedProofEnvironments: DESIGN_LAB_ENVIRONMENTS.filter(
    (item) => item.realManagedServiceProof,
  ).length,
  gateTasks: Object.values(DESIGN_LAB_OPERATING_MODEL_GATE_IDS).length,
});
