import assert from "node:assert/strict";

import {
  hasProfileMarketingFields,
  profileUpdateSchema,
} from "@/lib/account-validation";

const basicProfile = profileUpdateSchema.parse({
  bio: "Form researcher",
  displayName: "Daniel",
  state: "NSW",
});

const marketingProfile = profileUpdateSchema.parse({
  displayName: "Daniel",
  kennelName: "Greyhounds IQ",
});

assert.equal(hasProfileMarketingFields(basicProfile), false);
assert.equal(hasProfileMarketingFields(marketingProfile), true);

console.log("account validation tests passed");
