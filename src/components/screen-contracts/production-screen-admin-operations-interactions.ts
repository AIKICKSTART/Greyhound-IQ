import type { FamilyScreenManifest } from "./types";

export const PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-ADMIN-OPERATIONS-INTERACTIONS",
  path: "src/components/screen-contracts/production-screen-admin-operations-interactions.test.ts",
} as const;

const TEST_IDS = [
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_EVIDENCE_TEST.id,
] as const;

type InteractionContract = {
  queryParameters: readonly string[];
  actions: FamilyScreenManifest["actions"];
  forms: FamilyScreenManifest["forms"];
};

type InteractionAction = FamilyScreenManifest["actions"][number];
type InteractionForm = FamilyScreenManifest["forms"][number];

function action(
  id: string,
  result: string,
  enforcement: string,
): InteractionAction {
  return { id, result, enforcement, testIds: TEST_IDS };
}

function form(id: string, submitsTo: string, schema: string): InteractionForm {
  return { id, submitsTo, schema, testIds: TEST_IDS };
}

function statusInteraction({
  prefix,
  subject,
  resource,
  statuses,
  role = "administrator",
}: {
  prefix: string;
  subject: string;
  resource: string;
  statuses: string;
  role?: "administrator" | "moderator";
}): InteractionContract {
  return {
    queryParameters: [],
    actions: [
      action(
        `${prefix}.ACTION.STATUS.UPDATE`,
        `Updates the loaded ${subject} to an allowlisted operational status.`,
        `updateAdminStatus requires the ${role} boundary owned by the page and action, parses the resource, identifier, status and audit reason, validates ${resource} against ADMIN_RESOURCE_STATUSES, writes through the request context, records the audit event and revalidates the fixed admin path.`,
      ),
    ],
    forms: [
      form(
        `${prefix}.FORM.STATUS`,
        "SERVER ACTION updateAdminStatus",
        `resource:${resource},id:loaded-record-id,status:${statuses},reason:string(min3,max500),path:fixed-admin-route`,
      ),
    ],
  };
}

export const PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_ROUTES = [
  "/admin/account-deletion",
  "/admin/billing",
  "/admin/billing-events",
  "/admin/bug-reports",
  "/admin/dog-ownership",
  "/admin/entitlements",
  "/admin/exports",
  "/admin/feedback",
  "/admin/invitations",
  "/admin/invoices",
  "/admin/jobs",
  "/admin/organizations",
  "/admin/payments",
  "/admin/plans",
  "/admin/retention",
  "/admin/source-health",
  "/admin/subscriptions",
  "/admin/support",
  "/admin/usage",
  "/admin/users",
  "/admin/webhooks",
] as const;

export type AdminOperationsInteractionRoute =
  (typeof PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_ROUTES)[number];

export const PRODUCTION_SCREEN_ADMIN_OPERATIONS_SEMANTIC_FORM_COUNTS = {
  "/admin/account-deletion": 1,
  "/admin/billing": 1,
  "/admin/billing-events": 1,
  "/admin/bug-reports": 1,
  "/admin/dog-ownership": 1,
  "/admin/entitlements": 1,
  "/admin/exports": 2,
  "/admin/feedback": 1,
  "/admin/invitations": 1,
  "/admin/invoices": 1,
  "/admin/jobs": 1,
  "/admin/organizations": 2,
  "/admin/payments": 3,
  "/admin/plans": 6,
  "/admin/retention": 4,
  "/admin/source-health": 2,
  "/admin/subscriptions": 1,
  "/admin/support": 1,
  "/admin/usage": 3,
  "/admin/users": 4,
  "/admin/webhooks": 1,
} as const satisfies Record<AdminOperationsInteractionRoute, number>;

export const PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_CONTRACTS = {
  "/admin/account-deletion": statusInteraction({
    prefix: "ADMIN-ACCOUNT-DELETION",
    subject: "deletion job",
    resource: "deletionJob",
    statuses: "pending|cancelled|completed|failed",
  }),
  "/admin/billing": statusInteraction({
    prefix: "ADMIN-BILLING",
    subject: "billing customer",
    resource: "billingCustomer",
    statuses: "active|inactive|suspended|archived",
  }),
  "/admin/billing-events": statusInteraction({
    prefix: "ADMIN-BILLING-EVENTS",
    subject: "billing event",
    resource: "billingEvent",
    statuses: "recorded|processed|failed|ignored",
  }),
  "/admin/bug-reports": {
    queryParameters: [],
    actions: [
      action(
        "ADMIN-BUG-REPORTS.ACTION.UPDATE",
        "Updates the status and severity of a loaded bug report.",
        "The moderator-readable page renders this form only for administrators; updateAdminBugReportAction independently requires the admin profile, parses allowlisted status and severity values plus the audit reason, writes through the request context and revalidates the fixed route.",
      ),
    ],
    forms: [
      form(
        "ADMIN-BUG-REPORTS.FORM.UPDATE",
        "SERVER ACTION updateAdminBugReportAction",
        "bugReportId:loaded-report-id,status:open|triaged|in_progress|resolved|closed,severity:low|normal|high|critical,reason:string(min3,max500),path:fixed-admin-route",
      ),
    ],
  },
  "/admin/dog-ownership": {
    queryParameters: [],
    actions: [
      action(
        "ADMIN-DOG-OWNERSHIP.ACTION.APPROVE",
        "Approves the loaded pending dog-ownership claim.",
        "approveDogOwnershipAction requires the moderator profile, parses the server-bound ownership identifier and audit reason, and the service applies request-context policy and audit logging.",
      ),
      action(
        "ADMIN-DOG-OWNERSHIP.ACTION.REJECT",
        "Rejects the loaded pending dog-ownership claim with an audited reason.",
        "rejectDogOwnershipAction requires the moderator profile, parses the server-bound ownership identifier and bounded reason, and the service applies request-context policy and audit logging.",
      ),
    ],
    forms: [
      form(
        "ADMIN-DOG-OWNERSHIP.FORM.REVIEW",
        "SERVER ACTION approveDogOwnershipAction | rejectDogOwnershipAction",
        "ownershipId:loaded-pending-claim-id,reason:string(min3,max500),path:fixed-admin-route,decision:approve|reject",
      ),
    ],
  },
  "/admin/entitlements": statusInteraction({
    prefix: "ADMIN-ENTITLEMENTS",
    subject: "entitlement snapshot",
    resource: "entitlementSnapshot",
    statuses: "active|expired|replaced|ignored|inactive",
  }),
  "/admin/exports": {
    queryParameters: [],
    actions: [
      action(
        "ADMIN-EXPORTS.ACTION.CREATE",
        "Creates an audited export-artifact record for a bounded user or organization target.",
        "createAdminExportAction requires the admin profile, parses bounded export metadata and the reason, writes through the request context and revalidates /admin/exports.",
      ),
      action(
        "ADMIN-EXPORTS.ACTION.STATUS.UPDATE",
        "Updates a loaded export artifact to an allowlisted lifecycle status.",
        "updateAdminStatus requires the admin profile and validates exportArtifact status against ADMIN_RESOURCE_STATUSES before the audited request-context update.",
      ),
    ],
    forms: [
      form(
        "ADMIN-EXPORTS.FORM.CREATE",
        "SERVER ACTION createAdminExportAction",
        "exportType:string(min2,max80),targetUserId?:id,organizationId?:id,expiresAt?:date,reason:string(min3,max500),path:fixed-admin-route",
      ),
      form(
        "ADMIN-EXPORTS.FORM.STATUS",
        "SERVER ACTION updateAdminStatus",
        "resource:exportArtifact,id:loaded-artifact-id,status:created|processing|completed|failed|expired,reason:string(min3,max500),path:fixed-admin-route",
      ),
    ],
  },
  "/admin/feedback": statusInteraction({
    prefix: "ADMIN-FEEDBACK",
    subject: "feedback record",
    resource: "feedback",
    statuses: "new|reviewing|planned|closed",
  }),
  "/admin/invitations": statusInteraction({
    prefix: "ADMIN-INVITATIONS",
    subject: "organization invitation",
    resource: "organizationInvitation",
    statuses: "pending|accepted|cancelled|expired",
  }),
  "/admin/invoices": statusInteraction({
    prefix: "ADMIN-INVOICES",
    subject: "invoice record",
    resource: "invoiceRecord",
    statuses: "draft|issued|paid|overdue|voided|ignored",
  }),
  "/admin/jobs": {
    queryParameters: [],
    actions: [
      action(
        "ADMIN-JOBS.ACTION.STATUS.UPDATE",
        "Updates a loaded usage-outbox, usage-event, webhook-event or job-run row to a resource-specific allowlisted status.",
        "The page derives the resource from its loaded operational row and statusesForOperationalRow returns the same resource-specific values enforced by ADMIN_RESOURCE_STATUSES; updateAdminStatus independently requires the admin profile and an audit reason.",
      ),
    ],
    forms: [
      form(
        "ADMIN-JOBS.FORM.STATUS",
        "SERVER ACTION updateAdminStatus",
        "resource:usageOutbox|usageEvent|webhookEvent|jobRun,id:loaded-row-id,status:resource-allowlisted,reason:string(min3,max500),path:fixed-admin-route",
      ),
    ],
  },
  "/admin/organizations": {
    queryParameters: [],
    actions: [
      action(
        "ADMIN-ORGANIZATIONS.ACTION.UPSERT",
        "Creates or updates an organization identity mapping.",
        "upsertAdminOrganizationAction requires the admin profile, parses bounded organization and WorkOS identifiers plus the audit reason, writes through the request context and revalidates the fixed route.",
      ),
      action(
        "ADMIN-ORGANIZATIONS.ACTION.INVITATION.CREATE",
        "Creates an organization invitation for an allowlisted organization role.",
        "createAdminInvitationAction requires the admin profile, parses the loaded organization identifier, normalized email, member-or-admin role, expiry and audit reason, then writes through the request context.",
      ),
    ],
    forms: [
      form(
        "ADMIN-ORGANIZATIONS.FORM.UPSERT",
        "SERVER ACTION upsertAdminOrganizationAction",
        "name:string(min2,max120),workosOrganizationId:string(min2,max160),ownerId?:id,reason:string(min3,max500),path:fixed-admin-route",
      ),
      form(
        "ADMIN-ORGANIZATIONS.FORM.INVITATION.CREATE",
        "SERVER ACTION createAdminInvitationAction",
        "organizationId:id,email:email,role:member|admin,expiresAt:date,reason:string(min3,max500),path:fixed-admin-route",
      ),
    ],
  },
  "/admin/payments": {
    queryParameters: [],
    actions: [
      action(
        "ADMIN-PAYMENTS.ACTION.PAYMENT.STATUS.UPDATE",
        "Updates a loaded payment record to an allowlisted operational status.",
        "updateAdminStatus requires the admin profile, validates paymentRecord against ADMIN_RESOURCE_STATUSES and records the request-context audit event.",
      ),
      action(
        "ADMIN-PAYMENTS.ACTION.REFUND.STATUS.UPDATE",
        "Updates a loaded refund record to an allowlisted operational status.",
        "updateAdminStatus requires the admin profile, validates refundRecord against ADMIN_RESOURCE_STATUSES and records the request-context audit event.",
      ),
      action(
        "ADMIN-PAYMENTS.ACTION.CREDIT-NOTE.STATUS.UPDATE",
        "Updates a loaded credit-note record to an allowlisted operational status.",
        "updateAdminStatus requires the admin profile, validates creditNoteRecord against ADMIN_RESOURCE_STATUSES and records the request-context audit event.",
      ),
    ],
    forms: [
      form(
        "ADMIN-PAYMENTS.FORM.PAYMENT.STATUS",
        "SERVER ACTION updateAdminStatus",
        "resource:paymentRecord,id:loaded-payment-id,status:pending|succeeded|failed|refunded|ignored,reason:string(min3,max500),path:fixed-admin-route",
      ),
      form(
        "ADMIN-PAYMENTS.FORM.REFUND.STATUS",
        "SERVER ACTION updateAdminStatus",
        "resource:refundRecord,id:loaded-refund-id,status:pending|succeeded|failed|ignored,reason:string(min3,max500),path:fixed-admin-route",
      ),
      form(
        "ADMIN-PAYMENTS.FORM.CREDIT-NOTE.STATUS",
        "SERVER ACTION updateAdminStatus",
        "resource:creditNoteRecord,id:loaded-credit-note-id,status:issued|voided|failed|ignored,reason:string(min3,max500),path:fixed-admin-route",
      ),
    ],
  },
  "/admin/plans": {
    queryParameters: [],
    actions: [
      action(
        "ADMIN-PLANS.ACTION.PLAN.UPSERT",
        "Creates or updates a plan with an allowlisted lifecycle status.",
        "upsertAdminPlanAction requires the admin profile, parses bounded plan content and status plus the audit reason, then uses the request-context service and fixed-path revalidation.",
      ),
      action(
        "ADMIN-PLANS.ACTION.PRICE.CREATE",
        "Creates an AUD monthly or yearly price for a loaded plan.",
        "createAdminPriceAction requires the admin profile and parses the plan identifier, interval, AUD currency, bounded integer amount, status and audit reason before the request-context write.",
      ),
      action(
        "ADMIN-PLANS.ACTION.ENTITLEMENT.UPSERT",
        "Creates or updates an allowlisted entitlement for a loaded plan.",
        "upsertAdminEntitlementAction requires the admin profile and combines bounded form parsing with adminEntitlementInputSchema before the request-context write.",
      ),
      action(
        "ADMIN-PLANS.ACTION.PLAN.STATUS.UPDATE",
        "Updates a loaded plan to active, inactive or archived.",
        "updateAdminStatus validates the plan resource and status against ADMIN_RESOURCE_STATUSES before its audited admin-only write.",
      ),
      action(
        "ADMIN-PLANS.ACTION.PRICE.STATUS.UPDATE",
        "Updates a loaded price-catalog record to active, inactive or archived.",
        "updateAdminStatus validates the priceCatalog resource and status against ADMIN_RESOURCE_STATUSES before its audited admin-only write.",
      ),
      action(
        "ADMIN-PLANS.ACTION.ENTITLEMENT.TOGGLE",
        "Enables or disables a loaded plan entitlement.",
        "updateAdminStatus accepts exactly one enabled boolean for planEntitlement, rejects status-plus-enabled ambiguity, requires an audit reason and records the admin-only request-context update.",
      ),
    ],
    forms: [
      form(
        "ADMIN-PLANS.FORM.PLAN.UPSERT",
        "SERVER ACTION upsertAdminPlanAction",
        "code:string(min2,max80),name:string(min2,max120),status:active|inactive|archived,reason:string(min3,max500),path:fixed-admin-route",
      ),
      form(
        "ADMIN-PLANS.FORM.PRICE.CREATE",
        "SERVER ACTION createAdminPriceAction",
        "planId:loaded-plan-id,interval:monthly|yearly,currency:AUD,amountCents:integer(0..10000000),status:active|inactive,reason:string(min3,max500),path:fixed-admin-route",
      ),
      form(
        "ADMIN-PLANS.FORM.ENTITLEMENT.UPSERT",
        "SERVER ACTION upsertAdminEntitlementAction",
        "planId:loaded-plan-id,featureKey:known-entitlement,enabled:boolean,limitValue?:number,unit?:string(max40),reason:string(min3,max500),path:fixed-admin-route",
      ),
      form(
        "ADMIN-PLANS.FORM.PLAN.STATUS",
        "SERVER ACTION updateAdminStatus",
        "resource:plan,id:loaded-plan-id,status:active|inactive|archived,reason:string(min3,max500),path:fixed-admin-route",
      ),
      form(
        "ADMIN-PLANS.FORM.PRICE.STATUS",
        "SERVER ACTION updateAdminStatus",
        "resource:priceCatalog,id:loaded-price-id,status:active|inactive|archived,reason:string(min3,max500),path:fixed-admin-route",
      ),
      form(
        "ADMIN-PLANS.FORM.ENTITLEMENT.TOGGLE",
        "SERVER ACTION updateAdminStatus",
        "resource:planEntitlement,id:loaded-entitlement-id,enabled:boolean,reason:string(min3,max500),path:fixed-admin-route",
      ),
    ],
  },
  "/admin/retention": {
    queryParameters: [],
    actions: [
      action(
        "ADMIN-RETENTION.ACTION.POLICY.UPSERT",
        "Creates or updates a bounded retention policy.",
        "upsertAdminRetentionPolicyAction requires the admin profile, parses bounded target and retention-day values plus the audit reason, and writes through the request context.",
      ),
      action(
        "ADMIN-RETENTION.ACTION.DELETION-JOB.CREATE",
        "Schedules an audited deletion job for a bounded target and optional storage object.",
        "createAdminDeletionJobAction requires the admin profile, parses identifiers, bounded storage metadata, schedule and reason, and writes through the request context.",
      ),
      action(
        "ADMIN-RETENTION.ACTION.POLICY.TOGGLE",
        "Enables or disables a loaded retention policy.",
        "updateAdminStatus accepts only the enabled boolean for retentionPolicy and records the admin-only audited request-context update.",
      ),
      action(
        "ADMIN-RETENTION.ACTION.DELETION-JOB.STATUS.UPDATE",
        "Updates a loaded deletion job to an allowlisted lifecycle status.",
        "updateAdminStatus validates deletionJob against ADMIN_RESOURCE_STATUSES before the admin-only audited request-context update.",
      ),
    ],
    forms: [
      form(
        "ADMIN-RETENTION.FORM.POLICY.UPSERT",
        "SERVER ACTION upsertAdminRetentionPolicyAction",
        "code:string(min2,max80),targetType:string(min2,max80),retentionDays:integer(0..3650),enabled:boolean,reason:string(min3,max500),path:fixed-admin-route",
      ),
      form(
        "ADMIN-RETENTION.FORM.DELETION-JOB.CREATE",
        "SERVER ACTION createAdminDeletionJobAction",
        "policyId?:id,targetType:string(min2,max80),targetUserId?:id,storageBucket?:string(max120),storagePath?:string(max500),scheduledFor:date,reason:string(min3,max500),path:fixed-admin-route",
      ),
      form(
        "ADMIN-RETENTION.FORM.POLICY.TOGGLE",
        "SERVER ACTION updateAdminStatus",
        "resource:retentionPolicy,id:loaded-policy-id,enabled:boolean,reason:string(min3,max500),path:fixed-admin-route",
      ),
      form(
        "ADMIN-RETENTION.FORM.DELETION-JOB.STATUS",
        "SERVER ACTION updateAdminStatus",
        "resource:deletionJob,id:loaded-job-id,status:pending|cancelled|completed|failed,reason:string(min3,max500),path:fixed-admin-route",
      ),
    ],
  },
  "/admin/source-health": {
    queryParameters: [],
    actions: [
      action(
        "ADMIN-SOURCE-HEALTH.ACTION.UPSERT",
        "Creates or updates the health record for a bounded source provider.",
        "upsertAdminSourceHealthAction requires the admin profile and parses provider, allowlisted health status, bounded latency and audit reason before its request-context write.",
      ),
      action(
        "ADMIN-SOURCE-HEALTH.ACTION.STATUS.UPDATE",
        "Updates a loaded source-health record and its health timestamps.",
        "updateAdminStatus validates dataSourceHealth status against ADMIN_RESOURCE_STATUSES before the audited admin-only request-context update.",
      ),
    ],
    forms: [
      form(
        "ADMIN-SOURCE-HEALTH.FORM.UPSERT",
        "SERVER ACTION upsertAdminSourceHealthAction",
        "sourceProvider:string(min2,max120),status:ok|degraded|error|unknown,latencyMs?:integer(0..600000),reason:string(min3,max500),path:fixed-admin-route",
      ),
      form(
        "ADMIN-SOURCE-HEALTH.FORM.STATUS",
        "SERVER ACTION updateAdminStatus",
        "resource:dataSourceHealth,id:loaded-source-id,status:ok|degraded|error|unknown,reason:string(min3,max500),path:fixed-admin-route",
      ),
    ],
  },
  "/admin/subscriptions": statusInteraction({
    prefix: "ADMIN-SUBSCRIPTIONS",
    subject: "subscription",
    resource: "subscription",
    statuses: "active|past_due|paused|canceled|ended",
  }),
  "/admin/support": {
    queryParameters: [],
    actions: [
      action(
        "ADMIN-SUPPORT.ACTION.TICKET.UPDATE",
        "Updates a loaded support ticket and optionally records a bounded reply.",
        "The moderator-readable page renders mutation controls only for administrators; updateAdminSupportTicketAction independently requires the admin profile, parses allowlisted status, priority and category values plus the bounded reply and reason, then writes through the request context.",
      ),
    ],
    forms: [
      form(
        "ADMIN-SUPPORT.FORM.TICKET.UPDATE",
        "SERVER ACTION updateAdminSupportTicketAction",
        "ticketId:loaded-ticket-id,status:open|pending|resolved|closed,priority:low|normal|high|urgent,category:general|billing|technical|feedback,replyBody?:string(max2000),reason:string(min3,max500),path:fixed-admin-route",
      ),
    ],
  },
  "/admin/usage": {
    queryParameters: [],
    actions: [
      action(
        "ADMIN-USAGE.ACTION.AGGREGATE.STATUS.UPDATE",
        "Updates a loaded usage aggregate to an allowlisted status.",
        "updateAdminStatus requires the admin profile and validates usageAggregate against ADMIN_RESOURCE_STATUSES before its audited request-context write.",
      ),
      action(
        "ADMIN-USAGE.ACTION.EVENT.STATUS.UPDATE",
        "Updates a loaded usage event and its processing timestamps.",
        "updateAdminStatus requires the admin profile and validates usageEvent against ADMIN_RESOURCE_STATUSES before its audited request-context write.",
      ),
      action(
        "ADMIN-USAGE.ACTION.OUTBOX.STATUS.UPDATE",
        "Updates a loaded usage-outbox record and its delivery timestamps.",
        "updateAdminStatus requires the admin profile and validates usageOutbox against ADMIN_RESOURCE_STATUSES before its audited request-context write.",
      ),
    ],
    forms: [
      form(
        "ADMIN-USAGE.FORM.AGGREGATE.STATUS",
        "SERVER ACTION updateAdminStatus",
        "resource:usageAggregate,id:loaded-aggregate-id,status:open|closed|failed|ignored,reason:string(min3,max500),path:fixed-admin-route",
      ),
      form(
        "ADMIN-USAGE.FORM.EVENT.STATUS",
        "SERVER ACTION updateAdminStatus",
        "resource:usageEvent,id:loaded-event-id,status:received|processed|failed|ignored,reason:string(min3,max500),path:fixed-admin-route",
      ),
      form(
        "ADMIN-USAGE.FORM.OUTBOX.STATUS",
        "SERVER ACTION updateAdminStatus",
        "resource:usageOutbox,id:loaded-outbox-id,status:pending|sent|failed|ignored,reason:string(min3,max500),path:fixed-admin-route",
      ),
    ],
  },
  "/admin/users": {
    queryParameters: ["lookup", "page", "role", "tier", "user"],
    actions: [
      action(
        "ADMIN-USERS.ACTION.SEARCH",
        "Looks up one exact user by normalized email address or opaque user identifier without placing the submitted value in the URL.",
        "lookupAdminUserAction requires the administrator profile, applies a fail-closed per-admin rate limit, validates the POST field, performs an exact system-context lookup, and redirects using only the canonical opaque user identifier.",
      ),
      action(
        "ADMIN-USERS.ACTION.FILTER",
        "Filters the admin user directory by allowlisted subscription tier and profile role.",
        "The GET form and auto-submit controls use only USER_TIERS and USER_ROLES; parseAdminUsersQuery rejects every unrecognised value.",
      ),
      action(
        "ADMIN-USERS.ACTION.FILTER.CLEAR",
        "Clears the active directory filters.",
        "The fixed same-origin Link targets /admin/users after the page-level admin requirement.",
      ),
      action(
        "ADMIN-USERS.ACTION.DETAIL.OPEN",
        "Opens the loaded user record in the page's focused-detail section.",
        "buildAdminUsersHref constructs a same-origin query from normalized values and the selected identifier must match a user in the loaded page result.",
      ),
      action(
        "ADMIN-USERS.ACTION.DETAIL.CLOSE",
        "Closes the focused user record while preserving the normalized directory query.",
        "buildAdminUsersHref reconstructs the same-origin route without a selected-user identifier.",
      ),
      action(
        "ADMIN-USERS.ACTION.PAGE.NAVIGATE",
        "Moves to the previous or next bounded page of user results.",
        "Previous and next Links render only inside the loaded page bounds and buildAdminUsersHref serializes the normalized page and filters.",
      ),
      action(
        "ADMIN-USERS.ACTION.USER.UPSERT",
        "Creates a local user record or updates its profile access defaults by normalized email.",
        "createAdminUserAction requires the admin profile, parses normalized email, allowlisted tier and role values, verification and audit reason, then writes through the request context.",
      ),
      action(
        "ADMIN-USERS.ACTION.ACCESS.UPDATE",
        "Updates the loaded user's tier, role, verification, ban and deletion-cancellation controls.",
        "updateAdminUserAccessAction requires the admin profile, parses the loaded identifier and allowlisted access values, then the service enforces self-lockout and last-administrator protections inside the request context.",
      ),
    ],
    forms: [
      form(
        "ADMIN-USERS.FORM.SEARCH",
        "SERVER ACTION lookupAdminUserAction",
        "lookup:email(max254)|opaque-user-id(max128)",
      ),
      form(
        "ADMIN-USERS.FORM.FILTER",
        "GET /admin/users",
        "tier?:free|pro|pro_plus,role?:member|breeder|trainer|moderator|admin",
      ),
      form(
        "ADMIN-USERS.FORM.USER.UPSERT",
        "SERVER ACTION createAdminUserAction",
        "email:email,name?:string(max120),tier:free|pro|pro_plus,role:member|breeder|trainer|moderator|admin,verified:boolean,reason:string(min3,max500),path:fixed-admin-route",
      ),
      form(
        "ADMIN-USERS.FORM.ACCESS.UPDATE",
        "SERVER ACTION updateAdminUserAccessAction",
        "userId:loaded-user-id,tier:free|pro|pro_plus,role:member|breeder|trainer|moderator|admin,verified:boolean,banned:boolean,cancelDeletion:boolean,reason:string(min3,max500),path:fixed-admin-route",
      ),
    ],
  },
  "/admin/webhooks": statusInteraction({
    prefix: "ADMIN-WEBHOOKS",
    subject: "webhook event",
    resource: "webhookEvent",
    statuses: "received|processed|failed|ignored",
  }),
} as const satisfies Readonly<
  Record<AdminOperationsInteractionRoute, InteractionContract>
>;
