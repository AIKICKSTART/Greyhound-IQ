import { AUDIT_EVENTS, type AuditEventContract } from "./audit-events";

type AuditEventRequirementBinding = {
  requirementId: string;
  eventIds: readonly string[];
  scope: string;
};

export const AUDIT_EVENT_REQUIREMENT_BINDINGS = [
  {
    requirementId: "security.audit-event.authentication-failure",
    eventIds: ["AUDIT.AUTH.CALLBACK.FAILED"],
    scope:
      "Authentication callback failures are recorded with an allowlisted reason and correlation envelope; provider payloads and credentials are prohibited.",
  },
  {
    requirementId: "security.audit-event.account-deletion",
    eventIds: [
      "AUDIT.ACCOUNT.DELETION.REQUESTED",
      "AUDIT.ACCOUNT.DELETION.FINALIZED",
      "AUDIT.ACCOUNT.DELETION.STORAGE",
    ],
    scope:
      "Account-deletion request, finalisation, and storage-cleanup outcomes have separate redacted audit events.",
  },
  {
    requirementId: "security.audit-event.data-export",
    eventIds: ["AUDIT.ACCOUNT.DATA_EXPORT.DOWNLOADED"],
    scope:
      "Account export generation is recorded before the response with format, size, schema version, and counts; the archive body is prohibited.",
  },
  {
    requirementId: "security.audit-event.privacy-changes",
    eventIds: ["AUDIT.ACCOUNT.PRIVACY.MARKETING_CHANGED"],
    scope:
      "The owner-scoped preference change and its redacted audit record commit in the same request transaction.",
  },
  {
    requirementId: "security.audit-event.role-changes",
    eventIds: ["AUDIT.ADMIN.USER.ACCESS_CHANGED"],
    scope:
      "Administrator role changes record actor, user target, next role and mandatory reason after self/last-admin protection.",
  },
  {
    requirementId: "security.audit-event.account-suspension",
    eventIds: ["AUDIT.ADMIN.USER.ACCESS_CHANGED"],
    scope:
      "Administrator suspension changes record actor, user target, banned state and mandatory reason after self/last-admin protection.",
  },
  {
    requirementId: "security.audit-event.team-invitations",
    eventIds: ["AUDIT.ADMIN.TEAM.INVITATION.CREATED"],
    scope:
      "Organization invitation creation records actor, invitation target, organization, role and reason without plain email/token values.",
  },
  {
    requirementId: "security.audit-event.listing-publication",
    eventIds: ["AUDIT.MARKETPLACE.LISTING.MODERATED"],
    scope:
      "Moderator approval is the listing publication transition and persists three reasoned audit records.",
  },
  {
    requirementId: "security.audit-event.listing-moderation",
    eventIds: ["AUDIT.MARKETPLACE.LISTING.MODERATED"],
    scope:
      "Listing approval, rejection and removal persist actor, listing, action and reason evidence.",
  },
  {
    requirementId: "security.audit-event.verification-decisions",
    eventIds: ["AUDIT.DOG.OWNERSHIP.VERIFICATION_DECIDED"],
    scope:
      "Dog-ownership approval and rejection decisions persist the moderator, claim target and mandatory reason.",
  },
  {
    requirementId: "security.audit-event.payment-changes",
    eventIds: ["AUDIT.BILLING.PAYMENT.CHANGED"],
    scope:
      "Allowlisted administrator payment-record status changes persist actor, target, next status and reason.",
  },
  {
    requirementId: "security.audit-event.entitlement-changes",
    eventIds: ["AUDIT.BILLING.ENTITLEMENT.CHANGED"],
    scope:
      "Plan-entitlement changes persist actor, entitlement target, plan/feature identifiers and reason.",
  },
  {
    requirementId: "security.audit-event.administrative-mutations",
    eventIds: ["AUDIT.ADMIN.PRIVILEGED_MUTATION"],
    scope:
      "The central privileged mutation helper writes AdminAction and AuditLog rows inside each administration transaction.",
  },
  {
    requirementId: "security.audit-event.ai-tool-mutations",
    eventIds: ["AUDIT.AI.TOOL.MUTATION"],
    scope:
      "Agent-run starts and successful dog-card generations persist bounded audit records without prompt, credential or image content.",
  },
  {
    requirementId: "security.audit-event.policy-changes",
    eventIds: ["AUDIT.ADMIN.POLICY.CHANGED"],
    scope:
      "Retention and platform policy changes persist actor, target, action and reason without secret setting values.",
  },
] as const;

const auditEventsById = new Map<string, AuditEventContract>(
  AUDIT_EVENTS.map((event) => [event.eventId, event]),
);

export function auditEventRequirementIsImplemented(
  binding: AuditEventRequirementBinding,
) {
  return binding.eventIds.every((eventId) => {
    const event = auditEventsById.get(eventId);

    return Boolean(
      event &&
        event.persistence !== "missing" &&
        event.owner.trim() &&
        event.sourceFiles.length > 0 &&
        event.sourceSymbols.length > 0 &&
        event.evidence.length > 0 &&
        event.safeFields.length > 0 &&
        event.prohibitedFields.length > 0,
    );
  });
}
