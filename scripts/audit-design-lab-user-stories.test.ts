import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { DESIGN_LAB_USER_STORY_MANIFESTS } from "../src/components/screen-contracts/design-lab-user-stories";
import {
  DESIGN_LAB_STORY_RUNTIME_CASES,
  evaluateDesignLabStoryHtml,
  findDesignLabStoryAuditIssues,
} from "./audit-design-lab-user-stories";

// screen-evidence-test-id: DL-STORY-RUNTIME
const expectedScenarioIds = DESIGN_LAB_USER_STORY_MANIFESTS.flatMap((manifest) =>
  manifest.userStories.flatMap((story) =>
    story.acceptance.map((_, index) => `${story.id}.${index + 1}`),
  ),
).toSorted();
assert.deepEqual(
  DESIGN_LAB_STORY_RUNTIME_CASES.map((item) => item.id).toSorted(),
  expectedScenarioIds,
);

for (const storyCase of DESIGN_LAB_STORY_RUNTIME_CASES) {
  let html = storyCase.includes.join("\n");
  for (const [needle, expected] of Object.entries(storyCase.counts ?? {})) {
    html += needle.repeat(Math.max(0, expected - (html.split(needle).length - 1)));
  }
  assert.deepEqual(evaluateDesignLabStoryHtml(storyCase, html), []);
  assert.ok(
    evaluateDesignLabStoryHtml(storyCase, html.replace(storyCase.includes[0], "")).length > 0,
  );
}

const adminFrames = DESIGN_LAB_STORY_RUNTIME_CASES.find(
  (item) => item.id === "DL.STORY.DEMO-EXPERIENCE.2",
)!;
assert.ok(evaluateDesignLabStoryHtml(adminFrames, "<iframe><iframe").length > 0);

for (const relativePath of [
  "src/app/design-lab/page.tsx",
  "src/app/design-lab/demo-experience/page.tsx",
  "src/app/design-lab/dock-skins/page.tsx",
  "src/app/design-lab/role-blueprints/page.tsx",
  "src/app/feed/device-preview/page.tsx",
  "src/app/marketplace/design-lab/page.tsx",
]) {
  assert.match(readFileSync(path.resolve(relativePath), "utf8"), /await requireDesignLabReviewer\(\)/);
}
for (const relativePath of [
  "src/components/dock-skin-catalogue-preview.tsx",
  "src/components/design-lab-role-blueprint-preview.tsx",
  "src/app/feed/device-preview/page.tsx",
  "src/components/marketplace-template-catalogue.tsx",
]) {
  const source = readFileSync(path.resolve(relativePath), "utf8");
  assert.doesNotMatch(source, /fetch\(|"use server"|\/api\//);
}
assert.match(
  readFileSync(path.resolve("src/components/marketplace-template-catalogue.tsx"), "utf8"),
  /saveMode="local"/,
);

const binding = {
  headSha: "a".repeat(40),
  sourceSha256: "b".repeat(64),
  sourceFileCount: 10,
  now: Date.parse("2026-07-14T00:00:00.000Z"),
};
const validAudit = {
  schemaVersion: 1,
  auditKind: "design-lab-user-stories",
  generatedAt: "2026-07-14T00:00:00.000Z",
  baseUrl: "http://127.0.0.1:3000",
  testedCommitSha: binding.headSha,
  sourceSha256: binding.sourceSha256,
  sourceFileCount: binding.sourceFileCount,
  expectedRoutes: DESIGN_LAB_USER_STORY_MANIFESTS.length,
  passedRoutes: DESIGN_LAB_USER_STORY_MANIFESTS.length,
  expectedScenarios: DESIGN_LAB_STORY_RUNTIME_CASES.length,
  passedScenarios: DESIGN_LAB_STORY_RUNTIME_CASES.length,
  results: DESIGN_LAB_USER_STORY_MANIFESTS.map((manifest) => ({
    route: manifest.route,
    passed: true,
    scenarios: DESIGN_LAB_STORY_RUNTIME_CASES.filter(
      (storyCase) => storyCase.route === manifest.route,
    ).map((storyCase) => ({
      id: storyCase.id,
      route: storyCase.route,
      requestPath: storyCase.requestPath,
      status: storyCase.expectedStatus,
      passed: true,
      failures: [],
    })),
  })),
};
assert.deepEqual(findDesignLabStoryAuditIssues(validAudit, binding), []);
for (const invalidTopLevel of [
  { ...validAudit, schemaVersion: 999 },
  { ...validAudit, auditKind: "wrong-audit" },
  { ...validAudit, baseUrl: "https://greyhoundsiq.com" },
]) {
  assert.ok(findDesignLabStoryAuditIssues(invalidTopLevel, binding).length > 0);
}
const unexpectedScenarioAudit = structuredClone(validAudit);
unexpectedScenarioAudit.results[0].scenarios.push({
  ...unexpectedScenarioAudit.results[0].scenarios[0],
  id: "DL.STORY.UNEXPECTED.1",
});
assert.ok(
  findDesignLabStoryAuditIssues(unexpectedScenarioAudit, binding).some((issue) =>
    issue.includes("scenario rows"),
  ),
);
const wrongParentAudit = structuredClone(validAudit);
const firstScenario = wrongParentAudit.results[0].scenarios[0];
wrongParentAudit.results[0].scenarios[0] = wrongParentAudit.results[1].scenarios[0];
wrongParentAudit.results[1].scenarios[0] = firstScenario;
assert.ok(
  findDesignLabStoryAuditIssues(wrongParentAudit, binding).some((issue) =>
    issue.includes("child-scenario membership"),
  ),
);
const wrongStatusAudit = structuredClone(validAudit);
wrongStatusAudit.results[0].scenarios[0].status = 500;
assert.ok(
  findDesignLabStoryAuditIssues(wrongStatusAudit, binding).some((issue) =>
    issue.includes(wrongStatusAudit.results[0].scenarios[0].id),
  ),
);
assert.ok(
  findDesignLabStoryAuditIssues(
    { ...validAudit, sourceSha256: "c".repeat(64) },
    binding,
  ).some((issue) => issue.includes("source digest")),
);
const failingAudit = structuredClone(validAudit);
failingAudit.results[0].scenarios[0].passed = false;
assert.ok(
  findDesignLabStoryAuditIssues(failingAudit, binding).some((issue) =>
    issue.includes(failingAudit.results[0].scenarios[0].id),
  ),
);

console.log("Design Lab user-story runtime audit contract passed");
