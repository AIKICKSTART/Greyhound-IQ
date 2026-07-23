import { readFileSync } from "node:fs";

import {
  DEMO_SCREEN_FAMILIES,
  SCREEN_CONTRACT_BY_ROUTE,
  type DemoScreenFamily,
} from "./demo-experience-registry";
import { buildProductFieldContractSourceRegistry } from "./product-field-contract-source-registry";
import { DESIGN_LAB_USER_STORY_MANIFESTS } from "./screen-contracts/design-lab-user-stories";
import { getLocalSourceClosure } from "./screen-contracts/screen-contract-source-audit";

export type ProductStorySourceSignal = {
  kind: "analytics" | "audit";
  sourceFile: string;
  sourceLine: number;
  sourceText: string;
};

export type ProductStoryOperationalContractRecord = {
  id: string;
  storyId: string;
  route: string;
  goal: string;
  alternativePaths: readonly string[];
  failurePaths: {
    expectation: string;
    stateIds: readonly string[];
  };
  blockedPrivatePaths: {
    authentication: "optional" | "public" | "required";
    deniedPermissions: readonly string[];
    stateIds: readonly string[];
  };
  fields: readonly {
    id: string;
    name: string;
    sourceFile: string;
    sourceLine: number;
    sourceColumn: number;
  }[];
  validation: readonly {
    fieldId: string;
    rules: readonly string[];
  }[];
  loading: {
    expectation: string;
    stateIds: readonly string[];
  };
  empty: {
    expectation: string;
    stateIds: readonly string[];
  };
  success: {
    feedback: readonly string[];
    stateIds: readonly string[];
  };
  recoverableError: {
    expectation: string;
    stateIds: readonly string[];
  };
  analyticsAudit: readonly ProductStorySourceSignal[];
  onboarding: {
    tourId: string | null;
    recordedState: "not-route-declared" | "route-tour-declared";
  };
  accessibility: readonly string[];
  mobile: readonly string[];
  sourceFiles: readonly string[];
};

export type ProductStoryOperationalContractRegistry = {
  records: readonly ProductStoryOperationalContractRecord[];
  discoveredRecordIds: readonly string[];
  auditedRoutes: readonly string[];
  auditedSourceFiles: readonly string[];
};

type StoryInput = {
  route: string;
  storyId: string;
  feedback: readonly string[];
  family: DemoScreenFamily;
};

const FAILURE_STATE_PATTERN =
  /(?:BLOCK|CANCEL|DENIED|ERROR|FAIL|INVALID|MISSING|PRIVATE|RECOVER|UNAVAILABLE)/i;
const EMPTY_STATE_PATTERN = /(?:EMPTY|NO[-_]|ZERO)/i;
const LOADING_STATE_PATTERN = /(?:LOADING|PENDING)/i;
const SUCCESS_STATE_PATTERN =
  /(?:COMPLETE|CREATED|POPULATED|READY|SAVED|SENT|SUCCESS|UPDATED)/i;
const BLOCKED_PRIVATE_STATE_PATTERN = /(?:BLOCK|DENIED|PRIVATE|SIGNED-OUT)/i;
const ANALYTICS_AUDIT_PATTERN =
  /\b(?:analytics|audit|emitMetric|telemetry|trackEvent)\b/i;

export function buildProductStoryOperationalContractRegistry(): ProductStoryOperationalContractRegistry {
  const fieldRegistry = buildProductFieldContractSourceRegistry();
  const fieldsByRoute = new Map<
    string,
    (typeof fieldRegistry.records)[number][]
  >();
  for (const field of fieldRegistry.records) {
    const routeFields = fieldsByRoute.get(field.route) ?? [];
    routeFields.push(field);
    fieldsByRoute.set(field.route, routeFields);
  }

  const records = new Map<string, ProductStoryOperationalContractRecord>();
  const discoveredRecordIds = new Set<string>();
  const auditedRoutes = new Set<string>();
  const auditedSourceFiles = new Set<string>();

  for (const input of storyInputs()) {
    const screen = SCREEN_CONTRACT_BY_ROUTE.get(input.route);
    if (!screen) throw new Error(`Missing screen contract for ${input.route}`);

    const id = `${input.route}::${input.storyId}`;
    discoveredRecordIds.add(id);
    auditedRoutes.add(input.route);
    const sourceFiles = screen.sourceFiles
      .flatMap((sourceFile) => [...getLocalSourceClosure(sourceFile)])
      .filter(isAuditableSourceFile)
      .filter((sourceFile, index, files) => files.indexOf(sourceFile) === index)
      .toSorted();
    sourceFiles.forEach((sourceFile) => auditedSourceFiles.add(sourceFile));
    const routeFields = (fieldsByRoute.get(input.route) ?? []).toSorted(
      (left, right) => left.id.localeCompare(right.id),
    );
    const stateIds = screen.stateRules.map(({ id: stateId }) => stateId);
    const commonStateExpectation =
      input.family.acceptance.find((item) =>
        /loading, empty and recoverable-error states/i.test(item),
      ) ?? "No family-level state expectation declared.";

    records.set(id, {
      id,
      storyId: input.storyId,
      route: input.route,
      goal: `${input.family.userStory} Route outcome: ${screen.description}`,
      alternativePaths: [
        ...screen.entryPoints.slice(1),
        ...screen.secondaryActions,
      ],
      failurePaths: {
        expectation: commonStateExpectation,
        stateIds: matchingStates(stateIds, FAILURE_STATE_PATTERN),
      },
      blockedPrivatePaths: {
        authentication: screen.authentication,
        deniedPermissions: screen.permissionRules
          .filter(({ decision }) => decision === "deny")
          .map(({ actor, enforcedBy }) => `${actor} -> ${enforcedBy}`),
        stateIds: matchingStates(stateIds, BLOCKED_PRIVATE_STATE_PATTERN),
      },
      fields: routeFields.map((field) => ({
        id: field.id,
        name: field.name,
        sourceFile: field.sourceFile,
        sourceLine: field.sourceLine,
        sourceColumn: field.sourceColumn,
      })),
      validation: routeFields.map((field) => ({
        fieldId: field.id,
        rules: [...field.validationRules],
      })),
      loading: {
        expectation: commonStateExpectation,
        stateIds: matchingStates(stateIds, LOADING_STATE_PATTERN),
      },
      empty: {
        expectation: commonStateExpectation,
        stateIds: matchingStates(stateIds, EMPTY_STATE_PATTERN),
      },
      success: {
        feedback: [...input.feedback],
        stateIds: matchingStates(stateIds, SUCCESS_STATE_PATTERN),
      },
      recoverableError: {
        expectation: commonStateExpectation,
        stateIds: matchingStates(stateIds, FAILURE_STATE_PATTERN),
      },
      analyticsAudit: collectAnalyticsAuditSignals(sourceFiles),
      onboarding: {
        tourId: screen.onboardingTourId ?? null,
        recordedState: screen.onboardingTourId
          ? "route-tour-declared"
          : "not-route-declared",
      },
      accessibility: input.family.acceptance.filter((item) =>
        /keyboard|focus|semantic|touch|colour|motion/i.test(item),
      ),
      mobile: input.family.acceptance.filter((item) =>
        /phone|tablet|mobile|horizontal overflow|touch/i.test(item),
      ),
      sourceFiles,
    });
  }

  return {
    records: [...records.values()].toSorted((left, right) =>
      left.id.localeCompare(right.id),
    ),
    discoveredRecordIds: [...discoveredRecordIds].toSorted((left, right) =>
      left.localeCompare(right),
    ),
    auditedRoutes: [...auditedRoutes].toSorted(),
    auditedSourceFiles: [...auditedSourceFiles].toSorted(),
  };
}

function storyInputs(): StoryInput[] {
  const inputs: StoryInput[] = [];
  const designLabStoriesByRoute = new Map(
    DESIGN_LAB_USER_STORY_MANIFESTS.map((manifest) => [
      manifest.route,
      manifest.userStories,
    ] as const),
  );

  for (const family of DEMO_SCREEN_FAMILIES) {
    for (const screen of family.screens) {
      if (screen.userStory) {
        inputs.push({
          route: screen.route,
          storyId: screen.userStory.id,
          feedback: [screen.userStory.acceptance.then],
          family,
        });
        continue;
      }

      const detailedStories = designLabStoriesByRoute.get(screen.route) ?? [];
      for (const story of detailedStories) {
        inputs.push({
          route: screen.route,
          storyId: story.id,
          feedback: story.acceptance.map(({ then }) => then),
          family,
        });
      }
    }
  }
  return inputs;
}

function collectAnalyticsAuditSignals(sourceFiles: readonly string[]) {
  const signals: ProductStorySourceSignal[] = [];
  for (const sourceFile of sourceFiles) {
    const lines = readFileSync(sourceFile, "utf8").split(/\r?\n/);
    lines.forEach((sourceText, index) => {
      if (!ANALYTICS_AUDIT_PATTERN.test(sourceText)) return;
      const normalizedText = sourceText.trim().replace(/\s+/g, " ").slice(0, 180);
      if (/\baudit\b/i.test(sourceText)) {
        signals.push({
          kind: "audit",
          sourceFile,
          sourceLine: index + 1,
          sourceText: normalizedText,
        });
      }
      if (/\b(?:analytics|emitMetric|telemetry|trackEvent)\b/i.test(sourceText)) {
        signals.push({
          kind: "analytics",
          sourceFile,
          sourceLine: index + 1,
          sourceText: normalizedText,
        });
      }
    });
  }
  return signals.toSorted((left, right) => signalKey(left).localeCompare(signalKey(right)));
}

function matchingStates(stateIds: readonly string[], pattern: RegExp) {
  return stateIds.filter((stateId) => pattern.test(stateId)).toSorted();
}

function isAuditableSourceFile(sourceFile: string) {
  return (
    sourceFile.startsWith("src/") &&
    /\.[cm]?[jt]sx?$/.test(sourceFile) &&
    !/\.test\.[cm]?[jt]sx?$/.test(sourceFile)
  );
}

function signalKey(signal: ProductStorySourceSignal) {
  return `${signal.sourceFile}:${signal.sourceLine}:${signal.kind}`;
}
