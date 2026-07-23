import assert from "node:assert/strict";
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "./security-master-requirements";
import {
  SECURITY_REQUIRED_OUTPUT_EVIDENCE,
  SECURITY_REQUIRED_OUTPUT_PATHS,
} from "./security-required-outputs";

const repositoryRoot = realpathSync(resolve(__dirname, "../.."));
const outputRequirements = SECURITY_MASTER_REQUIREMENTS.filter(
  (requirement) => requirement.section === "required-output",
);

assert.equal(outputRequirements.length, 35, "required output count changed");
assert.deepEqual(
  Object.keys(SECURITY_REQUIRED_OUTPUT_PATHS).sort(),
  outputRequirements.map((requirement) => requirement.id).sort(),
  "every required output must have exactly one evidence mapping",
);
assert.deepEqual(
  Object.keys(SECURITY_REQUIRED_OUTPUT_EVIDENCE).sort(),
  outputRequirements.map((requirement) => requirement.id).sort(),
  "only immutable required-output requirements may receive output evidence",
);

const allPaths = Object.values(SECURITY_REQUIRED_OUTPUT_PATHS).flat();
assert.equal(
  new Set(allPaths).size,
  allPaths.length,
  "one output file must not satisfy multiple immutable output requirements",
);
const registryTestSource = readFileSync(
  resolve(repositoryRoot, "security/registry.test.ts"),
  "utf8",
);
const unitRunnerSource = readFileSync(
  resolve(repositoryRoot, "scripts/run-unit-tests.ts"),
  "utf8",
);
assert.match(
  unitRunnerSource,
  /\["src", "scripts", "security"\]\.flatMap\(findTestFiles\)/,
  "the unit runner must execute machine-registry tests",
);

for (const requirement of outputRequirements) {
  const paths = SECURITY_REQUIRED_OUTPUT_PATHS[
    requirement.id as keyof typeof SECURITY_REQUIRED_OUTPUT_PATHS
  ] as readonly string[];
  assert.ok(paths.length > 0, `${requirement.id} needs an output path`);
  assert.match(
    requirement.requirement,
    /^Produce (?:docs\/security\/|the authoritative machine registry security\/)/,
    `${requirement.id} must remain an output-production requirement`,
  );

  const evidence = SECURITY_REQUIRED_OUTPUT_EVIDENCE[requirement.id];
  assert.equal(evidence.status, "verified");
  assert.equal(
    evidence.verificationScope,
    "output-existence-only",
    `${requirement.id} must not claim underlying control correctness`,
  );

  const pathsNamedByRequirement = new Set(
    requirement.requirement.match(
      /(?:docs\/security\/[a-z0-9.-]+\.(?:md|json)|security\/[a-z0-9.-]+\.ts)/g,
    ) ?? [],
  );
  assert.deepEqual(
    [...paths].sort(),
    [...pathsNamedByRequirement].sort(),
    `${requirement.id} evidence paths must match the immutable requirement`,
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
      /\[(?:insert|details|unknown|todo|tbd)\b|lorem ipsum|\bplaceholder\b/i,
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
    } else {
      assert.match(source, /\bexport\b/, `${path} must export its registry`);
      const moduleName = `./${path.slice("security/".length, -".ts".length)}`;
      assert.ok(
        registryTestSource.includes(`from "${moduleName}"`),
        `${path} must be imported by security/registry.test.ts`,
      );
    }
  }

  const expectedEvidence = [
    ...paths,
    "src/components/security-required-outputs.test.ts",
    ...(paths.some((path) => path.startsWith("security/"))
      ? ["security/registry.test.ts"]
      : []),
  ];
  assert.deepEqual(
    evidence.evidence,
    expectedEvidence,
    `${requirement.id} evidence must remain scoped to output existence`,
  );
}

console.log(
  "All 35 required security output files exist; underlying control correctness is not asserted",
);
