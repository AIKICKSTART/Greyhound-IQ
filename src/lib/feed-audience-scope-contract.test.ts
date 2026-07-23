import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "src/lib/feed-service.ts"), "utf8");

assert.match(source, /status: "accepted"/);
assert.match(source, /viewerProfileId: current\.profileId/);
assert.match(source, /friendProfileIds/);
assert.match(source, /AND p\.visibility = 'public'/);
assert.match(source, /AND p\.visibility = 'public' AND s\.visibility = 'public'/);
assert.match(source, /p\."authorProfileId" IN \$\{audienceProfileIds\}/);
assert.match(source, /s\."accountableProfileId" IN \$\{audienceProfileIds\}/);
assert.match(source, /0::integer AS "window", 0::integer AS "bucket"/);
assert.doesNotMatch(source, /p\.status IN \('processing', 'failed'\)/);

console.log("feed audience scope contract passed");
