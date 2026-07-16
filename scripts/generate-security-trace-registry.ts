import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { MASTER_AUDIT_REQUIREMENTS } from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  FINAL_TRACEABILITY_ROWS,
  buildFinalTraceabilitySummary,
  renderFinalTraceabilityMarkdown,
} from "../security/final-traceability";

async function main() {
  const repositoryRoot = path.resolve(__dirname, "..");
  const reportPath = path.join(
    repositoryRoot,
    "docs",
    "security",
    "security-trace-registry.md",
  );
  const write = process.argv.includes("--write");
  const check = process.argv.includes("--check");

  if (write === check) {
    throw new Error(
      "Choose exactly one mode: --write or --check for the security trace registry.",
    );
  }

  const now = Date.now();
  const acceptedRiskRecords = MASTER_AUDIT_REQUIREMENTS.filter(
    (requirement) =>
      requirement.prompt === "security" &&
      requirement.status === "risk-accepted-temporarily",
  );
  const summary = buildFinalTraceabilitySummary({
    mandatoryTraceRequirementCount: SECURITY_MASTER_REQUIREMENTS.filter(
      (requirement) => requirement.section === "mandatory-trace",
    ).length,
    acceptedRisks: acceptedRiskRecords.length,
    expiredRiskAcceptances: acceptedRiskRecords.filter(
      (requirement) =>
        !requirement.riskAcceptance ||
        Date.parse(requirement.riskAcceptance.expiresOn) <= now,
    ).length,
  });
  const generated = renderFinalTraceabilityMarkdown(
    FINAL_TRACEABILITY_ROWS,
    summary,
  );

  if (write) {
    await writeFile(reportPath, generated, "utf8");
    console.log(
      `Wrote ${path.relative(repositoryRoot, reportPath)} with ${FINAL_TRACEABILITY_ROWS.length} trace rows.`,
    );
  } else {
    const committed = (await readFile(reportPath, "utf8")).replace(
      /\r\n/g,
      "\n",
    );
    if (committed !== generated) {
      throw new Error(
        "Security trace registry drifted. Run npm run build:security-trace-registry and review the generated report.",
      );
    }
    console.log(
      `Security trace registry is current: ${FINAL_TRACEABILITY_ROWS.length} trace rows.`,
    );
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
