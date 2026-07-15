import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { ADMIN_AUTHORIZATION_INVENTORY } from "../src/app/admin/admin-authorization-inventory";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { isAdminRole } from "../src/lib/auth-roles";
import {
  CI_ACCESS_ISOLATION_MASTER_EVIDENCE,
  CI_ACCESS_ISOLATION_REQUIREMENT_IDS,
  findDesignLabMutationSignals,
} from "./ci-access-isolation-evidence";

assert.equal(isAdminRole("admin"), true);
assert.equal(isAdminRole("moderator"), false);
assert.equal(isAdminRole("member"), false);
assert.equal(isAdminRole(undefined), false);

const administratorPages = ADMIN_AUTHORIZATION_INVENTORY.pages.filter(
  (surface) => surface.requiredRole === "admin",
);
const administratorActions = ADMIN_AUTHORIZATION_INVENTORY.serverActions.filter(
  (surface) => surface.requiredRole === "admin",
);
assert.equal(administratorPages.length, 23);
assert.equal(administratorActions.length, 17);

for (const page of administratorPages) {
  assert.match(
    readFileSync(page.sourceFile, "utf8"),
    /requireAdminProfile\s*\(/,
    `${page.id}: administrator page must fail closed through requireAdminProfile`,
  );
}
for (const action of administratorActions) {
  const body = exportedFunction(
    readFileSync(action.sourceFile, "utf8"),
    action.id,
  );
  assert.match(
    body,
    /requireAdminProfile\s*\(/,
    `${action.id}: administrator action must reject a moderator`,
  );
}

const designLabFiles = discoverDesignLabProductionFiles();
assert.ok(designLabFiles.length > 40, "Design Lab source discovery is vacuous");
assert.ok(designLabFiles.includes("src/app/design-lab/page.tsx"));
assert.ok(
  designLabFiles.includes("src/components/design-lab-scenario-controls.tsx"),
);
for (const file of designLabFiles) {
  assert.deepEqual(
    findDesignLabMutationSignals(readFileSync(file, "utf8")),
    [],
    `${file}: Design Lab production mutation signal`,
  );
}

assert.deepEqual(findDesignLabMutationSignals('"use server";'), [
  "SERVER_ACTION_MODULE",
]);
assert.deepEqual(
  findDesignLabMutationSignals('import { mutate } from "@/app/actions";'),
  ["APPLICATION_ACTION_IMPORT"],
);
assert.deepEqual(
  findDesignLabMutationSignals('import { remove } from "@/lib/admin-service";'),
  ["MUTATING_SERVICE_IMPORT"],
);
assert.deepEqual(
  findDesignLabMutationSignals('import { Prisma } from "@prisma/client";'),
  ["PRISMA_IMPORT"],
);
assert.deepEqual(
  findDesignLabMutationSignals('<form action={deleteAccount}>'),
  ["FORM_SERVER_ACTION"],
);
assert.deepEqual(
  findDesignLabMutationSignals('fetch("/api/users/me/delete", { method: "POST" })'),
  ["NETWORK_REQUEST"],
);

const page = readFileSync("src/app/design-lab/page.tsx", "utf8");
const scenario = readFileSync(
  "src/components/design-lab-scenario-controls.tsx",
  "utf8",
);
const proxy = readFileSync("src/proxy.ts", "utf8");
assert.match(page, /await requireDesignLabReviewer\(\)/);
assert.match(scenario, /onSimulateDestructive=\{\(\) => setDestructivePreview\(true\)\}/);
assert.match(scenario, /Simulation complete\. No record, account or external system changed\./);
assert.match(
  proxy,
  /if \(demo && !isDemoReadMethod\(request\.method\)\) \{\s*return securedErrorResponse\(403, "demo\.read_only"/,
);

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const unitRunner = readFileSync("scripts/run-unit-tests.ts", "utf8");
assert.match(workflow, /npm run test:unit/);
assert.match(unitRunner, /security/);
assert.ok(unitRunner.includes("/\\.test\\.tsx?$/"));
assert.doesNotMatch(unitRunner, /stderr\.includes\("server-only"\)/);
assert.match(
  unitRunner,
  /This module cannot be imported from a Client Component module/,
);

assert.deepEqual(
  Object.keys(CI_ACCESS_ISOLATION_MASTER_EVIDENCE),
  CI_ACCESS_ISOLATION_REQUIREMENT_IDS,
);
for (const requirementId of CI_ACCESS_ISOLATION_REQUIREMENT_IDS) {
  const evidence = CI_ACCESS_ISOLATION_MASTER_EVIDENCE[requirementId];
  assert.deepEqual(SECURITY_MASTER_EVIDENCE[requirementId], evidence);
  for (const evidencePath of evidence.evidence) {
    assert.ok(existsSync(evidencePath), `${requirementId}: missing ${evidencePath}`);
  }
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: immutable requirement missing`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

console.log(
  `CI access/isolation passed: ${administratorPages.length} admin pages, ${administratorActions.length} admin actions and ${designLabFiles.length} Design Lab source files fail closed`,
);

function discoverDesignLabProductionFiles() {
  return [
    ...walk("src/app/design-lab"),
    ...readdirSync("src/components", { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => `src/components/${entry.name}`)
      .filter((file) =>
        /\/(?:design-lab|demo-experience-screen-map|master-audit)[^/]*\.tsx?$/.test(
          file,
        ),
      ),
    ...readdirSync("src/lib", { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => `src/lib/${entry.name}`)
      .filter((file) => /\/(?:design-lab|demo-access)[^/]*\.tsx?$/.test(file)),
  ]
    .filter((file) => !/\.(?:test|spec)\.tsx?$/.test(file))
    .toSorted();
}

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name).replaceAll("\\", "/");
    return entry.isDirectory()
      ? walk(target)
      : /\.tsx?$/.test(entry.name)
        ? [target]
        : [];
  });
}

function exportedFunction(source: string, name: string) {
  const marker = `export async function ${name}`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `${name}: exported function missing`);
  const rest = source.slice(start + marker.length);
  const next = rest.search(/\nexport (?:async )?function /);
  return next >= 0 ? rest.slice(0, next) : rest;
}
