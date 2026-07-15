import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  COMMAND_INJECTION_CONTROL_MASTER_EVIDENCE,
  COMMAND_INJECTION_CONTROL_REQUIREMENT_ID,
  auditCommandExecutionSources,
  type CommandExecutionSource,
} from "./command-injection-control-evidence";

const productionSources = collectProductionSources("src");
assert.deepEqual(auditCommandExecutionSources(productionSources), []);

const requirement = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) => candidate.id === COMMAND_INJECTION_CONTROL_REQUIREMENT_ID,
);
assert.ok(requirement, "command-injection requirement must remain immutable");
assert.deepEqual(
  SECURITY_MASTER_EVIDENCE[COMMAND_INJECTION_CONTROL_REQUIREMENT_ID],
  COMMAND_INJECTION_CONTROL_MASTER_EVIDENCE[
    COMMAND_INJECTION_CONTROL_REQUIREMENT_ID
  ],
);
assert.equal(isMasterRequirementComplete(requirement), true);

const unsafeExecIssues = auditCommandExecutionSources([
  ...productionSources,
  {
    path: "src/lib/unsafe-command.ts",
    source:
      'import { exec } from "node:child_process";\nexec(userControlledCommand);\n',
  },
]);
assert.ok(
  unsafeExecIssues.includes(
    "UNREVIEWED_CHILD_PROCESS_IMPORT:src/lib/unsafe-command.ts",
  ),
);

const dynamicImportIssues = auditCommandExecutionSources([
  ...productionSources,
  {
    path: "src/lib/dynamic-command.ts",
    source: 'const command = await import("node:child_process");\n',
  },
]);
assert.ok(
  dynamicImportIssues.includes(
    "DYNAMIC_CHILD_PROCESS_IMPORT:src/lib/dynamic-command.ts",
  ),
);

const reviewedSource = productionSources.find(
  (item) => item.path === "src/lib/media-service.ts",
);
assert.ok(reviewedSource);
const shellEnabledSources = productionSources.map((item) =>
  item.path === reviewedSource.path
    ? {
        ...item,
        source: item.source.replace(
          "maxBuffer: 4 * 1024 * 1024,",
          "maxBuffer: 4 * 1024 * 1024, shell: true,",
        ),
      }
    : item,
);
assert.ok(
  auditCommandExecutionSources(shellEnabledSources).some((issue) =>
    issue.startsWith("COMMAND_SHELL_OPTION:src/lib/media-service.ts:"),
  ),
);

const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
  dependencies?: Record<string, string>;
};
for (const packageName of ["execa", "shelljs", "cross-spawn"]) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(manifest.dependencies ?? {}, packageName),
    false,
    `${packageName}: command-execution wrapper requires a policy review`,
  );
}

console.log(
  "Command-injection control passed: one exhaustive execFile boundary, five bounded calls, five allowlisted FFmpeg invocations, and no shell execution.",
);

function collectProductionSources(directory: string): CommandExecutionSource[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Unsupported symbolic link under production source: ${fullPath}`);
      }
      if (entry.isDirectory()) return collectProductionSources(fullPath);
      if (
        !/\.(?:c|m)?(?:j|t)sx?$/.test(entry.name) ||
        /\.(?:test|spec)\.(?:c|m)?(?:j|t)sx?$/.test(entry.name)
      ) {
        return [];
      }
      return [
        {
          path: relative(process.cwd(), fullPath).replaceAll("\\", "/"),
          source: readFileSync(fullPath, "utf8"),
        },
      ];
    })
    .toSorted((left, right) => left.path.localeCompare(right.path));
}
