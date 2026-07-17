import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/app/api/internal/live-sync/route.ts",
  "utf8"
);

assert.match(source, /export async function POST\(request: NextRequest\)/);
assert.doesNotMatch(
  source,
  /export async function GET\(/,
  "live racing synchronization must not mutate through GET"
);
assert.equal(
  [...source.matchAll(/runLiveSync\(request\)/g)].length,
  1,
  "only the POST handler may dispatch the live synchronization mutation"
);

console.log("live-sync route method contract tests passed");
