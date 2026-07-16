import { z } from "zod";

import {
  DEFAULT_TIER_ENTITLEMENT_LIMITS,
  ENTITLEMENT_KEYS,
  GENERIC_ENTITLEMENT_LIMIT_MAX,
  maximumEntitlementLimit,
} from "@/lib/billing/entitlements";

export const adminPlanStatusSchema = z.enum([
  "active",
  "inactive",
  "archived",
]);
export const adminPriceStatusSchema = z.enum(["active", "inactive"]);
export const adminPriceIntervalSchema = z.enum(["monthly", "yearly"]);
export const adminEntitlementKeySchema = z.enum(ENTITLEMENT_KEYS);
export const adminEntitlementLimitSchema = z.coerce
  .number()
  .int()
  .min(-1)
  .max(GENERIC_ENTITLEMENT_LIMIT_MAX)
  .nullable();
export const adminEntitlementInputSchema = z
  .object({
    featureKey: adminEntitlementKeySchema,
    limitValue: z.coerce
      .number()
      .int()
      .min(-1)
      .max(DEFAULT_TIER_ENTITLEMENT_LIMITS.pro_plus.storage_bytes)
      .nullable(),
  })
  .superRefine(({ featureKey, limitValue }, context) => {
    if (limitValue === null) return;
    const maximum = maximumEntitlementLimit(featureKey);
    if (maximum === null) {
      context.addIssue({
        code: "custom",
        path: ["limitValue"],
        message: "Boolean entitlements cannot define a numeric limit.",
      });
      return;
    }
    if (limitValue > maximum) {
      context.addIssue({
        code: "too_big",
        path: ["limitValue"],
        maximum,
        origin: "number",
        inclusive: true,
        message: "Entitlement limit exceeds the allowed maximum.",
      });
    }
  });
export const adminAudCurrencySchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.literal("AUD"));
export const adminOrganizationInvitationRoleSchema = z.enum([
  "member",
  "admin",
]);
export const adminSourceHealthStatusSchema = z.enum([
  "ok",
  "degraded",
  "error",
  "unknown",
]);
export const adminSupportTicketStatusSchema = z.enum([
  "open",
  "pending",
  "resolved",
  "closed",
]);
export const adminSupportTicketPrioritySchema = z.enum([
  "low",
  "normal",
  "high",
  "urgent",
]);
export const adminSupportTicketCategorySchema = z.enum([
  "general",
  "billing",
  "technical",
  "feedback",
]);
export const adminBugReportStatusSchema = z.enum([
  "open",
  "triaged",
  "in_progress",
  "resolved",
  "closed",
]);
export const adminBugReportSeveritySchema = z.enum([
  "low",
  "normal",
  "high",
  "critical",
]);

const ADMIN_LOCAL_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export const adminRequiredDateSchema = z
  .string()
  .trim()
  .refine(isValidAdminLocalDateTime, "Enter a valid calendar date and time")
  .transform((value) => new Date(value));

export const adminOptionalDateSchema = adminRequiredDateSchema.nullable();

function isValidAdminLocalDateTime(value: string) {
  const match = ADMIN_LOCAL_DATE_TIME.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second = "0"] = match;
  const numeric = [year, month, day, hour, minute, second].map(Number);
  const [y, m, d, h, min, sec] = numeric;
  if (h > 23 || min > 59 || sec > 59) return false;
  const candidate = new Date(Date.UTC(y, m - 1, d, h, min, sec));
  return (
    candidate.getUTCFullYear() === y &&
    candidate.getUTCMonth() === m - 1 &&
    candidate.getUTCDate() === d &&
    candidate.getUTCHours() === h &&
    candidate.getUTCMinutes() === min &&
    candidate.getUTCSeconds() === sec
  );
}
