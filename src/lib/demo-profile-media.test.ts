import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  DANIEL_DEMO_PROFILE_PORTRAIT,
  DEMO_PROFILE_PORTRAITS,
  GENERATED_DEMO_PROFILE_PORTRAITS,
  demoProfilePortraitForName,
  resolveDemoProfilePortrait,
} from "./demo-profile-media";

assert.equal(Object.keys(GENERATED_DEMO_PROFILE_PORTRAITS).length, 13);
assert.equal(Object.keys(DEMO_PROFILE_PORTRAITS).length, 14);
assert.equal(new Set(Object.values(DEMO_PROFILE_PORTRAITS)).size, 14);

for (const [displayName, publicPath] of Object.entries(DEMO_PROFILE_PORTRAITS)) {
  assert.equal(
    existsSync(path.join(process.cwd(), "public", publicPath)),
    true,
    `${displayName} is missing ${publicPath}`,
  );
}

assert.equal(
  demoProfilePortraitForName("  SARAH   THOMPSON "),
  "/images/demo-profiles/sarah-thompson.webp",
);
assert.equal(
  demoProfilePortraitForName("Daniel Fleuren"),
  DANIEL_DEMO_PROFILE_PORTRAIT,
);
assert.equal(demoProfilePortraitForName("Unknown Member"), null);

assert.equal(
  resolveDemoProfilePortrait("Patricia Pro", null, true),
  "/images/demo-profiles/patricia-pro.webp",
);
assert.equal(
  resolveDemoProfilePortrait(
    "Patricia Pro",
    "/images/custom/patricia.webp",
    true,
  ),
  "/images/custom/patricia.webp",
);
assert.equal(resolveDemoProfilePortrait("Patricia Pro", null, false), null);
assert.equal(resolveDemoProfilePortrait("Unknown Member", null, true), null);

console.log("demo profile media tests passed: 14 complete portrait mappings");
