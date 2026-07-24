"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { safeAdminPath } from "@/app/admin/admin-operation-path";
import {
  adminAudCurrencySchema,
  adminBugReportSeveritySchema,
  adminBugReportStatusSchema,
  adminEntitlementInputSchema,
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
} from "@/app/admin/admin-input-contract";
import { assertAdminResourceMutation } from "@/app/admin/admin-status-contract";
import { requireAdminProfile, requireModeratorProfile } from "@/lib/auth";
import { setPlatformFlag, PLATFORM_FLAGS } from "@/lib/platform-settings";
import {
  BESPOKE_STATUSES,
  updateCustomDesignRequest,
} from "@/lib/bespoke-service";
import {
  PRICING_PLAN_IDS,
  setPricingContent,
  type PricingContent,
  type PricingPlan,
} from "@/lib/site-content";
import {
  approveDogOwnership,
  approveTrainerClaim,
  createAdminDeletionJob,
  createAdminExportArtifact,
  createAdminInvitation,
  createAdminPrice,
  createAdminUser,
  updateAdminBugReport,
  updateAdminResourceStatus,
  rejectDogOwnership,
  rejectTrainerClaim,
  updateAdminSupportTicket,
  updateAdminUserAccess,
  upsertAdminEntitlement,
  upsertAdminOrganization,
  upsertAdminPlan,
  upsertAdminRetentionPolicy,
  upsertAdminSourceHealth,
  type AdminResource,
} from "@/lib/admin-service";

const resourceSchema = z.enum([
  "billingCustomer",
  "billingEvent",
  "bugReport",
  "creditNoteRecord",
  "dataSourceHealth",
  "deletionJob",
  "entitlementSnapshot",
  "exportArtifact",
  "feedback",
  "invoiceRecord",
  "jobRun",
  "organizationInvitation",
  "paymentRecord",
  "plan",
  "planEntitlement",
  "priceCatalog",
  "retentionPolicy",
  "refundRecord",
  "subscription",
  "supportTicket",
  "usageAggregate",
  "usageEvent",
  "usageOutbox",
  "webhookEvent",
]);

const reasonSchema = z.string().trim().min(3).max(500);
const statusSchema = z.string().trim().min(1).max(80);
const idSchema = z.string().trim().min(1).max(160);
const nullableIdSchema = z.string().trim().max(160).transform((value) => value || null);
const tierSchema = z.enum(["free", "pro", "pro_plus"]);
const roleSchema = z.enum(["member", "breeder", "trainer", "moderator", "admin"]);

const statusInputSchema = z.object({
  resource: resourceSchema,
  id: idSchema,
  status: statusSchema.optional(),
  enabled: z.boolean().optional(),
  reason: reasonSchema,
  path: z.string().trim().optional(),
});

const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(120).optional(),
  tier: tierSchema.default("free"),
  role: roleSchema.default("member"),
  verified: z.boolean(),
  confirmation: z.literal("CONFIRM USER ACCESS"),
  reason: reasonSchema,
  path: z.string().trim().optional(),
});

const updateUserAccessSchema = z.object({
  userId: idSchema,
  tier: tierSchema,
  role: roleSchema,
  verified: z.boolean(),
  banned: z.boolean(),
  cancelDeletion: z.boolean(),
  confirmation: z.literal("CONFIRM USER ACCESS"),
  reason: reasonSchema,
  path: z.string().trim().optional(),
});

const planSchema = z.object({
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(120),
  status: adminPlanStatusSchema,
  reason: reasonSchema,
  path: z.string().trim().optional(),
});

const priceSchema = z.object({
  planId: idSchema,
  interval: adminPriceIntervalSchema,
  currency: adminAudCurrencySchema,
  amountCents: z.coerce.number().int().min(0).max(10_000_000),
  status: adminPriceStatusSchema,
  reason: reasonSchema,
  path: z.string().trim().optional(),
});

const entitlementSchema = z
  .object({
    planId: idSchema,
    enabled: z.boolean(),
    unit: z.string().trim().max(40).nullable(),
    reason: reasonSchema,
    path: z.string().trim().optional(),
  })
  .and(adminEntitlementInputSchema);

const retentionPolicySchema = z.object({
  code: z.string().trim().min(2).max(80),
  targetType: z.string().trim().min(2).max(80),
  retentionDays: z.coerce.number().int().min(0).max(3650),
  enabled: z.boolean(),
  reason: reasonSchema,
  path: z.string().trim().optional(),
});

const deletionJobSchema = z.object({
  policyId: nullableIdSchema,
  targetType: z.string().trim().min(2).max(80),
  targetUserId: nullableIdSchema,
  storageBucket: z.string().trim().max(120).transform((value) => value || null),
  storagePath: z.string().trim().max(500).transform((value) => value || null),
  scheduledFor: adminRequiredDateSchema,
  reason: reasonSchema,
  path: z.string().trim().optional(),
});

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  workosOrganizationId: z.string().trim().min(2).max(160),
  ownerId: nullableIdSchema,
  reason: reasonSchema,
  path: z.string().trim().optional(),
});

const invitationSchema = z.object({
  organizationId: idSchema,
  email: z.string().trim().toLowerCase().email(),
  role: adminOrganizationInvitationRoleSchema,
  expiresAt: adminRequiredDateSchema,
  reason: reasonSchema,
  path: z.string().trim().optional(),
});

const exportSchema = z.object({
  exportType: z.string().trim().min(2).max(80),
  targetUserId: nullableIdSchema,
  organizationId: nullableIdSchema,
  expiresAt: adminOptionalDateSchema,
  reason: reasonSchema,
  path: z.string().trim().optional(),
});

const sourceHealthSchema = z.object({
  sourceProvider: z.string().trim().min(2).max(120),
  status: adminSourceHealthStatusSchema,
  latencyMs: z.coerce.number().int().min(0).max(600_000).nullable(),
  reason: reasonSchema,
  path: z.string().trim().optional(),
});

const supportTicketSchema = z.object({
  ticketId: idSchema,
  status: adminSupportTicketStatusSchema,
  priority: adminSupportTicketPrioritySchema,
  category: adminSupportTicketCategorySchema,
  replyBody: z.string().trim().max(2000).nullable(),
  reason: reasonSchema,
  path: z.string().trim().optional(),
});

const bugReportSchema = z.object({
  bugReportId: idSchema,
  status: adminBugReportStatusSchema,
  severity: adminBugReportSeveritySchema,
  reason: reasonSchema,
  path: z.string().trim().optional(),
});

const dogOwnershipReviewSchema = z.object({
  ownershipId: idSchema,
  reason: reasonSchema,
  path: z.string().trim().optional(),
});

const trainerClaimReviewSchema = z.object({
  trainerClaimId: idSchema,
  reason: reasonSchema,
  path: z.string().trim().optional(),
});

export async function updateAdminStatus(formData: FormData) {
  const current = await requireAdminProfile();
  const parsed = statusInputSchema.parse({
    resource: field(formData, "resource"),
    id: field(formData, "id"),
    status: optionalField(formData, "status"),
    enabled: optionalBoolean(formData, "enabled"),
    reason: field(formData, "reason"),
    path: optionalField(formData, "path"),
  });
  assertAdminResourceMutation(
    parsed.resource as AdminResource,
    parsed.status,
    parsed.enabled
  );
  await updateAdminResourceStatus(current, {
    resource: parsed.resource as AdminResource,
    id: parsed.id,
    status: parsed.status,
    enabled: parsed.enabled,
    reason: parsed.reason,
  });
  revalidateAdmin(parsed.path);
}

export async function createAdminUserAction(formData: FormData) {
  const current = await requireAdminProfile();
  const parsed = createUserSchema.parse({
    email: field(formData, "email"),
    name: optionalField(formData, "name"),
    tier: optionalField(formData, "tier") ?? "free",
    role: optionalField(formData, "role") ?? "member",
    verified: checkbox(formData, "verified"),
    confirmation: field(formData, "confirmation"),
    reason: field(formData, "reason"),
    path: optionalField(formData, "path"),
  });
  await createAdminUser(current, parsed);
  revalidateAdmin(parsed.path);
}

export async function updateAdminUserAccessAction(formData: FormData) {
  const current = await requireAdminProfile();
  const parsed = updateUserAccessSchema.parse({
    userId: field(formData, "userId"),
    tier: field(formData, "tier"),
    role: field(formData, "role"),
    verified: checkbox(formData, "verified"),
    banned: checkbox(formData, "banned"),
    cancelDeletion: checkbox(formData, "cancelDeletion"),
    confirmation: field(formData, "confirmation"),
    reason: field(formData, "reason"),
    path: optionalField(formData, "path"),
  });
  await updateAdminUserAccess(current, parsed);
  revalidateAdmin(parsed.path);
}

export async function upsertAdminPlanAction(formData: FormData) {
  const current = await requireAdminProfile();
  const parsed = planSchema.parse(raw(formData, ["code", "name", "status", "reason", "path"]));
  await upsertAdminPlan(current, parsed);
  revalidateAdmin(parsed.path);
}

export async function createAdminPriceAction(formData: FormData) {
  const current = await requireAdminProfile();
  const parsed = priceSchema.parse(raw(formData, ["planId", "interval", "currency", "amountCents", "status", "reason", "path"]));
  await createAdminPrice(current, parsed);
  revalidateAdmin(parsed.path);
}

export async function upsertAdminEntitlementAction(formData: FormData) {
  const current = await requireAdminProfile();
  const parsed = entitlementSchema.parse({
    planId: field(formData, "planId"),
    featureKey: field(formData, "featureKey"),
    enabled: checkbox(formData, "enabled"),
    limitValue: nullableNumberField(formData, "limitValue"),
    unit: optionalField(formData, "unit") ?? null,
    reason: field(formData, "reason"),
    path: optionalField(formData, "path"),
  });
  await upsertAdminEntitlement(current, parsed);
  revalidateAdmin(parsed.path);
}

export async function upsertAdminRetentionPolicyAction(formData: FormData) {
  const current = await requireAdminProfile();
  const parsed = retentionPolicySchema.parse({
    code: field(formData, "code"),
    targetType: field(formData, "targetType"),
    retentionDays: field(formData, "retentionDays"),
    enabled: checkbox(formData, "enabled"),
    reason: field(formData, "reason"),
    path: optionalField(formData, "path"),
  });
  await upsertAdminRetentionPolicy(current, parsed);
  revalidateAdmin(parsed.path);
}

export async function createAdminDeletionJobAction(formData: FormData) {
  const current = await requireAdminProfile();
  const parsed = deletionJobSchema.parse({
    policyId: field(formData, "policyId"),
    targetType: field(formData, "targetType"),
    targetUserId: field(formData, "targetUserId"),
    storageBucket: field(formData, "storageBucket"),
    storagePath: field(formData, "storagePath"),
    scheduledFor: field(formData, "scheduledFor"),
    reason: field(formData, "reason"),
    path: optionalField(formData, "path"),
  });
  await createAdminDeletionJob(current, parsed);
  revalidateAdmin(parsed.path);
}

export async function upsertAdminOrganizationAction(formData: FormData) {
  const current = await requireAdminProfile();
  const parsed = organizationSchema.parse({
    name: field(formData, "name"),
    workosOrganizationId: field(formData, "workosOrganizationId"),
    ownerId: field(formData, "ownerId"),
    reason: field(formData, "reason"),
    path: optionalField(formData, "path"),
  });
  await upsertAdminOrganization(current, parsed);
  revalidateAdmin(parsed.path);
}

export async function createAdminInvitationAction(formData: FormData) {
  const current = await requireAdminProfile();
  const parsed = invitationSchema.parse({
    organizationId: field(formData, "organizationId"),
    email: field(formData, "email"),
    role: field(formData, "role"),
    expiresAt: field(formData, "expiresAt"),
    reason: field(formData, "reason"),
    path: optionalField(formData, "path"),
  });
  await createAdminInvitation(current, parsed);
  revalidateAdmin(parsed.path);
}

export async function createAdminExportAction(formData: FormData) {
  const current = await requireAdminProfile();
  const parsed = exportSchema.parse({
    exportType: field(formData, "exportType"),
    targetUserId: field(formData, "targetUserId"),
    organizationId: field(formData, "organizationId"),
    expiresAt: optionalDateField(formData, "expiresAt"),
    reason: field(formData, "reason"),
    path: optionalField(formData, "path"),
  });
  await createAdminExportArtifact(current, parsed);
  revalidateAdmin(parsed.path);
}

export async function upsertAdminSourceHealthAction(formData: FormData) {
  const current = await requireAdminProfile();
  const parsed = sourceHealthSchema.parse({
    sourceProvider: field(formData, "sourceProvider"),
    status: field(formData, "status"),
    latencyMs: nullableNumberField(formData, "latencyMs"),
    reason: field(formData, "reason"),
    path: optionalField(formData, "path"),
  });
  await upsertAdminSourceHealth(current, parsed);
  revalidateAdmin(parsed.path);
}

export async function updateAdminSupportTicketAction(formData: FormData) {
  const current = await requireAdminProfile();
  const parsed = supportTicketSchema.parse({
    ticketId: field(formData, "ticketId"),
    status: field(formData, "status"),
    priority: field(formData, "priority"),
    category: field(formData, "category"),
    replyBody: optionalField(formData, "replyBody") ?? null,
    reason: field(formData, "reason"),
    path: optionalField(formData, "path"),
  });
  await updateAdminSupportTicket(current, parsed);
  revalidateAdmin(parsed.path);
}

export async function updateAdminBugReportAction(formData: FormData) {
  const current = await requireAdminProfile();
  const parsed = bugReportSchema.parse({
    bugReportId: field(formData, "bugReportId"),
    status: field(formData, "status"),
    severity: field(formData, "severity"),
    reason: field(formData, "reason"),
    path: optionalField(formData, "path"),
  });
  await updateAdminBugReport(current, parsed);
  revalidateAdmin(parsed.path);
}

export async function approveDogOwnershipAction(formData: FormData) {
  const current = await requireModeratorProfile();
  const parsed = dogOwnershipReviewSchema.parse({
    ownershipId: field(formData, "ownershipId"),
    reason: field(formData, "reason"),
    path: optionalField(formData, "path"),
  });
  await approveDogOwnership(current, parsed);
  revalidateAdmin(parsed.path);
}

export async function rejectDogOwnershipAction(formData: FormData) {
  const current = await requireModeratorProfile();
  const parsed = dogOwnershipReviewSchema.parse({
    ownershipId: field(formData, "ownershipId"),
    reason: field(formData, "reason"),
    path: optionalField(formData, "path"),
  });
  await rejectDogOwnership(current, parsed);
  revalidateAdmin(parsed.path);
}

export async function approveTrainerClaimAction(formData: FormData) {
  const current = await requireModeratorProfile();
  const parsed = trainerClaimReviewSchema.parse({
    trainerClaimId: field(formData, "trainerClaimId"),
    reason: field(formData, "reason"),
    path: optionalField(formData, "path"),
  });
  await approveTrainerClaim(current, parsed);
  revalidateAdmin(parsed.path);
}

export async function rejectTrainerClaimAction(formData: FormData) {
  const current = await requireModeratorProfile();
  const parsed = trainerClaimReviewSchema.parse({
    trainerClaimId: field(formData, "trainerClaimId"),
    reason: field(formData, "reason"),
    path: optionalField(formData, "path"),
  });
  await rejectTrainerClaim(current, parsed);
  revalidateAdmin(parsed.path);
}

function raw(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, optionalField(formData, key)]));
}

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function optionalField(formData: FormData, name: string) {
  const value = field(formData, name).trim();
  return value || undefined;
}

function nullableNumberField(formData: FormData, name: string) {
  const value = optionalField(formData, name);
  return value === undefined ? null : value;
}

function optionalDateField(formData: FormData, name: string) {
  const value = optionalField(formData, name);
  return value === undefined ? null : value;
}

function checkbox(formData: FormData, name: string) {
  const value = formData.get(name);
  return value === "on" || value === "true" || value === "1";
}

function optionalBoolean(formData: FormData, name: string) {
  if (!formData.has(name)) return undefined;
  return checkbox(formData, name);
}

function revalidateAdmin(path?: string) {
  const target = safeAdminPath(path);
  revalidatePath(target);
  if (target !== "/admin") revalidatePath("/admin");
  redirect(`${target}?adminResult=success`);
}

export async function updatePageRulesAction(formData: FormData) {
  const current = await requireAdminProfile();
  await setPlatformFlag(current, PLATFORM_FLAGS.requirePro, checkbox(formData, "requirePro"));
  await setPlatformFlag(
    current,
    PLATFORM_FLAGS.requireApprovedOwnership,
    checkbox(formData, "requireApprovedOwnership")
  );
  await setPlatformFlag(
    current,
    PLATFORM_FLAGS.requireRegisteredDog,
    checkbox(formData, "requireRegisteredDog")
  );
  await setPlatformFlag(
    current,
    PLATFORM_FLAGS.enforceDogPageLimit,
    checkbox(formData, "enforceDogPageLimit")
  );
  await setPlatformFlag(
    current,
    PLATFORM_FLAGS.cardGenerationEnabled,
    checkbox(formData, "cardGenerationEnabled")
  );
  revalidateAdmin("/admin/page-rules");
}

export async function updateBespokeRequestAction(formData: FormData) {
  const current = await requireModeratorProfile();
  const parsed = z
    .object({
      id: z.string().min(1),
      status: z.enum(BESPOKE_STATUSES),
      notes: z.string().max(2000).optional(),
    })
    .parse({
      id: field(formData, "id"),
      status: field(formData, "status"),
      notes: field(formData, "notes") || undefined,
    });
  await updateCustomDesignRequest(current, parsed.id, parsed.status, parsed.notes ?? null);
  revalidateAdmin("/admin/bespoke");
}

function lines(formData: FormData, name: string): string[] {
  return field(formData, name)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function updatePricingContentAction(formData: FormData) {
  const current = await requireAdminProfile();
  const plans: PricingPlan[] = PRICING_PLAN_IDS.map((id) => ({
    id,
    name: field(formData, `${id}_name`),
    price: field(formData, `${id}_price`),
    period: field(formData, `${id}_period`),
    description: field(formData, `${id}_description`),
    features: lines(formData, `${id}_features`),
    notIncluded: lines(formData, `${id}_notIncluded`),
    cta: field(formData, `${id}_cta`),
    highlighted: checkbox(formData, `${id}_highlighted`),
  }));
  const content: PricingContent = {
    plans,
    yearlyNote: field(formData, "yearlyNote"),
  };
  await setPricingContent(current, content);
  revalidatePath("/pricing");
  revalidateAdmin("/admin/site-content");
}
