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
    else if (/\.test\.tsx?$/.test(entry.name)) results.push(full.replace(/\\/g, "/"));
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
  const hitServerOnlyImportGuard =
    /node_modules[\\/]server-only[\\/]index\.js:\d+/.test(stderr) &&
    stderr.includes(
      "This module cannot be imported from a Client Component module.",
    );
  if (hitServerOnlyImportGuard) {
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

const files = ["src", "scripts", "security"].flatMap(findTestFiles).sort();
if (process.argv.includes("--list")) {
  console.log(files.join("\n"));
  process.exit(0);
}
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
