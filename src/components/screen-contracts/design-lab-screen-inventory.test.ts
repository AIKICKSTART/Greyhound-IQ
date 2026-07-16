import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import {
  DESIGN_LAB_HYDRATED_WAVE2_AUDIT_PATH,
  DESIGN_LAB_HYDRATED_WAVE2_ROUTES,
  findDesignLabHydratedWave2AuditIssues,
} from "../../../scripts/audit-design-lab-hydrated-wave2";
import { DESIGN_LAB_STORY_AUDIT_PATH } from "../../../scripts/audit-design-lab-user-stories";
import {
  fingerprintRepositoryFiles,
  getDesignLabSourceChangesBetween,
  getRepositoryHeadSha,
  isRepositoryCommitAncestor,
  parseDesignLabSourceFiles,
} from "../../../scripts/design-lab-source-fingerprint";

import {
  SCREEN_CONTRACT_BY_ROUTE,
  SCREEN_CONTRACT_COVERAGE_AREAS,
} from "../demo-experience-registry";
import { DESIGN_LAB_SCENARIO_DIMENSIONS } from "../design-lab-scenario-contract";
import { getOnboardingRouteTour } from "../onboarding-tour-registry";
import {
  DESIGN_LAB_HYDRATED_INVENTORY_TESTED_ROUTES,
  DESIGN_LAB_SCREEN_INVENTORIES,
  DESIGN_LAB_USER_STORY_MANIFESTS,
} from "./design-lab-user-stories";

// screen-evidence-test-id: DL-SCREEN-ATOMIC

const expected = {
  "/design-lab": {
    actions: [
      "DL.ACTION.AREA.SELECT",
      "DL.ACTION.SCREEN.SEARCH",
      "DL.ACTION.FAMILY.FILTER",
      "DL.ACTION.SCREEN.OPEN",
      ...DESIGN_LAB_SCENARIO_DIMENSIONS.map(
        (dimension) =>
          `DL.ACTION.SCENARIO.${dimension.key.toUpperCase()}.SELECT`,
      ),
      "DL.ACTION.SCENARIO.URL.COPY",
      "DL.ACTION.SCENARIO.DESTRUCTIVE.SIMULATE",
    ],
    states: 50,
    fixtures: 12,
    tests: [
      "DL-STORY-MANIFEST",
      "DL-STORY-RUNTIME",
      "DL-SCREEN-ATOMIC",
      "SCREEN-PERMISSION-EVIDENCE",
      "PRODUCTION-SCREEN-DESIGN-LAB-ONBOARDING",
      "DL-HYDRATED-STORY-RUNTIME",
      "DL-WORKSPACE-AREA",
      "DL-WORKSPACE-SHELL",
      "DL-SCREEN-REGISTRY",
      "DL-SCENARIO-STATE",
    ],
  },
  "/design-lab/demo-experience": {
    actions: [
      "DL.ACTION.REGISTRY.SEARCH",
      "DL.ACTION.REGISTRY.FAMILY.FILTER",
      "DL.ACTION.REGISTRY.SCREEN.OPEN",
      "DL.ACTION.ADMIN-FRAMES.OPEN",
      "DL.ACTION.VIEWPORT.DESKTOP.SELECT",
      "DL.ACTION.VIEWPORT.TABLET.SELECT",
      "DL.ACTION.VIEWPORT.MOBILE.SELECT",
      "DL.ACTION.REGISTRY.RETURN",
      "DL.ACTION.ADMIN.OPEN-FULL",
      "DL.ACTION.ADMIN-FRAMES.RELOAD",
    ],
    states: 7,
    fixtures: 3,
    tests: [
      "DL-STORY-MANIFEST",
      "DL-STORY-RUNTIME",
      "DL-SCREEN-ATOMIC",
      "SCREEN-PERMISSION-EVIDENCE",
      "PRODUCTION-SCREEN-DESIGN-LAB-ONBOARDING",
      "DL-HYDRATED-STORY-RUNTIME",
      "DL-SCREEN-REGISTRY",
      "DL-ADMIN-FRAME",
    ],
  },
  "/design-lab/dock-skins": {
    actions: [
      "DL.ACTION.DOCK.D1.SELECT",
      "DL.ACTION.DOCK.D2.SELECT",
      "DL.ACTION.DOCK.D3.SELECT",
      "DL.ACTION.DOCK.D4.SELECT",
      "DL.ACTION.DOCK.D5.SELECT",
      "DL.ACTION.DOCK.D6.SELECT",
      "DL.ACTION.DOCK-ACTION.HOME.SELECT",
      "DL.ACTION.DOCK-ACTION.FEED.SELECT",
      "DL.ACTION.DOCK-ACTION.POST.SELECT",
      "DL.ACTION.DOCK-ACTION.CHAT.SELECT",
      "DL.ACTION.DOCK-ACTION.MENU.SELECT",
    ],
    states: 13,
    fixtures: 8,
    tests: [
      "DL-STORY-MANIFEST",
      "DL-STORY-RUNTIME",
      "DL-SCREEN-ATOMIC",
      "SCREEN-PERMISSION-EVIDENCE",
      "PRODUCTION-SCREEN-DESIGN-LAB-ONBOARDING",
      "DL-HYDRATED-STORY-RUNTIME",
      "DL-DOCK-CATALOGUE",
      "DL-DOCK-VISUAL",
    ],
  },
  "/design-lab/role-blueprints": {
    actions: [
      "DL.ACTION.ROLE.BUSINESS.SELECT",
      "DL.ACTION.ROLE.TRAINER.SELECT",
      "DL.ACTION.ROLE.OWNER.SELECT",
      "DL.ACTION.ROLE.PUNTER.SELECT",
      "DL.ACTION.ROLE-VARIANT.A1.SELECT",
      "DL.ACTION.ROLE-VARIANT.A2.SELECT",
      "DL.ACTION.ROLE-VARIANT.B1.SELECT",
      "DL.ACTION.ROLE-VARIANT.B2.SELECT",
      "DL.ACTION.ROLE-VARIANT.C1.SELECT",
      "DL.ACTION.ROLE-VARIANT.C2.SELECT",
    ],
    states: 26,
    fixtures: 26,
    tests: [
      "DL-STORY-MANIFEST",
      "DL-STORY-RUNTIME",
      "DL-SCREEN-ATOMIC",
      "SCREEN-PERMISSION-EVIDENCE",
      "PRODUCTION-SCREEN-DESIGN-LAB-ONBOARDING",
      "DL-HYDRATED-WAVE2-RUNTIME",
      "DL-ROLE-BLUEPRINT",
      "DL-PROTOTYPE-REGISTRY",
    ],
  },
  "/feed/device-preview": {
    actions: [
      "DL.ACTION.FEED-DEVICE.DESKTOP.SELECT",
      "DL.ACTION.FEED-DEVICE.TABLET.SELECT",
      "DL.ACTION.FEED-DEVICE.MOBILE.SELECT",
      "DL.ACTION.FEED-VARIANT.A1.SELECT",
      "DL.ACTION.FEED-VARIANT.A2.SELECT",
      "DL.ACTION.FEED-VARIANT.B1.SELECT",
      "DL.ACTION.FEED-VARIANT.B2.SELECT",
      "DL.ACTION.FEED-VARIANT.C1.SELECT",
      "DL.ACTION.FEED-VARIANT.C2.SELECT",
      "DL.ACTION.FEED-DOCK.D1.SELECT",
      "DL.ACTION.FEED-DOCK.D2.SELECT",
      "DL.ACTION.FEED-DOCK.D3.SELECT",
      "DL.ACTION.FEED-DOCK.D4.SELECT",
      "DL.ACTION.FEED-DOCK.D5.SELECT",
      "DL.ACTION.FEED-DOCK.D6.SELECT",
    ],
    states: 20,
    fixtures: 20,
    tests: [
      "DL-STORY-MANIFEST",
      "DL-STORY-RUNTIME",
      "DL-SCREEN-ATOMIC",
      "SCREEN-PERMISSION-EVIDENCE",
      "PRODUCTION-SCREEN-DESIGN-LAB-ONBOARDING",
      "DL-HYDRATED-WAVE2-RUNTIME",
      "DL-REVIEW-MATRIX",
      "DL-PROTOTYPE-REGISTRY",
      "DL-APPEARANCE-PREVIEW",
    ],
  },
  "/marketplace/design-lab": {
    actions: [
      "DL.ACTION.MARKETPLACE.M1.SELECT",
      "DL.ACTION.MARKETPLACE.M2.SELECT",
      "DL.ACTION.MARKETPLACE.M3.SELECT",
      "DL.ACTION.MARKETPLACE.M4.SELECT",
      "DL.ACTION.MARKETPLACE.M5.SELECT",
      "DL.ACTION.MARKETPLACE.M6.SELECT",
      "DL.ACTION.MARKETPLACE.PROFILE.OPEN",
    ],
    states: 8,
    fixtures: 8,
    tests: [
      "DL-STORY-MANIFEST",
      "DL-STORY-RUNTIME",
      "DL-SCREEN-ATOMIC",
      "SCREEN-PERMISSION-EVIDENCE",
      "PRODUCTION-SCREEN-MARKETPLACE-ONBOARDING",
      "DL-HYDRATED-WAVE2-RUNTIME",
      "DL-MARKETPLACE-TEMPLATES",
      "DL-REVIEW-MATRIX",
    ],
  },
} as const;

const unitRunnerSource = readFileSync(
  path.resolve("scripts/run-unit-tests.ts"),
  "utf8",
);
const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
const ciSource = readFileSync(path.resolve(".github/workflows/ci.yml"), "utf8");
assert.match(
  unitRunnerSource,
  /const files = \["src", "scripts", "security"\]\.flatMap\(findTestFiles\)/
);
assert.match(unitRunnerSource, /\/\\\.test\\\.tsx\?\$\/\.test\(entry\.name\)/);
assert.match(unitRunnerSource, /const SKIP_FILES: string\[\] = \[\];/);
assert.equal(packageJson.scripts?.["test:unit"], "tsx scripts/run-unit-tests.ts");
assert.match(ciSource, /run: npm run test:unit/);

assert.deepEqual(
  Object.keys(DESIGN_LAB_SCREEN_INVENTORIES).toSorted(),
  Object.keys(expected).toSorted(),
  "Only the six Design Lab routes may receive this overlay",
);
assert.deepEqual(
  DESIGN_LAB_USER_STORY_MANIFESTS.map((manifest) => manifest.route).toSorted(),
  Object.keys(expected).toSorted(),
);

const promotedWave2Routes = DESIGN_LAB_HYDRATED_INVENTORY_TESTED_ROUTES.filter(
  (route) => new Set<string>(DESIGN_LAB_HYDRATED_WAVE2_ROUTES).has(route),
);
const promotedWave2RouteSet = new Set<string>(promotedWave2Routes);
if (promotedWave2Routes.length > 0) {
  assert.deepEqual(
    promotedWave2Routes.toSorted(),
    [...DESIGN_LAB_HYDRATED_WAVE2_ROUTES].toSorted(),
    "Wave 2 inventory coverage must be promoted atomically for all three routes",
  );
  assert.ok(
    existsSync(DESIGN_LAB_HYDRATED_WAVE2_AUDIT_PATH),
    "Wave 2 inventory coverage cannot be promoted without its runtime artifact",
  );
  assert.ok(
    existsSync(DESIGN_LAB_STORY_AUDIT_PATH),
    "Wave 2 inventory coverage cannot be promoted without its companion HTTP artifact",
  );
  const companionJson = readFileSync(DESIGN_LAB_STORY_AUDIT_PATH, "utf8");
  const wave2Audit = JSON.parse(
    readFileSync(DESIGN_LAB_HYDRATED_WAVE2_AUDIT_PATH, "utf8"),
  );
  const sourceFiles = parseDesignLabSourceFiles(wave2Audit);
  assert.ok(sourceFiles, "Wave 2 audit must declare its source-file manifest");
  const testedCommitSha = Reflect.get(wave2Audit, "testedCommitSha");
  assert.match(
    typeof testedCommitSha === "string" ? testedCommitSha : "",
    /^[a-f0-9]{40}$/,
    "Wave 2 audit tested commit must be a Git SHA",
  );
  const currentHeadSha = getRepositoryHeadSha(process.cwd());
  assert.equal(
    isRepositoryCommitAncestor(process.cwd(), testedCommitSha, currentHeadSha),
    true,
    "Wave 2 audit tested commit must be an ancestor of the current HEAD",
  );
  assert.deepEqual(
    getDesignLabSourceChangesBetween(
      process.cwd(),
      testedCommitSha,
      currentHeadSha,
      sourceFiles,
    ),
    [],
    "Wave 2 audit source files must not change after the tested commit",
  );
  const currentSource = fingerprintRepositoryFiles(process.cwd(), sourceFiles);
  assert.deepEqual(
    findDesignLabHydratedWave2AuditIssues(wave2Audit, {
      headSha: testedCommitSha,
      sourceSha256: currentSource.sha256,
      sourceFileCount: currentSource.fileCount,
      companionHttpAuditSha256: createHash("sha256")
        .update(companionJson)
        .digest("hex"),
    }),
    [],
    "Wave 2 inventory coverage cannot be promoted without exact current-source evidence",
  );
}

for (const manifest of DESIGN_LAB_USER_STORY_MANIFESTS) {
  const routeExpected = expected[manifest.route as keyof typeof expected];
  const inventory = DESIGN_LAB_SCREEN_INVENTORIES[manifest.route];
  const contract = SCREEN_CONTRACT_BY_ROUTE.get(manifest.route);
  const inventoryCoverageStatus =
    DESIGN_LAB_HYDRATED_INVENTORY_TESTED_ROUTES.some(
      (route) => route === manifest.route,
    )
      ? "tested"
      : "captured";
  assert.ok(inventory, `${manifest.route}: missing durable inventory`);
  assert.ok(contract, `${manifest.route}: missing screen contract`);

  assert.deepEqual(
    manifest.actions.map((item) => item.id),
    [...routeExpected.actions],
    `${manifest.route}: action inventory drifted`,
  );
  assert.equal(new Set(manifest.actions.map((item) => item.id)).size, manifest.actions.length);
  assert.ok(manifest.actions.every((item) => item.result && item.enforcement));
  assert.deepEqual(manifest.forms, []);
  assert.equal(manifest.states.length, routeExpected.states);
  assert.equal(new Set(manifest.states.map((item) => item.id)).size, manifest.states.length);
  assert.equal(manifest.designLab.length, routeExpected.fixtures);
  assert.equal(
    new Set(manifest.designLab.map((item) => item.fixtureId)).size,
    manifest.designLab.length,
  );
  assert.deepEqual(
    manifest.tests.map((item) => item.id),
    [...routeExpected.tests],
    `${manifest.route}: test inventory drifted`,
  );

  const fixtureIds = new Set(manifest.designLab.map((item) => item.fixtureId));
  for (const fixture of manifest.designLab) {
    const url = new URL(fixture.href, "http://greyhoundiq.test");
    assert.equal(url.origin, "http://greyhoundiq.test");
    assert.equal(url.pathname, manifest.route, `${fixture.fixtureId}: route mismatch`);
    assert.equal(url.hash, "", `${fixture.fixtureId}: fixture must be self-contained`);
  }
  for (const screenState of manifest.states) {
    if (screenState.fixtureId) {
      assert.ok(
        fixtureIds.has(screenState.fixtureId),
        `${manifest.route}/${screenState.id}: missing fixture ${screenState.fixtureId}`,
      );
    }
  }

  const testIds = new Set(manifest.tests.map((item) => item.id));
  for (const item of [...manifest.actions, ...manifest.states]) {
    assert.ok(item.testIds.length > 0, `${manifest.route}/${item.id}: needs tests`);
    assert.ok(
      item.testIds.every((testId) => testIds.has(testId)),
      `${manifest.route}/${item.id}: references an undeclared test`,
    );
  }
  for (const test of manifest.tests) {
    const normalizedTestPath = normalizeRepoPath(test.path);
    assert.match(
      normalizedTestPath,
      /^(?:src|scripts)\/.+\.test\.ts$/,
      `${manifest.route}: ${test.path} is not registered by the unit-test runner`,
    );
    const absolutePath = path.resolve(test.path);
    assert.ok(existsSync(absolutePath), `${manifest.route}: missing ${test.path}`);
    const marker = `// screen-evidence-test-id: ${test.id}`;
    assert.equal(
      readFileSync(absolutePath, "utf8")
        .split(/\r?\n/)
        .filter((line) => line.trim() === marker).length,
      1,
      `${test.path}: must declare ${test.id} exactly once`,
    );
  }

  const importClosure = getLocalSourceClosure(inventory.sourcePaths[0]);
  const onboardingTour = getOnboardingRouteTour(manifest.route);
  for (const sourcePath of inventory.sourcePaths) {
    assert.ok(
      importClosure.has(normalizeRepoPath(sourcePath)),
      `${manifest.route}: ${sourcePath} must belong to the route's local import closure`,
    );
  }
  assert.deepEqual(
    [...importClosure].flatMap(findFormSubmissionSignals),
    [],
    `${manifest.route}: forms may be excluded only while its full local import closure has no submission path`,
  );

  assert.deepEqual(
    Object.fromEntries(
      SCREEN_CONTRACT_COVERAGE_AREAS.map((area) => [
        area,
        manifest.coverage[area].status,
      ]),
    ),
    {
      route: "not-started",
      userStories: manifest.coverage.userStories.status,
      actions: inventoryCoverageStatus,
      forms: "excluded",
      permissions: "tested",
      states: inventoryCoverageStatus,
      designLab: inventoryCoverageStatus,
      onboarding: onboardingTour ? "tested" : "not-started",
      tests: "verified",
    },
  );
  assert.deepEqual(
    manifest.permissions.map(({ decision }) => decision),
    ["allow", "deny", "allow", "allow", "deny"],
  );
  assert.ok(
    manifest.coverage.permissions.evidence.some(
      (evidence) =>
        evidence.kind === "test" &&
        evidence.path ===
          "src/components/screen-contracts/screen-permission-evidence.test.ts" &&
        evidence.testId === "SCREEN-PERMISSION-EVIDENCE",
    ),
    `${manifest.route}: tested permissions need the focused evidence test`,
  );
  assert.deepEqual(
    manifest.onboarding,
    onboardingTour ? [{ tourId: onboardingTour.tourId }] : [],
  );

  assert.deepEqual(contract.primaryActions, manifest.actions.map((item) => item.id));
  assert.deepEqual(contract.forms, []);
  assert.deepEqual(contract.supportedStates, manifest.states.map((item) => item.id));
  assert.deepEqual(
    contract.designLabFixtureIds,
    manifest.designLab.map((item) => item.fixtureId),
  );
  for (const area of SCREEN_CONTRACT_COVERAGE_AREAS) {
    if (area === "route") continue;
    assert.equal(
      contract.coverage[area].status,
      manifest.coverage[area].status,
      `${manifest.route}/${area}: registry must mirror manifest status`,
    );
    assert.deepEqual(
      contract.coverage[area].evidence,
      [...new Set(manifest.coverage[area].evidence.map((item) => item.path))],
      `${manifest.route}/${area}: registry must mirror manifest evidence`,
    );
  }
  if (promotedWave2RouteSet.has(manifest.route)) {
    for (const area of ["actions", "states", "designLab"] as const) {
      assert.ok(
        manifest.coverage[area].evidence.some(
          (evidence) =>
            evidence.kind === "test" &&
            evidence.path ===
              "scripts/audit-design-lab-hydrated-wave2.test.ts" &&
            evidence.testId === "DL-HYDRATED-WAVE2-RUNTIME",
        ),
        `${manifest.route}/${area}: wave 2 runtime evidence is required`,
      );
    }
  }
  assert.equal(contract.coverage.route.status, "tested");
  assert.ok(contract.coverage.route.evidence.includes("output/demo-route-audit/latest.json"));
  assert.notEqual(
    contract.coverage.route.status,
    manifest.coverage.route.status,
    `${manifest.route}: canonical route audit must remain authoritative`,
  );
}

const rootClosure = getLocalSourceClosure("src/app/design-lab/page.tsx");
assert.ok(rootClosure.has("src/components/design-lab-advertising-console.tsx"));

const adminFrameClosure = getLocalSourceClosure(
  "src/app/design-lab/demo-experience/page.tsx",
);
assert.ok(
  adminFrameClosure.has("src/components/admin-control-centre-frame-lab.tsx"),
);
assert.ok(
  !adminFrameClosure.has("src/app/admin/page.tsx"),
  "The /admin iframe is a separate route document, not a form owned by the Design Lab shell",
);

const detectorSelfCheck = ts.createSourceFile(
  "form-detector-self-check.tsx",
  '<form onSubmit={() => undefined}><button type="submit">Save</button></form>',
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
assert.deepEqual(
  findFormSubmissionSignalsInSource("form-detector-self-check.tsx", detectorSelfCheck),
  [
    "form-detector-self-check.tsx:1:<form>",
    "form-detector-self-check.tsx:1:onSubmit",
    "form-detector-self-check.tsx:1:type=submit",
  ],
);

console.log("Design Lab screen inventories and registry overlay passed");

function getLocalSourceClosure(entryPath: string) {
  const repoRoot = path.resolve(".");
  const pending = [path.resolve(entryPath)];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const absolutePath = pending.pop()!;
    const repoPath = normalizeRepoPath(path.relative(repoRoot, absolutePath));
    assert.ok(
      repoPath !== ".." && !repoPath.startsWith("../") && !path.isAbsolute(repoPath),
      `${entryPath}: local import escaped the repository: ${absolutePath}`,
    );
    if (visited.has(repoPath)) continue;
    visited.add(repoPath);

    const source = readFileSync(absolutePath, "utf8");
    const sourceFile = ts.createSourceFile(
      absolutePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      absolutePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    for (const specifier of localImportSpecifiers(sourceFile)) {
      const resolved = resolveLocalImport(absolutePath, specifier);
      if (resolved) pending.push(resolved);
    }
  }

  return visited;
}

function localImportSpecifiers(sourceFile: ts.SourceFile) {
  const specifiers: string[] = [];
  function visit(node: ts.Node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return specifiers;
}

function resolveLocalImport(fromPath: string, specifier: string) {
  if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return null;
  const base = specifier.startsWith("@/")
    ? path.resolve("src", specifier.slice(2))
    : path.resolve(path.dirname(fromPath), specifier);
  const explicitExtension = path.extname(base);
  const candidates = explicitExtension
    ? [base]
    : [
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        `${base}.jsx`,
        path.join(base, "index.ts"),
        path.join(base, "index.tsx"),
        path.join(base, "index.js"),
        path.join(base, "index.jsx"),
      ];
  return (
    candidates.find(
      (candidate) =>
        /\.[cm]?[jt]sx?$/.test(candidate) && existsSync(candidate),
    ) ?? null
  );
}

function findFormSubmissionSignals(repoPath: string) {
  const sourceFile = ts.createSourceFile(
    repoPath,
    readFileSync(path.resolve(repoPath), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    repoPath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  return findFormSubmissionSignalsInSource(repoPath, sourceFile);
}

function findFormSubmissionSignalsInSource(
  repoPath: string,
  sourceFile: ts.SourceFile,
) {
  const signals: string[] = [];
  function record(node: ts.Node, signal: string) {
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    signals.push(`${normalizeRepoPath(repoPath)}:${line}:${signal}`);
  }
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      if (tagName.toLowerCase() === "form" || tagName === "Form" || tagName.endsWith(".Form")) {
        record(node, `<${tagName}>`);
      }
      if (tagName === "button" || tagName === "input") {
        const type = node.attributes.properties.find(
          (attribute): attribute is ts.JsxAttribute =>
            ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === "type",
        );
        if (type?.initializer && ts.isStringLiteral(type.initializer) && type.initializer.text === "submit") {
          record(type, "type=submit");
        }
      }
    }
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      if (name === "onSubmit" || name === "formAction") record(node, name);
    }
    if (
      ts.isCallExpression(node) &&
      (node.expression.getText(sourceFile) === "useActionState" ||
        node.expression.getText(sourceFile).endsWith(".requestSubmit"))
    ) {
      record(node, node.expression.getText(sourceFile));
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return signals;
}

function normalizeRepoPath(filePath: string) {
  return filePath.replaceAll("\\", "/");
}
