import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const panelSource = readFileSync(
  join(__dirname, "design-lab-operating-model-panel.tsx"),
  "utf8",
);
const workspaceSource = readFileSync(
  join(__dirname, "demo-experience-screen-map.tsx"),
  "utf8",
);

for (const contract of [
  "data-design-lab-operating-model",
  "Binding operating model",
  "Environment proof boundary",
  "Design Lab environment proof matrix",
  "Two protected admin planes",
  "Training-video pipeline",
  "Controlled break-glass",
  "Release authority",
  "data-mobile-cross-product-contract",
  "Four products, independent source and release boundaries",
  "iOS/iPadOS and Android/tablet are separate codebases",
  "Shared contracts only",
  "Native proof after web MVP",
]) {
  assert.ok(panelSource.includes(contract), `missing operating-model UI: ${contract}`);
}
assert.match(panelSource, /data-environment-proof-grid/);
assert.doesNotMatch(panelSource, /<table(?:\s|>)/i);
assert.doesNotMatch(panelSource, /min-w-\[\d+px\]/);
assert.doesNotMatch(panelSource, /overflow-x-auto/);
assert.match(panelSource, /sm:grid-cols-2[\s\S]*xl:grid-cols-4/);
assert.match(
  workspaceSource,
  /initialArea === "overview"[\s\S]*DesignLabDeploymentRace[\s\S]*DesignLabOperatingModelPanel/,
);
assert.match(
  workspaceSource,
  /initialArea === "requirements"[\s\S]*DesignLabPendingWorkPanel/,
);

console.log("Design Lab operating-model panel tests passed");
