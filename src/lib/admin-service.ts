import "server-only";

import type { Prisma } from "@prisma/client";

import type { CurrentUserProfile } from "@/lib/auth-types";
import {
  assertAdminSelfAccessChange,
  assertLastAdminAccessChange,
  lockAdminAccessChanges,
} from "@/lib/admin-access-contract";
import { isAdminRole, isModeratorRole } from "@/lib/auth-roles";
import { withDbRequestContext, type DbContextClient } from "@/lib/db-context";

export type AdminResource =
  | "billingCustomer"
  | "billingEvent"
  | "bugReport"
  | "creditNoteRecord"
  | "dataSourceHealth"
  | "deletionJob"
  | "entitlementSnapshot"
  | "exportArtifact"
  | "feedback"
  | "invoiceRecord"
  | "jobRun"
  | "organizationInvitation"
  | "paymentRecord"
  | "plan"
  | "planEntitlement"
  | "priceCatalog"
  | "retentionPolicy"
  | "refundRecord"
  | "subscription"
  | "supportTicket"
  | "usageAggregate"
  | "usageEvent"
  | "usageOutbox"
  | "webhookEvent";

export type AdminStatusInput = {
  resource: AdminResource;
  id: string;
  status?: string;
  enabled?: boolean;
  reason: string;
};

export type AdminUserAccessInput = {
  userId: string;
  tier: string;
  role: string;
  verified: boolean;
  banned: boolean;
  cancelDeletion: boolean;
  reason: string;
};

export type AdminCreateUserInput = {
  email: string;
  name?: string | null;
  tier: string;
  role: string;
  verified: boolean;
  reason: string;
};

export type AdminPlanInput = {
  code: string;
  name: string;
  status: string;
  reason: string;
};

export type AdminPriceInput = {
  planId: string;
  interval: string;
  currency: string;
  amountCents: number;
  status: string;
  reason: string;
};

export type AdminEntitlementInput = {
  planId: string;
  featureKey: string;
  enabled: boolean;
  limitValue: number | null;
  unit: string | null;
  reason: string;
};

export type AdminRetentionPolicyInput = {
  code: string;
  targetType: string;
  retentionDays: number;
  enabled: boolean;
  reason: string;
};

export type AdminDeletionJobInput = {
  policyId: string | null;
  targetType: string;
  targetUserId: string | null;
  storageBucket: string | null;
  storagePath: string | null;
  scheduledFor: Date;
  reason: string;
};

export type AdminOrganizationInput = {
  name: string;
  workosOrganizationId: string;
  ownerId: string | null;
  reason: string;
};

export type AdminInvitationInput = {
  organizationId: string;
  email: string;
  role: string;
  expiresAt: Date;
  reason: string;
};

export type AdminExportInput = {
  exportType: string;
  targetUserId: string | null;
  organizationId: string | null;
  expiresAt: Date | null;
  reason: string;
};

export type AdminSourceHealthInput = {
  sourceProvider: string;
  status: string;
  latencyMs: number | null;
  reason: string;
};

export type AdminSupportTicketInput = {
  ticketId: string;
  status: string;
  priority: string;
  category: string;
  replyBody: string | null;
  reason: string;
};

export type AdminBugReportInput = {
  bugReportId: string;
  status: string;
  severity: string;
  reason: string;
};

export function assertAdmin(current: CurrentUserProfile) {
  if (!isAdminRole(current.profileRole)) throw new Error("auth.forbidden");
}

export function assertModerator(current: CurrentUserProfile) {
  if (!isModeratorRole(current.profileRole)) throw new Error("auth.forbidden");
}

export function cleanAdminReason(reason: string | null | undefined) {
  const value = reason?.trim() ?? "";
  if (value.length < 3) throw new Error("admin.reason_required");
  return value.slice(0, 500);
}

export async function createAdminUser(
  current: CurrentUserProfile,
  input: AdminCreateUserInput
) {
  assertAdmin(current);
  const reason = cleanAdminReason(input.reason);
  return withDbRequestContext(current, async (tx) => {
    await lockAdminAccessChanges(tx);
    const user = await tx.user.upsert({
      where: { email: input.email },
      update: {
        name: input.name ?? undefined,
        subscriptionTier: input.tier,
      },
      create: {
        email: input.email,
        name: input.name ?? input.email,
        subscriptionTier: input.tier,
      },
      include: { profile: { select: { role: true } } },
    });
    const activeAdminCount = await tx.profile.count({
      where: {
        role: "admin",
        user: { isBanned: false, deletionRequestedAt: null },
      },
    });
    assertAdminSelfAccessChange({
      actingUserId: current.dbUserId,
      targetUserId: user.id,
      nextRole: input.role,
      banned: false,
    });
    assertLastAdminAccessChange({
      targetCurrentRole: user.profile?.role ?? "member",
      targetCurrentlyActive:
        !user.isBanned && user.deletionRequestedAt === null,
      nextRole: input.role,
      nextBanned: false,
      activeAdminCount,
    });
    await tx.profile.upsert({
      where: { userId: user.id },
      update: { role: input.role, verified: input.verified },
      create: {
        userId: user.id,
        displayName: input.name ?? input.email,
        role: input.role,
        verified: input.verified,
      },
    });
    await logAdminMutation(tx, current, {
      action: "admin.user.create_or_update",
      targetType: "user",
      targetId: user.id,
      affectedUserId: user.id,
      reason,
      metadata: { email: input.email, tier: input.tier, role: input.role },
    });
    return user;
  });
}

export async function updateAdminUserAccess(
  current: CurrentUserProfile,
  input: AdminUserAccessInput
) {
  assertAdmin(current);
  const reason = cleanAdminReason(input.reason);
  return withDbRequestContext(current, async (tx) => {
    await lockAdminAccessChanges(tx);
    const [target, activeAdminCount] = await Promise.all([
      tx.user.findUnique({
        where: { id: input.userId },
        select: {
          isBanned: true,
          deletionRequestedAt: true,
          profile: { select: { role: true } },
        },
      }),
      tx.profile.count({
        where: {
          role: "admin",
          user: { isBanned: false, deletionRequestedAt: null },
        },
      }),
    ]);
    if (!target?.profile) throw new Error("admin.user_not_found");

    assertAdminSelfAccessChange({
      actingUserId: current.dbUserId,
      targetUserId: input.userId,
      nextRole: input.role,
      banned: input.banned,
    });
    assertLastAdminAccessChange({
      targetCurrentRole: target.profile.role,
      targetCurrentlyActive:
        !target.isBanned && target.deletionRequestedAt === null,
      nextRole: input.role,
      nextBanned: input.banned,
      activeAdminCount,
    });
    const user = await tx.user.update({
      where: { id: input.userId },
      data: {
        subscriptionTier: input.tier,
        isBanned: input.banned,
        deletionRequestedAt: input.cancelDeletion ? null : undefined,
      },
    });
    await tx.profile.update({
      where: { userId: user.id },
      data: { role: input.role, verified: input.verified },
    });
    await logAdminMutation(tx, current, {
      action: "admin.user.access_update",
      targetType: "user",
      targetId: user.id,
      affectedUserId: user.id,
      reason,
      metadata: {
        tier: input.tier,
        role: input.role,
        verified: input.verified,
        banned: input.banned,
        cancelDeletion: input.cancelDeletion,
      },
    });
    return user;
  });
}

export async function updateAdminResourceStatus(
  current: CurrentUserProfile,
  input: AdminStatusInput
) {
  assertAdmin(current);
  const reason = cleanAdminReason(input.reason);
  return withDbRequestContext(current, async (tx) => {
    const result = await updateAllowedResource(tx, input);
    await logAdminMutation(tx, current, {
      action: `admin.${input.resource}.update`,
      targetType: input.resource,
      targetId: input.id,
      affectedUserId: result.affectedUserId,
      reason,
      metadata: { status: input.status, enabled: input.enabled },
    });
    return result.record;
  });
}

export async function upsertAdminPlan(
  current: CurrentUserProfile,
  input: AdminPlanInput
) {
  assertAdmin(current);
  const reason = cleanAdminReason(input.reason);
  return withDbRequestContext(current, async (tx) => {
    const plan = await tx.plan.upsert({
      where: { code: input.code },
      update: { name: input.name, status: input.status },
      create: { code: input.code, name: input.name, status: input.status },
    });
    await logAdminMutation(tx, current, {
      action: "admin.plan.upsert",
      targetType: "plan",
      targetId: plan.id,
      reason,
      metadata: { code: input.code, status: input.status },
    });
    return plan;
  });
}

export async function createAdminPrice(
  current: CurrentUserProfile,
  input: AdminPriceInput
) {
  assertAdmin(current);
  const reason = cleanAdminReason(input.reason);
  return withDbRequestContext(current, async (tx) => {
    const price = await tx.priceCatalog.create({
      data: {
        planId: input.planId,
        interval: input.interval,
        currency: input.currency,
        amountCents: input.amountCents,
        status: input.status,
      },
    });
    await logAdminMutation(tx, current, {
      action: "admin.price.create",
      targetType: "priceCatalog",
      targetId: price.id,
      reason,
      metadata: { planId: input.planId, interval: input.interval },
    });
    return price;
  });
}

export async function upsertAdminEntitlement(
  current: CurrentUserProfile,
  input: AdminEntitlementInput
) {
  assertAdmin(current);
  const reason = cleanAdminReason(input.reason);
  return withDbRequestContext(current, async (tx) => {
    const entitlement = await tx.planEntitlement.upsert({
      where: {
        planId_featureKey: {
          planId: input.planId,
          featureKey: input.featureKey,
        },
      },
      update: {
        enabled: input.enabled,
        limitValue: input.limitValue,
        unit: input.unit,
      },
      create: {
        planId: input.planId,
        featureKey: input.featureKey,
        enabled: input.enabled,
        limitValue: input.limitValue,
        unit: input.unit,
      },
    });
    await logAdminMutation(tx, current, {
      action: "admin.entitlement.upsert",
      targetType: "planEntitlement",
      targetId: entitlement.id,
      reason,
      metadata: { planId: input.planId, featureKey: input.featureKey },
    });
    return entitlement;
  });
}

export async function upsertAdminRetentionPolicy(
  current: CurrentUserProfile,
  input: AdminRetentionPolicyInput
) {
  assertAdmin(current);
  const reason = cleanAdminReason(input.reason);
  return withDbRequestContext(current, async (tx) => {
    const policy = await tx.retentionPolicy.upsert({
      where: { code: input.code },
      update: {
        targetType: input.targetType,
        retentionDays: input.retentionDays,
        enabled: input.enabled,
      },
      create: {
        code: input.code,
        targetType: input.targetType,
        retentionDays: input.retentionDays,
        enabled: input.enabled,
        createdByUserId: current.dbUserId,
      },
    });
    await logAdminMutation(tx, current, {
      action: "admin.retention_policy.upsert",
      targetType: "retentionPolicy",
      targetId: policy.id,
      reason,
      metadata: { code: input.code, targetType: input.targetType },
    });
    return policy;
  });
}

export async function createAdminDeletionJob(
  current: CurrentUserProfile,
  input: AdminDeletionJobInput
) {
  assertAdmin(current);
  const reason = cleanAdminReason(input.reason);
  return withDbRequestContext(current, async (tx) => {
    const job = await tx.deletionJob.create({
      data: {
        policyId: input.policyId,
        targetType: input.targetType,
        targetUserId: input.targetUserId,
        storageBucket: input.storageBucket,
        storagePath: input.storagePath,
        scheduledFor: input.scheduledFor,
        requestedByUserId: current.dbUserId,
      },
    });
    await logAdminMutation(tx, current, {
      action: "admin.deletion_job.create",
      targetType: "deletionJob",
      targetId: job.id,
      affectedUserId: input.targetUserId,
      reason,
      metadata: { targetType: input.targetType, scheduledFor: input.scheduledFor.toISOString() },
    });
    return job;
  });
}

export async function upsertAdminOrganization(
  current: CurrentUserProfile,
  input: AdminOrganizationInput
) {
  assertAdmin(current);
  const reason = cleanAdminReason(input.reason);
  return withDbRequestContext(current, async (tx) => {
    const organization = await tx.organization.upsert({
      where: { workosOrganizationId: input.workosOrganizationId },
      update: { name: input.name, ownerId: input.ownerId },
      create: {
        name: input.name,
        workosOrganizationId: input.workosOrganizationId,
        ownerId: input.ownerId,
      },
    });
    await logAdminMutation(tx, current, {
      action: "admin.organization.upsert",
      targetType: "organization",
      targetId: organization.id,
      affectedUserId: input.ownerId,
      reason,
      metadata: { workosOrganizationId: input.workosOrganizationId },
    });
    return organization;
  });
}

export async function createAdminInvitation(
  current: CurrentUserProfile,
  input: AdminInvitationInput
) {
  assertAdmin(current);
  const reason = cleanAdminReason(input.reason);
  return withDbRequestContext(current, async (tx) => {
    const invitation = await tx.organizationInvitation.create({
      data: {
        organizationId: input.organizationId,
        invitedByUserId: current.dbUserId,
        emailHash: await sha256(input.email.trim().toLowerCase()),
        tokenHash: crypto.randomUUID(),
        role: input.role,
        expiresAt: input.expiresAt,
      },
    });
    await logAdminMutation(tx, current, {
      action: "admin.invitation.create",
      targetType: "organizationInvitation",
      targetId: invitation.id,
      reason,
      metadata: { organizationId: input.organizationId, role: input.role },
    });
    return invitation;
  });
}

export async function createAdminExportArtifact(
  current: CurrentUserProfile,
  input: AdminExportInput
) {
  assertAdmin(current);
  const reason = cleanAdminReason(input.reason);
  return withDbRequestContext(current, async (tx) => {
    const artifact = await tx.exportArtifact.create({
      data: {
        exportType: input.exportType,
        targetUserId: input.targetUserId,
        organizationId: input.organizationId,
        requestedByUserId: current.dbUserId,
        expiresAt: input.expiresAt,
      },
    });
    await logAdminMutation(tx, current, {
      action: "admin.export.create",
      targetType: "exportArtifact",
      targetId: artifact.id,
      affectedUserId: input.targetUserId,
      reason,
      metadata: { exportType: input.exportType, organizationId: input.organizationId },
    });
    return artifact;
  });
}

export async function upsertAdminSourceHealth(
  current: CurrentUserProfile,
  input: AdminSourceHealthInput
) {
  assertAdmin(current);
  const reason = cleanAdminReason(input.reason);
  const checkedAt = new Date();
  return withDbRequestContext(current, async (tx) => {
    const row = await tx.dataSourceHealth.upsert({
      where: { sourceProvider: input.sourceProvider },
      update: {
        status: input.status,
        latencyMs: input.latencyMs,
        lastCheckedAt: checkedAt,
        lastSuccessAt: input.status === "ok" ? checkedAt : undefined,
        lastFailureAt: input.status === "error" ? checkedAt : undefined,
      },
      create: {
        sourceProvider: input.sourceProvider,
        status: input.status,
        latencyMs: input.latencyMs,
        lastCheckedAt: checkedAt,
        lastSuccessAt: input.status === "ok" ? checkedAt : null,
        lastFailureAt: input.status === "error" ? checkedAt : null,
      },
    });
    await logAdminMutation(tx, current, {
      action: "admin.source_health.upsert",
      targetType: "dataSourceHealth",
      targetId: row.id,
      reason,
      metadata: { sourceProvider: input.sourceProvider, status: input.status },
    });
    return row;
  });
}

export async function updateAdminSupportTicket(
  current: CurrentUserProfile,
  input: AdminSupportTicketInput
) {
  assertAdmin(current);
  const reason = cleanAdminReason(input.reason);
  const replyBody = input.replyBody?.trim() || null;
  return withDbRequestContext(current, async (tx) => {
    const ticket = await tx.supportTicket.update({
      where: { id: input.ticketId },
      data: {
        status: input.status,
        priority: input.priority,
        category: input.category,
      },
    });
    if (replyBody) {
      await tx.supportMessage.create({
        data: {
          ticketId: ticket.id,
          userId: current.dbUserId,
          body: replyBody.slice(0, 2000),
        },
      });
    }
    await logAdminMutation(tx, current, {
      action: "admin.support_ticket.update",
      targetType: "supportTicket",
      targetId: ticket.id,
      affectedUserId: ticket.userId,
      reason,
      metadata: {
        status: input.status,
        priority: input.priority,
        category: input.category,
        replyAdded: Boolean(replyBody),
      },
    });
    return ticket;
  });
}

export async function updateAdminBugReport(
  current: CurrentUserProfile,
  input: AdminBugReportInput
) {
  assertAdmin(current);
  const reason = cleanAdminReason(input.reason);
  return withDbRequestContext(current, async (tx) => {
    const report = await tx.bugReport.update({
      where: { id: input.bugReportId },
      data: {
        status: input.status,
        severity: input.severity,
      },
    });
    await logAdminMutation(tx, current, {
      action: "admin.bug_report.update",
      targetType: "bugReport",
      targetId: report.id,
      affectedUserId: report.userId,
      reason,
      metadata: { status: input.status, severity: input.severity },
    });
    return report;
  });
}

export type AdminDogOwnershipReviewInput = {
  ownershipId: string;
  reason: string;
};

export async function approveDogOwnership(
  current: CurrentUserProfile,
  input: AdminDogOwnershipReviewInput
) {
  assertModerator(current);
  const reason = cleanAdminReason(input.reason);
  return withDbRequestContext(current, async (tx) => {
    // updateMany avoids a RETURNING SELECT, so the review write does not depend
    // on the row being visible under the SELECT policy.
    const updated = await tx.dogOwnership.updateMany({
      where: { id: input.ownershipId, status: "pending" },
      data: {
        status: "approved",
        verified: true,
        reviewedByProfileId: current.profileId,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
    });
    if (updated.count === 0) throw new Error("dog.ownership.not_pending");

    await logAdminMutation(tx, current, {
      action: "dog.ownership.approve",
      targetType: "dogOwnership",
      targetId: input.ownershipId,
      reason,
    });
    return { ownershipId: input.ownershipId };
  });
}

export async function rejectDogOwnership(
  current: CurrentUserProfile,
  input: AdminDogOwnershipReviewInput
) {
  assertModerator(current);
  const reason = cleanAdminReason(input.reason);
  return withDbRequestContext(current, async (tx) => {
    const updated = await tx.dogOwnership.updateMany({
      where: { id: input.ownershipId, status: "pending" },
      data: {
        status: "rejected",
        verified: false,
        reviewedByProfileId: current.profileId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
    });
    if (updated.count === 0) throw new Error("dog.ownership.not_pending");

    await logAdminMutation(tx, current, {
      action: "dog.ownership.reject",
      targetType: "dogOwnership",
      targetId: input.ownershipId,
      reason,
    });
    return { ownershipId: input.ownershipId };
  });
}

async function updateAllowedResource(
  tx: DbContextClient,
  input: AdminStatusInput
): Promise<{ record: unknown; affectedUserId?: string | null }> {
  const status = input.status;
  switch (input.resource) {
    case "billingCustomer": {
      if (!status) throw new Error("admin.status_required");
      const record = await tx.billingCustomer.update({
        where: { id: input.id },
        data: { status },
      });
      return { record, affectedUserId: record.userId };
    }
    case "billingEvent": {
      if (!status) throw new Error("admin.status_required");
      const record = await tx.billingEvent.update({
        where: { id: input.id },
        data: { status },
      });
      return { record, affectedUserId: record.userId };
    }
    case "bugReport": {
      if (!status) throw new Error("admin.status_required");
      const record = await tx.bugReport.update({
        where: { id: input.id },
        data: { status },
      });
      return { record, affectedUserId: record.userId };
    }
    case "creditNoteRecord": {
      if (!status) throw new Error("admin.status_required");
      const record = await tx.creditNoteRecord.update({
        where: { id: input.id },
        data: { status },
      });
      return { record, affectedUserId: record.userId };
    }
    case "dataSourceHealth": {
      if (!status) throw new Error("admin.status_required");
      return {
        record: await tx.dataSourceHealth.update({
          where: { id: input.id },
          data: {
            status,
            lastCheckedAt: new Date(),
            lastSuccessAt: status === "ok" ? new Date() : undefined,
            lastFailureAt: status === "error" ? new Date() : undefined,
          },
        }),
      };
    }
    case "deletionJob": {
      if (!status) throw new Error("admin.status_required");
      const record = await tx.deletionJob.update({
        where: { id: input.id },
        data: {
          status,
          completedAt: status === "completed" ? new Date() : undefined,
        },
      });
      return { record, affectedUserId: record.targetUserId };
    }
    case "entitlementSnapshot": {
      if (!status) throw new Error("admin.status_required");
      const record = await tx.entitlementSnapshot.update({
        where: { id: input.id },
        data: { status },
      });
      return { record, affectedUserId: record.userId };
    }
    case "exportArtifact": {
      if (!status) throw new Error("admin.status_required");
      const record = await tx.exportArtifact.update({
        where: { id: input.id },
        data: {
          status,
          completedAt: status === "completed" ? new Date() : undefined,
        },
      });
      return { record, affectedUserId: record.targetUserId };
    }
    case "feedback": {
      if (!status) throw new Error("admin.status_required");
      const record = await tx.feedback.update({
        where: { id: input.id },
        data: { status },
      });
      return { record, affectedUserId: record.userId };
    }
    case "refundRecord": {
      if (!status) throw new Error("admin.status_required");
      const record = await tx.refundRecord.update({
        where: { id: input.id },
        data: { status },
      });
      return { record, affectedUserId: record.userId };
    }
    case "invoiceRecord": {
      if (!status) throw new Error("admin.status_required");
      const record = await tx.invoiceRecord.update({
        where: { id: input.id },
        data: {
          status,
          voidedAt: status === "voided" ? new Date() : undefined,
        },
      });
      return { record, affectedUserId: record.userId };
    }
    case "jobRun": {
      if (!status) throw new Error("admin.status_required");
      return {
        record: await tx.jobRun.update({
          where: { id: input.id },
          data: {
            status,
            startedAt: status === "running" ? new Date() : undefined,
            completedAt: ["completed", "failed", "cancelled"].includes(status)
              ? new Date()
              : undefined,
          },
        }),
      };
    }
    case "organizationInvitation": {
      if (!status) throw new Error("admin.status_required");
      return {
        record: await tx.organizationInvitation.update({
          where: { id: input.id },
          data: {
            status,
            acceptedAt: status === "accepted" ? new Date() : undefined,
          },
        }),
      };
    }
    case "paymentRecord": {
      if (!status) throw new Error("admin.status_required");
      const record = await tx.paymentRecord.update({
        where: { id: input.id },
        data: { status },
      });
      return { record, affectedUserId: record.userId };
    }
    case "plan": {
      if (!status) throw new Error("admin.status_required");
      return {
        record: await tx.plan.update({ where: { id: input.id }, data: { status } }),
      };
    }
    case "planEntitlement": {
      if (input.enabled === undefined) throw new Error("admin.enabled_required");
      return {
        record: await tx.planEntitlement.update({
          where: { id: input.id },
          data: { enabled: input.enabled },
        }),
      };
    }
    case "priceCatalog": {
      if (!status) throw new Error("admin.status_required");
      return {
        record: await tx.priceCatalog.update({
          where: { id: input.id },
          data: { status },
        }),
      };
    }
    case "retentionPolicy": {
      if (input.enabled === undefined) throw new Error("admin.enabled_required");
      return {
        record: await tx.retentionPolicy.update({
          where: { id: input.id },
          data: { enabled: input.enabled },
        }),
      };
    }
    case "subscription": {
      if (!status) throw new Error("admin.status_required");
      const record = await tx.subscription.update({
        where: { id: input.id },
        data: {
          status,
          canceledAt: status === "canceled" ? new Date() : undefined,
          endedAt: status === "ended" ? new Date() : undefined,
        },
      });
      return { record, affectedUserId: record.userId };
    }
    case "supportTicket": {
      if (!status) throw new Error("admin.status_required");
      const record = await tx.supportTicket.update({
        where: { id: input.id },
        data: { status },
      });
      return { record, affectedUserId: record.userId };
    }
    case "usageAggregate": {
      if (!status) throw new Error("admin.status_required");
      const record = await tx.usageAggregate.update({
        where: { id: input.id },
        data: { status },
      });
      return { record, affectedUserId: record.userId };
    }
    case "usageEvent": {
      if (!status) throw new Error("admin.status_required");
      const record = await tx.usageEvent.update({
        where: { id: input.id },
        data: {
          status,
          nextRetryAt: status === "received" ? new Date() : undefined,
          failedAt: status === "failed" ? new Date() : undefined,
          processedAt: status === "processed" ? new Date() : undefined,
        },
      });
      return { record, affectedUserId: record.userId };
    }
    case "usageOutbox": {
      if (!status) throw new Error("admin.status_required");
      const record = await tx.usageOutbox.update({
        where: { id: input.id },
        data: {
          status,
          nextRetryAt: status === "pending" ? new Date() : undefined,
          failedAt: status === "failed" ? new Date() : undefined,
          sentAt: status === "sent" ? new Date() : undefined,
        },
      });
      return { record, affectedUserId: record.userId };
    }
    case "webhookEvent": {
      if (!status) throw new Error("admin.status_required");
      return {
        record: await tx.webhookEvent.update({
          where: { id: input.id },
          data: {
            status,
            processedAt: ["processed", "ignored"].includes(status)
              ? new Date()
              : undefined,
          },
        }),
      };
    }
  }
}

async function logAdminMutation(
  tx: DbContextClient,
  current: CurrentUserProfile,
  input: {
    action: string;
    targetType: string;
    targetId: string;
    reason: string;
    affectedUserId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }
) {
  await tx.adminAction.create({
    data: {
      adminId: current.dbUserId,
      affectedUserId: input.affectedUserId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
    },
  });
  await tx.auditLog.create({
    data: {
      actorId: current.dbUserId,
      actorType: "admin",
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

async function sha256(value: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
