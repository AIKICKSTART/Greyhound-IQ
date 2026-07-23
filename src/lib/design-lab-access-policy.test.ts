import assert from "node:assert/strict";

import { resolveDesignLabAccessDecision } from "./design-lab-access-policy";

assert.equal(
  resolveDesignLabAccessDecision({
    nodeEnv: "development",
    enabled: undefined,
    isolatedDemo: false,
  }),
  "allow-local"
);
assert.equal(
  resolveDesignLabAccessDecision({
    nodeEnv: "production",
    enabled: undefined,
    isolatedDemo: false,
  }),
  "deny"
);
assert.equal(
  resolveDesignLabAccessDecision({
    nodeEnv: "production",
    enabled: "TRUE",
    isolatedDemo: false,
  }),
  "deny",
  "the production flag must be exact"
);
assert.equal(
  resolveDesignLabAccessDecision({
    nodeEnv: "production",
    enabled: "true",
    isolatedDemo: false,
  }),
  "require-administrator"
);
assert.equal(
  resolveDesignLabAccessDecision({
    nodeEnv: "production",
    enabled: "true",
    isolatedDemo: true,
  }),
  "allow-isolated-demo"
);

console.log("Design Lab access policy tests passed");
