import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(file: string) {
  return readFileSync(join(__dirname, file), "utf8");
}

const pendingWork = source("design-lab-pending-work-panel.tsx");
const delivery = source("design-lab-delivery-progress-panel.tsx");
const readiness = source("design-lab-preproduction-checklist.tsx");
const masterAudit = source("master-audit-checklist.tsx");
const operatingModel = source("design-lab-operating-model-panel.tsx");
const advertising = source("design-lab-advertising-console.tsx");
const contractInspector = source("design-lab-contract-inspector-prototype.tsx");
const architecture = source("design-lab-architecture-lab.tsx");
const workspace = source("design-lab-workspace-shell.tsx");

// Source-static guard only. True viewport evidence still comes from browser audit.
assert.match(pendingWork, /className="min-w-0 rounded-xl/);
assert.match(pendingWork, /flex-col items-start[\s\S]*sm:flex-row sm:items-center/);
assert.match(delivery, /min-w-0 max-w-full break-all font-mono/);
assert.match(delivery, /max-w-full space-y-1/);
assert.match(delivery, /summary className="flex min-h-11/);
assert.match(readiness, /className="min-w-0 rounded-xl/);
assert.match(readiness, /Verification commands[\s\S]*min-w-0 max-w-full/);
assert.match(masterAudit, /className="min-w-0 rounded-xl/);
assert.match(masterAudit, /flex-col items-start[\s\S]*sm:flex-row sm:items-center/);
assert.match(operatingModel, /data-environment-proof-grid/);
assert.match(advertising, /data-ad-placement-specifications/);
assert.match(contractInspector, /data-contract-audit-grid/);
for (const responsiveCardSource of [operatingModel, advertising, contractInspector]) {
  assert.doesNotMatch(responsiveCardSource, /<table(?:\s|>)/i);
  assert.doesNotMatch(responsiveCardSource, /min-w-\[\d+px\]/);
}
assert.match(
  workspace,
  /sticky top-2[\s\S]*grid-cols-2[\s\S]*md:grid-cols-3[\s\S]*2xl:grid-cols-6/,
);
assert.match(workspace, /2xl:grid-cols-\[240px_minmax\(0,1fr\)\]/);
assert.match(architecture, /iframe[\s\S]*w-full/);
assert.match(architecture, /data-architecture-mobile-report/);
assert.match(architecture, /iframe[\s\S]*loading="lazy"/);
assert.match(architecture, /iframe[\s\S]*hidden h-\[78vh\][\s\S]*lg:block/);
assert.match(
  architecture,
  /data-architecture-primary-path[\s\S]*data-architecture-bounded-node/,
);
assert.match(architecture, /data-architecture-bounded-flow/);
assert.match(architecture, /\[overflow-wrap:anywhere\]/);
assert.match(
  architecture,
  /grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)_auto_minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/,
);
assert.doesNotMatch(architecture, /overflow-x-(?:auto|scroll)/);
assert.doesNotMatch(architecture, /min-w-\[\d+px\]/);
assert.doesNotMatch(architecture, /cyan-/);

console.log("Design Lab responsive source contracts passed");
