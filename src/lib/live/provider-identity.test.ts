import assert from "node:assert/strict";

import {
  officialProviderProfileUrl,
  providerIdentityEvidenceSha256,
} from "./provider-identity";

assert.equal(
  officialProviderProfileUrl({
    provider: "thedogs",
    entityKind: "trainer",
    sourceId: "10792",
    value: "/trainers/10792/ashleigh-kay",
  }),
  "https://www.thedogs.com.au/trainers/10792/ashleigh-kay",
);
assert.equal(
  officialProviderProfileUrl({
    provider: "thedogs",
    entityKind: "trainer",
    sourceId: "10792",
    value: "https://attacker.example/trainers/10792/ashleigh-kay",
  }),
  null,
);
assert.equal(
  providerIdentityEvidenceSha256("thedogs", "dog", "123", "dog-1"),
  providerIdentityEvidenceSha256("thedogs", "dog", "123", "dog-1"),
);

console.log("provider identity tests passed");
