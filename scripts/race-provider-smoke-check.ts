import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

type PackageJson = {
  scripts?: Record<string, string>;
};

type SmokeCommand = {
  label: string;
  script: string;
  file: string;
  requiredText?: string;
};

const commands: SmokeCommand[] = [
  {
    label: "deployment smoke gate",
    script: "test:smoke",
    file: "scripts/smoke-production.ts",
  },
  {
    label: "live race coverage audit",
    script: "audit:live-race-coverage",
    file: "scripts/audit-live-race-coverage.ts",
  },
  {
    label: "live result coverage audit",
    script: "audit:live-result-coverage",
    file: "scripts/audit-live-result-coverage.ts",
  },
  {
    label: "TheDogs harvest status",
    script: "status:thedogs:harvest",
    file: "scripts/status-thedogs-harvest.ts",
  },
  {
    label: "TheDogs import replay check",
    script: "supervise:thedogs:imports",
    file: "scripts/supervise-thedogs-import-replay.ts",
    requiredText: "checkOnce",
  },
  {
    label: "TheDogs race-day archive check",
    script: "supervise:thedogs:race-day-archive",
    file: "scripts/supervise-thedogs-race-day-archive-import.ts",
    requiredText: "checkOnce",
  },
  {
    label: "TheDogs dog-profile import check",
    script: "supervise:thedogs:dog-profile-import",
    file: "scripts/supervise-thedogs-dog-profile-import.ts",
    requiredText: "checkOnce",
  },
];

const healthPaths = ["/api/health", "/api/health/ready", "/api/health/feeds"];

main().catch((error) => {
  console.error("Race provider smoke checklist failed:");
  console.error(String(error));
  process.exitCode = 1;
});

async function main() {
  parseArgs(process.argv.slice(2));

  const failures: string[] = [];
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as PackageJson;
  const scripts = packageJson.scripts ?? {};

  for (const command of commands) {
    const value = scripts[command.script];
    if (!value) {
      failures.push(`package.json missing script: ${command.script}`);
      continue;
    }
    if (!value.includes(command.file)) {
      failures.push(`${command.script} does not run ${command.file}`);
    }
    if (!existsSync(command.file)) {
      failures.push(`missing script file: ${command.file}`);
      continue;
    }
    if (command.requiredText) {
      const source = await readFile(command.file, "utf8");
      if (!source.includes(command.requiredText)) {
        failures.push(`${command.file} missing ${command.requiredText}`);
      }
    }
  }

  const smokeSource = await readFile("scripts/smoke-production.ts", "utf8");
  for (const path of healthPaths) {
    if (!smokeSource.includes(path)) {
      failures.push(`scripts/smoke-production.ts missing ${path}`);
    }
  }

  if (failures.length > 0) {
    console.error("Race provider smoke checklist failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("Race provider smoke checklist passed (no network).");
  console.log("Verified provider health gate paths:");
  for (const path of healthPaths) console.log(`- ${path}`);
  console.log("Verified reusable provider smoke commands:");
  for (const command of commands) {
    console.log(`- npm run ${command.script} -> ${command.file}`);
  }
}

function parseArgs(args: string[]) {
  for (const arg of args) {
    if (arg === "--no-network" || arg === "--dry-run") continue;
    if (arg === "--help") {
      console.log("Usage: npm run smoke:race-provider -- --no-network");
      process.exit(0);
    }
    throw new Error(`Unknown option: ${arg}`);
  }
}

export {};
