import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import {
  PRODUCT_ACCESSIBILITY_FIELD_ERROR_EVIDENCE_FILE,
  PRODUCT_ACCESSIBILITY_FIELD_ERROR_MASTER_EVIDENCE,
  PRODUCT_ACCESSIBILITY_FIELD_ERROR_REQUIREMENT_IDS,
  PRODUCT_ACCESSIBILITY_FIELD_ERROR_SCOPE,
  PRODUCT_ACCESSIBILITY_FIELD_ERROR_TEST_FILE,
} from "./product-accessibility-field-error-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-ACCESSIBILITY-FIELD-ERROR-EVIDENCE

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const SOURCE_FIELD_COUNTS = new Map([
  ["src/app/account/team/team-invite-form.tsx", 2],
  ["src/components/conversation-call-panel.tsx", 3],
  ["src/components/feed-comments-panel.tsx", 1],
  ["src/components/hub/add-friend-search.tsx", 1],
  ["src/components/hub/hub-conversation-dock.tsx", 1],
  ["src/components/instant-feed-controls.tsx", 6],
  ["src/components/instant-listing-enquiry-form.tsx", 1],
  ["src/components/instant-message-composer.tsx", 1],
] as const);
const NATIVE_CONTROL_TAGS = new Set(["input", "select", "textarea"]);
const EXPECTED_FIELD_COUNT = 16;

assert.deepEqual(PRODUCT_ACCESSIBILITY_FIELD_ERROR_REQUIREMENT_IDS, [
  "GLOBAL.A11Y.errors",
]);
assert.equal(
  PRODUCT_MASTER_REQUIREMENTS.some(({ id }) => id === "GLOBAL.A11Y.errors"),
  true,
);

const evidence =
  PRODUCT_ACCESSIBILITY_FIELD_ERROR_MASTER_EVIDENCE["GLOBAL.A11Y.errors"];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_ACCESSIBILITY_FIELD_ERROR_EVIDENCE_FILE,
  PRODUCT_ACCESSIBILITY_FIELD_ERROR_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((evidencePath) =>
  assert.equal(existsSync(resolveRepoPath(evidencePath)), true, evidencePath),
);

const evidenceSource = source(PRODUCT_ACCESSIBILITY_FIELD_ERROR_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_ACCESSIBILITY_FIELD_ERROR_SCOPE, /16 native controls/i);
assert.match(PRODUCT_ACCESSIBILITY_FIELD_ERROR_SCOPE, /aria-invalid/i);
assert.match(PRODUCT_ACCESSIBILITY_FIELD_ERROR_SCOPE, /aria-errormessage/i);
assert.match(PRODUCT_ACCESSIBILITY_FIELD_ERROR_SCOPE, /does not prove/i);

let linkedFieldCount = 0;
for (const [sourcePath, expectedCount] of SOURCE_FIELD_COUNTS) {
  const audit = auditSource(sourcePath);
  assert.equal(audit.linkedFields, expectedCount, sourcePath);
  assert.deepEqual(audit.unresolvedErrorTargets, [], sourcePath);
  assert.deepEqual(audit.missingInvalidState, [], sourcePath);
  assert.deepEqual(audit.missingAlertTarget, [], sourcePath);
  linkedFieldCount += audit.linkedFields;
}

assert.equal(linkedFieldCount, EXPECTED_FIELD_COUNT);

console.log(
  `Accessibility field-error evidence passed: ${linkedFieldCount} native controls retain active aria-invalid and alert-linked aria-errormessage contracts across ${SOURCE_FIELD_COUNTS.size} reachable source files.`,
);

type SourceAudit = {
  linkedFields: number;
  unresolvedErrorTargets: string[];
  missingInvalidState: string[];
  missingAlertTarget: string[];
};

function auditSource(sourcePath: string): SourceAudit {
  const sourceFile = parseSource(sourcePath);
  const alertIds = new Set<string>();
  const controls: Array<{
    location: string;
    invalidState: string | null;
    condition: string | null;
    target: string;
  }> = [];

  visit(sourceFile, (node) => {
    if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) {
      return;
    }

    const id = attributeValue(node, sourceFile, "id");
    const role = attributeValue(node, sourceFile, "role");
    if (id && role?.includes("alert")) alertIds.add(unquote(id));

    const tagName = node.tagName.getText(sourceFile);
    if (!NATIVE_CONTROL_TAGS.has(tagName)) return;
    const errorMessage = attributeValue(node, sourceFile, "aria-errormessage");
    if (!errorMessage) return;

    controls.push({
      location: sourceLocation(sourcePath, sourceFile, node),
      invalidState: attributeValue(node, sourceFile, "aria-invalid"),
      ...errorTarget(errorMessage),
    });
  });

  return {
    linkedFields: controls.length,
    unresolvedErrorTargets: controls
      .filter(({ target }) => !alertIds.has(target))
      .map(({ location, target }) => `${location}: ${target}`),
    missingInvalidState: controls
      .filter(({ invalidState, condition }) => !matchesInvalidState(invalidState, condition))
      .map(({ location }) => location),
    missingAlertTarget: controls
      .filter(({ target }) => !target)
      .map(({ location }) => location),
  };
}

function attributeValue(
  node: ts.JsxOpeningLikeElement,
  sourceFile: ts.SourceFile,
  expectedName: string,
) {
  const attribute = node.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) &&
      property.name.getText(sourceFile) === expectedName,
  );
  if (!attribute?.initializer) return null;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  if (!ts.isJsxExpression(attribute.initializer) || !attribute.initializer.expression) {
    return null;
  }
  return attribute.initializer.expression.getText(sourceFile);
}

function errorTarget(value: string) {
  const conditional = value.match(/^(.*)\s\?\s(.+?)\s:\sundefined$/);
  return {
    condition: conditional?.[1].trim() ?? null,
    target: unquote((conditional?.[2] ?? value).trim()),
  };
}

function matchesInvalidState(value: string | null, condition: string | null) {
  if (!value || !condition) return false;
  return value.replace(/^Boolean\((.+)\)$/, "$1") === condition;
}

function unquote(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith("`") && value.endsWith("`"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseSource(sourcePath: string) {
  const absolutePath = resolveRepoPath(sourcePath);
  return ts.createSourceFile(
    absolutePath,
    readFileSync(absolutePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function source(sourcePath: string) {
  return readFileSync(resolveRepoPath(sourcePath), "utf8");
}

function resolveRepoPath(sourcePath: string) {
  return path.resolve(REPOSITORY_ROOT, sourcePath);
}

function sourceLocation(sourcePath: string, sourceFile: ts.SourceFile, node: ts.Node) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${sourcePath}:${line + 1}`;
}

function visit(node: ts.Node, inspect: (candidate: ts.Node) => void) {
  inspect(node);
  ts.forEachChild(node, (child) => visit(child, inspect));
}
