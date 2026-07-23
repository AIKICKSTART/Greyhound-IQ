import {
  DEMO_ROUTE_AUDIT_EXPECTED_ROWS,
  DEMO_ROUTE_AUDIT_EVALUATION,
  DEMO_SCREEN_COUNT,
  DEMO_SCREEN_FAMILIES,
  DEMO_USER_JOURNEYS,
  SCREEN_CONTRACT_CHECKLIST,
  SCREEN_CONTRACT_BY_ROUTE,
} from "./demo-experience-registry";
import { evaluateDemoRouteAuditEvidence } from "./demo-route-audit-evidence";
import {
  DESIGN_LAB_DELIVERY_PROGRESS,
  DESIGN_LAB_DELIVERY_PROGRESS_SUMMARY,
  type DesignLabDeliveryProgressItem,
} from "./design-lab-delivery-progress";
import { GREYHOUNDIQ_ARCHITECTURE_TASK_SUMMARY } from "./design-lab-architecture-plan";
import { ADVERTISING_PRODUCT_SUMMARY } from "./advertising-product-contract";
import {
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS,
  DESIGN_LAB_PREPRODUCTION_SUMMARY,
  isDesignLabPreproductionRequirementComplete,
} from "./design-lab-preproduction-requirements";
import {
  DESIGN_LAB_COMPLETE_AWAITING_VERIFICATION_WORK,
  DESIGN_LAB_PENDING_WORK_SUMMARY,
  DESIGN_LAB_VERIFICATION_REFRESH_WORKFLOW,
  findDesignLabPendingWorkIssues,
} from "./design-lab-pending-work";
import {
  DESIGN_LAB_RELEASE_GATE,
  type DesignLabReleaseGateStatus,
} from "./design-lab-release-gate";
import {
  DESIGN_LAB_AREAS,
  type DesignLabAreaId,
} from "./design-lab-workspace";
import {
  MASTER_AUDIT_REQUIREMENTS,
  MASTER_AUDIT_SUMMARY,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import {
  DESIGN_LAB_DATABASE_CONTRACT_SUMMARY,
  isDesignLabDatabaseOperationComplete,
} from "./design-lab-database-contracts";
import {
  DESIGN_LAB_USER_STORY_MANIFESTS,
  type DesignLabUserStoryManifest,
} from "./screen-contracts/design-lab-user-stories";
import { DATABASE_OPERATIONS } from "../../security/database-operations";
import { DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY } from "../../security/local-data-policy";

export type DesignLabSyncSectionStatus = "complete" | "open" | "blocked";

export type DesignLabSyncSection = {
  id: string;
  title: string;
  completed: number;
  total: number;
  blocked: number;
  status: DesignLabSyncSectionStatus;
};

export type DesignLabMissionControlState =
  | "complete"
  | "active"
  | "blocked";

export type DesignLabMissionControlStatus = {
  state: DesignLabMissionControlState;
  badge: string;
  detail: string;
};

export type DesignLabReleaseEvidenceState =
  | "fresh-verified"
  | "stale-captured"
  | "open"
  | "blocked";

export type DesignLabReleaseEvidenceCapture = {
  id: string;
  label: string;
  evidencePath: string;
  state: DesignLabReleaseEvidenceState;
};

export const DESIGN_LAB_DEPLOYMENT_TARGET = Object.freeze({
  date: "2026-07-15",
  window: "Tonight",
  timezone: "Australia/Sydney",
  classification: "operator target",
  teamSeats: 4,
  condition:
    "Promote only when the exact immutable candidate passes the fail-closed release gate and receives human approval.",
});

export const DESIGN_LAB_RELEASE_EVIDENCE_SNAPSHOT: readonly DesignLabReleaseEvidenceCapture[] =
  Object.freeze([
    {
      id: "exact-route",
      label: "Exact-route browser audit",
      evidencePath: "output/demo-route-audit/latest.json",
      state:
        DEMO_ROUTE_AUDIT_EVALUATION.valid &&
        DEMO_ROUTE_AUDIT_EVALUATION.summary?.failed === 0
          ? "stale-captured"
          : "open",
    },
    {
      id: "responsive-workspace",
      label: "Responsive workspace audit",
      evidencePath: "output/design-lab-responsive-workspace/latest.json",
      state: "stale-captured",
    },
    {
      id: "user-stories",
      label: "User-story HTTP audit",
      evidencePath: "output/demo-route-audit/design-lab-user-stories.json",
      state: "stale-captured",
    },
    {
      id: "hydrated-stories",
      label: "Hydrated user-story audit",
      evidencePath: "output/demo-route-audit/design-lab-hydrated-stories.json",
      state: "stale-captured",
    },
    {
      id: "hydrated-wave2",
      label: "Hydrated wave 2 audit",
      evidencePath: "output/demo-route-audit/design-lab-hydrated-wave2.json",
      state: "stale-captured",
    },
  ]);

const releaseEvidenceSummary = Object.freeze({
  total: DESIGN_LAB_RELEASE_EVIDENCE_SNAPSHOT.length,
  freshVerified: DESIGN_LAB_RELEASE_EVIDENCE_SNAPSHOT.filter(
    (capture) => capture.state === "fresh-verified",
  ).length,
  staleCaptured: DESIGN_LAB_RELEASE_EVIDENCE_SNAPSHOT.filter(
    (capture) => capture.state === "stale-captured",
  ).length,
  open: DESIGN_LAB_RELEASE_EVIDENCE_SNAPSHOT.filter(
    (capture) => capture.state === "open",
  ).length,
  blocked: DESIGN_LAB_RELEASE_EVIDENCE_SNAPSHOT.filter(
    (capture) => capture.state === "blocked",
  ).length,
});

export function resolveDesignLabSyncReleaseStatus(
  registryStatus: DesignLabReleaseGateStatus,
  evidence: Pick<typeof releaseEvidenceSummary, "freshVerified" | "total">,
): DesignLabReleaseGateStatus {
  return registryStatus === "ready-for-approval" &&
    evidence.total > 0 &&
    evidence.freshVerified === evidence.total
    ? "ready-for-approval"
    : "blocked";
}

function section(
  id: string,
  title: string,
  completed: number,
  total: number,
  blocked = 0
): DesignLabSyncSection {
  return {
    id,
    title,
    completed,
    total,
    blocked,
    status:
      completed === total && blocked === 0
        ? "complete"
        : blocked > 0
          ? "blocked"
          : "open",
  };
}

const releaseRequirements = MASTER_AUDIT_REQUIREMENTS.filter(
  (requirement) => requirement.releaseBlocking
);
const releasePreproductionRequirements =
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.filter(
    (requirement) => requirement.releaseBlocking,
  );

export const DESIGN_LAB_SYNC_SECTIONS: readonly DesignLabSyncSection[] = [
  ...SCREEN_CONTRACT_CHECKLIST.map((item) =>
    section(
      `screen:${item.area}`,
      `Screen contract · ${item.area}`,
      item.completed,
      item.total,
      item.blocked
    )
  ),
  ...(["product", "security"] as const).map((prompt) => {
    const requirements = releaseRequirements.filter(
      (requirement) => requirement.prompt === prompt
    );
    return section(
      `master:${prompt}`,
      `${prompt[0].toUpperCase()}${prompt.slice(1)} master requirements`,
      requirements.filter(isMasterRequirementComplete).length,
      requirements.length
    );
  }),
  ...[
    ...new Set(
      releasePreproductionRequirements.map((requirement) =>
        requirement.system
      )
    ),
  ].map((system) => {
    const requirements = releasePreproductionRequirements.filter(
      (requirement) => requirement.system === system
    );
    return section(
      `preproduction:${system}`,
      `Pre-production · ${system}`,
      requirements.filter(isDesignLabPreproductionRequirementComplete).length,
      requirements.length,
      requirements.filter((requirement) => requirement.status === "blocked")
        .length
    );
  }),
  section(
    "database:operations",
    "Database operation contracts",
    DATABASE_OPERATIONS.filter(isDesignLabDatabaseOperationComplete).length,
    DATABASE_OPERATIONS.length
  ),
] as const;

const releaseOpenChecks =
  DESIGN_LAB_RELEASE_GATE.totalChecks -
  DESIGN_LAB_RELEASE_GATE.completedChecks;
const releaseAwaitingVerificationChecks =
  DESIGN_LAB_COMPLETE_AWAITING_VERIFICATION_WORK.length;
const releaseImplementationOpenChecks =
  releaseOpenChecks - releaseAwaitingVerificationChecks;
const designLabSyncReleaseStatus = resolveDesignLabSyncReleaseStatus(
  DESIGN_LAB_RELEASE_GATE.status,
  releaseEvidenceSummary,
);
const screenSections = DESIGN_LAB_SYNC_SECTIONS.filter((item) =>
  item.id.startsWith("screen:"),
);
const screenCompleted = screenSections.reduce(
  (total, item) => total + item.completed,
  0,
);
const screenTotal = screenSections.reduce(
  (total, item) => total + item.total,
  0,
);
const screenBlocked = screenSections.reduce(
  (total, item) => total + item.blocked,
  0,
);
const advertisingSection = DESIGN_LAB_SYNC_SECTIONS.find(
  (item) => item.id === "preproduction:advertising",
);
const registrySyncWorkstream = DESIGN_LAB_DELIVERY_PROGRESS.find(
  (item) => item.id === "WORK.DESIGN-LAB.SYNC",
);

export const DESIGN_LAB_MISSION_CONTROL_STATUS = Object.freeze({
  overview: missionStatus(
    designLabSyncReleaseStatus === "ready-for-approval"
      ? "complete"
      : "blocked",
    `${releaseOpenChecks.toLocaleString("en-AU")} MVP open`,
    `${DESIGN_LAB_RELEASE_GATE.completedChecks.toLocaleString("en-AU")}/${DESIGN_LAB_RELEASE_GATE.totalChecks.toLocaleString("en-AU")} verified`,
  ),
  delivery: missionStatus(
    DESIGN_LAB_DELIVERY_PROGRESS_SUMMARY.verified ===
      DESIGN_LAB_DELIVERY_PROGRESS_SUMMARY.total
      ? "complete"
      : DESIGN_LAB_DELIVERY_PROGRESS_SUMMARY.blocked > 0
        ? "blocked"
        : "active",
    `${DESIGN_LAB_DELIVERY_PROGRESS_SUMMARY.active} active`,
    `${DESIGN_LAB_DELIVERY_PROGRESS_SUMMARY.verified}/${DESIGN_LAB_DELIVERY_PROGRESS_SUMMARY.total} workstreams verified · ${DESIGN_LAB_DELIVERY_PROGRESS_SUMMARY.blocked} blocked`,
  ),
  architecture: missionStatus(
    GREYHOUNDIQ_ARCHITECTURE_TASK_SUMMARY.releaseReady
      ? "complete"
      : GREYHOUNDIQ_ARCHITECTURE_TASK_SUMMARY.blocked > 0
        ? "blocked"
        : "active",
    `${GREYHOUNDIQ_ARCHITECTURE_TASK_SUMMARY.verified}/${GREYHOUNDIQ_ARCHITECTURE_TASK_SUMMARY.total} verified`,
    `${GREYHOUNDIQ_ARCHITECTURE_TASK_SUMMARY.inProgress} active · ${GREYHOUNDIQ_ARCHITECTURE_TASK_SUMMARY.planned} planned · ${GREYHOUNDIQ_ARCHITECTURE_TASK_SUMMARY.blocked} blocked`,
  ),
  advertising: missionStatus(
    advertisingSection?.status === "complete" ? "complete" : "active",
    `${advertisingSection?.completed ?? 0}/${advertisingSection?.total ?? 0} verified`,
    `${ADVERTISING_PRODUCT_SUMMARY.userStories} stories · ${ADVERTISING_PRODUCT_SUMMARY.acceptanceScenarios} scenarios · ${ADVERTISING_PRODUCT_SUMMARY.status.replaceAll("-", " ")}`,
  ),
  requirements: missionStatus(
    DESIGN_LAB_RELEASE_GATE.status === "ready-for-approval"
      ? "complete"
      : "blocked",
    `${DESIGN_LAB_PENDING_WORK_SUMMARY.release.pending.toLocaleString("en-AU")} MVP open`,
    `${DESIGN_LAB_PENDING_WORK_SUMMARY.deferred.pending} post-MVP / scale open`,
  ),
  readiness: missionStatus(
    DESIGN_LAB_PREPRODUCTION_SUMMARY.releaseComplete ===
      DESIGN_LAB_PREPRODUCTION_SUMMARY.releaseTotal
      ? "complete"
      : DESIGN_LAB_PREPRODUCTION_SUMMARY.releaseBlocked > 0
        ? "blocked"
        : "active",
    `${DESIGN_LAB_PREPRODUCTION_SUMMARY.releaseComplete}/${DESIGN_LAB_PREPRODUCTION_SUMMARY.releaseTotal} verified`,
    `${DESIGN_LAB_PREPRODUCTION_SUMMARY.postMvpTotal} native post-MVP · ${DESIGN_LAB_PREPRODUCTION_SUMMARY.releaseBlocked} blocked`,
  ),
  screens: missionStatus(
    screenCompleted === screenTotal
      ? "complete"
      : screenBlocked > 0
        ? "blocked"
        : "active",
    `${screenCompleted.toLocaleString("en-AU")}/${screenTotal.toLocaleString("en-AU")} verified`,
    `${(screenTotal - screenCompleted).toLocaleString("en-AU")} open across ${DEMO_SCREEN_COUNT} routes`,
  ),
} satisfies Record<DesignLabAreaId, DesignLabMissionControlStatus>);

function missionStatus(
  state: DesignLabMissionControlState,
  badge: string,
  detail: string,
): DesignLabMissionControlStatus {
  return Object.freeze({ state, badge, detail });
}

export const DESIGN_LAB_SYNC_SNAPSHOT = Object.freeze({
  schemaVersion: 5,
  sourceOfTruth: "Design Lab release registries",
  deploymentTarget: DESIGN_LAB_DEPLOYMENT_TARGET,
  release: Object.freeze({
    status: designLabSyncReleaseStatus,
    registryStatus: DESIGN_LAB_RELEASE_GATE.status,
    completedChecks: DESIGN_LAB_RELEASE_GATE.completedChecks,
    totalChecks: DESIGN_LAB_RELEASE_GATE.totalChecks,
    openChecks: releaseOpenChecks,
    awaitingVerificationChecks: releaseAwaitingVerificationChecks,
    implementationOpenChecks: releaseImplementationOpenChecks,
    awaitingVerification: Object.freeze({
      total: DESIGN_LAB_COMPLETE_AWAITING_VERIFICATION_WORK.length,
      itemIds: Object.freeze(
        DESIGN_LAB_COMPLETE_AWAITING_VERIFICATION_WORK.map((item) => item.id),
      ),
      refreshWorkflow: DESIGN_LAB_VERIFICATION_REFRESH_WORKFLOW,
    }),
    evidence: Object.freeze({
      ...releaseEvidenceSummary,
      captures: DESIGN_LAB_RELEASE_EVIDENCE_SNAPSHOT,
    }),
    blockers: DESIGN_LAB_RELEASE_GATE.blockers,
    masterBlockers: DESIGN_LAB_RELEASE_GATE.masterBlockers,
    preproductionBlockers: DESIGN_LAB_RELEASE_GATE.preproductionBlockers,
    databaseBlocker: DESIGN_LAB_RELEASE_GATE.databaseBlocker,
  }),
  sections: DESIGN_LAB_SYNC_SECTIONS,
  sectionSummary: Object.freeze({
    total: DESIGN_LAB_SYNC_SECTIONS.length,
    complete: DESIGN_LAB_SYNC_SECTIONS.filter(
      (item) => item.status === "complete"
    ).length,
    open: DESIGN_LAB_SYNC_SECTIONS.filter((item) => item.status === "open")
      .length,
    blocked: DESIGN_LAB_SYNC_SECTIONS.filter(
      (item) => item.status === "blocked"
    ).length,
  }),
  workstreams: DESIGN_LAB_DELIVERY_PROGRESS_SUMMARY,
  registrySync: Object.freeze({
    status: registrySyncWorkstream?.status ?? "unreported",
  }),
  missionControl: DESIGN_LAB_MISSION_CONTROL_STATUS,
  backlog: DESIGN_LAB_PENDING_WORK_SUMMARY,
  inventory: Object.freeze({
    screens: DEMO_SCREEN_COUNT,
    families: DEMO_SCREEN_FAMILIES.length,
    journeys: DEMO_USER_JOURNEYS.length,
  }),
  master: MASTER_AUDIT_SUMMARY,
  preproduction: DESIGN_LAB_PREPRODUCTION_SUMMARY,
  database: DESIGN_LAB_DATABASE_CONTRACT_SUMMARY,
  localData: DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY,
});

export function findDesignLabRegistrySyncIssues({
  progress = DESIGN_LAB_DELIVERY_PROGRESS,
  sections = DESIGN_LAB_SYNC_SECTIONS,
  storyManifests = DESIGN_LAB_USER_STORY_MANIFESTS,
}: {
  progress?: readonly DesignLabDeliveryProgressItem[];
  sections?: readonly DesignLabSyncSection[];
  storyManifests?: readonly DesignLabUserStoryManifest[];
} = {}) {
  const issues: string[] = [];
  issues.push(...findDesignLabPendingWorkIssues());
  const progressIds = progress.map((item) => item.id);
  const sectionIds = sections.map((item) => item.id);
  const sectionCompleted = sections.reduce(
    (total, item) => total + item.completed,
    0
  );
  const sectionTotal = sections.reduce((total, item) => total + item.total, 0);

  if (new Set(progressIds).size !== progressIds.length) {
    issues.push("Delivery workstream IDs are not unique.");
  }
  if (new Set(sectionIds).size !== sectionIds.length) {
    issues.push("Canonical section IDs are not unique.");
  }
  if (sectionCompleted !== DESIGN_LAB_RELEASE_GATE.completedChecks) {
    issues.push(
      `Section completed total ${sectionCompleted} disagrees with release gate ${DESIGN_LAB_RELEASE_GATE.completedChecks}.`
    );
  }
  if (sectionTotal !== DESIGN_LAB_RELEASE_GATE.totalChecks) {
    issues.push(
      `Section requirement total ${sectionTotal} disagrees with release gate ${DESIGN_LAB_RELEASE_GATE.totalChecks}.`
    );
  }
  if (
    DESIGN_LAB_PENDING_WORK_SUMMARY.release.total !==
      DESIGN_LAB_RELEASE_GATE.totalChecks ||
    DESIGN_LAB_PENDING_WORK_SUMMARY.release.complete !==
      DESIGN_LAB_RELEASE_GATE.completedChecks ||
    DESIGN_LAB_PENDING_WORK_SUMMARY.release.pending !== releaseOpenChecks
  ) {
    issues.push(
      "Mission Control MVP backlog disagrees with the canonical release gate.",
    );
  }
  if (
    DESIGN_LAB_PENDING_WORK_SUMMARY.pending !==
    DESIGN_LAB_PENDING_WORK_SUMMARY.release.pending +
      DESIGN_LAB_PENDING_WORK_SUMMARY.deferred.pending
  ) {
    issues.push(
      "All-phase pending work does not equal MVP plus post-MVP/scale work.",
    );
  }
  const missionAreaIds = Object.keys(DESIGN_LAB_MISSION_CONTROL_STATUS);
  const workspaceAreaIds = DESIGN_LAB_AREAS.map((area) => area.id);
  if (
    missionAreaIds.length !== workspaceAreaIds.length ||
    missionAreaIds.some((id) => !workspaceAreaIds.includes(id as DesignLabAreaId))
  ) {
    issues.push(
      "Mission Control status coverage does not exactly match its seven areas.",
    );
  }
  if (!advertisingSection || advertisingSection.total !== 1) {
    issues.push(
      "Advertising must remain represented by one release-blocking end-to-end MVP gate.",
    );
  }
  if (
    GREYHOUNDIQ_ARCHITECTURE_TASK_SUMMARY.verified +
      GREYHOUNDIQ_ARCHITECTURE_TASK_SUMMARY.inProgress +
      GREYHOUNDIQ_ARCHITECTURE_TASK_SUMMARY.planned +
      GREYHOUNDIQ_ARCHITECTURE_TASK_SUMMARY.blocked !==
    GREYHOUNDIQ_ARCHITECTURE_TASK_SUMMARY.total
  ) {
    issues.push("Architecture task states do not add up to the roadmap total.");
  }

  const checkedScreenSections = sections.filter((item) =>
    item.id.startsWith("screen:"),
  );
  if (
    checkedScreenSections.length !== SCREEN_CONTRACT_CHECKLIST.length ||
    checkedScreenSections.some((item) => item.total !== DEMO_SCREEN_COUNT)
  ) {
    issues.push("Visible screen inventory disagrees with screen-contract sections.");
  }
  if (
    DEMO_SCREEN_FAMILIES.flatMap((family) => family.screens).length !==
      DEMO_SCREEN_COUNT ||
    DESIGN_LAB_SYNC_SNAPSHOT.inventory.families !==
      DEMO_SCREEN_FAMILIES.length ||
    DESIGN_LAB_SYNC_SNAPSHOT.inventory.journeys !== DEMO_USER_JOURNEYS.length
  ) {
    issues.push("Visible screen, family or journey inventory is out of sync.");
  }

  const masterSections = sections.filter((item) => item.id.startsWith("master:"));
  if (
    masterSections.reduce((total, item) => total + item.total, 0) !==
      MASTER_AUDIT_SUMMARY.releaseBlocking ||
    masterSections.reduce((total, item) => total + item.completed, 0) !==
      MASTER_AUDIT_SUMMARY.releaseCompleted
  ) {
    issues.push("Master-audit summary disagrees with canonical master sections.");
  }
  const preproductionSections = sections.filter((item) =>
    item.id.startsWith("preproduction:")
  );
  if (
    preproductionSections.reduce((total, item) => total + item.total, 0) !==
      DESIGN_LAB_PREPRODUCTION_SUMMARY.releaseTotal ||
    preproductionSections.reduce((total, item) => total + item.completed, 0) !==
      DESIGN_LAB_PREPRODUCTION_SUMMARY.releaseComplete ||
    preproductionSections.reduce((total, item) => total + item.blocked, 0) !==
      DESIGN_LAB_PREPRODUCTION_SUMMARY.releaseBlocked
  ) {
    issues.push(
      "Pre-production summary disagrees with canonical pre-production sections."
    );
  }
  const databaseSection = sections.find(
    (item) => item.id === "database:operations"
  );
  if (
    !databaseSection ||
    databaseSection.total !== DESIGN_LAB_DATABASE_CONTRACT_SUMMARY.total ||
    databaseSection.completed !== DESIGN_LAB_DATABASE_CONTRACT_SUMMARY.complete
  ) {
    issues.push("Database summary disagrees with its canonical section.");
  }
  const localDataClassified =
    DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY.providerPublic +
    DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY.providerMetadataOnly +
    DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY.referenceSeed +
    DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY.syntheticOnly +
    DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY.localDerived;
  if (
    localDataClassified !== DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY.totalModels ||
    DESIGN_LAB_LOCAL_DATA_POLICY_SUMMARY.productionDatabaseCopyAllowed !== 0
  ) {
    issues.push("Visible local-data policy summary is internally inconsistent.");
  }

  for (const item of progress) {
    if (item.evidence.length === 0) {
      issues.push(`${item.id} has no evidence paths.`);
    }
    if (item.status === "verified") {
      if (item.verification.length === 0) {
        issues.push(`${item.id} is verified without a verification record.`);
      }
      if (item.verificationOutcome !== "pass") {
        issues.push(`${item.id} is verified without a passing outcome.`);
      }
      if (item.nextStep?.trim()) {
        issues.push(`${item.id} is verified but still has a next step.`);
      }
    } else if (!item.nextStep?.trim()) {
      issues.push(`${item.id} is ${item.status} without a next step.`);
    } else if (item.verificationOutcome === "pass") {
      issues.push(`${item.id} has a passing outcome but is not verified.`);
    }
  }

  const staticAuditRequirement = DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.find(
    (requirement) => requirement.id === "PREPROD.API.STATIC_CONTRACT_AUDIT"
  );
  const staticAuditWorkstream = progress.find(
    (item) => item.id === "WORK.API.STATIC-AUDIT"
  );
  if (!staticAuditRequirement || !staticAuditWorkstream) {
    issues.push("Static API audit requirement and workstream must both exist.");
  } else {
    const complete = isDesignLabPreproductionRequirementComplete(
      staticAuditRequirement
    );
    if ((staticAuditWorkstream.status === "verified") !== complete) {
      issues.push(
        "Static API audit workstream disagrees with its pre-production completion authority."
      );
    }
  }

  const designLabFamily = DEMO_SCREEN_FAMILIES.find(
    (family) => family.key === "design-lab"
  );
  const storyWorkstream = progress.find(
    (item) => item.id === "WORK.SCREENS.USER-STORIES"
  );
  if (!designLabFamily || !storyWorkstream) {
    issues.push("Design Lab family and user-story workstream must both exist.");
  } else {
    const expectedRoutes = designLabFamily.screens
      .map((screen) => screen.route)
      .toSorted();
    const manifestRoutes = storyManifests
      .map((manifest) => manifest.route)
      .toSorted();
    const exactManifestInventory =
      new Set(manifestRoutes).size === manifestRoutes.length &&
      manifestRoutes.length === expectedRoutes.length &&
      manifestRoutes.every((route, index) => route === expectedRoutes[index]);
    if (!exactManifestInventory) {
      issues.push(
        "Design Lab user-story manifests do not exactly cover the Design Lab route inventory."
      );
    }
    const registryComplete = designLabFamily.screens.every((screen) => {
      const status = SCREEN_CONTRACT_BY_ROUTE.get(screen.route)?.coverage
        .userStories.status;
      return status === "verified" || status === "tested" || status === "excluded";
    });
    const manifestComplete = exactManifestInventory && storyManifests.every(
      (manifest) => {
        const status = manifest.coverage.userStories.status;
        return status === "verified" || status === "tested" || status === "excluded";
      }
    );
    if (
      (storyWorkstream.status === "verified") !==
      (registryComplete && manifestComplete)
    ) {
      issues.push(
        "Design Lab user-story workstream disagrees with its exact manifests and screen-contract coverage."
      );
    }
  }

  const summary = {
    total: progress.length,
    verified: progress.filter((item) => item.status === "verified").length,
    active: progress.filter((item) => item.status === "in-progress").length,
    waiting: progress.filter(
      (item) => item.status === "waiting"
    ).length,
    blocked: progress.filter((item) => item.status === "blocked").length,
  };
  for (const key of Object.keys(summary) as (keyof typeof summary)[]) {
    if (summary[key] !== DESIGN_LAB_DELIVERY_PROGRESS_SUMMARY[key]) {
      issues.push(
        `Delivery ${key} ${summary[key]} disagrees with summary ${DESIGN_LAB_DELIVERY_PROGRESS_SUMMARY[key]}.`
      );
    }
  }

  return issues;
}

export function findDesignLabRouteAuditSyncIssues(
  audit: unknown,
  routeWorkstream = DESIGN_LAB_DELIVERY_PROGRESS.find(
    (item) => item.id === "WORK.ROUTES.EXACT-AUDIT"
  ),
  routeSection = DESIGN_LAB_SYNC_SECTIONS.find(
    (item) => item.id === "screen:route"
  )
) {
  const evaluation = evaluateDemoRouteAuditEvidence(
    audit,
    DEMO_ROUTE_AUDIT_EXPECTED_ROWS
  );
  const issues = [...evaluation.structuralIssues];

  if (!routeWorkstream) {
    issues.push("WORK.ROUTES.EXACT-AUDIT is missing.");
    return issues;
  }
  if (!routeSection) {
    issues.push("screen:route canonical section is missing.");
    return issues;
  }
  if (routeSection.total !== DEMO_ROUTE_AUDIT_EXPECTED_ROWS.length) {
    issues.push("screen:route total disagrees with the exact route inventory.");
  }
  if (routeSection.completed !== evaluation.passedRoutes.length) {
    issues.push(
      `screen:route reports ${routeSection.completed} complete while validated audit evidence proves ${evaluation.passedRoutes.length}.`
    );
  }

  const exactPass =
    evaluation.valid &&
    evaluation.passedRoutes.length === DEMO_ROUTE_AUDIT_EXPECTED_ROWS.length &&
    evaluation.failedRoutes.length === 0;
  if (routeWorkstream.status === "verified" && !exactPass) {
    issues.push("Exact-route workstream is verified without an exact full pass.");
  }
  if (exactPass && routeWorkstream.status !== "verified") {
    issues.push("Exact-route audit is a full pass but its workstream is not verified.");
  }

  return issues;
}
