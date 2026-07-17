import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";

import {
  DEMO_SCREEN_COUNT,
  SCREEN_CONTRACTS,
  SCREEN_CONTRACT_CHECKLIST,
} from "./demo-experience-registry";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "./master-audit-requirements";
import {
  discoverRouteHandlers,
} from "../../security/endpoints";

const repositoryRoot = path.resolve(__dirname, "../..");
const appRoot = path.join(repositoryRoot, "src", "app");
const pageRoutes = discoverPageRoutes(appRoot).toSorted();
const registeredRoutes = SCREEN_CONTRACTS.map((screen) => screen.route).toSorted();
const routeFiles = walkFiles(appRoot)
  .filter((file) => path.basename(file) === "route.ts")
  .map(repoPath)
  .toSorted();
const discoveredRouteFiles = [
  ...new Set(
    discoverRouteHandlers(repositoryRoot).map((handler) => handler.sourceFile),
  ),
].toSorted();

assert.equal(DEMO_SCREEN_COUNT, SCREEN_CONTRACTS.length);
assert.deepEqual(registeredRoutes, pageRoutes);
assert.deepEqual(
  discoveredRouteFiles,
  routeFiles,
  "every non-page route definition must export at least one discovered HTTP method",
);
assert.equal(
  SCREEN_CONTRACT_CHECKLIST.find((item) => item.area === "route")?.total,
  DEMO_SCREEN_COUNT,
);
assert.equal(
  SCREEN_CONTRACT_CHECKLIST.find((item) => item.area === "userStories")
    ?.completed,
  DEMO_SCREEN_COUNT,
);

for (const id of [
  "OUT.route-screen-inventory",
  "OUT.user-story-inventory",
  "DISC.SRC.route-definitions",
  "COMPLETE.EVIDENCE.route-tree-inspected",
]) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.prompt === "product" && candidate.id === id,
  );
  assert.ok(requirement, `${id} must remain in the product master registry`);
  assert.equal(requirement.status, "tested");
  assert.equal(
    isMasterRequirementComplete(requirement),
    true,
    `${id} must remain bound to exhaustive page and route-handler discovery`,
  );
}

console.log(
  `Product route-tree evidence passed: ${pageRoutes.length} pages and ${routeFiles.length} route-handler files exhaustively inventoried`,
);

function discoverPageRoutes(directory: string, segments: string[] = []): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      if (entry.name === "api") return [];
      return discoverPageRoutes(path.join(directory, entry.name), [
        ...segments,
        entry.name,
      ]);
    }
    if (entry.name !== "page.tsx") return [];
    return [segments.length === 0 ? "/" : `/${segments.join("/")}`];
  });
}

function walkFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(target) : [target];
  });
}

function repoPath(file: string) {
  return path.relative(repositoryRoot, file).replaceAll("\\", "/");
}
