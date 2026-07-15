import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import { DESIGN_LAB_USER_STORY_MANIFESTS } from "./screen-contracts/design-lab-user-stories";
import { PRODUCTION_SCREEN_INTERACTION_CONTRACTS } from "./screen-contracts/production-screen-coverage";
import { getLocalSourceClosure } from "./screen-contracts/screen-contract-source-audit";
import type { FamilyScreenManifest } from "./screen-contracts/types";
import { discoverRouteHandlers } from "../../security/endpoints";

type PrimaryAction = FamilyScreenManifest["actions"][number];
type FormContract = FamilyScreenManifest["forms"][number];

type InteractionContract = {
  actions: readonly PrimaryAction[];
  forms: readonly FormContract[];
};

export type ProductInternalLinkKind =
  "href-property" | "jsx-href" | "navigation-call";

export type ProductInternalLinkRecord = {
  id: string;
  sourceFile: string;
  sourceLine: number;
  sourceColumn: number;
  ownerRoutes: readonly string[];
  kind: ProductInternalLinkKind;
  rawTarget: string;
  normalizedTarget: string;
  matchedRoutePattern: string | null;
};

export type ProductInternalLinkIssue = {
  code: "MISSING_INTERNAL_ROUTE";
  recordId: string;
  sourceFile: string;
  target: string;
};

export type ProductPrimaryActionDestination = {
  rawTarget: string;
  normalizedTarget: string;
  matchedRoutePattern: string | null;
};

export type ProductPrimaryActionImplementationEvidence = {
  actionId: string;
  sourceFile: string;
  sourceLine: number;
  binding: "action-id" | "destination-control" | "handler-token";
  value: string;
};

export type ProductPrimaryActionTestEvidence = {
  actionId: string;
  testId: string;
  testFile: string;
};

export type ProductPrimaryActionRecord = {
  id: string;
  route: string;
  actionId: string;
  result: string;
  enforcement: string;
  contractSourceFile: string | null;
  contractSourceLine: number | null;
  declaredTestIds: readonly string[];
  implementationEvidence: readonly ProductPrimaryActionImplementationEvidence[];
  testEvidence: readonly ProductPrimaryActionTestEvidence[];
  destinations: readonly ProductPrimaryActionDestination[];
  resolution:
    "destination-and-handler-contract" | "handler-contract" | "unresolved";
};

export type ProductInteractiveControlRecord = {
  id: string;
  sourceFile: string;
  sourceLine: number;
  sourceColumn: number;
  ownerRoutes: readonly string[];
  tagName: string;
  purposeContractIds: readonly string[];
  bindingEvidence: readonly string[];
};

export type ProductInteractiveControlIssue = {
  code: "INTERACTIVE_CONTROL_PURPOSE_MISSING";
  recordId: string;
  sourceFile: string;
  sourceLine: number;
  ownerRoutes: readonly string[];
};

export type ProductPrimaryActionIssue = {
  code:
    | "ACTION_CONTRACT_SOURCE_MISSING"
    | "ACTION_DESTINATION_MISSING"
    | "ACTION_HANDLER_OR_DESTINATION_MISSING"
    | "ACTION_SOURCE_SIGNAL_MISSING"
    | "ACTION_TEST_MISSING";
  recordId: string;
  detail: string;
};

export type ProductStateFixtureRecord = {
  id: string;
  route: string;
  stateId: string;
  fixtureId: string | null;
  recoveryActionId: string | null;
  evidence: readonly string[];
};

export type ProductStateFixtureIssue = {
  code: "STATE_FIXTURE_MISSING";
  recordId: string;
  route: string;
  stateId: string;
};

export type ProductAutomatedSourceGateRegistry = {
  routePatterns: readonly string[];
  auditedRoutes: readonly string[];
  auditedSourceFiles: readonly string[];
  internalLinks: readonly ProductInternalLinkRecord[];
  internalLinkIssues: readonly ProductInternalLinkIssue[];
  primaryActions: readonly ProductPrimaryActionRecord[];
  primaryActionIssues: readonly ProductPrimaryActionIssue[];
  interactiveControls: readonly ProductInteractiveControlRecord[];
  interactiveControlIssues: readonly ProductInteractiveControlIssue[];
  stateFixtures: readonly ProductStateFixtureRecord[];
  stateFixtureIssues: readonly ProductStateFixtureIssue[];
};

type StaticTarget = {
  rawTarget: string;
  kind: ProductInternalLinkKind;
  node: ts.Node;
};

type ActionSourceLocation = {
  sourceFile: string;
  sourceLine: number;
};

type ActionSourceLine = ActionSourceLocation & {
  sourceText: string;
};

type PurposeContract = {
  id: string;
  route: string;
  kind: "action" | "form";
  bindingTokens: readonly string[];
  destinations: readonly ProductPrimaryActionDestination[];
};

const TEST_FILE_PATTERN = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const SOURCE_FILE_PATTERN = /\.[cm]?[jt]sx?$/;
const DYNAMIC_VALUE = "__GIQ_DYNAMIC_SEGMENT__";
const ACTION_PATH_PATTERN =
  /(?:^|[\s("'`])((?:\/(?!\/)(?:[A-Za-z0-9._~:@%+\-\[\]]+\/?)*))/g;
const NAVIGATION_CALL_PATTERN =
  /^(?:redirect|permanentRedirect|router\.(?:push|replace)|navigation\.(?:push|replace))$/;
const INTERACTIVE_ATTRIBUTE_NAMES = new Set([
  "action",
  "formAction",
  "onChange",
  "onClick",
  "onInput",
  "onKeyDown",
  "onSelect",
  "onSubmit",
]);
const INTERACTIVE_INTRINSIC_TAGS = new Set([
  "a",
  "button",
  "form",
  "input",
  "select",
  "summary",
  "textarea",
]);
const NON_BINDING_TOKENS = new Set([
  "ACTION",
  "CLIENT",
  "HTTP",
  "HTTPS",
  "LINK",
  "POST",
  "SERVER",
]);

export function buildProductAutomatedSourceGateRegistry(): ProductAutomatedSourceGateRegistry {
  const repoRoot = path.resolve(".");
  const pageRoutePatterns = discoverPageRoutePatterns(repoRoot);
  const handlerRoutePatterns = discoverRouteHandlers(repoRoot).map(
    ({ route }) => route,
  );
  const routePatterns = [
    ...new Set([...pageRoutePatterns, ...handlerRoutePatterns]),
  ].toSorted((left, right) => left.localeCompare(right));
  const sourceOwners = collectSourceOwners();
  const auditedSourceFiles = [...sourceOwners.keys()].toSorted((left, right) =>
    left.localeCompare(right),
  );

  const internalLinks = auditedSourceFiles
    .flatMap((sourceFile) =>
      collectInternalLinkRecords(
        sourceFile,
        sourceOwners.get(sourceFile) ?? [],
        routePatterns,
      ),
    )
    .filter(
      (record, index, records) =>
        records.findIndex(({ id }) => id === record.id) === index,
    )
    .toSorted((left, right) => left.id.localeCompare(right.id));

  const actionSourceLocations = collectActionSourceLocations(repoRoot);
  const interactiveControls = collectInteractiveControlRecords(
    sourceOwners,
    routePatterns,
  );
  const primaryActions = collectPrimaryActionRecords(
    sourceOwners,
    routePatterns,
    actionSourceLocations,
    internalLinks,
    interactiveControls,
  );
  const stateFixtures = collectStateFixtureRecords();

  return {
    routePatterns,
    auditedRoutes: SCREEN_CONTRACTS.map(({ route }) => route).toSorted(),
    auditedSourceFiles,
    internalLinks,
    internalLinkIssues: findInternalLinkIssues(internalLinks),
    primaryActions,
    primaryActionIssues: findPrimaryActionIssues(primaryActions),
    interactiveControls,
    interactiveControlIssues: findInteractiveControlIssues(interactiveControls),
    stateFixtures,
    stateFixtureIssues: findStateFixtureIssues(stateFixtures),
  };
}

export function findInternalLinkIssues(
  records: readonly ProductInternalLinkRecord[],
): ProductInternalLinkIssue[] {
  return records
    .filter(({ matchedRoutePattern }) => matchedRoutePattern === null)
    .map((record) => ({
      code: "MISSING_INTERNAL_ROUTE" as const,
      recordId: record.id,
      sourceFile: record.sourceFile,
      target: record.normalizedTarget,
    }));
}

export function findPrimaryActionIssues(
  records: readonly ProductPrimaryActionRecord[],
): ProductPrimaryActionIssue[] {
  const issues: ProductPrimaryActionIssue[] = [];

  for (const record of records) {
    const implementationEvidence = record.implementationEvidence.filter(
      (evidence) =>
        evidence.actionId === record.actionId &&
        evidence.sourceFile.trim().length > 0 &&
        evidence.sourceLine > 0 &&
        isImplementationEvidenceBound(record, evidence),
    );
    const testEvidence = record.testEvidence.filter(
      (evidence) =>
        evidence.actionId === record.actionId &&
        record.declaredTestIds.includes(evidence.testId) &&
        evidence.testFile.trim().length > 0,
    );
    if (!record.contractSourceFile || !record.contractSourceLine) {
      issues.push({
        code: "ACTION_CONTRACT_SOURCE_MISSING",
        recordId: record.id,
        detail:
          "No exact non-test source declaration was found for the action ID.",
      });
    }
    if (implementationEvidence.length === 0) {
      issues.push({
        code: "ACTION_SOURCE_SIGNAL_MISSING",
        recordId: record.id,
        detail:
          "No route implementation source is bound to this exact action ID, destination or enforcement handler.",
      });
    }
    if (testEvidence.length === 0) {
      issues.push({
        code: "ACTION_TEST_MISSING",
        recordId: record.id,
        detail:
          "No existing focused test contains this exact action ID and one of its declared test IDs.",
      });
    }
    for (const destination of record.destinations) {
      if (destination.matchedRoutePattern !== null) continue;
      issues.push({
        code: "ACTION_DESTINATION_MISSING",
        recordId: record.id,
        detail: `The declared internal destination ${destination.normalizedTarget} has no page or route handler.`,
      });
    }
    if (
      record.resolution === "unresolved" ||
      implementationEvidence.length === 0 ||
      testEvidence.length === 0
    ) {
      issues.push({
        code: "ACTION_HANDLER_OR_DESTINATION_MISSING",
        recordId: record.id,
        detail:
          "The action does not have a complete action-bound implementation and focused-test contract.",
      });
    }
  }

  return issues;
}

function isImplementationEvidenceBound(
  record: ProductPrimaryActionRecord,
  evidence: ProductPrimaryActionImplementationEvidence,
) {
  if (evidence.binding === "action-id") {
    return evidence.value === record.actionId;
  }
  if (evidence.binding === "handler-token") {
    return bindingTokens(`${record.result} ${record.enforcement}`).includes(
      evidence.value,
    );
  }
  return record.destinations.some(
    (destination) =>
      destination.normalizedTarget === evidence.value ||
      (destination.matchedRoutePattern !== null &&
        destination.matchedRoutePattern === evidence.value),
  );
}

export function findInteractiveControlIssues(
  records: readonly ProductInteractiveControlRecord[],
): ProductInteractiveControlIssue[] {
  return records
    .filter(({ purposeContractIds }) => purposeContractIds.length === 0)
    .map((record) => ({
      code: "INTERACTIVE_CONTROL_PURPOSE_MISSING" as const,
      recordId: record.id,
      sourceFile: record.sourceFile,
      sourceLine: record.sourceLine,
      ownerRoutes: record.ownerRoutes,
    }));
}

export function findStateFixtureIssues(
  records: readonly ProductStateFixtureRecord[],
): ProductStateFixtureIssue[] {
  return records
    .filter(({ fixtureId }) => !fixtureId)
    .map((record) => ({
      code: "STATE_FIXTURE_MISSING" as const,
      recordId: record.id,
      route: record.route,
      stateId: record.stateId,
    }));
}

export function matchInternalRoute(
  rawTarget: string,
  routePatterns: readonly string[],
) {
  const normalizedTarget = normalizeInternalTarget(rawTarget);
  if (!normalizedTarget) return null;
  return (
    routePatterns.find((routePattern) =>
      routePatternToRegExp(routePattern).test(normalizedTarget),
    ) ?? null
  );
}

function collectSourceOwners() {
  const sourceOwners = new Map<string, Set<string>>();
  for (const screen of SCREEN_CONTRACTS) {
    const sourceFiles = screen.sourceFiles
      .flatMap((sourceFile) => [...getLocalSourceClosure(sourceFile)])
      .filter(isAuditableSourceFile);
    for (const sourceFile of sourceFiles) {
      const routes = sourceOwners.get(sourceFile) ?? new Set<string>();
      routes.add(screen.route);
      sourceOwners.set(sourceFile, routes);
    }
  }
  return new Map(
    [...sourceOwners].map(
      ([sourceFile, routes]) =>
        [
          sourceFile,
          [...routes].toSorted((left, right) => left.localeCompare(right)),
        ] as const,
    ),
  );
}

function collectInternalLinkRecords(
  sourceFile: string,
  ownerRoutes: readonly string[],
  routePatterns: readonly string[],
) {
  const source = readFileSync(sourceFile, "utf8");
  const parsed = parseSource(sourceFile, source);
  const targets: StaticTarget[] = [];

  visitSource(parsed, (node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(parsed) === "href") {
      const value = node.initializer
        ? ts.isStringLiteral(node.initializer)
          ? [node.initializer.text]
          : ts.isJsxExpression(node.initializer) && node.initializer.expression
            ? staticExpressionValues(node.initializer.expression, parsed)
            : []
        : [];
      value.forEach((rawTarget) =>
        targets.push({ rawTarget, kind: "jsx-href", node }),
      );
      return;
    }

    if (
      ts.isPropertyAssignment(node) &&
      propertyName(node.name, parsed) === "href"
    ) {
      staticExpressionValues(node.initializer, parsed).forEach((rawTarget) =>
        targets.push({ rawTarget, kind: "href-property", node }),
      );
      return;
    }

    if (
      ts.isCallExpression(node) &&
      NAVIGATION_CALL_PATTERN.test(node.expression.getText(parsed)) &&
      node.arguments[0]
    ) {
      staticExpressionValues(node.arguments[0], parsed).forEach((rawTarget) =>
        targets.push({ rawTarget, kind: "navigation-call", node }),
      );
    }
  });

  return targets.flatMap((target) => {
    const normalizedTarget = normalizeInternalTarget(target.rawTarget);
    if (!normalizedTarget || isPublicAssetTarget(normalizedTarget)) return [];
    const location = parsed.getLineAndCharacterOfPosition(
      target.node.getStart(parsed),
    );
    const matchedRoutePattern = matchInternalRoute(
      normalizedTarget,
      routePatterns,
    );
    const sourceLine = location.line + 1;
    const sourceColumn = location.character + 1;
    return [
      {
        id: `${sourceFile}:${sourceLine}:${sourceColumn}:${target.kind}:${normalizedTarget}`,
        sourceFile,
        sourceLine,
        sourceColumn,
        ownerRoutes: [...ownerRoutes],
        kind: target.kind,
        rawTarget: target.rawTarget,
        normalizedTarget,
        matchedRoutePattern,
      } satisfies ProductInternalLinkRecord,
    ];
  });
}

function collectInteractiveControlRecords(
  sourceOwners: ReadonlyMap<string, readonly string[]>,
  routePatterns: readonly string[],
) {
  const purposeContracts = collectPurposeContracts(routePatterns);
  const contractsByRoute = new Map<string, PurposeContract[]>();
  for (const contract of purposeContracts) {
    const contracts = contractsByRoute.get(contract.route) ?? [];
    contracts.push(contract);
    contractsByRoute.set(contract.route, contracts);
  }

  const records: ProductInteractiveControlRecord[] = [];
  for (const [sourceFile, ownerRoutes] of sourceOwners) {
    if (!isImplementationSourceFile(sourceFile)) continue;
    const source = readFileSync(sourceFile, "utf8");
    const parsed = parseSource(sourceFile, source);

    visitSource(parsed, (node) => {
      if (
        !ts.isJsxOpeningElement(node) &&
        !ts.isJsxSelfClosingElement(node)
      ) {
        return;
      }
      const tagName = node.tagName.getText(parsed);
      if (!isInteractiveControl(node, parsed, tagName)) return;

      const contextNodes = [node, findEnclosingForm(node, parsed)].filter(
        (candidate): candidate is ts.JsxOpeningLikeElement => Boolean(candidate),
      );
      const contextText = contextNodes
        .map((candidate) => candidate.getText(parsed))
        .join("\n");
      const staticTargets = contextNodes
        .flatMap((candidate) =>
          ["href", "to"].flatMap((attributeName) =>
            jsxStaticAttributeValues(candidate, parsed, attributeName),
          ),
        )
        .map((target) => normalizeInternalTarget(target))
        .filter((target): target is string => Boolean(target));
      const routeContracts = ownerRoutes.flatMap(
        (route) => contractsByRoute.get(route) ?? [],
      );
      const bindings = routeContracts.flatMap((contract) =>
        purposeContractBindings(
          contract,
          contextText,
          staticTargets,
          routePatterns,
        ),
      );
      const location = parsed.getLineAndCharacterOfPosition(
        node.getStart(parsed),
      );
      const sourceLine = location.line + 1;
      const sourceColumn = location.character + 1;

      records.push({
        id: `${sourceFile}:${sourceLine}:${sourceColumn}:${tagName}`,
        sourceFile,
        sourceLine,
        sourceColumn,
        ownerRoutes,
        tagName,
        purposeContractIds: [
          ...new Set(bindings.map(({ contractId }) => contractId)),
        ].toSorted((left, right) => left.localeCompare(right)),
        bindingEvidence: [
          ...new Set(bindings.map(({ evidence }) => evidence)),
        ].toSorted((left, right) => left.localeCompare(right)),
      });
    });
  }

  return records
    .filter(
      (record, index, allRecords) =>
        allRecords.findIndex(({ id }) => id === record.id) === index,
    )
    .toSorted((left, right) => left.id.localeCompare(right.id));
}

function collectPurposeContracts(routePatterns: readonly string[]) {
  const contractsByRoute = collectInteractionContractsByRoute();
  return SCREEN_CONTRACTS.flatMap((screen) => {
    const contract = contractsByRoute.get(screen.route);
    if (!contract) return [];
    return [
      ...contract.actions.map(
        (action) =>
          ({
            id: action.id,
            route: screen.route,
            kind: "action",
            bindingTokens: bindingTokens(
              `${action.result} ${action.enforcement ?? ""}`,
            ),
            destinations: extractActionDestinations(
              `${action.result} ${action.enforcement ?? ""}`,
              routePatterns,
            ),
          }) satisfies PurposeContract,
      ),
      ...contract.forms.map(
        (form) =>
          ({
            id: form.id,
            route: screen.route,
            kind: "form",
            bindingTokens: bindingTokens(form.submitsTo),
            destinations: extractActionDestinations(
              form.submitsTo,
              routePatterns,
            ),
          }) satisfies PurposeContract,
      ),
    ];
  });
}

function purposeContractBindings(
  contract: PurposeContract,
  contextText: string,
  staticTargets: readonly string[],
  routePatterns: readonly string[],
) {
  const bindings: { contractId: string; evidence: string }[] = [];
  if (contextText.includes(contract.id)) {
    bindings.push({
      contractId: contract.id,
      evidence: `${contract.id}:contract-id`,
    });
  }
  for (const token of contract.bindingTokens) {
    if (!new RegExp(`\\b${escapeRegExp(token)}\\b`).test(contextText)) continue;
    bindings.push({
      contractId: contract.id,
      evidence: `${contract.id}:handler-token:${token}`,
    });
  }
  for (const target of staticTargets) {
    const routePattern = matchInternalRoute(target, routePatterns);
    if (
      !contract.destinations.some(
        (destination) =>
          destination.normalizedTarget === target ||
          (routePattern !== null &&
            destination.matchedRoutePattern === routePattern),
      )
    ) {
      continue;
    }
    bindings.push({
      contractId: contract.id,
      evidence: `${contract.id}:destination:${target}`,
    });
  }
  return bindings;
}

function isInteractiveControl(
  node: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
  tagName: string,
) {
  const intrinsicName = tagName.toLowerCase();
  if (INTERACTIVE_INTRINSIC_TAGS.has(intrinsicName)) return true;
  if (
    /(?:^|\.)(?:Button|Checkbox|Form|Link|MenuItem|Radio|Select|Switch|Tab|Trigger)$/.test(
      tagName,
    )
  ) {
    return true;
  }
  return node.attributes.properties.some(
    (attribute) =>
      ts.isJsxAttribute(attribute) &&
      INTERACTIVE_ATTRIBUTE_NAMES.has(attribute.name.getText(sourceFile)),
  );
}

function findEnclosingForm(
  node: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
) {
  let parent: ts.Node | undefined = node.parent;
  while (parent) {
    if (ts.isJsxElement(parent)) {
      const opening = parent.openingElement;
      const tagName = opening.tagName.getText(sourceFile);
      if (tagName === "form" || tagName === "Form" || tagName.endsWith(".Form")) {
        return opening;
      }
    }
    parent = parent.parent;
  }
  return null;
}

function jsxStaticAttributeValues(
  node: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
  attributeName: string,
) {
  const attribute = node.attributes.properties.find(
    (candidate): candidate is ts.JsxAttribute =>
      ts.isJsxAttribute(candidate) &&
      candidate.name.getText(sourceFile) === attributeName,
  );
  if (!attribute?.initializer) return [];
  if (ts.isStringLiteral(attribute.initializer)) {
    return [attribute.initializer.text];
  }
  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
    return staticExpressionValues(attribute.initializer.expression, sourceFile);
  }
  return [];
}

function collectPrimaryActionRecords(
  sourceOwners: ReadonlyMap<string, readonly string[]>,
  routePatterns: readonly string[],
  actionSourceLocations: ReadonlyMap<string, ActionSourceLocation>,
  internalLinks: readonly ProductInternalLinkRecord[],
  interactiveControls: readonly ProductInteractiveControlRecord[],
) {
  const contractsByRoute = collectInteractionContractsByRoute();
  const records: ProductPrimaryActionRecord[] = [];

  for (const screen of SCREEN_CONTRACTS) {
    const actions = contractsByRoute.get(screen.route)?.actions ?? [];
    const sourceFiles = [...sourceOwners]
      .filter(([, routes]) => routes.includes(screen.route))
      .map(([sourceFile]) => sourceFile)
      .filter(isImplementationSourceFile)
      .toSorted((left, right) => left.localeCompare(right));
    const candidateTestFiles = screen.coverage.actions.evidence
      .filter((evidencePath) => TEST_FILE_PATTERN.test(evidencePath))
      .filter((evidencePath) => existsSync(evidencePath))
      .toSorted((left, right) => left.localeCompare(right));

    for (const action of actions) {
      const contractLocation = actionSourceLocations.get(action.id) ?? null;
      const destinations = extractActionDestinations(
        `${action.result} ${action.enforcement ?? ""}`,
        routePatterns,
      );
      const implementationEvidence = collectActionImplementationEvidence(
        action,
        screen.route,
        sourceFiles,
        destinations,
        internalLinks,
        interactiveControls,
      );
      const testEvidence = collectActionTestEvidence(
        action,
        candidateTestFiles,
      );
      const hasHandlerContract = Boolean(
        action.enforcement?.trim() &&
        contractLocation &&
        implementationEvidence.length > 0 &&
        testEvidence.length > 0,
      );
      const hasDestination = destinations.some(
        ({ matchedRoutePattern }) => matchedRoutePattern !== null,
      );

      records.push({
        id: `${screen.route}::${action.id}`,
        route: screen.route,
        actionId: action.id,
        result: action.result,
        enforcement: action.enforcement ?? "",
        contractSourceFile: contractLocation?.sourceFile ?? null,
        contractSourceLine: contractLocation?.sourceLine ?? null,
        declaredTestIds: [...action.testIds],
        implementationEvidence,
        testEvidence,
        destinations,
        resolution:
          hasHandlerContract && hasDestination
            ? "destination-and-handler-contract"
            : hasHandlerContract
              ? "handler-contract"
              : "unresolved",
      });
    }
  }

  return records.toSorted((left, right) => left.id.localeCompare(right.id));
}

function collectActionImplementationEvidence(
  action: PrimaryAction,
  route: string,
  sourceFiles: readonly string[],
  destinations: readonly ProductPrimaryActionDestination[],
  internalLinks: readonly ProductInternalLinkRecord[],
  interactiveControls: readonly ProductInteractiveControlRecord[],
) {
  const evidence: ProductPrimaryActionImplementationEvidence[] = [];
  const sourceFileSet = new Set(sourceFiles);

  for (const control of interactiveControls) {
    if (
      !sourceFileSet.has(control.sourceFile) ||
      !control.ownerRoutes.includes(route) ||
      !control.purposeContractIds.includes(action.id)
    ) {
      continue;
    }
    const contractBinding = control.bindingEvidence.find((binding) =>
      binding.startsWith(`${action.id}:`),
    );
    if (!contractBinding) continue;
    const implementationBinding = implementationBindingFromControl(
      action.id,
      contractBinding,
    );
    if (!implementationBinding) continue;
    evidence.push({
      actionId: action.id,
      sourceFile: control.sourceFile,
      sourceLine: control.sourceLine,
      ...implementationBinding,
    });
  }

  for (const link of internalLinks) {
    if (
      !sourceFileSet.has(link.sourceFile) ||
      !link.ownerRoutes.includes(route) ||
      !destinations.some(
        (destination) =>
          destination.normalizedTarget === link.normalizedTarget ||
          (destination.matchedRoutePattern !== null &&
            destination.matchedRoutePattern === link.matchedRoutePattern),
      )
    ) {
      continue;
    }
    const exactDestination = destinations.find(
      (destination) =>
        destination.normalizedTarget === link.normalizedTarget,
    );
    const routePatternDestination = destinations.find(
      (destination) =>
        destination.matchedRoutePattern !== null &&
        destination.matchedRoutePattern === link.matchedRoutePattern,
    );
    evidence.push({
      actionId: action.id,
      sourceFile: link.sourceFile,
      sourceLine: link.sourceLine,
      binding: "destination-control",
      value:
        exactDestination?.normalizedTarget ??
        routePatternDestination?.matchedRoutePattern ??
        link.normalizedTarget,
    });
  }

  const tokens = bindingTokens(`${action.result} ${action.enforcement ?? ""}`);
  for (const sourceFile of sourceFiles) {
    const source = readFileSync(sourceFile, "utf8");
    const parsed = parseSource(sourceFile, source);
    visitSource(parsed, (node) => {
      if (!ts.isIdentifier(node)) return;
      const binding =
        node.text === action.id
          ? "action-id"
          : tokens.includes(node.text)
            ? "handler-token"
            : null;
      if (!binding) return;
      const location = parsed.getLineAndCharacterOfPosition(
        node.getStart(parsed),
      );
      evidence.push({
        actionId: action.id,
        sourceFile,
        sourceLine: location.line + 1,
        binding,
        value: node.text,
      });
    });
  }

  return evidence
    .filter(
      (item, index, allItems) =>
        allItems.findIndex(
          (candidate) =>
            candidate.actionId === item.actionId &&
            candidate.sourceFile === item.sourceFile &&
            candidate.sourceLine === item.sourceLine &&
            candidate.binding === item.binding &&
            candidate.value === item.value,
        ) === index,
    )
    .toSorted((left, right) =>
      `${left.sourceFile}:${left.sourceLine}:${left.binding}:${left.value}`.localeCompare(
        `${right.sourceFile}:${right.sourceLine}:${right.binding}:${right.value}`,
      ),
    );
}

function implementationBindingFromControl(
  actionId: string,
  contractBinding: string,
): Pick<ProductPrimaryActionImplementationEvidence, "binding" | "value"> | null {
  const prefix = `${actionId}:`;
  if (!contractBinding.startsWith(prefix)) return null;
  const binding = contractBinding.slice(prefix.length);
  if (binding === "contract-id") {
    return { binding: "action-id", value: actionId };
  }
  if (binding.startsWith("handler-token:")) {
    return {
      binding: "handler-token",
      value: binding.slice("handler-token:".length),
    };
  }
  if (binding.startsWith("destination:")) {
    return {
      binding: "destination-control",
      value: binding.slice("destination:".length),
    };
  }
  return null;
}

function collectActionTestEvidence(
  action: PrimaryAction,
  candidateTestFiles: readonly string[],
) {
  return candidateTestFiles.flatMap((testFile) => {
    const source = readFileSync(testFile, "utf8");
    if (!source.includes(action.id)) return [];
    return action.testIds
      .filter((testId) => source.includes(testId))
      .map(
        (testId) =>
          ({
            actionId: action.id,
            testId,
            testFile,
          }) satisfies ProductPrimaryActionTestEvidence,
      );
  });
}

function collectStateFixtureRecords() {
  return SCREEN_CONTRACTS.flatMap((screen) =>
    screen.stateRules.map(
      (state) =>
        ({
          id: `${screen.route}::${state.id}`,
          route: screen.route,
          stateId: state.id,
          fixtureId: state.fixtureId?.trim() || null,
          recoveryActionId: state.recoveryActionId?.trim() || null,
          evidence: [...screen.coverage.states.evidence],
        }) satisfies ProductStateFixtureRecord,
    ),
  ).toSorted((left, right) => left.id.localeCompare(right.id));
}

function collectActionSourceLocations(repoRoot: string) {
  const screenContractRoot = path.join(
    repoRoot,
    "src",
    "components",
    "screen-contracts",
  );
  const actions = collectDeclaredActions();
  const actionIds = new Set(actions.map(({ id }) => id));
  const locations = new Map<string, ActionSourceLocation>();
  const sourceLines: ActionSourceLine[] = [];

  for (const absoluteFile of walkFiles(screenContractRoot)) {
    if (
      !SOURCE_FILE_PATTERN.test(absoluteFile) ||
      TEST_FILE_PATTERN.test(absoluteFile)
    ) {
      continue;
    }
    const sourceFile = normalizeRepoPath(path.relative(repoRoot, absoluteFile));
    const lines = readFileSync(absoluteFile, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      sourceLines.push({
        sourceFile,
        sourceLine: index + 1,
        sourceText: line,
      });
      for (const actionId of actionIds) {
        if (locations.has(actionId) || !line.includes(actionId)) continue;
        locations.set(actionId, { sourceFile, sourceLine: index + 1 });
      }
    });
  }

  for (const action of actions) {
    if (locations.has(action.id)) continue;
    const exactEnforcement = sourceLines.find(({ sourceText }) =>
      sourceText.includes(action.enforcement ?? "\0"),
    );
    if (exactEnforcement && action.enforcement?.trim()) {
      locations.set(action.id, sourceLocation(exactEnforcement));
      continue;
    }

    const handlerTokens = codeLikeTokens(action.enforcement ?? "");
    const generatedContract = sourceLines.find(({ sourceText }) =>
      handlerTokens.some((token) => sourceText.includes(token)),
    );
    if (generatedContract) {
      locations.set(action.id, sourceLocation(generatedContract));
    }
  }

  return locations;
}

function collectDeclaredActions() {
  const contractsByRoute = collectInteractionContractsByRoute();
  const actions = new Map<string, PrimaryAction>();
  for (const screen of SCREEN_CONTRACTS) {
    const routeActions = contractsByRoute.get(screen.route)?.actions ?? [];
    routeActions.forEach((action) => actions.set(action.id, action));
  }
  return [...actions.values()];
}

function collectInteractionContractsByRoute() {
  const contracts = new Map<string, InteractionContract>();
  for (const manifest of DESIGN_LAB_USER_STORY_MANIFESTS) {
    contracts.set(manifest.route, {
      actions: manifest.actions,
      forms: manifest.forms,
    });
  }
  const productionContracts =
    PRODUCTION_SCREEN_INTERACTION_CONTRACTS as Readonly<
      Record<string, InteractionContract | undefined>
    >;
  for (const [route, contract] of Object.entries(productionContracts)) {
    if (contract) contracts.set(route, contract);
  }
  return contracts;
}

function codeLikeTokens(value: string) {
  return [...value.matchAll(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g)]
    .map(([token]) => token)
    .filter(
      (token) =>
        /[a-z][A-Z]|^[A-Z][A-Z0-9_]+$/.test(token) && token.length >= 5,
    )
    .toSorted((left, right) => right.length - left.length);
}

function bindingTokens(value: string) {
  return codeLikeTokens(value).filter(
    (token) => !NON_BINDING_TOKENS.has(token),
  );
}

function sourceLocation(line: ActionSourceLine): ActionSourceLocation {
  return { sourceFile: line.sourceFile, sourceLine: line.sourceLine };
}

function extractActionDestinations(
  text: string,
  routePatterns: readonly string[],
) {
  const rawTargets = [...text.matchAll(ACTION_PATH_PATTERN)]
    .map((match) => cleanActionPath(match[1] ?? ""))
    .filter(Boolean)
    .filter((target, index, targets) => targets.indexOf(target) === index);

  return rawTargets.map((rawTarget) => {
    const normalizedTarget = normalizeInternalTarget(rawTarget) ?? rawTarget;
    return {
      rawTarget,
      normalizedTarget,
      matchedRoutePattern: matchInternalRoute(normalizedTarget, routePatterns),
    } satisfies ProductPrimaryActionDestination;
  });
}

function cleanActionPath(value: string) {
  return value
    .replace(/[.,;:!?]+$/g, "")
    .replace(/\/$/, (match) => (value === "/" ? match : ""));
}

function staticExpressionValues(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
  visitedIdentifiers = new Set<string>(),
): string[] {
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  ) {
    return [expression.text];
  }
  if (ts.isTemplateExpression(expression)) {
    let value = expression.head.text;
    for (const span of expression.templateSpans) {
      value += DYNAMIC_VALUE + span.literal.text;
    }
    return [value];
  }
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return staticExpressionValues(
      expression.expression,
      sourceFile,
      visitedIdentifiers,
    );
  }
  if (ts.isConditionalExpression(expression)) {
    return [
      ...staticExpressionValues(
        expression.whenTrue,
        sourceFile,
        visitedIdentifiers,
      ),
      ...staticExpressionValues(
        expression.whenFalse,
        sourceFile,
        visitedIdentifiers,
      ),
    ];
  }
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = staticExpressionValues(
      expression.left,
      sourceFile,
      visitedIdentifiers,
    );
    const right = staticExpressionValues(
      expression.right,
      sourceFile,
      visitedIdentifiers,
    );
    if (left.length === 0 && right.length > 0) {
      return right.map((value) => `${DYNAMIC_VALUE}${value}`);
    }
    if (right.length === 0 && left.length > 0) {
      return left.map((value) => `${value}${DYNAMIC_VALUE}`);
    }
    return left.flatMap((leftValue) =>
      right.map((rightValue) => `${leftValue}${rightValue}`),
    );
  }
  if (
    ts.isNewExpression(expression) &&
    expression.expression.getText() === "URL" &&
    expression.arguments?.[0]
  ) {
    return staticExpressionValues(
      expression.arguments[0],
      sourceFile,
      visitedIdentifiers,
    );
  }
  if (ts.isIdentifier(expression)) {
    if (visitedIdentifiers.has(expression.text)) return [];
    const initializer = findIdentifierInitializer(expression, sourceFile);
    if (!initializer) return [];
    return staticExpressionValues(
      initializer,
      sourceFile,
      new Set([...visitedIdentifiers, expression.text]),
    );
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const initializer = findPropertyInitializer(expression, sourceFile);
    return initializer
      ? staticExpressionValues(initializer, sourceFile, visitedIdentifiers)
      : [];
  }
  return [];
}

function findIdentifierInitializer(
  reference: ts.Identifier,
  sourceFile: ts.SourceFile,
): ts.Expression | null {
  let match: ts.VariableDeclaration | null = null;
  visitSource(sourceFile, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === reference.text &&
      node.initializer &&
      node.getStart(sourceFile) < reference.getStart(sourceFile) &&
      (!match || node.getStart(sourceFile) > match.getStart(sourceFile))
    ) {
      match = node;
    }
  });
  const declaration = match as ts.VariableDeclaration | null;
  return declaration?.initializer ?? null;
}

function findPropertyInitializer(
  reference: ts.PropertyAccessExpression,
  sourceFile: ts.SourceFile,
): ts.Expression | null {
  const owner = resolveObjectLiteral(reference.expression, sourceFile);
  if (!owner) return null;
  const property = owner.properties.find(
    (candidate): candidate is ts.PropertyAssignment =>
      ts.isPropertyAssignment(candidate) &&
      propertyName(candidate.name, sourceFile) === reference.name.text,
  );
  return property?.initializer ?? null;
}

function resolveObjectLiteral(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
): ts.ObjectLiteralExpression | null {
  if (ts.isObjectLiteralExpression(expression)) return expression;
  if (ts.isIdentifier(expression)) {
    const initializer = findIdentifierInitializer(expression, sourceFile);
    return initializer ? resolveObjectLiteral(initializer, sourceFile) : null;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const initializer = findPropertyInitializer(expression, sourceFile);
    return initializer ? resolveObjectLiteral(initializer, sourceFile) : null;
  }
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
    return resolveObjectLiteral(expression.expression, sourceFile);
  }
  return null;
}

function normalizeInternalTarget(rawTarget: string) {
  const target = rawTarget.trim();
  if (!target) return null;
  if (target.startsWith("#") || target.startsWith("?")) return "/";
  if (!target.startsWith("/") || target.startsWith("//")) return null;
  const pathname = target.split(/[?#]/, 1)[0] ?? "/";
  const normalized = pathname.replace(/\/{2,}/g, "/");
  if (normalized === "/") return normalized;
  return normalized.replace(/\/$/, "");
}

function isPublicAssetTarget(target: string) {
  return (
    target.startsWith("/_next/") ||
    target.startsWith("/images/") ||
    target.startsWith("/fonts/") ||
    target.startsWith("/icons/") ||
    /\.[a-z0-9]{2,8}$/i.test(target)
  );
}

function routePatternToRegExp(routePattern: string) {
  if (routePattern === "/") return /^\/$/;
  const segments = routePattern.split("/").filter(Boolean);
  let source = "^";
  for (const segment of segments) {
    if (/^\[\[\.\.\.[^\]]+\]\]$/.test(segment)) {
      source += "(?:/.*)?";
    } else if (/^\[\.\.\.[^\]]+\]$/.test(segment)) {
      source += "/.+";
    } else if (/^\[[^\]]+\]$/.test(segment)) {
      source += "/[^/]+";
    } else {
      source += `/${escapeRegExp(segment)}`;
    }
  }
  return new RegExp(`${source}/?$`);
}

function discoverPageRoutePatterns(repoRoot: string) {
  const appRoot = path.join(repoRoot, "src", "app");
  return walkFiles(appRoot)
    .filter((absoluteFile) => path.basename(absoluteFile) === "page.tsx")
    .map((absoluteFile) => {
      const relativeDirectory = normalizeRepoPath(
        path.relative(appRoot, path.dirname(absoluteFile)),
      );
      const segments = relativeDirectory
        .split("/")
        .filter(Boolean)
        .filter((segment) => !segment.startsWith("@"))
        .filter((segment) => !/^\(.+\)$/.test(segment));
      return segments.length > 0 ? `/${segments.join("/")}` : "/";
    })
    .filter((route, index, routes) => routes.indexOf(route) === index)
    .toSorted((left, right) => left.localeCompare(right));
}

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((entry) => {
    const absolutePath = path.join(root, entry);
    return statSync(absolutePath).isDirectory()
      ? walkFiles(absolutePath)
      : [absolutePath];
  });
}

function parseSource(filePath: string, source: string) {
  return ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function visitSource(
  sourceFile: ts.SourceFile,
  inspect: (node: ts.Node) => void,
) {
  function visit(node: ts.Node) {
    inspect(node);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function propertyName(name: ts.PropertyName, sourceFile: ts.SourceFile) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return name.getText(sourceFile);
}

function isAuditableSourceFile(sourceFile: string) {
  return (
    sourceFile.startsWith("src/") &&
    SOURCE_FILE_PATTERN.test(sourceFile) &&
    !TEST_FILE_PATTERN.test(sourceFile)
  );
}

function isImplementationSourceFile(sourceFile: string) {
  return (
    isAuditableSourceFile(sourceFile) &&
    !sourceFile.startsWith("src/components/screen-contracts/") &&
    sourceFile !== "src/components/demo-experience-registry.ts" &&
    !/^src\/components\/product-.+-evidence\.tsx?$/.test(sourceFile) &&
    sourceFile !==
      "src/components/product-automated-source-gate-registry.ts"
  );
}

function normalizeRepoPath(filePath: string) {
  return filePath.replaceAll("\\", "/");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
