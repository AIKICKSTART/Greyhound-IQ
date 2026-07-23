import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { writeWave2ReportAtomically } from "./audit-design-lab-hydrated-wave2";

async function main() {
  const temporaryRoot = realpathSync(tmpdir());
  const testDirectory = mkdtempSync(
    path.join(temporaryRoot, "greyhoundiq-wave2-write-test-"),
  );
  try {
    const outputPath = path.join(testDirectory, "evidence.json");
    writeFileSync(outputPath, "previous\n", "utf8");
    await writeWave2ReportAtomically(outputPath, "replacement\n");
    assert.equal(readFileSync(outputPath, "utf8"), "replacement\n");
    assert.deepEqual(temporaryFiles(testDirectory), []);

    const invalidTarget = path.join(testDirectory, "directory-target");
    mkdirSync(invalidTarget);
    await assert.rejects(() =>
      writeWave2ReportAtomically(invalidTarget, "rejected\n"),
    );
    assert.equal(readFileSync(outputPath, "utf8"), "replacement\n");
    assert.deepEqual(temporaryFiles(testDirectory), []);
  } finally {
    const canonicalTestDirectory = realpathSync(testDirectory);
    const relativeTestDirectory = path.relative(
      temporaryRoot,
      canonicalTestDirectory,
    );
    assert.equal(path.dirname(relativeTestDirectory), ".");
    assert.match(
      path.basename(relativeTestDirectory),
      /^greyhoundiq-wave2-write-test-/,
    );
    rmSync(canonicalTestDirectory, { recursive: true, force: true });
  }
  console.log("Design Lab hydrated wave 2 atomic-write tests passed");
}

function temporaryFiles(directory: string) {
  return readdirSync(directory).filter((name) => name.endsWith(".tmp"));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
