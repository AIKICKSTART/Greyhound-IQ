import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_HISTORY_NAVIGATION_EVIDENCE_FILE =
  "src/components/product-history-navigation-evidence.ts" as const;
export const PRODUCT_HISTORY_NAVIGATION_TEST_FILE =
  "src/components/product-history-navigation-evidence.test.ts" as const;

export const PRODUCT_HISTORY_NAVIGATION_REQUIREMENT_ID =
  "GLOBAL.FUNC.history" as const;

export const PRODUCT_HISTORY_NAVIGATION_SCOPE =
  "Deterministic source-static inventory of all eight direct native History API writes in runtime source. Three pushState calls create reversible entries: one owns explicit popstate restoration and two use Next.js search-parameter synchronization. Five replaceState calls deliberately replace transient call, filter, audit, hash, or prototype state without adding a false back-stack entry. Every target is derived from the current same-origin URL or an allowlisted relative destination. This closes the repository history-navigation source contract only; it does not prove browser rendering, third-party browser behavior, deployed navigation, user-perceived continuity, or production readiness.";

export type ProductHistoryNavigationContract = {
  id: string;
  sourceFile: string;
  method: "pushState" | "replaceState";
  urlArgument: string;
  strategy:
    | "explicit-popstate-restoration"
    | "next-search-params-restoration"
    | "replace-transient-current-entry";
  targetPolicy:
    | "allowlisted-relative-destination"
    | "current-url-object"
    | "relative-builder"
    | "relative-template";
  proofMarkers: readonly string[];
  rationale: string;
};

export const PRODUCT_HISTORY_NAVIGATION_CONTRACTS = [
  {
    id: "conversation.call-intent-cleanup",
    sourceFile: "src/components/conversation-call-panel.tsx",
    method: "replaceState",
    urlArgument: "url",
    strategy: "replace-transient-current-entry",
    targetPolicy: "current-url-object",
    proofMarkers: [
      "const url = new URL(window.location.href);",
      'url.searchParams.delete("call");',
    ],
    rationale:
      "Remove the consumed call intent from the current entry so Back cannot restart a completed or rejected call.",
  },
  {
    id: "design-lab.contract-route-selection",
    sourceFile: "src/components/design-lab-contract-inspector.tsx",
    method: "pushState",
    urlArgument:
      "buildDesignLabInspectorRouteUrl(window.location.href, nextRoute)",
    strategy: "explicit-popstate-restoration",
    targetPolicy: "relative-builder",
    proofMarkers: [
      'window.addEventListener("popstate", restoreRouteFromUrl);',
      'window.removeEventListener("popstate", restoreRouteFromUrl);',
      "resolveDesignLabInspectorContract(",
    ],
    rationale:
      "Create a reviewable route-selection entry and restore the allowlisted selected contract on Back or Forward.",
  },
  {
    id: "design-lab.pending-filter-sync",
    sourceFile: "src/components/design-lab-pending-work-panel.tsx",
    method: "replaceState",
    urlArgument: "`${url.pathname}${url.search}${url.hash}`",
    strategy: "replace-transient-current-entry",
    targetPolicy: "relative-template",
    proofMarkers: [
      "const url = new URL(window.location.href);",
      "url.searchParams.delete(\"workQuery\");",
      "const searchParams = useSearchParams();",
    ],
    rationale:
      "Synchronize transient review filters without adding a history entry for each filter edit.",
  },
  {
    id: "design-lab.scenario-state",
    sourceFile: "src/components/design-lab-scenario-controls.tsx",
    method: "pushState",
    urlArgument:
      "buildDesignLabScenarioUrl(window.location.href, { [key]: value })",
    strategy: "next-search-params-restoration",
    targetPolicy: "relative-builder",
    proofMarkers: [
      "const searchParams = useSearchParams();",
      "const scenario = resolveDesignLabScenarioState(searchParams);",
    ],
    rationale:
      "Create reversible scenario selections whose URL state is consumed through Next.js search parameters.",
  },
  {
    id: "design-lab.onboarding-preview",
    sourceFile: "src/components/design-lab-scenario-controls.tsx",
    method: "pushState",
    urlArgument:
      "buildDesignLabOnboardingPreviewUrl(window.location.href, patch)",
    strategy: "next-search-params-restoration",
    targetPolicy: "relative-builder",
    proofMarkers: [
      "const searchParams = useSearchParams();",
      "resolveDesignLabOnboardingDevice(",
      "resolveDesignLabOnboardingTargetMode(",
    ],
    rationale:
      "Create reversible onboarding-preview selections consumed from Next.js search parameters.",
  },
  {
    id: "design-lab.audit-filter-sync",
    sourceFile: "src/components/master-audit-checklist.tsx",
    method: "replaceState",
    urlArgument: "`${url.pathname}${url.search}${url.hash}`",
    strategy: "replace-transient-current-entry",
    targetPolicy: "relative-template",
    proofMarkers: [
      "const url = new URL(window.location.href);",
      "url.searchParams.delete(\"auditQuery\");",
      "const searchParams = useSearchParams();",
    ],
    rationale:
      "Synchronize transient audit filters without adding a history entry for each filter edit.",
  },
  {
    id: "prototype.feed-composer-hash",
    sourceFile: "src/components/prototype-member-chrome.tsx",
    method: "replaceState",
    urlArgument:
      "`${window.location.pathname}${window.location.search}#feed-composer`",
    strategy: "replace-transient-current-entry",
    targetPolicy: "relative-template",
    proofMarkers: [
      'window.dispatchEvent(new Event("hashchange"));',
      'window.dispatchEvent(new Event("giq:open-feed-composer"));',
    ],
    rationale:
      "Expose transient composer focus in the current URL without creating a duplicate Back entry.",
  },
  {
    id: "prototype.feed-reset",
    sourceFile: "src/components/prototype-member-chrome.tsx",
    method: "replaceState",
    urlArgument: "destination",
    strategy: "replace-transient-current-entry",
    targetPolicy: "allowlisted-relative-destination",
    proofMarkers: [
      "const destination = prototypeDockDestination(action, currentSearch);",
      'if (action === "feed" && window.location.pathname === "/feed")',
    ],
    rationale:
      "Reset the current prototype feed entry without adding a duplicate same-route Back entry.",
  },
] as const satisfies readonly ProductHistoryNavigationContract[];

export type ProductHistoryNavigationIssue = {
  code:
    | "DUPLICATE_CONTRACT"
    | "INVALID_FILE"
    | "INVALID_METHOD_STRATEGY"
    | "INVALID_TARGET_POLICY"
    | "MISSING_ID"
    | "MISSING_PROOF"
    | "MISSING_RATIONALE"
    | "MISSING_URL_ARGUMENT";
  contractId: string;
};

export function findHistoryNavigationIssues(
  contracts: readonly ProductHistoryNavigationContract[],
): ProductHistoryNavigationIssue[] {
  const issues: ProductHistoryNavigationIssue[] = [];
  const seenIds = new Set<string>();
  const seenCalls = new Set<string>();

  for (const contract of contracts) {
    const contractId = contract.id.trim();
    if (!contractId) issues.push({ code: "MISSING_ID", contractId: contract.id });
    const callKey = `${contract.sourceFile}:${contract.method}:${contract.urlArgument}`;
    if (seenIds.has(contractId) || seenCalls.has(callKey)) {
      issues.push({ code: "DUPLICATE_CONTRACT", contractId: contract.id });
    }
    seenIds.add(contractId);
    seenCalls.add(callKey);

    if (
      !contract.sourceFile.startsWith("src/") ||
      /(?:^|\.)test\.[cm]?[jt]sx?$/u.test(contract.sourceFile)
    ) {
      issues.push({ code: "INVALID_FILE", contractId: contract.id });
    }
    if (!contract.urlArgument.trim()) {
      issues.push({ code: "MISSING_URL_ARGUMENT", contractId: contract.id });
    }
    if (
      contract.proofMarkers.length === 0 ||
      contract.proofMarkers.some((marker) => !marker.trim()) ||
      new Set(contract.proofMarkers).size !== contract.proofMarkers.length
    ) {
      issues.push({ code: "MISSING_PROOF", contractId: contract.id });
    }
    if (!contract.rationale.trim()) {
      issues.push({ code: "MISSING_RATIONALE", contractId: contract.id });
    }
    if (
      ![
        "allowlisted-relative-destination",
        "current-url-object",
        "relative-builder",
        "relative-template",
      ].includes(contract.targetPolicy)
    ) {
      issues.push({ code: "INVALID_TARGET_POLICY", contractId: contract.id });
    }

    const validStrategy =
      (contract.method === "pushState" &&
        (contract.strategy === "explicit-popstate-restoration" ||
          contract.strategy === "next-search-params-restoration")) ||
      (contract.method === "replaceState" &&
        contract.strategy === "replace-transient-current-entry");
    if (!validStrategy) {
      issues.push({
        code: "INVALID_METHOD_STRATEGY",
        contractId: contract.id,
      });
    }
  }

  return issues;
}

type ProductHistoryNavigationEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_HISTORY_NAVIGATION_MASTER_EVIDENCE = {
  [PRODUCT_HISTORY_NAVIGATION_REQUIREMENT_ID]: {
    status: "tested",
    evidence: [
      PRODUCT_HISTORY_NAVIGATION_EVIDENCE_FILE,
      PRODUCT_HISTORY_NAVIGATION_TEST_FILE,
      "src/components/design-lab-contract-inspector-model.ts",
      "src/components/design-lab-scenario-state.ts",
      "src/components/design-lab-onboarding-preview.ts",
      "src/components/prototype-dock-navigation.ts",
    ],
  },
} as const satisfies Readonly<
  Record<string, ProductHistoryNavigationEvidenceRecord>
>;
