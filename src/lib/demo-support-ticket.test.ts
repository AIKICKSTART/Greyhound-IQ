import assert from "node:assert/strict";

import {
  DEMO_SUPPORT_TICKET_ID,
  resolveDemoSupportTicketFixture,
} from "@/lib/demo-support-ticket";

const current = {
  dbUserId: "demo-user-admin-pro-plus",
  email: "admin@greyhoundiq.test",
};
const demoEnv = { APP_ENV: "demo", DEMO_AUTH_MODE: "full-access" };

const fixture = resolveDemoSupportTicketFixture(
  current,
  DEMO_SUPPORT_TICKET_ID,
  demoEnv,
);
assert.ok(fixture);
assert.equal(fixture._count.messages, 2);
assert.deepEqual(
  fixture.messages.map(({ userId }) => userId),
  [current.dbUserId, null],
);
assert.equal(
  resolveDemoSupportTicketFixture(current, "another-ticket", demoEnv),
  null,
);
assert.equal(
  resolveDemoSupportTicketFixture(
    { ...current, email: "another@greyhoundiq.test" },
    DEMO_SUPPORT_TICKET_ID,
    demoEnv,
  ),
  null,
);
assert.equal(
  resolveDemoSupportTicketFixture(current, DEMO_SUPPORT_TICKET_ID, {
    APP_ENV: "production",
    DEMO_AUTH_MODE: "full-access",
  }),
  null,
);

console.log(
  "Demo support-ticket fixture passed: exact demo boundary, account and identifier required",
);
