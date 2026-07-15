import {
  DEMO_SCREEN_FAMILIES,
  SCREEN_CONTRACT_BY_ROUTE,
  SCREEN_CONTRACT_COVERAGE_AREAS,
  SCREEN_CONTRACTS,
  type ScreenContract,
  type ScreenContractCoverageStatus,
} from "./demo-experience-registry";
import { DESIGN_LAB_USER_STORY_MANIFESTS } from "./screen-contracts/design-lab-user-stories";
import { removeDesignLabTransientQueries } from "./design-lab-url-state";

export const DESIGN_LAB_INSPECTOR_DIMENSIONS = [
  { id: "DL.INSPECT.route", label: "Route" },
  { id: "DL.INSPECT.actors", label: "Actors" },
  { id: "DL.INSPECT.stories", label: "User stories" },
  { id: "DL.INSPECT.entry-points", label: "Entry points" },
  { id: "DL.INSPECT.roles", label: "Roles" },
  { id: "DL.INSPECT.tiers", label: "Subscription tiers" },
  { id: "DL.INSPECT.permissions", label: "Permissions" },
  { id: "DL.INSPECT.feature-flags", label: "Feature flags" },
  { id: "DL.INSPECT.forms", label: "Forms" },
  { id: "DL.INSPECT.fields", label: "Fields" },
  { id: "DL.INSPECT.primary-actions", label: "Primary actions" },
  { id: "DL.INSPECT.secondary-actions", label: "Secondary actions" },
  { id: "DL.INSPECT.data", label: "Data dependencies" },
  { id: "DL.INSPECT.states", label: "Supported states" },
  { id: "DL.INSPECT.onboarding", label: "Onboarding" },
  { id: "DL.INSPECT.accessibility", label: "Accessibility notes" },
  { id: "DL.INSPECT.responsive", label: "Responsive notes" },
  { id: "DL.INSPECT.tests", label: "Test coverage" },
  { id: "DL.INSPECT.gaps", label: "Known gaps" },
] as const;

export type DesignLabInspectorRequirementId =
  (typeof DESIGN_LAB_INSPECTOR_DIMENSIONS)[number]["id"];

export type DesignLabInspectorSection = {
  id: DesignLabInspectorRequirementId;
  label: string;
  state: "recorded" | "gap";
  values: readonly string[];
};

export const DEFAULT_DESIGN_LAB_INSPECTOR_ROUTE = "/dogs/[id]";

export function resolveDesignLabInspectorContract(route?: string | null) {
  return (
    SCREEN_CONTRACT_BY_ROUTE.get(route ?? "") ??
    SCREEN_CONTRACT_BY_ROUTE.get(DEFAULT_DESIGN_LAB_INSPECTOR_ROUTE) ??
    SCREEN_CONTRACTS[0]!
  );
}

export function buildDesignLabInspectorRouteUrl(
  currentHref: string,
  route: string,
) {
  const contract = resolveDesignLabInspectorContract(route);
  const url = new URL(currentHref);
  removeDesignLabTransientQueries(url.searchParams);
  url.searchParams.set("route", contract.route);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildDesignLabContractInspectorSections(
  contract: ScreenContract,
): readonly DesignLabInspectorSection[] {
  const family = DEMO_SCREEN_FAMILIES.find((candidate) =>
    candidate.screens.some((screen) => screen.route === contract.route),
  );
  const screen = family?.screens.find(
    (candidate) => candidate.route === contract.route,
  );
  const designLabManifest = DESIGN_LAB_USER_STORY_MANIFESTS.find(
    (candidate) => candidate.route === contract.route,
  );
  const stories = screen?.userStory
    ? [
        `${screen.userStory.id}: ${screen.userStory.actor} — ${screen.userStory.outcome}`,
        `Given ${screen.userStory.acceptance.given}`,
        `When ${screen.userStory.acceptance.when}`,
        `Then ${screen.userStory.acceptance.then}`,
      ]
    : (designLabManifest?.userStories.flatMap((story) => [
        `${story.id}: ${story.actor} — ${story.outcome}`,
        ...story.acceptance.map(
          (scenario) =>
            `Given ${scenario.given} / When ${scenario.when} / Then ${scenario.then}`,
        ),
      ]) ?? (family ? [family.userStory] : []));
  const accessibilityNotes =
    family?.acceptance.filter((criterion) =>
      /keyboard|focus|semantic|label|touch|screen reader|accessib/i.test(
        criterion,
      ),
    ) ?? [];
  const responsiveNotes =
    family?.acceptance.filter((criterion) =>
      /overflow|phone|tablet|desktop|responsive|breakpoint|mobile/i.test(
        criterion,
      ),
    ) ?? [];
  const incompleteCoverage = SCREEN_CONTRACT_COVERAGE_AREAS.filter(
    (area) => !isCoverageComplete(contract.coverage[area].status),
  ).map(
    (area) =>
      `${formatCoverageArea(area)}: ${contract.coverage[area].status}`,
  );
  const metadataGaps = [
    contract.forms.length > 0 ? null : "Forms: none registered",
    "Fields: field-level metadata is not registered yet",
    contract.secondaryActions.length > 0
      ? null
      : "Secondary actions: none registered",
    contract.dataDependencies.length > 0
      ? null
      : "Data dependencies: none registered",
    contract.onboardingTourId ? null : "Onboarding: no tour registered",
  ].filter((value): value is string => Boolean(value));

  return [
    recorded("DL.INSPECT.route", "Route", [
      `Pattern: ${contract.route}`,
      `Concrete route: ${contract.concreteRoute}`,
    ]),
    valuesOrGap(
      "DL.INSPECT.actors",
      "Actors",
      contract.actors,
      "No actors are registered for this screen.",
    ),
    valuesOrGap(
      "DL.INSPECT.stories",
      "User stories",
      stories,
      "No user story is registered for this screen.",
    ),
    valuesOrGap(
      "DL.INSPECT.entry-points",
      "Entry points",
      contract.entryPoints,
      "No entry points are registered for this screen.",
    ),
    valuesOrGap(
      "DL.INSPECT.roles",
      "Roles",
      contract.roles,
      "No role metadata is registered for this screen.",
    ),
    valuesOrGap(
      "DL.INSPECT.tiers",
      "Subscription tiers",
      contract.tiers,
      "No tier metadata is registered for this screen.",
    ),
    valuesOrGap(
      "DL.INSPECT.permissions",
      "Permissions",
      contract.permissionRules.map(
        (rule) =>
          `${rule.actor}: ${rule.decision} — ${rule.enforcedBy}${
            rule.testIds.length > 0
              ? ` (tests: ${rule.testIds.join(", ")})`
              : ""
          }`,
      ),
      "No permission rule is registered for this screen.",
    ),
    valuesOrGap(
      "DL.INSPECT.feature-flags",
      "Feature flags",
      contract.featureFlags,
      "No feature flag is registered for this screen.",
    ),
    valuesOrGap(
      "DL.INSPECT.forms",
      "Forms",
      contract.forms,
      "No form is registered for this screen.",
    ),
    gap(
      "DL.INSPECT.fields",
      "Fields",
      "Field-level metadata is not registered yet; the form contract remains visible above without inventing field coverage.",
    ),
    valuesOrGap(
      "DL.INSPECT.primary-actions",
      "Primary actions",
      contract.primaryActions,
      "No primary action is registered for this screen.",
    ),
    valuesOrGap(
      "DL.INSPECT.secondary-actions",
      "Secondary actions",
      contract.secondaryActions,
      "No secondary action is registered for this screen.",
    ),
    valuesOrGap(
      "DL.INSPECT.data",
      "Data dependencies",
      contract.dataDependencies,
      "No data dependency is registered for this screen.",
    ),
    valuesOrGap(
      "DL.INSPECT.states",
      "Supported states",
      contract.stateRules.length > 0
        ? contract.stateRules.map(
            (state) =>
              `${state.id}${state.fixtureId ? ` — fixture ${state.fixtureId}` : ""}${
                state.recoveryActionId
                  ? ` — recovery ${state.recoveryActionId}`
                  : ""
              }`,
          )
        : contract.supportedStates,
      "No state is registered for this screen.",
    ),
    valuesOrGap(
      "DL.INSPECT.onboarding",
      "Onboarding",
      contract.onboardingTourId ? [contract.onboardingTourId] : [],
      "No onboarding tour is registered for this screen.",
    ),
    valuesOrGap(
      "DL.INSPECT.accessibility",
      "Accessibility notes",
      accessibilityNotes,
      "No accessibility note is registered for this screen family.",
    ),
    valuesOrGap(
      "DL.INSPECT.responsive",
      "Responsive notes",
      responsiveNotes,
      "No responsive note is registered for this screen family.",
    ),
    valuesOrGap(
      "DL.INSPECT.tests",
      "Test coverage",
      contract.coverage.tests.evidence,
      `Test coverage is ${contract.coverage.tests.status} with no linked evidence.`,
    ),
    valuesOrGap(
      "DL.INSPECT.gaps",
      "Known gaps",
      [...incompleteCoverage, ...metadataGaps],
      "No registry gap is currently recorded for this screen.",
    ),
  ];
}

function recorded(
  id: DesignLabInspectorRequirementId,
  label: string,
  values: readonly string[],
): DesignLabInspectorSection {
  return { id, label, state: "recorded", values };
}

function gap(
  id: DesignLabInspectorRequirementId,
  label: string,
  message: string,
): DesignLabInspectorSection {
  return { id, label, state: "gap", values: [message] };
}

function valuesOrGap(
  id: DesignLabInspectorRequirementId,
  label: string,
  values: readonly string[],
  message: string,
): DesignLabInspectorSection {
  return values.length > 0 ? recorded(id, label, values) : gap(id, label, message);
}

function isCoverageComplete(status: ScreenContractCoverageStatus) {
  return status === "verified" || status === "tested" || status === "excluded";
}

function formatCoverageArea(area: string) {
  return area.replace(/([a-z])([A-Z])/g, "$1 $2");
}
