import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  THIRD_PARTY_INVENTORY_MASTER_EVIDENCE,
  THIRD_PARTY_INVENTORY_SCOPE,
  THIRD_PARTY_SOURCE_BINDINGS,
} from "./third-party-inventory-evidence";
import { THIRD_PARTIES, type ThirdPartyContract } from "./third-parties";

const requirementId = "security.third-party-inventory.all-providers";
const requirement = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) => candidate.id === requirementId,
);
assert.ok(requirement, "immutable third-party inventory requirement missing");
assert.equal(requirement.requirement, "Inventory every external provider.");
assert.deepEqual(
  SECURITY_MASTER_EVIDENCE[requirementId],
  THIRD_PARTY_INVENTORY_MASTER_EVIDENCE[requirementId],
);
assert.equal(isMasterRequirementComplete(requirement), true);

assert.equal(THIRD_PARTIES.length, 18);
assert.equal(THIRD_PARTY_SOURCE_BINDINGS.length, 18);
assert.deepEqual(
  THIRD_PARTIES.map(({ providerId }) => providerId).toSorted(),
  THIRD_PARTY_SOURCE_BINDINGS.map(({ providerId }) => providerId).toSorted(),
);
assert.equal(new Set(THIRD_PARTY_SOURCE_BINDINGS.map(({ providerId }) => providerId)).size, 18);

for (const binding of THIRD_PARTY_SOURCE_BINDINGS) {
  assert.ok(existsSync(binding.sourceFile), `${binding.providerId}: missing ${binding.sourceFile}`);
  assert.match(
    readFileSync(binding.sourceFile, "utf8"),
    new RegExp(escapeRegExp(binding.sourceMarker)),
    `${binding.providerId}: source marker drifted`,
  );
}

for (const provider of THIRD_PARTIES) {
  for (const [field, value] of Object.entries(provider)) {
    assertCompleteValue(provider, field, value);
  }
  assert.ok(provider.sourceFiles.length > 0, `${provider.providerId}: no source files`);
  for (const sourceFile of provider.sourceFiles) {
    assert.ok(existsSync(sourceFile), `${provider.providerId}: missing ${sourceFile}`);
  }
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  dependencies: Record<string, string>;
};
for (const dependency of [
  "@supabase/ssr",
  "@supabase/supabase-js",
  "@workos-inc/authkit-nextjs",
  "@workos-inc/node",
  "livekit-client",
  "livekit-server-sdk",
  "stripe",
]) {
  assert.ok(packageJson.dependencies[dependency], `${dependency}: external SDK not dependency-pinned`);
}
assert.match(THIRD_PARTY_INVENTORY_SCOPE, /source-visible/);
assert.match(THIRD_PARTY_INVENTORY_SCOPE, /not provider contracts/i);
assert.ok(
  THIRD_PARTIES.every(({ verificationStatus }) => verificationStatus !== "Verified"),
  "source inventory must not promote provider runtime controls",
);
assert.ok(
  THIRD_PARTIES.some(({ costLimit }) => /not verified/i.test(costLimit)),
  "known provider control gaps must remain visible",
);

console.log(
  "third-party inventory passed: 18/18 source-visible providers registered; runtime/provider controls remain explicitly unverified",
);

function assertCompleteValue(
  provider: ThirdPartyContract,
  field: string,
  value: unknown,
) {
  if (typeof value === "string") {
    assert.ok(value.trim(), `${provider.providerId}: blank ${field}`);
    return;
  }
  if (Array.isArray(value)) {
    assert.ok(
      value.length > 0 || field === "personalInformation" || field === "evidence",
      `${provider.providerId}: empty ${field}`,
    );
    for (const item of value) {
      assert.ok(
        typeof item === "object" || (typeof item === "string" && item.trim()),
        `${provider.providerId}: invalid ${field}`,
      );
    }
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
