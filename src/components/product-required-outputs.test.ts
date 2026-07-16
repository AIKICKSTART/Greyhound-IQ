import assert from "node:assert/strict";
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_REQUIRED_OUTPUT_EVIDENCE,
  PRODUCT_REQUIRED_OUTPUT_PATHS,
} from "./product-required-outputs";

const repositoryRoot = realpathSync(resolve(__dirname, "../.."));
const outputRequirements = PRODUCT_MASTER_REQUIREMENTS.filter(
  (requirement) => requirement.section === "outputs",
);

assert.equal(outputRequirements.length, 17, "required product output count changed");
assert.deepEqual(
  Object.keys(PRODUCT_REQUIRED_OUTPUT_PATHS).sort(),
  outputRequirements.map((requirement) => requirement.id).sort(),
  "every product output requirement must have exactly one evidence mapping",
);
assert.deepEqual(
  Object.keys(PRODUCT_REQUIRED_OUTPUT_EVIDENCE).sort(),
  outputRequirements.map((requirement) => requirement.id).sort(),
  "only immutable product output requirements may receive output evidence",
);

for (const requirement of outputRequirements) {
  const paths = PRODUCT_REQUIRED_OUTPUT_PATHS[
    requirement.id as keyof typeof PRODUCT_REQUIRED_OUTPUT_PATHS
  ] as readonly string[];
  assert.ok(paths.length > 0, `${requirement.id} needs an output artifact`);
  assert.match(
    requirement.requirement,
    /^Produce or update /,
    `${requirement.id} must remain an output-production requirement`,
  );
  const evidence = PRODUCT_REQUIRED_OUTPUT_EVIDENCE[requirement.id];
  assert.equal(evidence.status, "verified");
  assert.equal(
    evidence.verificationScope,
    "output-existence-only",
    `${requirement.id} must not imply implementation or release readiness`,
  );

  for (const path of paths) {
    assert.equal(isAbsolute(path), false, `${path} must be repository-relative`);
    const absolutePath = resolve(repositoryRoot, path);
    assert.equal(existsSync(absolutePath), true, `${path} must exist`);
    assert.equal(lstatSync(absolutePath).isSymbolicLink(), false, `${path} must not be a symlink`);
    const canonicalPath = realpathSync(absolutePath);
    const fromRoot = relative(repositoryRoot, canonicalPath);
    assert.ok(
      fromRoot && !fromRoot.startsWith("..") && !isAbsolute(fromRoot),
      `${path} must remain inside the repository`,
    );
    assert.equal(statSync(canonicalPath).isFile(), true, `${path} must be a file`);

    const source = readFileSync(canonicalPath, "utf8");
    assert.ok(source.length >= 250, `${path} is too small to be a durable output`);
    assert.doesNotMatch(
      source,
      /\[(?:insert|details|unknown|todo|tbd)\b|lorem ipsum/i,
      `${path} is a template`,
    );
    if (path.endsWith(".md")) {
      assert.match(source, /^#\s+\S/m, `${path} must have a Markdown title`);
    } else if (path.endsWith(".json")) {
      const value = JSON.parse(source) as unknown;
      assert.ok(
        value && typeof value === "object" && !Array.isArray(value),
        `${path} must be a JSON object`,
      );
      assert.ok(Object.keys(value).length > 0, `${path} must not be empty JSON`);
    }
  }

  assert.deepEqual(
    evidence.evidence,
    [...paths, "src/components/product-required-outputs.test.ts"],
    `${requirement.id} evidence must remain scoped to output existence`,
  );
}

for (const reportPath of [
  "docs/product/broken-link-report.md",
  "docs/product/missing-screen-report.md",
  "docs/product/accessibility-audit.md",
  "docs/product/responsive-audit.md",
]) {
  const report = readFileSync(resolve(repositoryRoot, reportPath), "utf8");
  assert.match(report, /^Status: incomplete;/m, `${reportPath} must stay incomplete`);
  assert.match(
    report,
    /does not prove|does not close|remains? release-blocking|readiness fails/i,
    `${reportPath} must retain an explicit non-readiness statement`,
  );
}

const missingActionReport = readFileSync(
  resolve(repositoryRoot, "docs/product/missing-action-report.md"),
  "utf8",
);
assert.match(
  missingActionReport,
  /^Status: inventory complete; behavior verification open/m,
);
assert.match(
  missingActionReport,
  /actions remain release-blocking until those individual contracts pass/i,
);

const completionReport = readFileSync(
  resolve(repositoryRoot, "docs/product/final-audit-report.md"),
  "utf8",
);
assert.match(
  completionReport,
  /Completion is \*\*not approved\*\*/,
  "the completion output must retain its honest no-go decision",
);

const onboardingOutput = readFileSync(
  resolve(repositoryRoot, "docs/product/onboarding-map.md"),
  "utf8",
);
assert.match(
  onboardingOutput,
  /^Status: route coverage complete; deployed-browser recapture remains a release evidence task/m,
  "the tour output must retain its explicit deployment-evidence gap",
);

console.log(
  "All 17 required product outputs exist and remain scoped away from implementation readiness",
);
