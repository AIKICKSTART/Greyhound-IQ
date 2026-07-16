import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const designLabPages = [
  "src/app/design-lab/page.tsx",
  "src/app/design-lab/demo-experience/page.tsx",
  "src/app/design-lab/dock-skins/page.tsx",
  "src/app/design-lab/role-blueprints/page.tsx",
  "src/app/feed/device-preview/page.tsx",
  "src/app/marketplace/design-lab/page.tsx",
] as const;
const accessSource = readFileSync("src/lib/design-lab-access.ts", "utf8");
const policySource = readFileSync(
  "src/lib/design-lab-access-policy.ts",
  "utf8"
);

for (const path of designLabPages) {
  const source = readFileSync(path, "utf8");
  assert.match(
    source,
    /robots: \{ index: false, follow: false \}/,
    `${path} must remain noindex.`
  );
  assert.match(
    source,
    /await requireDesignLabReviewer\(\)/,
    `${path} must remain server-gated in production.`
  );
}

assert.match(accessSource, /if \(decision === "deny"\) notFound\(\)/);
assert.match(
  accessSource,
  /if \(decision === "require-administrator"\)[\s\S]*await requireAdminProfile\(\)[\s\S]*catch[\s\S]*notFound\(\)/
);
assert.match(policySource, /if \(enabled !== "true"\) return "deny"/);
assert.match(
  policySource,
  /if \(isolatedDemo\) return "allow-isolated-demo"/
);

console.log(`${designLabPages.length} Design Lab routes passed safety checks`);
