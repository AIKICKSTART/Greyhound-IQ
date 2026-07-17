import type { AdminResource } from "@/lib/admin-service";

export const ADMIN_RESOURCE_STATUSES = {
  billingCustomer: ["active", "inactive", "suspended", "archived"],
  billingEvent: ["recorded", "processed", "failed", "ignored"],
  bugReport: [],
  creditNoteRecord: ["issued", "voided", "failed", "ignored"],
  dataSourceHealth: ["ok", "degraded", "error", "unknown"],
  deletionJob: ["pending", "cancelled", "completed", "failed"],
  entitlementSnapshot: ["active", "expired", "replaced", "ignored", "inactive"],
  exportArtifact: ["created", "processing", "completed", "failed", "expired"],
  feedback: ["new", "reviewing", "planned", "closed"],
  invoiceRecord: ["draft", "issued", "paid", "overdue", "voided", "ignored"],
  jobRun: ["pending", "running", "completed", "failed", "cancelled"],
  organizationInvitation: ["pending", "accepted", "cancelled", "expired"],
  paymentRecord: ["pending", "succeeded", "failed", "refunded", "ignored"],
  plan: ["active", "inactive", "archived"],
  planEntitlement: [],
  priceCatalog: ["active", "inactive", "archived"],
  retentionPolicy: [],
  refundRecord: ["pending", "succeeded", "failed", "ignored"],
  subscription: ["active", "past_due", "paused", "canceled", "ended"],
  supportTicket: [],
  usageAggregate: ["open", "closed", "failed", "ignored"],
  usageEvent: ["received", "processed", "failed", "ignored"],
  usageOutbox: ["pending", "sent", "failed", "ignored"],
  webhookEvent: ["received", "processed", "failed", "ignored"],
} as const satisfies Record<AdminResource, readonly string[]>;

const ADMIN_ENABLED_RESOURCES = new Set<AdminResource>([
  "planEntitlement",
  "retentionPolicy",
]);

export function assertAdminResourceMutation(
  resource: AdminResource,
  status: string | undefined,
  enabled: boolean | undefined
) {
  const hasStatus = status !== undefined;
  const hasEnabled = enabled !== undefined;
  if (hasStatus === hasEnabled) throw new Error("admin.invalid_resource_mutation");

  if (status !== undefined) {
    const allowed = ADMIN_RESOURCE_STATUSES[resource] as readonly string[];
    if (!allowed.includes(status)) throw new Error("admin.invalid_status");
  }

  if (enabled !== undefined && !ADMIN_ENABLED_RESOURCES.has(resource)) {
    throw new Error("admin.invalid_enabled_resource");
  }
}
