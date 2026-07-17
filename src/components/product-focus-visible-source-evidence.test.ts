import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import { buildProductAutomatedSourceGateRegistry } from "./product-automated-source-gate-registry";
import {
  PRODUCT_FOCUS_VISIBLE_SOURCE_EVIDENCE_FILE,
  PRODUCT_FOCUS_VISIBLE_SOURCE_MASTER_EVIDENCE,
  PRODUCT_FOCUS_VISIBLE_SOURCE_REQUIREMENT_IDS,
  PRODUCT_FOCUS_VISIBLE_SOURCE_SCOPE,
  PRODUCT_FOCUS_VISIBLE_SOURCE_TEST_FILE,
} from "./product-focus-visible-source-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-FOCUS-VISIBLE-SOURCE-EVIDENCE

assert.deepEqual(PRODUCT_FOCUS_VISIBLE_SOURCE_REQUIREMENT_IDS, [
  "GLOBAL.A11Y.focus-visible",
]);
assert.equal(
  PRODUCT_MASTER_REQUIREMENTS.some(
    ({ id }) => id === "GLOBAL.A11Y.focus-visible",
  ),
  true,
);

const evidence =
  PRODUCT_FOCUS_VISIBLE_SOURCE_MASTER_EVIDENCE["GLOBAL.A11Y.focus-visible"];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_FOCUS_VISIBLE_SOURCE_EVIDENCE_FILE,
  PRODUCT_FOCUS_VISIBLE_SOURCE_TEST_FILE,
]);

const globalStyles = readFileSync("src/app/globals.css", "utf8");
assert.match(
  globalStyles,
  /\*:focus-visible\s*\{[\s\S]*?outline:\s*2px solid[\s\S]*?outline-offset:\s*2px/,
);

const sourceRegistry = buildProductAutomatedSourceGateRegistry();
assert.ok(sourceRegistry.auditedSourceFiles.length >= 400);
assert.ok(sourceRegistry.auditedSourceFiles.includes("src/components/interactive-help.tsx"));

const missingIndicators = sourceRegistry.auditedSourceFiles.flatMap((sourceFile) =>
  findOutlineRemovalsWithoutFocusIndicator(sourceFile),
);
assert.deepEqual(missingIndicators, []);

assert.match(PRODUCT_FOCUS_VISIBLE_SOURCE_SCOPE, /source-static/i);
assert.match(PRODUCT_FOCUS_VISIBLE_SOURCE_SCOPE, /does not prove keyboard order/i);
assert.match(PRODUCT_FOCUS_VISIBLE_SOURCE_SCOPE, /actual browser focus traversal/i);

console.log(
  `Focus-visible source evidence passed: global fallback plus explicit indicators cover ${sourceRegistry.auditedSourceFiles.length} audited reachable source files.`,
);

function findOutlineRemovalsWithoutFocusIndicator(sourceFile: string) {
  const sourceText = readFileSync(sourceFile, "utf8");
  const parsed = ts.createSourceFile(
    sourceFile,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    sourceFile.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const failures: string[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (removesOutline(node.text) && !hasFocusVisibleIndicator(node.text)) {
        const { line } = parsed.getLineAndCharacterOfPosition(node.getStart(parsed));
        failures.push(`${repoPath(sourceFile)}:${line + 1}`);
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(parsed);
  return failures;
}

function removesOutline(classNames: string) {
  return /(?:^|\s)(?:focus-visible:)?outline-none(?:\s|$)/.test(classNames);
}

function hasFocusVisibleIndicator(classNames: string) {
  return /(?:^|\s)focus-visible:(?:ring(?:-|\b)|outline-(?!none(?:\s|$))|border(?:-|\b))/.test(
    classNames,
  );
}

function repoPath(file: string) {
  return path.relative(path.resolve(__dirname, "../.."), file).replace(/\\/g, "/");
}
