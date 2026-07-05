import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// ponytail: skip list for concurrently-edited files only — remove entries once
// the human session owning races/replay/live lands and tests verify clean.
// TODO: clear this list when races/live work is complete.
const SKIP_FILES: string[] = [];

const tsxBin = join("node_modules", "tsx", "dist", "cli.mjs");

function findTestFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findTestFiles(full));
    else if (entry.name.endsWith(".test.ts")) results.push(full.replace(/\\/g, "/"));
  }
  return results.sort();
}

function runFile(file: string): boolean {
  const first = spawnSync(process.execPath, [tsxBin, file], {
    stdio: ["inherit", "inherit", "pipe"],
    encoding: "utf8",
  });
  if (first.status === 0) return true;

  const stderr: string = first.stderr ?? "";
  if (stderr.includes("server-only")) {
    // Module uses "server-only" guard — retry under react-server conditions.
    const retry = spawnSync(
      process.execPath,
      [tsxBin, "--conditions=react-server", file],
      { stdio: "inherit" }
    );
    return (retry.status ?? 1) === 0;
  }

  process.stderr.write(stderr);
  return false;
}

const files = findTestFiles("src");
const passed: string[] = [];

for (const file of files) {
  if (SKIP_FILES.includes(file)) {
    console.log(`[skip] ${file}`);
    continue;
  }
  console.log(`[run]  ${file}`);
  if (!runFile(file)) {
    console.error(`\nFAILED: ${file}`);
    process.exit(1);
  }
  passed.push(file);
}

console.log(`\nAll ${passed.length} unit test${passed.length === 1 ? "" : "s"} passed.`);
