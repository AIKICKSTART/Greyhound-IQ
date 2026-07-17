import assert from "node:assert/strict";

import {
  adminAudCurrencySchema,
  adminBugReportSeveritySchema,
  adminBugReportStatusSchema,
  adminEntitlementKeySchema,
  adminEntitlementInputSchema,
  adminEntitlementLimitSchema,
  adminOrganizationInvitationRoleSchema,
  adminOptionalDateSchema,
  adminPlanStatusSchema,
  adminPriceIntervalSchema,
  adminPriceStatusSchema,
  adminSourceHealthStatusSchema,
  adminSupportTicketCategorySchema,
  adminSupportTicketPrioritySchema,
  adminSupportTicketStatusSchema,
  adminRequiredDateSchema,
} from "./admin-input-contract";

const allowlistCases = [
  [adminPlanStatusSchema, "active"],
  [adminPriceStatusSchema, "inactive"],
  [adminPriceIntervalSchema, "yearly"],
  [adminEntitlementKeySchema, "agent_runs_per_month"],
  [adminOrganizationInvitationRoleSchema, "member"],
  [adminSourceHealthStatusSchema, "degraded"],
  [adminSupportTicketStatusSchema, "resolved"],
  [adminSupportTicketPrioritySchema, "urgent"],
  [adminSupportTicketCategorySchema, "technical"],
  [adminBugReportStatusSchema, "in_progress"],
  [adminBugReportSeveritySchema, "critical"],
] as const;

for (const [schema, allowed] of allowlistCases) {
  assert.equal(schema.safeParse(allowed).success, true);
  assert.equal(
    schema.safeParse("forged-value").success,
    false,
    `${allowed} allowlist must fail closed for an unexpected value`
  );
}

assert.equal(adminAudCurrencySchema.parse("aud"), "AUD");
assert.equal(adminAudCurrencySchema.safeParse("USD").success, false);
assert.equal(adminEntitlementLimitSchema.parse(-1), -1);
assert.equal(adminEntitlementLimitSchema.safeParse(-2).success, false);
assert.equal(
  adminEntitlementLimitSchema.safeParse(100 * 1024 ** 3).success,
  false,
  "the generic cost limit must remain bounded"
);
assert.equal(
  adminEntitlementInputSchema.safeParse({
    featureKey: "storage_bytes",
    limitValue: 100 * 1024 ** 3,
  }).success,
  true,
  "the current Pro+ storage default must remain configurable"
);
assert.equal(
  adminEntitlementInputSchema.safeParse({
    featureKey: "prediction_runs_per_month",
    limitValue: 100 * 1024 ** 3,
  }).success,
  false,
  "storage-sized values must not weaken cost-bearing limits"
);
assert.equal(
  adminEntitlementInputSchema.safeParse({
    featureKey: "advanced_prediction_agents",
    limitValue: 1,
  }).success,
  false,
  "boolean entitlements must not accept numeric limits"
);

assert.equal(
  adminRequiredDateSchema.parse("2026-07-15T12:30") instanceof Date,
  true,
);
assert.equal(adminOptionalDateSchema.parse(null), null);
for (const value of [
  "",
  "not-a-date",
  "2026-02-30T12:30",
  "2026-13-01T12:30",
  "2026-07-15T24:00",
  "2026-07-15",
]) {
  assert.equal(
    adminRequiredDateSchema.safeParse(value).success,
    false,
    `${value || "empty date"}: invalid admin date must fail closed`,
  );
}

console.log("admin privileged input allowlist tests passed");
