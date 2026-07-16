import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import { AGENTS_ONBOARDING_ROUTE_TOURS } from "./agents-onboarding-tour-registry";
import { COMMUNITY_ONBOARDING_ROUTE_TOURS } from "./community-onboarding-tour-registry";
import { DESIGN_LAB_ONBOARDING_ROUTE_TOURS } from "./design-lab-onboarding-tour-registry";
import { MARKETPLACE_ONBOARDING_ROUTE_TOURS } from "./marketplace-onboarding-tour-registry";
import {
  ACCOUNT_ONBOARDING_ROUTE_TOURS,
  ADMIN_ONBOARDING_ROUTE_TOURS,
} from "./onboarding-tour-registry";
import {
  PRODUCT_TOUR_KEYBOARD_GATE_EVIDENCE_FILE,
  PRODUCT_TOUR_KEYBOARD_GATE_MASTER_EVIDENCE,
  PRODUCT_TOUR_KEYBOARD_GATE_REQUIREMENT_IDS,
  PRODUCT_TOUR_KEYBOARD_GATE_SCOPE,
  PRODUCT_TOUR_KEYBOARD_GATE_TEST_FILE,
} from "./product-tour-keyboard-gate-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import { PUBLIC_ONBOARDING_ROUTE_TOURS } from "./public-onboarding-tour-registry";
import { RACING_ONBOARDING_ROUTE_TOURS } from "./racing-onboarding-tour-registry";

// screen-evidence-test-id: PRODUCT-TOUR-KEYBOARD-GATE

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const INTERACTIVE_HELP_SOURCE = "src/components/interactive-help.tsx";
const NATIVE_ACTIVATION_TAGS = new Set(["a", "button", "input", "select", "summary", "textarea"]);
const ACTIVATION_ATTRIBUTES = new Set(["onClick", "onMouseDown", "onPointerDown"]);

const tourGroups = [
  ADMIN_ONBOARDING_ROUTE_TOURS,
  ACCOUNT_ONBOARDING_ROUTE_TOURS,
  PUBLIC_ONBOARDING_ROUTE_TOURS,
  RACING_ONBOARDING_ROUTE_TOURS,
  COMMUNITY_ONBOARDING_ROUTE_TOURS,
  MARKETPLACE_ONBOARDING_ROUTE_TOURS,
  AGENTS_ONBOARDING_ROUTE_TOURS,
  DESIGN_LAB_ONBOARDING_ROUTE_TOURS,
] as const;
const tours = tourGroups.flatMap((group) => [...group]);

assert.deepEqual(PRODUCT_TOUR_KEYBOARD_GATE_REQUIREMENT_IDS, [
  "VERIFY.GATE.tour-keyboard",
]);
assert.equal(
  PRODUCT_MASTER_REQUIREMENTS.find(
    ({ id }) => id === "VERIFY.GATE.tour-keyboard",
  )?.requirement,
  "Fail when a tour cannot be completed with the keyboard.",
);

const evidence =
  PRODUCT_TOUR_KEYBOARD_GATE_MASTER_EVIDENCE["VERIFY.GATE.tour-keyboard"];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_TOUR_KEYBOARD_GATE_EVIDENCE_FILE,
  PRODUCT_TOUR_KEYBOARD_GATE_TEST_FILE,
]);
for (const evidencePath of evidence.evidence) {
  assert.equal(existsSync(resolveRepoPath(evidencePath)), true, evidencePath);
}

assert.equal(tours.length, 87, "all registered route tours must use the shared keyboard path");
assert.equal(
  tours.reduce((total, tour) => total + tour.steps.length, 0),
  435,
  "all registered tour steps must remain reachable through shared controls",
);
assert.equal(
  new Set(tours.map(({ route }) => route)).size,
  tours.length,
  "route tours must not create ambiguous keyboard journeys",
);
for (const tour of tours) {
  assert.ok(tour.steps.length > 0, tour.route);
  assert.equal(new Set(tour.steps.map(({ id }) => id)).size, tour.steps.length, tour.route);
  for (const step of tour.steps) {
    assert.ok(step.id.trim(), `${tour.route}: step id`);
    assert.ok(step.title.trim(), `${tour.route}: step title`);
    assert.ok(step.body.trim(), `${tour.route}: step body`);
    assert.ok(step.targetId, `${tour.route}: target`);
    assert.ok(step.fallbackTargetId, `${tour.route}: fallback target`);
  }
}

const interactiveHelp = source(INTERACTIVE_HELP_SOURCE);
assert.deepEqual(findTourKeyboardGateIssues(interactiveHelp), []);
assert.match(interactiveHelp, /disabled=\{stepIndex === 0\}/);
assert.match(interactiveHelp, /changeStep\(stepIndex - 1\)/);
assert.match(interactiveHelp, /onClick=\{skipCurrentStep\}/);
assert.match(interactiveHelp, /if \(lastStep\) closeAndComplete\(\);/);
assert.match(interactiveHelp, /else changeStep\(stepIndex \+ 1\);/);
assert.match(interactiveHelp, />\s*Back\s*<\/button>/);
assert.match(interactiveHelp, /\bFinish\b/);
assert.match(interactiveHelp, /\bNext\b/);
assert.match(interactiveHelp, /\bSkip step\b/);
assert.match(interactiveHelp, /document\.activeElement instanceof HTMLElement/);
assert.match(interactiveHelp, /previousFocus\?\.isConnected\) previousFocus\.focus\(\)/);
assert.match(interactiveHelp, /aria-live="polite"/);

const sheet = source("src/components/ui/sheet.tsx");
assert.match(sheet, /Dialog as SheetPrimitive/);
assert.match(sheet, /SheetPrimitive\.Root/);
assert.match(sheet, /SheetPrimitive\.Popup/);
assert.match(sheet, /SheetPrimitive\.Close/);

const globalInteractionGate = source(
  "src/components/global-accessibility-interaction.test.ts",
);
assert.match(globalInteractionGate, /const sourceRoots = \["src\/app", "src\/components"\]/);
assert.match(globalInteractionGate, /all direct activation surfaces must be native controls/i);
assert.match(globalInteractionGate, /positive tab indices break visual and keyboard focus order/i);

const missingNext = interactiveHelp.replace(
  "else changeStep(stepIndex + 1);",
  "else void 0;",
);
assert.ok(
  findTourKeyboardGateIssues(missingNext).includes("next transition missing"),
);
assert.deepEqual(findKeyboardSourceIssues("const Broken = () => <div onClick={next}>Next</div>;"), [
  "non-native activation at div:onClick",
]);
assert.deepEqual(findKeyboardSourceIssues("const Broken = () => <button tabIndex={2}>Next</button>;"), [
  "positive tab index at button",
]);

assert.match(PRODUCT_TOUR_KEYBOARD_GATE_SCOPE, /87 registered onboarding tours and 435 steps/i);
assert.match(PRODUCT_TOUR_KEYBOARD_GATE_SCOPE, /negative broken-control fixtures/i);
assert.match(PRODUCT_TOUR_KEYBOARD_GATE_SCOPE, /does not prove rendered focus traversal/i);
assert.match(PRODUCT_TOUR_KEYBOARD_GATE_SCOPE, /production readiness/i);

console.log(
  "Tour keyboard gate evidence passed: 87 route tours and 435 steps retain one native, focus-restoring Back/Skip/Next/Finish path.",
);

function findKeyboardSourceIssues(sourceText: string) {
  const parsed = ts.createSourceFile(
    "fixture.tsx",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const issues: string[] = [];

  function inspect(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(parsed);
      const intrinsic = /^[a-z]/.test(tagName);
      for (const property of node.attributes.properties) {
        if (!ts.isJsxAttribute(property)) continue;
        const attributeName = property.name.getText(parsed);
        if (
          intrinsic &&
          ACTIVATION_ATTRIBUTES.has(attributeName) &&
          !NATIVE_ACTIVATION_TAGS.has(tagName)
        ) {
          issues.push(`non-native activation at ${tagName}:${attributeName}`);
        }
        if (
          attributeName === "tabIndex" &&
          /^(?:[1-9]\d*|\{[1-9]\d*\})$/.test(
            property.initializer?.getText(parsed) ?? "",
          )
        ) {
          issues.push(`positive tab index at ${tagName}`);
        }
      }
    }
    ts.forEachChild(node, inspect);
  }

  inspect(parsed);
  return issues.toSorted();
}

function findTourKeyboardGateIssues(sourceText: string) {
  return [
    ...findKeyboardSourceIssues(sourceText),
    ...[
      [/changeStep\(stepIndex - 1\)/, "back transition missing"],
      [/onClick=\{skipCurrentStep\}/, "skip transition missing"],
      [/else changeStep\(stepIndex \+ 1\);/, "next transition missing"],
      [/if \(lastStep\) closeAndComplete\(\);/, "finish transition missing"],
      [/previousFocus\?\.isConnected\) previousFocus\.focus\(\)/, "focus restoration missing"],
    ].flatMap(([pattern, issue]) =>
      (pattern as RegExp).test(sourceText) ? [] : [issue as string],
    ),
  ].toSorted();
}

function source(sourcePath: string) {
  return readFileSync(resolveRepoPath(sourcePath), "utf8");
}

function resolveRepoPath(sourcePath: string) {
  return path.resolve(REPOSITORY_ROOT, sourcePath);
}
