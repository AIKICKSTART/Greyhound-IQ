import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { workosCookiePolicyError } from "../src/lib/workos-env";
import { COOKIE_CONTROL_MASTER_EVIDENCE } from "./cookie-control-evidence";

const production = {
  NODE_ENV: "production",
  NEXT_PUBLIC_WORKOS_REDIRECT_URI: "https://greyhoundsiq.com.au/callback",
  WORKOS_COOKIE_SAMESITE: "lax",
  WORKOS_COOKIE_DOMAIN: "",
};
assert.equal(workosCookiePolicyError(production), null);
assert.match(
  workosCookiePolicyError({
    ...production,
    WORKOS_COOKIE_DOMAIN: ".greyhoundsiq.com.au",
  }) ?? "",
  /host-only/,
);

const cloudRunDeploy = readFileSync(
  ".github/workflows/cloud-run-deploy.yml",
  "utf8",
);
assert.match(
  cloudRunDeploy,
  /if \[ -n "\$\{\{ vars\.WORKOS_COOKIE_DOMAIN \}\}" \]; then[\s\S]*WORKOS_COOKIE_DOMAIN must remain empty so production sessions are host-only/,
  "Cloud Run deployment must reject a configured WorkOS cookie domain",
);
assert.doesNotMatch(
  cloudRunDeploy,
  /WORKOS_COOKIE_DOMAIN=\$workos_cookie_domain/,
  "Cloud Run must not inject a shared WorkOS cookie domain",
);

const workosCookie = readFileSync(
  "node_modules/@workos-inc/authkit-nextjs/dist/esm/cookie.js",
  "utf8",
);
const workosSession = readFileSync(
  "node_modules/@workos-inc/authkit-nextjs/dist/esm/session.js",
  "utf8",
);
assert.match(workosCookie, /path: '\/'/);
assert.match(workosCookie, /httpOnly: true/);
assert.match(
  workosCookie,
  /const sameSite = WORKOS_COOKIE_SAMESITE \|\| 'lax'/,
);
assert.match(workosCookie, /secure = url\.protocol === 'https:'/);
assert.match(workosCookie, /domain: WORKOS_COOKIE_DOMAIN \|\| ''/);
assert.match(workosSession, /Set-Cookie/);
assert.match(workosSession, /encryptedSession/);

const productionFiles = collectTypeScriptFiles("src").filter(
  (file) =>
    !/\.test\.(?:ts|tsx)$/.test(file) && !/-evidence\.(?:ts|tsx)$/.test(file),
);
const applicationSource = productionFiles
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

assert.doesNotMatch(
  applicationSource,
  /searchParams\.(?:set|append)\(\s*["'](?:session|sessionId|accessToken|refreshToken|token)["']/i,
  "application URLs must not carry session material",
);
assert.doesNotMatch(
  applicationSource,
  /(?:gtag|posthog|mixpanel|segment|analytics)\s*\([^\n]{0,240}(?:session|accessToken|refreshToken|authorization)/i,
  "analytics calls must not receive session material",
);
assert.doesNotMatch(
  applicationSource,
  /console\.(?:log|error|warn|info|debug)\([^\n]{0,240}(?:session|accessToken|refreshToken|authorization|cookie)/i,
  "client logs must not receive session material",
);

const adminError = readFileSync("src/app/admin/error.tsx", "utf8");
assert.match(adminError, /console\.error\("admin\.segment_error", \{ digest:/);
assert.doesNotMatch(adminError, /session|token|authorization|cookie/i);

const localStorageFiles = productionFiles.filter((file) =>
  /(?:localStorage|sessionStorage)\.(?:getItem|setItem)/.test(
    readFileSync(file, "utf8"),
  ),
);
assert.deepEqual(localStorageFiles.toSorted(), [
  join("src", "components", "cookie-consent.tsx"),
  join("src", "components", "interactive-help.tsx"),
  join("src", "components", "onboarding-analytics-client.ts"),
]);
for (const file of localStorageFiles) {
  const source = readFileSync(file, "utf8");
  assert.doesNotMatch(
    source,
    /(?:accessToken|refreshToken|authorization|sessionToken|workos-access-token|wos-session)/i,
  );
}

const activeIdentity = readFileSync("src/app/actions.ts", "utf8");
assert.match(activeIdentity, /httpOnly: true/);
assert.match(activeIdentity, /sameSite: "lax"/);
assert.match(activeIdentity, /secure: process\.env\.NODE_ENV === "production"/);
assert.match(activeIdentity, /path: "\/"/);

const expectedIds = Object.keys(COOKIE_CONTROL_MASTER_EVIDENCE);
assert.equal(expectedIds.length, 10);
for (const requirementId of expectedIds) {
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    COOKIE_CONTROL_MASTER_EVIDENCE[requirementId],
  );
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

console.log(
  "Cookie controls passed: host-only hardened sessions and no browser-side session leakage",
);

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}
