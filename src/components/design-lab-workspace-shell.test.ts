import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// screen-evidence-test-id: DL-WORKSPACE-SHELL

const shellSource = readFileSync(
  join(__dirname, "design-lab-workspace-shell.tsx"),
  "utf8",
);
const screenMapSource = readFileSync(
  join(__dirname, "demo-experience-screen-map.tsx"),
  "utf8",
);
const rootPageSource = readFileSync(
  join(__dirname, "../app/design-lab/page.tsx"),
  "utf8",
);

assert.match(shellSource, /aria-label="Design Lab live status"/);
assert.match(shellSource, /label="Verified"/);
assert.match(shellSource, /label="Complete, awaiting verification"/);
assert.match(shellSource, /label="Implementation open"/);
assert.match(shellSource, /label="Team target"/);
assert.match(shellSource, /DESIGN_LAB_SYNC_SNAPSHOT\.deploymentTarget\.window/);
assert.match(
  shellSource,
  /DESIGN_LAB_SYNC_SNAPSHOT\.release\.awaitingVerificationChecks/,
);
assert.match(
  shellSource,
  /DESIGN_LAB_SYNC_SNAPSHOT\.release\.implementationOpenChecks/,
);
assert.match(shellSource, /DESIGN_LAB_SYNC_SNAPSHOT\.missionControl\[area\.id\]/);
assert.match(shellSource, /DESIGN_LAB_SYNC_SNAPSHOT\.workstreams\.blocked/);
assert.match(shellSource, /data-design-lab-area-status=\{status\.state\}/);
assert.match(shellSource, /aria-label="Design Lab sections"/);
assert.match(shellSource, /aria-current=\{current \? "page" : undefined\}/);
assert.match(shellSource, /sticky top-28 hidden[\s\S]*2xl:block/);
assert.match(shellSource, /min-h-11[\s\S]*focus-visible:ring-2/);
assert.match(shellSource, /data-design-lab-active-area=\{activeArea\}/);

assert.doesNotMatch(screenMapSource, /<main data-demo-experience-map/);
for (const area of [
  "delivery",
  "architecture",
  "advertising",
  "requirements",
  "readiness",
  "screens",
]) {
  assert.match(screenMapSource, new RegExp(`initialArea === "${area}"`));
}
assert.match(screenMapSource, /<DesignLabArchitectureLab \/>/);
assert.match(screenMapSource, /Open final to-do list/);
assert.doesNotMatch(screenMapSource, /NavigationPrototype|\?variant=/);
assert.match(rootPageSource, /searchParams: Promise<DesignLabSearchParams>/);
assert.match(rootPageSource, /const query = await searchParams/);
assert.match(rootPageSource, /resolveDesignLabArea\(query\.area\)/);
assert.match(
  rootPageSource,
  /initialContractRoute=\{firstValue\(query\.route\)\}/,
);

console.log("design lab workspace shell tests passed");
