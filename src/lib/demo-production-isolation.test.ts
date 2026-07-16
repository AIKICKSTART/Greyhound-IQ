import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rootLayout = readFileSync("src/app/layout.tsx", "utf8");
const designLabPage = readFileSync("src/app/design-lab/page.tsx", "utf8");
const designLabAccess = readFileSync("src/lib/design-lab-access.ts", "utf8");

assert.match(
  rootLayout,
  /const user = fullAccessDemo \? null : await getCurrentUser\(\)/,
  "The isolated demo must not resolve a real database-backed user."
);
assert.match(
  rootLayout,
  /const auth = fullAccessDemo \? \{ user: null as null \} : await withAuth\(\)/,
  "The isolated demo must not resolve a real AuthKit session."
);
assert.match(rootLayout, /data-demo-read-only=/);
assert.match(designLabPage, /robots: \{ index: false, follow: false \}/);
assert.match(
  designLabPage,
  /await requireDesignLabReviewer\(\)/,
  "Production Design Lab access must be denied unless explicitly enabled server-side."
);
assert.match(designLabAccess, /requireAdminProfile\(\)/);
assert.match(designLabAccess, /isFullAccessDemo\(\)/);

console.log("Design Lab production-isolation contract tests passed");
