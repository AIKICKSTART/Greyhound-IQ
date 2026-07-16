import {
  SCREEN_CONTRACT_COVERAGE_AREAS,
  SCREEN_CONTRACTS,
  type ScreenContractCoverageStatus,
} from "./demo-experience-registry";
import {
  DESIGN_LAB_PREPRODUCTION_REQUIREMENTS,
  isDesignLabPreproductionRequirementComplete,
} from "./design-lab-preproduction-requirements";
import { DESIGN_LAB_RELEASE_GATE } from "./design-lab-release-gate";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import {
  DATABASE_OPERATIONS,
  type DatabaseOperationContract,
} from "../../security/database-operations";
import { isDesignLabDatabaseOperationComplete } from "./design-lab-database-contracts";
import { DESIGN_LAB_DATABASE_NORMALIZATION_REQUIREMENTS } from "./design-lab-database-normalization-requirements";

export const DESIGN_LAB_PENDING_WORK_SOURCES = [
  "screen",
  "master",
  "preproduction",
  "database",
] as const;

export type DesignLabPendingWorkSource =
  (typeof DESIGN_LAB_PENDING_WORK_SOURCES)[number];

export type DesignLabPendingWorkItem = {
  id: string;
  source: DesignLabPendingWorkSource;
  title: string;
  description: string;
  productArea: string;
  owner: string;
  status: string;
  complete: boolean;
  blocked: boolean;
  releaseBlocking: boolean;
  evidence: readonly string[];
  roles: readonly string[];
  screen: string | null;
  dependencies: readonly string[];
};

export type DesignLabPendingWorkFilters = {
  completion?:
    | "all"
    | "pending"
    | "complete"
    | "awaiting-verification"
    | "blocked";
  source?: "all" | DesignLabPendingWorkSource;
  productArea?: string;
  owner?: string;
  role?: string;
  screen?: string;
  dependency?: string;
  query?: string;
};

const COMPLETE_SCREEN_STATUSES: readonly ScreenContractCoverageStatus[] = [
  "verified",
  "tested",
  "excluded",
];

const screenWork = SCREEN_CONTRACTS.flatMap((screen) =>
  SCREEN_CONTRACT_COVERAGE_AREAS.map((area): DesignLabPendingWorkItem => {
    const claim = screen.coverage[area];
    const complete = COMPLETE_SCREEN_STATUSES.includes(claim.status);
    return {
      id: `screen:${screen.id}:${area}`,
      source: "screen",
      title: `${screen.title} · ${area}`,
      description: `${screen.route} must have ${area} evidence that satisfies the screen-contract completion rule.`,
      productArea: screen.productArea,
      owner: "Screen-contract owner",
      status: claim.status,
      complete,
      blocked: claim.status === "blocked",
      releaseBlocking: true,
      evidence: claim.evidence,
      roles: unique([...screen.roles, ...screen.actors]),
      screen: screen.route,
      dependencies: unique(screen.dataDependencies),
    };
  }),
);

const masterWork = MASTER_AUDIT_REQUIREMENTS.filter(
  (requirement) => requirement.releaseBlocking,
).map(
  (requirement): DesignLabPendingWorkItem => ({
    id: `master:${requirement.id}`,
    source: "master",
    title: requirement.id,
    description: requirement.requirement,
    productArea: requirement.section,
    owner: requirement.owner,
    status: requirement.status,
    complete: isMasterRequirementComplete(requirement),
    blocked: false,
    releaseBlocking: true,
    evidence: requirement.evidence,
    roles: [],
    screen: null,
    dependencies: [],
  }),
);

const preproductionWork = DESIGN_LAB_PREPRODUCTION_REQUIREMENTS.map(
  (requirement): DesignLabPendingWorkItem => ({
    id: `preproduction:${requirement.id}`,
    source: "preproduction",
    title: requirement.id,
    description: requirement.requirement,
    productArea: requirement.system,
    owner: requirement.owner,
    status: requirement.status,
    complete: isDesignLabPreproductionRequirementComplete(requirement),
    blocked: requirement.status === "blocked",
    releaseBlocking: requirement.releaseBlocking,
    evidence: requirement.evidence,
    roles: requirement.roles ?? [],
    screen: null,
    dependencies: requirement.dependencies ?? [],
  }),
);

const normalizationScaleWork = DESIGN_LAB_DATABASE_NORMALIZATION_REQUIREMENTS.filter(
  (requirement) => !requirement.releaseBlocking,
).map(
  (requirement): DesignLabPendingWorkItem => ({
    id: `preproduction:${requirement.id}`,
    source: "preproduction",
    title: requirement.id,
    description: requirement.requirement,
    productArea: requirement.system,
    owner: requirement.owner,
    status: requirement.status,
    complete: false,
    blocked: false,
    releaseBlocking: false,
    evidence: requirement.evidence,
    roles: [],
    screen: null,
    dependencies: [],
  }),
);

const databaseWork = DATABASE_OPERATIONS.map(databaseOperationWorkItem);

/**
 * Canonical atomic work index derived from the four release-gate registries
 * plus explicitly non-release database normalization work.
 * Never hand-edit status in this collection; update the owning registry and let
 * the release-gate drift test prove that totals and completion still agree.
 */
export const DESIGN_LAB_PENDING_WORK: readonly DesignLabPendingWorkItem[] = [
  ...screenWork,
  ...masterWork,
  ...preproductionWork,
  ...normalizationScaleWork,
  ...databaseWork,
];

/**
 * Internal review claims with captured evidence that still need an independent
 * verification pass. Their status is informational and does not control deployment.
 */
export const DESIGN_LAB_COMPLETE_AWAITING_VERIFICATION_WORK = Object.freeze(
  DESIGN_LAB_PENDING_WORK.filter(isDesignLabWorkAwaitingVerification),
);

export const DESIGN_LAB_VERIFICATION_REFRESH_WORKFLOW = Object.freeze({
  trigger: "final code freeze",
  queueFilter: "workCompletion=awaiting-verification",
  steps: Object.freeze([
    "Freeze source and record the immutable candidate commit.",
    "Open every awaiting-verification item and rerun its listed focused evidence.",
    "Recapture any source-bound review artifacts against that same candidate.",
    "Run the internal sync report without changing source between captures.",
    "Move each queue item to verified only with accepted fresh evidence; otherwise leave it explicitly open or blocked.",
  ]),
  commands: Object.freeze([
    "npx tsx scripts/audit-demo-routes.ts --base-url http://127.0.0.1:3000",
    "npx tsx scripts/audit-design-lab-user-stories.ts --base-url http://127.0.0.1:3000",
    "npm run audit:design-lab-hydrated-stories -- --base-url http://127.0.0.1:3000",
    "npm run audit:design-lab-hydrated-wave2 -- --base-url http://127.0.0.1:3000",
    "npm run audit:design-lab-responsive-workspace -- --base-url http://127.0.0.1:3000",
    "npm run check:design-lab-sync",
  ]),
});

const releaseWork = DESIGN_LAB_PENDING_WORK.filter(
  (item) => item.releaseBlocking,
);
const deferredWork = DESIGN_LAB_PENDING_WORK.filter(
  (item) => !item.releaseBlocking,
);

export const DESIGN_LAB_PENDING_WORK_SUMMARY = Object.freeze({
  total: DESIGN_LAB_PENDING_WORK.length,
  complete: DESIGN_LAB_PENDING_WORK.filter((item) => item.complete).length,
  pending: DESIGN_LAB_PENDING_WORK.filter((item) => !item.complete).length,
  awaitingVerification: DESIGN_LAB_COMPLETE_AWAITING_VERIFICATION_WORK.length,
  blocked: DESIGN_LAB_PENDING_WORK.filter((item) => item.blocked).length,
  release: Object.freeze({
    total: releaseWork.length,
    complete: releaseWork.filter((item) => item.complete).length,
    pending: releaseWork.filter((item) => !item.complete).length,
    blocked: releaseWork.filter((item) => item.blocked).length,
  }),
  deferred: Object.freeze({
    total: deferredWork.length,
    complete: deferredWork.filter((item) => item.complete).length,
    pending: deferredWork.filter((item) => !item.complete).length,
    blocked: deferredWork.filter((item) => item.blocked).length,
  }),
  sources: Object.freeze({
    screen: screenWork.length,
    master: masterWork.length,
    preproduction: preproductionWork.length + normalizationScaleWork.length,
    database: databaseWork.length,
  }),
});

/**
 * Filters the canonical work index without changing completion authority.
 * Empty filters are fail-open for visibility and return all release checks.
 */
export function filterDesignLabPendingWork(
  filters: DesignLabPendingWorkFilters = {},
) {
  const completion = filters.completion ?? "all";
  const source = filters.source ?? "all";
  const productArea = normalize(filters.productArea);
  const owner = normalize(filters.owner);
  const role = normalize(filters.role);
  const screen = normalize(filters.screen);
  const dependency = normalize(filters.dependency);
  const query = normalize(filters.query);

  return DESIGN_LAB_PENDING_WORK.filter((item) => {
    if (completion === "pending" && item.complete) return false;
    if (completion === "complete" && !item.complete) return false;
    if (
      completion === "awaiting-verification" &&
      !isDesignLabWorkAwaitingVerification(item)
    ) {
      return false;
    }
    if (completion === "blocked" && !item.blocked) return false;
    if (source !== "all" && item.source !== source) return false;
    if (productArea && normalize(item.productArea) !== productArea) return false;
    if (owner && normalize(item.owner) !== owner) return false;
    if (role && !item.roles.some((value) => normalize(value) === role)) {
      return false;
    }
    if (screen && normalize(item.screen) !== screen) return false;
    if (
      dependency &&
      !item.dependencies.some((value) => normalize(value) === dependency)
    ) {
      return false;
    }
    if (!query) return true;
    return searchableText(item).includes(query);
  });
}

export function isDesignLabWorkAwaitingVerification(
  item: DesignLabPendingWorkItem,
) {
  return (
    item.releaseBlocking &&
    !item.complete &&
    !item.blocked &&
    item.status === "captured" &&
    item.evidence.length > 0
  );
}

/**
 * Reports registry drift instead of allowing the visible backlog to disagree
 * with the production release gate. Callers must treat any issue as blocking.
 */
export function findDesignLabPendingWorkIssues(
  items = DESIGN_LAB_PENDING_WORK,
) {
  const issues: string[] = [];
  const ids = items.map((item) => item.id);
  const releaseItems = items.filter((item) => item.releaseBlocking);
  const releaseComplete = releaseItems.filter((item) => item.complete).length;

  if (new Set(ids).size !== ids.length) {
    issues.push("Pending-work IDs are not unique.");
  }
  if (releaseItems.length !== DESIGN_LAB_RELEASE_GATE.totalChecks) {
    issues.push(
      `Release-blocking pending-work total ${releaseItems.length} disagrees with release total ${DESIGN_LAB_RELEASE_GATE.totalChecks}.`,
    );
  }
  if (releaseComplete !== DESIGN_LAB_RELEASE_GATE.completedChecks) {
    issues.push(
      `Release-blocking pending-work completion ${releaseComplete} disagrees with release completion ${DESIGN_LAB_RELEASE_GATE.completedChecks}.`,
    );
  }
  return issues;
}

function databaseOperationWorkItem(
  operation: DatabaseOperationContract,
): DesignLabPendingWorkItem {
  return {
    id: `database:${operation.queryId}`,
    source: "database",
    title: operation.queryId,
    description: `${operation.operationType} via ${operation.sourceSymbol}: ${operation.failureBehaviour}`,
    productArea: "database operations",
    owner: "Database trace owner",
    status: operation.verificationStatus,
    complete: isDesignLabDatabaseOperationComplete(operation),
    blocked: false,
    releaseBlocking: true,
    evidence: operation.evidence,
    roles: unique([operation.databaseRole]),
    screen: null,
    dependencies: unique([...operation.tables, ...operation.views]),
  };
}

function searchableText(item: DesignLabPendingWorkItem) {
  return normalize(
    [
      item.id,
      item.source,
      item.title,
      item.description,
      item.productArea,
      item.owner,
      item.status,
      item.screen ?? "",
      ...item.roles,
      ...item.dependencies,
      ...item.evidence,
    ].join(" "),
  );
}

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].toSorted();
}
