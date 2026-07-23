import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import {
  PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_EVIDENCE_FILE,
  PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_MASTER_EVIDENCE,
  PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_REQUIREMENT_IDS,
  PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_SCOPE,
  PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_TEST_FILE,
} from "./product-public-route-accessibility-evidence";
import { buildProductFieldContractSourceRegistry } from "./product-field-contract-source-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import { getLocalSourceClosure } from "./screen-contracts/screen-contract-source-audit";

// screen-evidence-test-id: PRODUCT-PUBLIC-ROUTE-ACCESSIBILITY

const REPOSITORY_ROOT = path.resolve(__dirname, "../..");
const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/contact",
  "/pricing",
  "/privacy",
  "/responsible-use",
  "/terms",
] as const;
const NATIVE_ACTIVATION_TAGS = new Set([
  "a",
  "button",
  "input",
  "label",
  "select",
  "summary",
  "textarea",
]);
const NAMED_CONTROL_TAGS = new Set(["a", "button", "summary", "Link"]);
const ACTIVATION_ATTRIBUTES = new Set(["onClick", "onMouseDown", "onPointerDown"]);
const REVIEWED_NON_NATIVE_ACTIVATIONS = new Set([
  "src/components/marketplace-dog-player-card.tsx:div:onPointerDown",
  "src/components/media-focal-point-editor.tsx:div:onPointerDown",
  "src/components/recipient-picker.tsx:li:onMouseDown",
]);

assert.deepEqual(PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_REQUIREMENT_IDS, [
  "ROUTE.PUBLIC.a11y",
]);
assert.equal(
  PRODUCT_MASTER_REQUIREMENTS.find(({ id }) => id === "ROUTE.PUBLIC.a11y")
    ?.requirement,
  "Preserve keyboard focus, semantic labels, and 44px primary touch targets.",
);

const evidence =
  PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_MASTER_EVIDENCE["ROUTE.PUBLIC.a11y"];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_EVIDENCE_FILE,
  PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_TEST_FILE,
]);
for (const evidencePath of evidence.evidence) {
  assert.equal(existsSync(resolveRepoPath(evidencePath)), true, evidencePath);
}

const publicContracts = PUBLIC_ROUTES.map((route) => {
  const contract = SCREEN_CONTRACTS.find((candidate) => candidate.route === route);
  assert.ok(contract, route);
  return contract;
});
const publicSourceFiles = [
  ...new Set(
    ["src/app/layout.tsx", ...publicContracts.flatMap(({ sourceFiles }) => sourceFiles)]
      .flatMap((sourceFile) => [...getLocalSourceClosure(sourceFile)])
      .filter((sourceFile) => sourceFile.endsWith(".tsx")),
  ),
].toSorted();
assert.equal(publicSourceFiles.length, 36);

const issues = publicSourceFiles.flatMap((sourceFile) =>
  findAccessibilityIssues(source(sourceFile), sourceFile),
);
assert.deepEqual(issues, []);

const publicRouteSet = new Set<string>(PUBLIC_ROUTES);
const publicFields = buildProductFieldContractSourceRegistry().records.filter(
  (field) => publicRouteSet.has(field.route) && !field.hidden,
);
assert.equal(publicFields.length, 2);
assert.deepEqual(
  publicFields
    .filter((field) => field.accessibleLabel === null)
    .map((field) => `${field.sourceFile}:${field.sourceLine}:${field.name}`),
  [],
);

const syntheticFailures = findAccessibilityIssues(
  `
    const Broken = () => <>
      <div onClick={open}>Open</div>
      <button tabIndex={2}><svg aria-hidden="true" /></button>
      <a className="outline-none" href="/next"><svg aria-hidden="true" /></a>
      <button data-action-contract="PUBLIC.ACTION.BROKEN">Continue</button>
    </>;
  `,
  "fixture.tsx",
);
assert.deepEqual(syntheticFailures, [
  "fixture.tsx:3: non-native activation div:onClick",
  "fixture.tsx:4: positive tab index button",
  "fixture.tsx:4: unnamed button",
  "fixture.tsx:5: outline removed without focus-visible a",
  "fixture.tsx:5: unnamed a",
  "fixture.tsx:6: primary action has no 44px source contract button",
]);

assert.match(PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_SCOPE, /seven public route source closures/i);
assert.match(PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_SCOPE, /focused negative fixtures/i);
assert.match(PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_SCOPE, /does not establish rendered focus traversal/i);
assert.match(PRODUCT_PUBLIC_ROUTE_ACCESSIBILITY_SCOPE, /production readiness/i);

console.log(
  `Public-route accessibility evidence passed: ${publicSourceFiles.length} reachable TSX files and ${publicFields.length} public fields satisfy the keyboard, name, focus and primary-touch source gate.`,
);

function findAccessibilityIssues(sourceText: string, sourceFile: string) {
  const parsed = ts.createSourceFile(
    sourceFile,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const issues: string[] = [];

  function inspect(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(parsed);
      const line = parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1;
      const attributes = new Map(
        node.attributes.properties.flatMap((property) =>
          ts.isJsxAttribute(property)
            ? [[property.name.getText(parsed), property.initializer?.getText(parsed) ?? ""] as const]
            : [],
        ),
      );
      const intrinsic = /^[a-z]/.test(tagName);
      for (const activationAttribute of ACTIVATION_ATTRIBUTES) {
        if (!attributes.has(activationAttribute) || !intrinsic) continue;
        const id = `${sourceFile}:${tagName}:${activationAttribute}`;
        if (!NATIVE_ACTIVATION_TAGS.has(tagName) && !REVIEWED_NON_NATIVE_ACTIVATIONS.has(id)) {
          issues.push(`${sourceFile}:${line}: non-native activation ${tagName}:${activationAttribute}`);
        }
      }
      if (/^(?:[1-9]\d*|\{[1-9]\d*\})$/.test(attributes.get("tabIndex") ?? "")) {
        issues.push(`${sourceFile}:${line}: positive tab index ${tagName}`);
      }
      const className = attributes.get("className") ?? "";
      if (className.includes("outline-none") && !className.includes("focus-visible")) {
        issues.push(`${sourceFile}:${line}: outline removed without focus-visible ${tagName}`);
      }
      if (
        NAMED_CONTROL_TAGS.has(tagName) &&
        !hasAccessibleName(node, attributes)
      ) {
        issues.push(`${sourceFile}:${line}: unnamed ${tagName}`);
      }
      if (
        attributes.has("data-action-contract") &&
        !/(?:min-h-11|h-11|size-11|giq-(?:button|outline-action|liquid-purple-button|danger-action|icon-button|mobile-dock-link))/.test(
          className,
        )
      ) {
        issues.push(
          `${sourceFile}:${line}: primary action has no 44px source contract ${tagName}`,
        );
      }
    }
    ts.forEachChild(node, inspect);
  }

  inspect(parsed);
  return issues;
}

function hasAccessibleName(
  node: ts.JsxOpeningLikeElement,
  attributes: ReadonlyMap<string, string>,
) {
  if (node.attributes.properties.some(ts.isJsxSpreadAttribute)) return true;
  if (["aria-label", "aria-labelledby", "title"].some((name) => attributes.has(name))) {
    return true;
  }
  if (!ts.isJsxOpeningElement(node)) return false;
  return node.parent.children.some(hasNamingContent);
}

function hasNamingContent(node: ts.JsxChild): boolean {
  if (ts.isJsxText(node)) return Boolean(node.text.trim());
  if (ts.isJsxExpression(node)) return Boolean(node.expression);
  if (ts.isJsxSelfClosingElement(node)) {
    const attributes = new Map(
      node.attributes.properties.flatMap((property) =>
        ts.isJsxAttribute(property)
          ? [[property.name.getText(), property.initializer?.getText() ?? ""] as const]
          : [],
      ),
    );
    return (
      !/^(["'])true\1$/.test(attributes.get("aria-hidden") ?? "") &&
      (attributes.has("alt") || /^[A-Z]/.test(node.tagName.getText()))
    );
  }
  if (ts.isJsxElement(node)) {
    const hasAlt = node.openingElement.attributes.properties.some(
      (property) =>
        ts.isJsxAttribute(property) && property.name.getText() === "alt",
    );
    return hasAlt || node.children.some(hasNamingContent);
  }
  return false;
}

function source(sourcePath: string) {
  return readFileSync(resolveRepoPath(sourcePath), "utf8");
}

function resolveRepoPath(sourcePath: string) {
  return path.resolve(REPOSITORY_ROOT, sourcePath);
}
