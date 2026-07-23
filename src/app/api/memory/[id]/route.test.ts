import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/api/memory/[id]/route.ts", "utf8");
const getHandler = source.slice(
  source.indexOf("export async function GET"),
  source.indexOf("export async function DELETE"),
);

assert.match(getHandler, /tx\.memoryEntry\.findFirst\(/);
assert.doesNotMatch(
  getHandler,
  /\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\(/,
  "memory GET must remain read-only",
);
assert.doesNotMatch(getHandler, /accessCount|lastAccessedAt/);

console.log("memory GET read-only contract tests passed");
