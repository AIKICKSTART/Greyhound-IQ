import type { ProductMasterRequirementStatus } from "./product-master-requirements";
import {
  SECURITY_MASTER_REQUIREMENTS,
  type SecurityRequirementStatus,
} from "./security-master-requirements";
import { PRODUCT_REQUIRED_OUTPUT_EVIDENCE } from "./product-required-outputs";
import { SECURITY_REQUIRED_OUTPUT_EVIDENCE } from "./security-required-outputs";
import {
  ARCHITECTURE_INVENTORY_EVIDENCE,
  ARCHITECTURE_MASTER_EVIDENCE_REQUIREMENT_IDS,
} from "./design-lab-architecture-inventory";
import { PRODUCT_ROUTE_MASTER_EVIDENCE } from "./product-route-master-evidence";
import { PRODUCT_PUBLIC_ROUTE_OUTCOME_MASTER_EVIDENCE } from "./product-public-route-outcome-evidence";
import { PRODUCT_VERIFICATION_GATE_MASTER_EVIDENCE } from "./product-verification-gate-evidence";
import { PRODUCT_AUTOMATED_SOURCE_GATE_MASTER_EVIDENCE } from "./product-automated-source-gate-evidence";
import { PRODUCT_PLACEHOLDER_PROHIBITION_MASTER_EVIDENCE } from "./product-placeholder-prohibition-evidence";
import { PRODUCT_GLOBAL_SECURITY_INVARIANT_MASTER_EVIDENCE } from "./product-global-security-invariant-evidence";
import { PRODUCT_SYSTEM_STATE_MASTER_EVIDENCE } from "./product-system-state-evidence";
import { PRODUCT_SYSTEM_RECOVERY_MASTER_EVIDENCE } from "./product-system-recovery-evidence";
import { PRODUCT_STORY_CAPABILITY_MASTER_EVIDENCE } from "./product-story-capability-evidence";
import { PRODUCT_STORY_CONTRACT_FIELD_MASTER_EVIDENCE } from "./product-story-contract-field-evidence";
import { PRODUCT_STORY_OPERATIONAL_CONTRACT_MASTER_EVIDENCE } from "./product-story-operational-contract-evidence";
import { PRODUCT_DESIGN_LAB_INSPECTOR_MASTER_EVIDENCE } from "./product-design-lab-inspector-evidence";
import { PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_MASTER_EVIDENCE } from "./product-design-lab-route-selector-evidence";
import { PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_MASTER_EVIDENCE } from "./product-design-lab-scenario-selector-evidence";
import { PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_MASTER_EVIDENCE } from "./product-design-lab-scenario-simulator-evidence";
import { PRODUCT_COMMUNITY_CAPABILITY_MASTER_EVIDENCE } from "./product-community-capability-evidence";
import { PRODUCT_COMMUNITY_PRIVACY_HIDE_MASTER_EVIDENCE } from "./product-community-privacy-hide-evidence";
import { PRODUCT_COMMUNITY_FRIEND_REMOVAL_MASTER_EVIDENCE } from "./product-community-friend-removal-evidence";
import { PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_MASTER_EVIDENCE } from "./product-community-dropped-call-recovery-evidence";
import { PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_MASTER_EVIDENCE } from "./product-action-type-control-catalogue-evidence";
import { PRODUCT_ACTION_INVENTORY_MASTER_EVIDENCE } from "./product-action-inventory-evidence";
import { PRODUCT_ROUTE_REGISTRY_METADATA_MASTER_EVIDENCE } from "./product-route-registry-metadata-evidence";
import { PRODUCT_ROUTE_REFRESH_FIXTURE_MASTER_EVIDENCE } from "./product-route-refresh-fixture-evidence";
import { PRODUCT_RESPONSIVE_WIDTH_MASTER_EVIDENCE } from "./product-responsive-width-evidence";
import { PRODUCT_MESSAGING_ACCESS_STATE_MASTER_EVIDENCE } from "./product-messaging-access-state-evidence";
import { PRODUCT_RACING_STRUCTURE_MASTER_EVIDENCE } from "./product-racing-structure-evidence";
import { PRODUCT_RACING_MEETING_SEARCH_MASTER_EVIDENCE } from "./product-racing-meeting-search-evidence";
import { PRODUCT_RACING_DETAIL_NAVIGATION_MASTER_EVIDENCE } from "./product-racing-detail-navigation-evidence";
import { PRODUCT_RACING_CONTEXT_PRESERVATION_MASTER_EVIDENCE } from "./product-racing-context-preservation-evidence";
import { PRODUCT_RACING_STATUS_DISTINCTION_MASTER_EVIDENCE } from "./product-racing-status-distinction-evidence";
import { PRODUCT_RACING_ZERO_MISSING_MASTER_EVIDENCE } from "./product-racing-zero-missing-evidence";
import { PRODUCT_RACING_PROVENANCE_MASTER_EVIDENCE } from "./product-racing-provenance-evidence";
import { PRODUCT_RACING_MISSING_SNAPSHOT_MASTER_EVIDENCE } from "./product-racing-missing-snapshot-evidence";
import { PRODUCT_RACING_PRESENTATION_SCHEMA_MASTER_EVIDENCE } from "./product-racing-presentation-schema-evidence";
import { PRODUCT_RACING_FINAL_ROUTES_MASTER_EVIDENCE } from "./product-racing-final-routes-evidence";
import { PRODUCT_RACING_FIXTURE_MASTER_EVIDENCE } from "./product-racing-fixture-evidence";
import { PRODUCT_SCREEN_CONTRACT_COMPLETENESS_MASTER_EVIDENCE } from "./product-screen-contract-completeness-evidence";
import { PRODUCT_FORM_CONTRACT_CORE_MASTER_EVIDENCE } from "./product-form-contract-core-evidence";
import { PRODUCT_FORM_OPERATIONAL_CONTRACT_MASTER_EVIDENCE } from "./product-form-operational-contract-evidence";
import { PRODUCT_FIELD_CONTRACT_SOURCE_MASTER_EVIDENCE } from "./product-field-contract-source-evidence";
import { PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_MASTER_EVIDENCE } from "./product-dynamic-route-missing-record-evidence";
import { PRODUCT_ACTION_PURPOSE_MASTER_EVIDENCE } from "./product-action-purpose-evidence";
import { PRODUCT_ACTOR_MAP_MASTER_EVIDENCE } from "./product-actor-map-evidence";
import { PRODUCT_MARKETPLACE_ACCESS_SAFETY_MASTER_EVIDENCE } from "./product-marketplace-access-safety-evidence";
import { PRODUCT_ADMIN_SERVER_AUTHORIZATION_MASTER_EVIDENCE } from "./product-admin-server-authorization-evidence";
import { PRODUCT_ADMIN_SAFE_FAILURE_MASTER_EVIDENCE } from "./product-admin-safe-failure-evidence";
import { PRODUCT_MARKETPLACE_MISSING_PRIVACY_MASTER_EVIDENCE } from "./product-marketplace-missing-privacy-evidence";
import { PRODUCT_ACCOUNT_FORM_VALIDATION_MASTER_EVIDENCE } from "./product-account-form-validation-evidence";
import { PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_MASTER_EVIDENCE } from "./product-account-sensitive-confirmation-evidence";
import { PRODUCT_ACCOUNT_TEAM_MASTER_EVIDENCE } from "./product-account-team-evidence";
import { PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_MASTER_EVIDENCE } from "./product-account-support-ticket-detail-evidence";
import { PRODUCT_MARKETPLACE_SELLER_PROFILE_MASTER_EVIDENCE } from "./product-marketplace-seller-profile-evidence";
import { PRODUCT_MARKETPLACE_SHARE_MASTER_EVIDENCE } from "./product-marketplace-share-evidence";
import { PRODUCT_MARKETPLACE_SORT_PAGINATION_MASTER_EVIDENCE } from "./product-marketplace-sort-pagination-evidence";
import { PRODUCT_MARKETPLACE_MEDIA_ORDERING_MASTER_EVIDENCE } from "./product-marketplace-media-ordering-evidence";
import { PRODUCT_MARKETPLACE_EDIT_MASTER_EVIDENCE } from "./product-marketplace-edit-evidence";
import { PRODUCT_MARKETPLACE_EDIT_ROUTE_MASTER_EVIDENCE } from "./product-marketplace-edit-route-evidence";
import { PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_MASTER_EVIDENCE } from "./product-marketplace-seller-inventory-routes-evidence";
import { PRODUCT_AI_TRUTH_MASTER_EVIDENCE } from "./product-ai-truth-evidence";
import { PRODUCT_AI_ROUTE_INVENTORY_MASTER_EVIDENCE } from "./product-ai-route-inventory-evidence";
import { PRODUCT_AGENT_RUN_LIFECYCLE_MASTER_EVIDENCE } from "./product-agent-run-lifecycle-evidence";
import { PRODUCT_ONBOARDING_CAPABILITY_MASTER_EVIDENCE } from "./product-onboarding-capability-evidence";
import { PRODUCT_DOCUMENTATION_AUTHORITY_MASTER_EVIDENCE } from "./product-documentation-authority-evidence";
import { API_SURFACE_MASTER_EVIDENCE } from "../../security/api-surface-evidence";
import { APPLICATION_SURFACE_MASTER_EVIDENCE } from "../../security/application-surface-evidence";
import { API_TRACE_GOVERNANCE_MASTER_EVIDENCE } from "../../security/api-trace-governance-evidence";
import { DATABASE_QUERY_RECORD_MASTER_EVIDENCE } from "../../security/database-query-record-evidence";
import { ACTUAL_QUERY_CAPTURE_MASTER_EVIDENCE } from "../../security/actual-query-capture-evidence";
import { QUERY_SAFETY_MASTER_EVIDENCE } from "../../security/query-safety-evidence";
import { TOPAZ_RESPONSE_SAFETY_MASTER_EVIDENCE } from "../../security/topaz-response-safety-evidence";
import { ENDPOINT_ERROR_MASTER_EVIDENCE } from "../../security/endpoint-error-evidence";
import { ENDPOINT_VALIDATION_MASTER_EVIDENCE } from "../../security/endpoint-validation-evidence";
import { ENDPOINT_RESOURCE_DATABASE_MASTER_EVIDENCE } from "../../security/endpoint-resource-database-evidence";
import { SENSITIVE_BUSINESS_FLOW_MASTER_EVIDENCE } from "../../security/sensitive-business-flow-evidence";
import { PRIMARY_TRACE_CHAIN_MASTER_EVIDENCE } from "../../security/primary-trace-chain-evidence";
import { SECURITY_FINDING_MASTER_EVIDENCE } from "../../security/security-finding-evidence";
import { FINDING_SEVERITY_MASTER_EVIDENCE } from "../../security/finding-severity-evidence";
import { ACTION_TRACE_DATABASE_MASTER_EVIDENCE } from "../../security/action-trace-database-evidence";
import { ACTION_TRACE_RECORD_MASTER_EVIDENCE } from "../../security/action-trace-record-evidence";
import { SECURITY_STANDARDS_MASTER_EVIDENCE } from "../../security/standards-baseline-evidence";
import { THREAT_MODEL_COVERAGE_MASTER_EVIDENCE } from "../../security/threat-model-coverage-evidence";
import { SECURITY_CI_MASTER_EVIDENCE } from "../../security/ci-gate-evidence";
import { CI_ACCESS_ISOLATION_MASTER_EVIDENCE } from "../../security/ci-access-isolation-evidence";
import { INFRASTRUCTURE_REVIEW_MASTER_EVIDENCE } from "../../security/infrastructure-review-evidence";
import { RISK_ACCEPTANCE_POLICY_MASTER_EVIDENCE } from "../../security/risk-acceptance-policy-evidence";
import { SECURITY_LANGUAGE_POLICY_MASTER_EVIDENCE } from "../../security/security-language-policy-evidence";
import { DELETION_LIFECYCLE_MASTER_EVIDENCE } from "../../security/deletion-lifecycle-evidence";
import { INCIDENT_READINESS_MASTER_EVIDENCE } from "../../security/incident-readiness-evidence";
import { AUTHORIZATION_ACTOR_MASTER_EVIDENCE } from "../../security/authorization-actor-evidence";
import { AUTHENTICATION_PATH_MASTER_EVIDENCE } from "../../security/authentication-path-evidence";
import { SUPPLY_CHAIN_REVIEW_MASTER_EVIDENCE } from "../../security/supply-chain-review-evidence";
import { AUDIT_EVENT_COVERAGE_MASTER_EVIDENCE } from "../../security/audit-event-coverage-evidence";
import { ARCHITECTURE_ADAPTATION_MASTER_EVIDENCE } from "../../security/architecture-adaptation-evidence";
import { DATABASE_INVENTORY_MASTER_EVIDENCE } from "../../security/database-inventory-evidence";
import { SQL_INJECTION_CONTROL_MASTER_EVIDENCE } from "../../security/sql-injection-control-evidence";
import { INJECTION_SURFACE_CONTROL_MASTER_EVIDENCE } from "../../security/injection-surface-control-evidence";
import { COMMAND_INJECTION_CONTROL_MASTER_EVIDENCE } from "../../security/command-injection-control-evidence";
import { DESERIALIZATION_CONTROL_MASTER_EVIDENCE } from "../../security/deserialization-control-evidence";
import { ORM_INJECTION_CONTROL_MASTER_EVIDENCE } from "../../security/orm-injection-control-evidence";
import { HEADER_INJECTION_CONTROL_MASTER_EVIDENCE } from "../../security/header-injection-control-evidence";
import { API_INVENTORY_MANAGEMENT_MASTER_EVIDENCE } from "../../security/api-inventory-management-evidence";
import { DATABASE_COLUMN_RECORD_MASTER_EVIDENCE } from "../../security/database-column-record-evidence";
import { PERSONAL_INFORMATION_RECORD_MASTER_EVIDENCE } from "../../security/personal-information-record-evidence";
import { PRIVACY_MINIMISATION_MASTER_EVIDENCE } from "../../security/privacy-minimisation-evidence";
import { RETENTION_SCHEDULE_MASTER_EVIDENCE } from "../../security/retention-schedule-evidence";
import { AUTHORISED_TESTING_BOUNDARY_MASTER_EVIDENCE } from "../../security/authorised-testing-boundary-evidence";
import { THIRD_PARTY_INVENTORY_MASTER_EVIDENCE } from "../../security/third-party-inventory-evidence";
import { THIRD_PARTY_PROHIBITION_MASTER_EVIDENCE } from "../../security/third-party-prohibition-evidence";
import { SSRF_CONTROL_MASTER_EVIDENCE } from "../../security/ssrf-control-evidence";
import { AI_AUTHORIZATION_MASTER_EVIDENCE } from "../../security/ai-authorization-evidence";
import { PCI_SCOPE_MASTER_EVIDENCE } from "../../security/pci-scope-evidence";
import {
  XSS_IMPLEMENTATION_CONTROL_MASTER_EVIDENCE,
  XSS_SURFACE_REVIEW_MASTER_EVIDENCE,
} from "../../security/xss-surface-evidence";
import { SECRET_INVENTORY_MASTER_EVIDENCE } from "../../security/secret-inventory-evidence";
import { SECRET_CONTROL_MASTER_EVIDENCE } from "../../security/secret-control-evidence";
import { INFRASTRUCTURE_SOURCE_CONTROL_MASTER_EVIDENCE } from "../../security/infrastructure-source-control-evidence";
import { INFRASTRUCTURE_POLICY_CONTROL_MASTER_EVIDENCE } from "../../security/infrastructure-policy-control-evidence";
import { CRYPTOGRAPHY_RECORD_MASTER_EVIDENCE } from "../../security/cryptography-record-evidence";
import { APPLICATION_LOG_ENVELOPE_MASTER_EVIDENCE } from "../../security/application-log-envelope-evidence";
import { APPLICATION_LOG_PROHIBITION_MASTER_EVIDENCE } from "../../security/application-log-prohibition-evidence";
import { ALERT_RECORD_MASTER_EVIDENCE } from "../../security/alert-definition-evidence";
import { SECURITY_ALERT_EVENT_MASTER_EVIDENCE } from "../../security/security-alert-event-evidence";
import { BROWSER_SECURITY_HEADER_MASTER_EVIDENCE } from "../../security/browser-security-header-evidence";
import { AUDIT_INTEGRITY_MASTER_EVIDENCE } from "../../security/audit-integrity-evidence";
import { EXTERNAL_LINK_EMBED_MASTER_EVIDENCE } from "../../security/external-link-embed-evidence";
import { DOWNLOAD_CONTROL_MASTER_EVIDENCE } from "../../security/download-control-evidence";
import { UPLOAD_UNTRUSTED_CLAIM_MASTER_EVIDENCE } from "../../security/upload-untrusted-claim-evidence";
import { CORS_CONTROL_MASTER_EVIDENCE } from "../../security/cors-control-evidence";
import { CSRF_CONTROL_MASTER_EVIDENCE } from "../../security/csrf-control-evidence";
import { HTTP_CONTROL_MASTER_EVIDENCE } from "../../security/http-control-evidence";
import { WEBHOOK_CONTROL_MASTER_EVIDENCE } from "../../security/webhook-control-evidence";
import { BILLING_LIFECYCLE_MASTER_EVIDENCE } from "../../security/billing-lifecycle-evidence";
import { BILLING_INVOICE_OWNERSHIP_MASTER_EVIDENCE } from "../../security/billing-invoice-ownership-evidence";
import { BILLING_SUBSCRIPTION_STATE_MACHINE_MASTER_EVIDENCE } from "../../security/billing-subscription-state-machine-evidence";
import { HEALTH_ENDPOINT_REDACTION_MASTER_EVIDENCE } from "../../security/health-endpoint-redaction-evidence";
import { MODERATOR_API_BOUNDARY_MASTER_EVIDENCE } from "../../security/moderator-api-boundary-evidence";
import { ADMINISTRATION_BOUNDARY_MASTER_EVIDENCE } from "../../security/administration-boundary-evidence";
import { SCHEDULED_TASK_CONTROL_MASTER_EVIDENCE } from "../../security/scheduled-task-control-evidence";
import { QUEUE_WORKER_CONTROL_MASTER_EVIDENCE } from "../../security/queue-worker-control-evidence";
import { COOKIE_CONTROL_MASTER_EVIDENCE } from "../../security/cookie-control-evidence";
import { BROWSER_DATA_HANDLING_MASTER_EVIDENCE } from "../../security/browser-data-handling-evidence";
import { ENDPOINT_INJECTION_OUTPUT_MASTER_EVIDENCE } from "../../security/endpoint-injection-output-evidence";
import { EXTERNAL_INPUT_SURFACE_MASTER_EVIDENCE } from "../../security/external-input-surface-evidence";
import { FRONTEND_AUTHORIZATION_MASTER_EVIDENCE } from "../../security/frontend-authorization-evidence";
import { PROPERTY_AUTHORIZATION_MASTER_EVIDENCE } from "../../security/property-authorization-evidence";
import { LISTING_OBJECT_AUTHORIZATION_MASTER_EVIDENCE } from "../../security/listing-object-authorization-evidence";
import { TRACE_IDENTIFIER_EXAMPLE_MASTER_EVIDENCE } from "../../security/trace-identifier-example-evidence";
import { VOICE_VIDEO_CONTROL_MASTER_EVIDENCE } from "../../security/voice-video-control-evidence";
import { UPLOAD_CONTROL_MASTER_EVIDENCE } from "../../security/upload-control-evidence";
import { UPLOAD_VALIDATION_MASTER_EVIDENCE } from "../../security/upload-validation-evidence";
import { REALTIME_CONTROL_MASTER_EVIDENCE } from "../../security/realtime-control-evidence";
import { MEDIA_BOUNDARY_MASTER_EVIDENCE } from "../../security/media-boundary-evidence";
import { DESIGN_LAB_ISOLATION_MASTER_EVIDENCE } from "../../security/design-lab-isolation-evidence";
import { SUPPLY_CHAIN_ADDITIONAL_MASTER_EVIDENCE } from "../../security/supply-chain-additional-evidence";
import { SECURE_FAILURE_MASTER_EVIDENCE } from "../../security/secure-failure-evidence";
import { ROW_LEVEL_SECURITY_MASTER_EVIDENCE } from "../../security/row-level-security-evidence";
import { DATABASE_ROLE_SEPARATION_MASTER_EVIDENCE } from "../../security/database-role-separation-evidence";
import { GENERIC_SECURITY_PLACEHOLDER_MASTER_EVIDENCE } from "../../security/placeholder-prohibition-evidence";
import { REQUIRED_INPUT_REGISTRY_MASTER_EVIDENCE } from "./security-required-input-evidence";
import {
  PRODUCT_ROUTE_CAPABILITY_SOURCE_MASTER_EVIDENCE,
  PRODUCT_SOURCE_AUDIT_MASTER_EVIDENCE,
} from "./product-source-audit-evidence";
import { PRODUCT_SOURCE_INTERACTION_MASTER_EVIDENCE } from "./product-source-interaction-evidence";
export { TESTED_REGISTERED_PAGE_ROUTE_REQUIREMENTS } from "./product-route-master-evidence";

export type ProductMasterEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
  owner?: string;
  verificationScope?: "output-existence-only";
};

export type SecurityMasterEvidenceRecord = {
  status: SecurityRequirementStatus;
  evidence: readonly string[];
  owner?: string;
  notApplicableJustification?: string;
  verificationScope?: "output-existence-only" | "final-report-structure-only";
};

/**
 * Evidence is intentionally separate from the immutable prompt extraction.
 * Add an entry only after the linked artifact exists; captured work remains
 * incomplete until verification or test evidence satisfies the requirement.
 */
export const PRODUCT_MASTER_EVIDENCE: Readonly<
  Record<string, ProductMasterEvidenceRecord>
> = {
  ...PRODUCT_REQUIRED_OUTPUT_EVIDENCE,
  ...PRODUCT_ROUTE_MASTER_EVIDENCE,
  ...PRODUCT_PUBLIC_ROUTE_OUTCOME_MASTER_EVIDENCE,
  ...PRODUCT_VERIFICATION_GATE_MASTER_EVIDENCE,
  ...PRODUCT_AUTOMATED_SOURCE_GATE_MASTER_EVIDENCE,
  ...PRODUCT_PLACEHOLDER_PROHIBITION_MASTER_EVIDENCE,
  ...PRODUCT_GLOBAL_SECURITY_INVARIANT_MASTER_EVIDENCE,
  ...PRODUCT_SYSTEM_STATE_MASTER_EVIDENCE,
  ...PRODUCT_SYSTEM_RECOVERY_MASTER_EVIDENCE,
  ...PRODUCT_STORY_CAPABILITY_MASTER_EVIDENCE,
  ...PRODUCT_STORY_CONTRACT_FIELD_MASTER_EVIDENCE,
  ...PRODUCT_STORY_OPERATIONAL_CONTRACT_MASTER_EVIDENCE,
  ...PRODUCT_DESIGN_LAB_INSPECTOR_MASTER_EVIDENCE,
  ...PRODUCT_DESIGN_LAB_ROUTE_SELECTOR_MASTER_EVIDENCE,
  ...PRODUCT_DESIGN_LAB_SCENARIO_SELECTOR_MASTER_EVIDENCE,
  ...PRODUCT_DESIGN_LAB_SCENARIO_SIMULATOR_MASTER_EVIDENCE,
  ...PRODUCT_COMMUNITY_CAPABILITY_MASTER_EVIDENCE,
  ...PRODUCT_COMMUNITY_PRIVACY_HIDE_MASTER_EVIDENCE,
  ...PRODUCT_COMMUNITY_FRIEND_REMOVAL_MASTER_EVIDENCE,
  ...PRODUCT_COMMUNITY_DROPPED_CALL_RECOVERY_MASTER_EVIDENCE,
  ...PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_MASTER_EVIDENCE,
  ...PRODUCT_ROUTE_REGISTRY_METADATA_MASTER_EVIDENCE,
  ...PRODUCT_ROUTE_REFRESH_FIXTURE_MASTER_EVIDENCE,
  ...PRODUCT_RESPONSIVE_WIDTH_MASTER_EVIDENCE,
  "GLOBAL.SEC.thread-metadata":
    PRODUCT_MESSAGING_ACCESS_STATE_MASTER_EVIDENCE[
      "GLOBAL.SEC.thread-metadata"
    ],
  ...PRODUCT_RACING_STRUCTURE_MASTER_EVIDENCE,
  ...PRODUCT_RACING_MEETING_SEARCH_MASTER_EVIDENCE,
  ...PRODUCT_RACING_DETAIL_NAVIGATION_MASTER_EVIDENCE,
  ...PRODUCT_RACING_CONTEXT_PRESERVATION_MASTER_EVIDENCE,
  ...PRODUCT_RACING_STATUS_DISTINCTION_MASTER_EVIDENCE,
  ...PRODUCT_RACING_ZERO_MISSING_MASTER_EVIDENCE,
  ...PRODUCT_RACING_PROVENANCE_MASTER_EVIDENCE,
  ...PRODUCT_RACING_MISSING_SNAPSHOT_MASTER_EVIDENCE,
  ...PRODUCT_RACING_PRESENTATION_SCHEMA_MASTER_EVIDENCE,
  ...PRODUCT_RACING_FINAL_ROUTES_MASTER_EVIDENCE,
  ...PRODUCT_RACING_FIXTURE_MASTER_EVIDENCE,
  ...PRODUCT_SCREEN_CONTRACT_COMPLETENESS_MASTER_EVIDENCE,
  ...PRODUCT_FORM_CONTRACT_CORE_MASTER_EVIDENCE,
  ...PRODUCT_FORM_OPERATIONAL_CONTRACT_MASTER_EVIDENCE,
  ...PRODUCT_FIELD_CONTRACT_SOURCE_MASTER_EVIDENCE,
  ...PRODUCT_DYNAMIC_ROUTE_MISSING_RECORD_MASTER_EVIDENCE,
  ...PRODUCT_ACTION_PURPOSE_MASTER_EVIDENCE,
  ...PRODUCT_ACTOR_MAP_MASTER_EVIDENCE,
  ...PRODUCT_MARKETPLACE_ACCESS_SAFETY_MASTER_EVIDENCE,
  ...PRODUCT_ADMIN_SERVER_AUTHORIZATION_MASTER_EVIDENCE,
  ...PRODUCT_ADMIN_SAFE_FAILURE_MASTER_EVIDENCE,
  ...PRODUCT_MARKETPLACE_MISSING_PRIVACY_MASTER_EVIDENCE,
  ...PRODUCT_ACCOUNT_FORM_VALIDATION_MASTER_EVIDENCE,
  ...PRODUCT_ACCOUNT_SENSITIVE_CONFIRMATION_MASTER_EVIDENCE,
  ...PRODUCT_ACCOUNT_TEAM_MASTER_EVIDENCE,
  ...PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_MASTER_EVIDENCE,
  ...PRODUCT_MARKETPLACE_SELLER_PROFILE_MASTER_EVIDENCE,
  ...PRODUCT_MARKETPLACE_SHARE_MASTER_EVIDENCE,
  ...PRODUCT_MARKETPLACE_SORT_PAGINATION_MASTER_EVIDENCE,
  ...PRODUCT_MARKETPLACE_MEDIA_ORDERING_MASTER_EVIDENCE,
  ...PRODUCT_MARKETPLACE_EDIT_MASTER_EVIDENCE,
  ...PRODUCT_MARKETPLACE_EDIT_ROUTE_MASTER_EVIDENCE,
  ...PRODUCT_MARKETPLACE_SELLER_INVENTORY_ROUTES_MASTER_EVIDENCE,
  ...PRODUCT_AI_TRUTH_MASTER_EVIDENCE,
  ...PRODUCT_AI_ROUTE_INVENTORY_MASTER_EVIDENCE,
  ...PRODUCT_AGENT_RUN_LIFECYCLE_MASTER_EVIDENCE,
  ...PRODUCT_ONBOARDING_CAPABILITY_MASTER_EVIDENCE,
  ...PRODUCT_DOCUMENTATION_AUTHORITY_MASTER_EVIDENCE,
  ...PRODUCT_SOURCE_AUDIT_MASTER_EVIDENCE,
  ...PRODUCT_SOURCE_INTERACTION_MASTER_EVIDENCE,
  ...PRODUCT_ROUTE_CAPABILITY_SOURCE_MASTER_EVIDENCE,
  "OUT.route-screen-inventory": {
    status: "tested",
    evidence: [
      "docs/product/route-inventory.md",
      "src/components/demo-experience-registry.ts",
      "src/components/product-route-tree-evidence.test.ts",
    ],
  },
  "OUT.user-story-inventory": {
    status: "tested",
    evidence: [
      "docs/product/user-story-matrix.md",
      "src/components/demo-experience-registry.test.ts",
      "src/components/product-route-tree-evidence.test.ts",
    ],
  },
  ...PRODUCT_ACTION_INVENTORY_MASTER_EVIDENCE,
  "OUT.state-matrix": {
    status: "captured",
    evidence: ["docs/product/state-matrix.md"],
  },
  "DISC.SRC.route-definitions": {
    status: "tested",
    evidence: [
      "docs/product/route-inventory.md",
      "src/components/demo-experience-registry.test.ts",
      "security/registry.test.ts",
      "src/components/product-route-tree-evidence.test.ts",
    ],
  },
  "DISC.SRC.navigation-menus": {
    status: "tested",
    evidence: ["src/components/site-header-mobile-navigation.test.ts"],
  },
  "DISC.SRC.mobile-navigation": {
    status: "tested",
    evidence: ["src/components/site-header-mobile-navigation.test.ts"],
  },
  "DISC.SRC.tablet-navigation": {
    status: "tested",
    evidence: ["src/components/site-header-mobile-navigation.test.ts"],
  },
  "DISC.SRC.next-route-directories": {
    status: "tested",
    evidence: [
      "src/components/demo-experience-registry.test.ts",
      "security/registry.test.ts",
    ],
  },
  "DISC.SRC.design-lab-routes": {
    status: "tested",
    evidence: [
      "src/components/demo-experience-registry.ts",
      "src/components/demo-experience-registry.test.ts",
      "docs/product/route-inventory.md",
    ],
  },
  "DISC.SRC.production-pages": {
    status: "captured",
    evidence: [
      "docs/product/production-parity.md",
      "output/product-audit/production-link-audit.json",
    ],
  },
  "DISC.CRAWL.destination": {
    status: "captured",
    evidence: ["output/product-audit/production-link-audit.json"],
  },
  "DISC.CRAWL.http-status": {
    status: "captured",
    evidence: ["output/product-audit/production-link-audit.json"],
  },
  "DISC.CRAWL.redirect-chain": {
    status: "captured",
    evidence: ["output/product-audit/production-link-audit.json"],
  },
  "DISC.CRAWL.canonical-host": {
    status: "verified",
    evidence: [
      "docs/product/production-parity.md",
      "output/product-audit/production-link-audit.json",
    ],
  },
  "REG.ROUTE.single-source": {
    status: "tested",
    evidence: [
      "src/components/demo-experience-registry.ts",
      "src/components/demo-experience-registry.test.ts",
    ],
  },
  "REG.ROUTE.drives-design-lab": {
    status: "tested",
    evidence: [
      "src/components/demo-experience-screen-map.tsx",
      "src/components/demo-experience-registry.test.ts",
    ],
  },
  "REG.ROUTE.drives-tests": {
    status: "tested",
    evidence: ["src/components/demo-experience-registry.test.ts"],
  },
  "REG.ROUTE.drives-docs": {
    status: "tested",
    evidence: [
      "scripts/check-design-lab-doc-counters.ts",
      "scripts/check-design-lab-doc-counters.test.ts",
      "docs/product/design-lab-coverage.md",
    ],
  },
  "REG.ROUTE.field-route-pattern": {
    status: "tested",
    evidence: [
      "src/components/demo-experience-registry.ts",
      "src/components/demo-experience-registry.test.ts",
    ],
  },
  "REG.ROUTE.field-id": {
    status: "tested",
    evidence: [
      "src/components/demo-experience-registry.ts",
      "src/components/demo-experience-registry.test.ts",
    ],
  },
  "REG.ROUTE.field-route": {
    status: "tested",
    evidence: [
      "src/components/demo-experience-registry.ts",
      "src/components/demo-experience-registry.test.ts",
    ],
  },
  "REG.ROUTE.field-title": {
    status: "tested",
    evidence: [
      "src/components/demo-experience-registry.ts",
      "src/components/demo-experience-registry.test.ts",
    ],
  },
  "REG.ROUTE.field-product-area": {
    status: "tested",
    evidence: [
      "src/components/demo-experience-registry.ts",
      "src/components/demo-experience-registry.test.ts",
    ],
  },
  "REG.ROUTE.field-description": {
    status: "tested",
    evidence: [
      "src/components/demo-experience-registry.ts",
      "src/components/demo-experience-registry.test.ts",
    ],
  },
  "REG.ROUTE.field-actors": {
    status: "tested",
    evidence: [
      "src/components/demo-experience-registry.ts",
      "src/components/demo-experience-registry.test.ts",
    ],
  },
  "REG.ROUTE.field-authentication": {
    status: "tested",
    evidence: [
      "src/components/demo-experience-registry.ts",
      "src/components/demo-experience-registry.test.ts",
    ],
  },
  "REG.ROUTE.field-roles": {
    status: "tested",
    evidence: [
      "src/components/demo-experience-registry.ts",
      "src/components/demo-experience-registry.test.ts",
    ],
  },
  "REG.ROUTE.field-tiers": {
    status: "tested",
    evidence: [
      "src/components/demo-experience-registry.ts",
      "src/components/demo-experience-registry.test.ts",
    ],
  },
  "REG.ROUTE.field-dynamic-parameters": {
    status: "tested",
    evidence: [
      "src/components/demo-experience-registry.ts",
      "src/components/demo-experience-registry.test.ts",
    ],
  },
  "REG.ROUTE.field-noindex": {
    status: "tested",
    evidence: [
      "src/components/demo-experience-registry.ts",
      "src/components/demo-experience-registry.test.ts",
      "src/components/design-lab-route-safety.test.ts",
    ],
  },
  "REG.ROUTE.field-production-enabled": {
    status: "tested",
    evidence: [
      "src/components/demo-experience-registry.ts",
      "src/components/demo-experience-registry.test.ts",
      "src/components/design-lab-route-safety.test.ts",
      "src/lib/design-lab-access-policy.test.ts",
    ],
  },
  "ROUTE.PUBLIC.auth-cancelled": {
    status: "tested",
    evidence: [
      "src/app/auth/error/page.tsx",
      "src/lib/auth-callback-recovery.test.ts",
      "src/lib/auth-callback-route-contract.test.ts",
    ],
  },
  "ROUTE.PUBLIC.auth-expired": {
    status: "tested",
    evidence: [
      "src/app/auth/error/page.tsx",
      "src/lib/auth-callback-recovery.test.ts",
    ],
  },
  "ROUTE.PUBLIC.auth-provider-failure": {
    status: "tested",
    evidence: [
      "src/app/auth/error/page.tsx",
      "src/lib/auth-callback-recovery.test.ts",
    ],
  },
  "ROUTE.PUBLIC.safe-return": {
    status: "tested",
    evidence: ["src/lib/workos-redirect.test.ts"],
  },
  "ROUTE.PUBLIC.no-open-redirect": {
    status: "tested",
    evidence: ["src/lib/workos-redirect.test.ts"],
  },
  "ROUTE.PUBLIC.auth-retry": {
    status: "tested",
    evidence: [
      "src/app/auth/error/page.tsx",
      "src/lib/auth-callback-route-contract.test.ts",
    ],
  },
  "ROUTE.PUBLIC.not-found": {
    status: "tested",
    evidence: ["src/app/not-found.tsx", "src/proxy-detail-routes.test.ts"],
  },
  "ROUTE.ADMIN.moderator-nav": {
    status: "tested",
    evidence: [
      "src/app/admin/admin-nav-data.ts",
      "src/app/admin/admin-nav-data.test.ts",
    ],
  },
  "ROUTE.ADMIN.allowlist-status": {
    status: "tested",
    evidence: [
      "src/app/admin/admin-status-contract.ts",
      "src/app/admin/admin-status-contract.test.ts",
      "src/app/admin/admin-input-contract.ts",
      "src/app/admin/admin-input-contract.test.ts",
    ],
  },
  "ROUTE.ADMIN.read-only": {
    status: "tested",
    evidence: [
      "src/app/admin/admin-moderator-read-only-contract.test.ts",
      "src/app/admin/admin-nav-data.test.ts",
    ],
  },
  "DL.ROUTE.master": {
    status: "tested",
    evidence: [
      "src/app/design-lab/page.tsx",
      "src/components/demo-experience-registry.test.ts",
    ],
  },
  "DL.ROUTE.demo-experience": {
    status: "tested",
    evidence: [
      "src/app/design-lab/demo-experience/page.tsx",
      "src/components/screen-contracts/design-lab-screen-inventory.test.ts",
      "src/components/design-lab-route-safety.test.ts",
    ],
  },
  "DL.ROUTE.dock-skins": {
    status: "tested",
    evidence: [
      "src/app/design-lab/dock-skins/page.tsx",
      "src/components/screen-contracts/design-lab-screen-inventory.test.ts",
      "src/components/design-lab-route-safety.test.ts",
    ],
  },
  "DL.ROUTE.role-blueprints": {
    status: "tested",
    evidence: [
      "src/app/design-lab/role-blueprints/page.tsx",
      "src/components/screen-contracts/design-lab-screen-inventory.test.ts",
      "src/components/design-lab-route-safety.test.ts",
    ],
  },
  "DL.ROUTE.feed-device-preview": {
    status: "tested",
    evidence: [
      "src/app/feed/device-preview/page.tsx",
      "src/components/screen-contracts/design-lab-screen-inventory.test.ts",
      "src/components/design-lab-route-safety.test.ts",
    ],
  },
  "DL.ROUTE.marketplace": {
    status: "tested",
    evidence: [
      "src/app/marketplace/design-lab/page.tsx",
      "src/components/screen-contracts/design-lab-screen-inventory.test.ts",
      "src/components/design-lab-route-safety.test.ts",
    ],
  },
  "DL.SAFE.noindex": {
    status: "tested",
    evidence: ["src/components/design-lab-route-safety.test.ts"],
  },
  "DL.SAFE.production-disabled": {
    status: "tested",
    evidence: ["src/components/design-lab-route-safety.test.ts"],
  },
  "DL.SAFE.server-gate": {
    status: "tested",
    evidence: ["src/components/design-lab-route-safety.test.ts"],
  },
  "DL.SAFE.no-production-data": {
    status: "tested",
    evidence: [
      "src/lib/demo-production-isolation.test.ts",
      "src/lib/design-lab-local-data-policy.test.ts",
      "security/local-data-policy.ts",
    ],
  },
  "VERIFY.GATE.lab-indexable": {
    status: "tested",
    evidence: [
      "src/components/design-lab-route-safety.test.ts",
      "src/components/demo-experience-registry.test.ts",
    ],
  },
  "SYSTEM.not-found": {
    status: "tested",
    evidence: ["src/app/not-found.tsx", "src/proxy-detail-routes.test.ts"],
  },
  "GLOBAL.RESP.menus": {
    status: "captured",
    evidence: ["src/components/site-header-mobile-navigation.test.ts"],
  },
  "VERIFY.GATE.overflow": {
    status: "tested",
    evidence: [
      "scripts/audit-design-lab-responsive-workspace.ts",
      "scripts/audit-design-lab-responsive-workspace.test.ts",
      "output/design-lab-responsive-workspace/latest.json",
    ],
  },
  "DOC.PATH.design-lab": {
    status: "tested",
    evidence: [
      "docs/product/design-lab-coverage.md",
      "scripts/check-design-lab-doc-counters.test.ts",
    ],
  },
  "DOC.PATH.route": {
    status: "tested",
    evidence: [
      "docs/product/route-inventory.md",
      "scripts/check-design-lab-doc-counters.test.ts",
    ],
  },
  "DOC.PATH.stories": {
    status: "tested",
    evidence: [
      "docs/product/user-story-matrix.md",
      "scripts/check-design-lab-doc-counters.test.ts",
    ],
  },
  "DOC.PATH.actions": {
    status: "tested",
    evidence: [
      "docs/product/action-inventory.md",
      "scripts/check-design-lab-doc-counters.test.ts",
    ],
  },
  "DOC.PATH.forms": {
    status: "tested",
    evidence: [
      "docs/product/form-field-registry.md",
      "scripts/check-design-lab-doc-counters.test.ts",
    ],
  },
  "DOC.PATH.permissions": {
    status: "tested",
    evidence: [
      "docs/product/permissions-matrix.md",
      "scripts/check-design-lab-doc-counters.test.ts",
    ],
  },
  "DOC.PATH.states": {
    status: "tested",
    evidence: [
      "docs/product/state-matrix.md",
      "scripts/check-design-lab-doc-counters.test.ts",
    ],
  },
  "DOC.PATH.onboarding": {
    status: "tested",
    evidence: [
      "docs/product/onboarding-map.md",
      "scripts/check-design-lab-doc-counters.test.ts",
    ],
  },
  "DOC.PATH.final": {
    status: "tested",
    evidence: [
      "docs/product/final-audit-report.md",
      "scripts/check-design-lab-doc-counters.test.ts",
    ],
  },
  "COMPLETE.EVIDENCE.production-inspected": {
    status: "verified",
    evidence: [
      "docs/product/production-parity.md",
      "output/product-audit/production-link-audit.json",
    ],
  },
  "COMPLETE.EVIDENCE.route-tree-inspected": {
    status: "tested",
    evidence: [
      "docs/product/route-inventory.md",
      "src/components/demo-experience-registry.test.ts",
      "security/registry.test.ts",
      "src/components/product-route-tree-evidence.test.ts",
    ],
  },
  "COMPLETE.EVIDENCE.beyond-seed": {
    status: "verified",
    evidence: [
      "docs/product/route-inventory.md",
      "docs/product/production-parity.md",
    ],
  },
};

export const TESTED_SECURITY_REGISTRY_FIELD_REQUIREMENTS = {
  endpoints: {
    "security.api-inventory-record.field.endpoint-id": "endpointId",
    "security.api-inventory-record.field.protocol": "protocol",
    "security.api-inventory-record.field.host": "host",
    "security.api-inventory-record.field.environment": "environment",
    "security.api-inventory-record.field.version": "version",
    "security.api-inventory-record.field.method": "method",
    "security.api-inventory-record.field.route-or-procedure":
      "routeOrProcedure",
    "security.api-inventory-record.field.source-file": "sourceFile",
    "security.api-inventory-record.field.handler": "handler",
    "security.api-inventory-record.field.frontend-callers": "frontendCallers",
    "security.api-inventory-record.field.non-frontend-callers":
      "nonFrontendCallers",
    "security.api-inventory-record.field.authentication": "authentication",
    "security.api-inventory-record.field.session-or-token-type":
      "sessionOrTokenType",
    "security.api-inventory-record.field.csrf-requirement": "csrfRequirement",
    "security.api-inventory-record.field.cors-policy": "corsPolicy",
    "security.api-inventory-record.field.allowed-actors": "allowedActors",
    "security.api-inventory-record.field.allowed-roles": "allowedRoles",
    "security.api-inventory-record.field.allowed-subscriptions":
      "allowedSubscriptions",
    "security.api-inventory-record.field.required-permissions":
      "requiredPermissions",
    "security.api-inventory-record.field.object-level-policy":
      "objectLevelPolicy",
    "security.api-inventory-record.field.property-level-policy":
      "propertyLevelPolicy",
    "security.api-inventory-record.field.tenant-policy": "tenantPolicy",
    "security.api-inventory-record.field.request-schema": "requestSchema",
    "security.api-inventory-record.field.allowed-input-fields":
      "allowedInputFields",
    "security.api-inventory-record.field.maximum-body-size": "maximumBodySize",
    "security.api-inventory-record.field.maximum-file-size": "maximumFileSize",
    "security.api-inventory-record.field.output-schema": "outputSchema",
    "security.api-inventory-record.field.allowed-output-fields":
      "allowedOutputFields",
    "security.api-inventory-record.field.rate-limit": "rateLimit",
    "security.api-inventory-record.field.cost-or-resource-budget":
      "costOrResourceBudget",
    "security.api-inventory-record.field.idempotency": "idempotency",
    "security.api-inventory-record.field.database-operations":
      "databaseOperations",
    "security.api-inventory-record.field.cache-operations": "cacheOperations",
    "security.api-inventory-record.field.background-jobs": "backgroundJobs",
    "security.api-inventory-record.field.external-providers":
      "externalProviders",
    "security.api-inventory-record.field.sensitive-data": "sensitiveData",
    "security.api-inventory-record.field.audit-event": "auditEvent",
    "security.api-inventory-record.field.log-events": "logEvents",
    "security.api-inventory-record.field.error-responses": "errorResponses",
    "security.api-inventory-record.field.deprecation-status":
      "deprecationStatus",
    "security.api-inventory-record.field.owner": "owner",
    "security.api-inventory-record.field.tests": "tests",
    "security.api-inventory-record.field.verification-status":
      "verificationStatus",
  },
  databaseOperations: {
    "security.database-operation-contract.field.query-id": "queryId",
    "security.database-operation-contract.field.trace-id": "traceId",
    "security.database-operation-contract.field.source-file": "sourceFile",
    "security.database-operation-contract.field.source-symbol": "sourceSymbol",
    "security.database-operation-contract.field.orm-or-driver": "ormOrDriver",
    "security.database-operation-contract.field.orm-operation": "ormOperation",
    "security.database-operation-contract.field.normalized-sql":
      "normalizedSql",
    "security.database-operation-contract.field.stored-procedure":
      "storedProcedure",
    "security.database-operation-contract.field.database-function":
      "databaseFunction",
    "security.database-operation-contract.field.database-role": "databaseRole",
    "security.database-operation-contract.field.database-name": "databaseName",
    "security.database-operation-contract.field.schema-name": "schemaName",
    "security.database-operation-contract.field.operation-type":
      "operationType",
    "security.database-operation-contract.field.tables": "tables",
    "security.database-operation-contract.field.views": "views",
    "security.database-operation-contract.field.columns-read": "columnsRead",
    "security.database-operation-contract.field.columns-written":
      "columnsWritten",
    "security.database-operation-contract.field.bound-parameters":
      "boundParameters",
    "security.database-operation-contract.field.parameterized": "parameterized",
    "security.database-operation-contract.field.tenant-predicate":
      "tenantPredicate",
    "security.database-operation-contract.field.ownership-predicate":
      "ownershipPredicate",
    "security.database-operation-contract.field.visibility-predicate":
      "visibilityPredicate",
    "security.database-operation-contract.field.row-level-security-policies":
      "rowLevelSecurityPolicies",
    "security.database-operation-contract.field.expected-row-count":
      "expectedRowCount",
    "security.database-operation-contract.field.maximum-row-count":
      "maximumRowCount",
    "security.database-operation-contract.field.pagination-required":
      "paginationRequired",
    "security.database-operation-contract.field.transaction-boundary":
      "transactionBoundary",
    "security.database-operation-contract.field.isolation-level":
      "isolationLevel",
    "security.database-operation-contract.field.locks": "locks",
    "security.database-operation-contract.field.concurrency-control":
      "concurrencyControl",
    "security.database-operation-contract.field.indexes-expected":
      "indexesExpected",
    "security.database-operation-contract.field.constraints-relied-on":
      "constraintsReliedOn",
    "security.database-operation-contract.field.triggers-invoked":
      "triggersInvoked",
    "security.database-operation-contract.field.timeout-milliseconds":
      "timeoutMilliseconds",
    "security.database-operation-contract.field.explain-plan-evidence":
      "explainPlanEvidence",
    "security.database-operation-contract.field.sensitive-columns":
      "sensitiveColumns",
    "security.database-operation-contract.field.returned-data-shape":
      "returnedDataShape",
    "security.database-operation-contract.field.not-found-behaviour":
      "notFoundBehaviour",
    "security.database-operation-contract.field.unauthorized-behaviour":
      "unauthorizedBehaviour",
    "security.database-operation-contract.field.conflict-behaviour":
      "conflictBehaviour",
    "security.database-operation-contract.field.failure-behaviour":
      "failureBehaviour",
    "security.database-operation-contract.field.tests": "tests",
  },
  securityTraces: {
    "security.security-trace-contract.identity.trace-id": "traceId",
    "security.security-trace-contract.identity.user-story-ids": "userStoryIds",
    "security.security-trace-contract.identity.product-area": "productArea",
    "security.security-trace-contract.identity.route-patterns": "routePatterns",
    "security.security-trace-contract.identity.screen-ids": "screenIds",
    "security.security-trace-contract.identity.action-name": "actionName",
    "security.security-trace-contract.identity.action-type": "actionType",
    "security.security-trace-contract.access.actors": "actors",
    "security.security-trace-contract.access.authentication": "authentication",
    "security.security-trace-contract.access.allowed-roles": "allowedRoles",
    "security.security-trace-contract.access.allowed-tiers": "allowedTiers",
    "security.security-trace-contract.access.required-permissions":
      "requiredPermissions",
    "security.security-trace-contract.access.required-relationships":
      "requiredRelationships",
    "security.security-trace-contract.access.feature-flags": "featureFlags",
    "security.security-trace-contract.database.database-operations":
      "databaseOperations",
    "security.security-trace-contract.governance.data-classification":
      "dataClassification",
    "security.security-trace-contract.governance.audit-events": "auditEvents",
    "security.security-trace-contract.governance.security-controls":
      "securityControls",
    "security.security-trace-contract.governance.threats": "threats",
    "security.security-trace-contract.governance.tests": "tests",
    "security.security-trace-contract.governance.evidence": "evidence",
    "security.security-trace-contract.governance.owner": "owner",
    "security.security-trace-contract.governance.verification-status":
      "verificationStatus",
  },
  securityTraceFrontend: {
    "security.security-trace-contract.frontend.source-files": "sourceFiles",
    "security.security-trace-contract.frontend.components": "components",
    "security.security-trace-contract.frontend.event-handlers": "eventHandlers",
    "security.security-trace-contract.frontend.forms": "forms",
    "security.security-trace-contract.frontend.fields": "fields",
    "security.security-trace-contract.frontend.client-validation-schemas":
      "clientValidationSchemas",
    "security.security-trace-contract.frontend.client-state-stores":
      "clientStateStores",
    "security.security-trace-contract.frontend.sensitive-browser-storage":
      "sensitiveBrowserStorage",
  },
  securityTraceTransport: {
    "security.security-trace-contract.transport.protocol": "protocol",
    "security.security-trace-contract.transport.method": "method",
    "security.security-trace-contract.transport.path-or-procedure":
      "pathOrProcedure",
    "security.security-trace-contract.transport.content-type": "contentType",
    "security.security-trace-contract.transport.credential-mode":
      "credentialMode",
    "security.security-trace-contract.transport.required-headers":
      "requiredHeaders",
    "security.security-trace-contract.transport.csrf-control": "csrfControl",
    "security.security-trace-contract.transport.cors-policy": "corsPolicy",
    "security.security-trace-contract.transport.maximum-request-bytes":
      "maximumRequestBytes",
    "security.security-trace-contract.transport.timeout-milliseconds":
      "timeoutMilliseconds",
  },
  securityTraceServer: {
    "security.security-trace-contract.server.entry-files": "entryFiles",
    "security.security-trace-contract.server.handlers": "handlers",
    "security.security-trace-contract.server.middleware-order":
      "middlewareOrder",
    "security.security-trace-contract.server.authentication-function":
      "authenticationFunction",
    "security.security-trace-contract.server.session-validation-function":
      "sessionValidationFunction",
    "security.security-trace-contract.server.authorization-policy":
      "authorizationPolicy",
    "security.security-trace-contract.server.object-authorization-policy":
      "objectAuthorizationPolicy",
    "security.security-trace-contract.server.property-authorization-policy":
      "propertyAuthorizationPolicy",
    "security.security-trace-contract.server.request-validation-schema":
      "requestValidationSchema",
    "security.security-trace-contract.server.output-schema": "outputSchema",
    "security.security-trace-contract.server.business-service":
      "businessService",
    "security.security-trace-contract.server.repository-methods":
      "repositoryMethods",
    "security.security-trace-contract.server.rate-limit-policy":
      "rateLimitPolicy",
    "security.security-trace-contract.server.idempotency-policy":
      "idempotencyPolicy",
  },
  securityTraceCacheOperations: {
    "security.security-trace-contract.cache.operation": "operation",
    "security.security-trace-contract.cache.key-shape": "keyShape",
    "security.security-trace-contract.cache.includes-security-context":
      "includesSecurityContext",
    "security.security-trace-contract.cache.ttl-seconds": "ttlSeconds",
    "security.security-trace-contract.cache.invalidation-triggers":
      "invalidationTriggers",
  },
  securityTraceBackgroundOperations: {
    "security.security-trace-contract.background.queue-or-scheduler":
      "queueOrScheduler",
    "security.security-trace-contract.background.job-type": "jobType",
    "security.security-trace-contract.background.payload-schema":
      "payloadSchema",
    "security.security-trace-contract.background.worker-identity":
      "workerIdentity",
    "security.security-trace-contract.background.retry-policy": "retryPolicy",
    "security.security-trace-contract.background.idempotency-key":
      "idempotencyKey",
  },
  securityTraceExternalOperations: {
    "security.security-trace-contract.external.provider": "provider",
    "security.security-trace-contract.external.operation": "operation",
    "security.security-trace-contract.external.credential-scope":
      "credentialScope",
    "security.security-trace-contract.external.request-schema": "requestSchema",
    "security.security-trace-contract.external.response-schema":
      "responseSchema",
    "security.security-trace-contract.external.timeout-policy": "timeoutPolicy",
    "security.security-trace-contract.external.retry-policy": "retryPolicy",
    "security.security-trace-contract.external.circuit-breaker-policy":
      "circuitBreakerPolicy",
    "security.security-trace-contract.external.webhook-follow-up":
      "webhookFollowUp",
  },
  securityTraceResponses: {
    "security.security-trace-contract.response.success-status": "successStatus",
    "security.security-trace-contract.response.response-schema":
      "responseSchema",
    "security.security-trace-contract.response.permitted-fields":
      "permittedFields",
    "security.security-trace-contract.response.cache-policy": "cachePolicy",
    "security.security-trace-contract.response.frontend-success-state":
      "frontendSuccessState",
  },
  securityTraceFailureModes: {
    "security.security-trace-contract.failure.condition": "condition",
    "security.security-trace-contract.failure.external-status":
      "externalStatus",
    "security.security-trace-contract.failure.safe-user-message":
      "safeUserMessage",
    "security.security-trace-contract.failure.server-log-event":
      "serverLogEvent",
    "security.security-trace-contract.failure.retry-permitted":
      "retryPermitted",
  },
  thirdParties: {
    "security.third-party-record.field.purpose": "purpose",
    "security.third-party-record.field.data-sent": "dataSent",
    "security.third-party-record.field.data-received": "dataReceived",
    "security.third-party-record.field.personal-information":
      "personalInformation",
    "security.third-party-record.field.credentials": "credentials",
    "security.third-party-record.field.credential-scope": "credentialScope",
    "security.third-party-record.field.credential-storage": "credentialStorage",
    "security.third-party-record.field.credential-rotation":
      "credentialRotation",
    "security.third-party-record.field.environments": "environments",
    "security.third-party-record.field.allowed-hosts": "allowedHosts",
    "security.third-party-record.field.tls-verification": "tlsVerification",
    "security.third-party-record.field.request-timeout": "requestTimeout",
    "security.third-party-record.field.retry-policy": "retryPolicy",
    "security.third-party-record.field.circuit-breaker": "circuitBreaker",
    "security.third-party-record.field.rate-limit": "rateLimit",
    "security.third-party-record.field.cost-limit": "costLimit",
    "security.third-party-record.field.response-validation":
      "responseValidation",
    "security.third-party-record.field.webhook-security": "webhookSecurity",
    "security.third-party-record.field.data-retention": "dataRetention",
    "security.third-party-record.field.provider-logging": "providerLogging",
    "security.third-party-record.field.known-subprocessors":
      "knownSubprocessors",
    "security.third-party-record.field.failure-fallback": "failureFallback",
    "security.third-party-record.field.incident-contact": "incidentContact",
    "security.third-party-record.field.responsible-owner": "responsibleOwner",
  },
} as const;

export const TESTED_SECURITY_REGISTRY_ENUM_REQUIREMENTS = {
  securityTraceAuthentication: {
    "security.security-trace-enum.authentication-public": "public",
    "security.security-trace-enum.authentication-optional": "optional",
    "security.security-trace-enum.authentication-required": "required",
  },
  securityTraceActionType: {
    "security.security-trace-enum.action-read": "read",
    "security.security-trace-enum.action-create": "create",
    "security.security-trace-enum.action-update": "update",
    "security.security-trace-enum.action-delete": "delete",
    "security.security-trace-enum.action-upload": "upload",
    "security.security-trace-enum.action-download": "download",
    "security.security-trace-enum.action-authentication": "authentication",
    "security.security-trace-enum.action-billing": "billing",
    "security.security-trace-enum.action-administration": "administration",
    "security.security-trace-enum.action-background": "background",
    "security.security-trace-enum.action-webhook": "webhook",
    "security.security-trace-enum.action-realtime": "realtime",
    "security.security-trace-enum.action-external": "external",
  },
  databaseOperationType: {
    "security.database-operation-enum.operation-select": "select",
    "security.database-operation-enum.operation-insert": "insert",
    "security.database-operation-enum.operation-update": "update",
    "security.database-operation-enum.operation-delete": "delete",
    "security.database-operation-enum.operation-upsert": "upsert",
    "security.database-operation-enum.operation-procedure": "procedure",
    "security.database-operation-enum.operation-transaction": "transaction",
  },
} as const;

export const SECURITY_REGISTRY_RECORD_SET_SOURCES = {
  endpoints: "security/endpoints.ts",
  databaseOperations: "security/database-operations.ts",
  securityTraces: "security/traces.ts",
  securityTraceFrontend: "security/traces.ts",
  securityTraceTransport: "security/traces.ts",
  securityTraceServer: "security/traces.ts",
  securityTraceCacheOperations: "security/traces.ts",
  securityTraceBackgroundOperations: "security/traces.ts",
  securityTraceExternalOperations: "security/traces.ts",
  securityTraceResponses: "security/traces.ts",
  securityTraceFailureModes: "security/traces.ts",
  thirdParties: "security/third-parties.ts",
} as const;

export const SECURITY_REGISTRY_ENUM_SET_SOURCES = {
  securityTraceAuthentication: "security/traces.ts",
  securityTraceActionType: "security/traces.ts",
  databaseOperationType: "security/database-operations.ts",
} as const;

const SECURITY_REGISTRY_EVIDENCE_TEST =
  "src/components/master-audit-security-registry-evidence.test.ts";

const TESTED_SECURITY_REGISTRY_FIELD_EVIDENCE = Object.fromEntries(
  Object.entries(TESTED_SECURITY_REGISTRY_FIELD_REQUIREMENTS).flatMap(
    ([recordSet, requirements]) =>
      Object.keys(requirements).map((id) => [
        id,
        {
          status: "verified",
          evidence: [
            SECURITY_REGISTRY_RECORD_SET_SOURCES[
              recordSet as keyof typeof SECURITY_REGISTRY_RECORD_SET_SOURCES
            ],
            SECURITY_REGISTRY_EVIDENCE_TEST,
          ],
        } satisfies SecurityMasterEvidenceRecord,
      ]),
  ),
);

const TESTED_SECURITY_REGISTRY_ENUM_EVIDENCE = Object.fromEntries(
  Object.entries(TESTED_SECURITY_REGISTRY_ENUM_REQUIREMENTS).flatMap(
    ([enumSet, requirements]) =>
      Object.keys(requirements).map((id) => [
        id,
        {
          status: "verified",
          evidence: [
            SECURITY_REGISTRY_ENUM_SET_SOURCES[
              enumSet as keyof typeof SECURITY_REGISTRY_ENUM_SET_SOURCES
            ],
            SECURITY_REGISTRY_EVIDENCE_TEST,
          ],
        } satisfies SecurityMasterEvidenceRecord,
      ]),
  ),
);

const TESTED_ARCHITECTURE_INVENTORY_EVIDENCE = Object.fromEntries(
  ARCHITECTURE_MASTER_EVIDENCE_REQUIREMENT_IDS.map((id) => [
    id,
    {
      status: "verified",
      evidence: ARCHITECTURE_INVENTORY_EVIDENCE,
    } satisfies SecurityMasterEvidenceRecord,
  ]),
);

const FINAL_REPORT_STRUCTURE_EVIDENCE = [
  "security/final-traceability.ts",
  "security/final-traceability.test.ts",
  "docs/security/security-trace-registry.md",
  "src/components/master-audit-security-registry-evidence.test.ts",
] as const;

const TESTED_FINAL_REPORT_STRUCTURE_EVIDENCE = Object.fromEntries(
  SECURITY_MASTER_REQUIREMENTS.filter(
    (requirement) =>
      requirement.section === "final-traceability-field" ||
      requirement.section === "final-summary-metric",
  ).map(({ id }) => [
    id,
    {
      status: "verified",
      verificationScope: "final-report-structure-only",
      evidence: FINAL_REPORT_STRUCTURE_EVIDENCE,
    } satisfies SecurityMasterEvidenceRecord,
  ]),
);

export const SECURITY_MASTER_EVIDENCE: Readonly<
  Record<string, SecurityMasterEvidenceRecord>
> = {
  ...SECURITY_REQUIRED_OUTPUT_EVIDENCE,
  ...TESTED_SECURITY_REGISTRY_FIELD_EVIDENCE,
  ...TESTED_SECURITY_REGISTRY_ENUM_EVIDENCE,
  ...TESTED_ARCHITECTURE_INVENTORY_EVIDENCE,
  ...TESTED_FINAL_REPORT_STRUCTURE_EVIDENCE,
  ...REQUIRED_INPUT_REGISTRY_MASTER_EVIDENCE,
  ...GENERIC_SECURITY_PLACEHOLDER_MASTER_EVIDENCE,
  ...API_SURFACE_MASTER_EVIDENCE,
  ...APPLICATION_SURFACE_MASTER_EVIDENCE,
  ...API_TRACE_GOVERNANCE_MASTER_EVIDENCE,
  ...DATABASE_QUERY_RECORD_MASTER_EVIDENCE,
  ...ACTUAL_QUERY_CAPTURE_MASTER_EVIDENCE,
  ...QUERY_SAFETY_MASTER_EVIDENCE,
  ...TOPAZ_RESPONSE_SAFETY_MASTER_EVIDENCE,
  ...ENDPOINT_ERROR_MASTER_EVIDENCE,
  ...ENDPOINT_VALIDATION_MASTER_EVIDENCE,
  ...ENDPOINT_RESOURCE_DATABASE_MASTER_EVIDENCE,
  ...SENSITIVE_BUSINESS_FLOW_MASTER_EVIDENCE,
  ...PRIMARY_TRACE_CHAIN_MASTER_EVIDENCE,
  ...SECURITY_FINDING_MASTER_EVIDENCE,
  ...FINDING_SEVERITY_MASTER_EVIDENCE,
  ...ACTION_TRACE_DATABASE_MASTER_EVIDENCE,
  ...ACTION_TRACE_RECORD_MASTER_EVIDENCE,
  ...SECURITY_STANDARDS_MASTER_EVIDENCE,
  ...SECURITY_CI_MASTER_EVIDENCE,
  ...RISK_ACCEPTANCE_POLICY_MASTER_EVIDENCE,
  ...SECURITY_LANGUAGE_POLICY_MASTER_EVIDENCE,
  ...DELETION_LIFECYCLE_MASTER_EVIDENCE,
  ...INCIDENT_READINESS_MASTER_EVIDENCE,
  ...AUTHORIZATION_ACTOR_MASTER_EVIDENCE,
  ...AUTHENTICATION_PATH_MASTER_EVIDENCE,
  ...SUPPLY_CHAIN_REVIEW_MASTER_EVIDENCE,
  ...AUDIT_EVENT_COVERAGE_MASTER_EVIDENCE,
  ...ARCHITECTURE_ADAPTATION_MASTER_EVIDENCE,
  ...DATABASE_INVENTORY_MASTER_EVIDENCE,
  ...SQL_INJECTION_CONTROL_MASTER_EVIDENCE,
  ...INJECTION_SURFACE_CONTROL_MASTER_EVIDENCE,
  ...COMMAND_INJECTION_CONTROL_MASTER_EVIDENCE,
  ...DESERIALIZATION_CONTROL_MASTER_EVIDENCE,
  ...ORM_INJECTION_CONTROL_MASTER_EVIDENCE,
  ...HEADER_INJECTION_CONTROL_MASTER_EVIDENCE,
  ...API_INVENTORY_MANAGEMENT_MASTER_EVIDENCE,
  ...DATABASE_COLUMN_RECORD_MASTER_EVIDENCE,
  ...PERSONAL_INFORMATION_RECORD_MASTER_EVIDENCE,
  ...PRIVACY_MINIMISATION_MASTER_EVIDENCE,
  ...RETENTION_SCHEDULE_MASTER_EVIDENCE,
  ...AUTHORISED_TESTING_BOUNDARY_MASTER_EVIDENCE,
  ...THIRD_PARTY_INVENTORY_MASTER_EVIDENCE,
  ...THIRD_PARTY_PROHIBITION_MASTER_EVIDENCE,
  ...SSRF_CONTROL_MASTER_EVIDENCE,
  ...AI_AUTHORIZATION_MASTER_EVIDENCE,
  ...PCI_SCOPE_MASTER_EVIDENCE,
  ...XSS_SURFACE_REVIEW_MASTER_EVIDENCE,
  ...XSS_IMPLEMENTATION_CONTROL_MASTER_EVIDENCE,
  ...SECRET_INVENTORY_MASTER_EVIDENCE,
  ...SECRET_CONTROL_MASTER_EVIDENCE,
  ...INFRASTRUCTURE_SOURCE_CONTROL_MASTER_EVIDENCE,
  ...INFRASTRUCTURE_POLICY_CONTROL_MASTER_EVIDENCE,
  ...CRYPTOGRAPHY_RECORD_MASTER_EVIDENCE,
  ...APPLICATION_LOG_ENVELOPE_MASTER_EVIDENCE,
  ...APPLICATION_LOG_PROHIBITION_MASTER_EVIDENCE,
  ...ALERT_RECORD_MASTER_EVIDENCE,
  ...SECURITY_ALERT_EVENT_MASTER_EVIDENCE,
  ...BROWSER_SECURITY_HEADER_MASTER_EVIDENCE,
  ...AUDIT_INTEGRITY_MASTER_EVIDENCE,
  ...EXTERNAL_LINK_EMBED_MASTER_EVIDENCE,
  ...DOWNLOAD_CONTROL_MASTER_EVIDENCE,
  ...UPLOAD_UNTRUSTED_CLAIM_MASTER_EVIDENCE,
  ...CORS_CONTROL_MASTER_EVIDENCE,
  ...CSRF_CONTROL_MASTER_EVIDENCE,
  ...HTTP_CONTROL_MASTER_EVIDENCE,
  ...WEBHOOK_CONTROL_MASTER_EVIDENCE,
  ...BILLING_LIFECYCLE_MASTER_EVIDENCE,
  ...BILLING_INVOICE_OWNERSHIP_MASTER_EVIDENCE,
  ...BILLING_SUBSCRIPTION_STATE_MACHINE_MASTER_EVIDENCE,
  ...HEALTH_ENDPOINT_REDACTION_MASTER_EVIDENCE,
  ...MODERATOR_API_BOUNDARY_MASTER_EVIDENCE,
  ...ADMINISTRATION_BOUNDARY_MASTER_EVIDENCE,
  ...SCHEDULED_TASK_CONTROL_MASTER_EVIDENCE,
  ...QUEUE_WORKER_CONTROL_MASTER_EVIDENCE,
  ...COOKIE_CONTROL_MASTER_EVIDENCE,
  ...BROWSER_DATA_HANDLING_MASTER_EVIDENCE,
  ...ENDPOINT_INJECTION_OUTPUT_MASTER_EVIDENCE,
  ...EXTERNAL_INPUT_SURFACE_MASTER_EVIDENCE,
  ...FRONTEND_AUTHORIZATION_MASTER_EVIDENCE,
  ...PROPERTY_AUTHORIZATION_MASTER_EVIDENCE,
  ...LISTING_OBJECT_AUTHORIZATION_MASTER_EVIDENCE,
  ...TRACE_IDENTIFIER_EXAMPLE_MASTER_EVIDENCE,
  ...VOICE_VIDEO_CONTROL_MASTER_EVIDENCE,
  ...UPLOAD_CONTROL_MASTER_EVIDENCE,
  ...UPLOAD_VALIDATION_MASTER_EVIDENCE,
  ...REALTIME_CONTROL_MASTER_EVIDENCE,
  ...MEDIA_BOUNDARY_MASTER_EVIDENCE,
  ...DESIGN_LAB_ISOLATION_MASTER_EVIDENCE,
  ...SUPPLY_CHAIN_ADDITIONAL_MASTER_EVIDENCE,
  ...SECURE_FAILURE_MASTER_EVIDENCE,
  "security.api-inventory-management.code-exists": {
    status: "verified",
    evidence: ["security/endpoints.ts", "security/registry.test.ts"],
  },
  "security.ci.03.nonexistent-inventory-endpoint": {
    status: "verified",
    evidence: ["security/endpoints.ts", "security/registry.test.ts"],
  },
  "security.ci.11.database-operation-no-trace": {
    status: "verified",
    evidence: ["security/database-operations.ts", "security/registry.test.ts"],
  },
  "security.security-trace-contract.ci-validation": {
    status: "verified",
    evidence: [
      "security/registry.test.ts",
      "scripts/run-unit-tests.ts",
      "package.json",
      ".github/workflows/ci.yml",
    ],
  },
  "security.registry-governance.machine-readable": {
    status: "verified",
    evidence: [
      "security/endpoints.ts",
      "security/traces.ts",
      "security/database-operations.ts",
      "security/third-parties.ts",
      "security/registry.test.ts",
    ],
  },
  "security.application-log-field.service": {
    status: "verified",
    evidence: [
      "src/lib/logger.ts",
      "src/lib/logger.test.ts",
      "scripts/structured-logging-policy.ts",
      "scripts/structured-logging-policy.test.ts",
      "package.json",
    ],
  },
  "security.input-validation.enum": {
    status: "partially-verified",
    evidence: [
      "src/app/admin/admin-status-contract.test.ts",
      "src/app/admin/admin-input-contract.test.ts",
    ],
  },
  "security.administration-control.last-admin": {
    status: "partially-verified",
    evidence: [
      "src/lib/admin-access-contract.ts",
      "src/lib/admin-access-contract.test.ts",
      "src/lib/admin-service.ts",
      "src/lib/account-service.ts",
      "src/lib/account-deletion.test.ts",
    ],
  },
  "security.threat-administration.last-administrator-removal": {
    status: "partially-verified",
    evidence: [
      "src/lib/admin-access-contract.test.ts",
      "src/lib/admin-service.ts",
      "src/lib/account-service.ts",
      "src/lib/account-deletion.test.ts",
    ],
  },
  "security.endpoint-test-authorization.administrator-only-action-as-moderator":
    {
      status: "partially-verified",
      evidence: ["src/app/admin/admin-nav-data.test.ts"],
    },
  "security.authentication-control.redirect-allowlist": {
    status: "verified",
    evidence: ["src/lib/workos-redirect.test.ts"],
  },
  "security.authorization-actor.design-lab": {
    status: "verified",
    evidence: [
      "src/lib/design-lab-access-policy.test.ts",
      "src/components/design-lab-route-safety.test.ts",
    ],
  },
  "security.migration-review.forward": {
    status: "partially-verified",
    evidence: [
      "prisma/migrations/migration_lock.toml",
      "scripts/check-database-migration-replay.ts",
      "scripts/check-database-migration-replay.test.ts",
      "output/database-audit/migration-replay.json",
      "docs/security/database-migration-replay.md",
    ],
  },
  "security.migration-review.access-control": {
    status: "partially-verified",
    evidence: [
      "scripts/check-database-migration-replay.ts",
      "scripts/audit-local-postgres-catalog.ts",
      "output/database-audit/migration-replay.json",
      "output/database-audit/isolated-runtime-catalog.json",
      "docs/security/database-migration-replay.md",
    ],
  },
  "security.row-level-security.defense-in-depth": {
    status: "partially-verified",
    evidence: [
      "scripts/audit-local-postgres-catalog.ts",
      "scripts/audit-local-postgres-catalog.test.ts",
      "output/database-audit/isolated-runtime-catalog.json",
      "security/database-operations.ts",
    ],
  },
  "security.row-level-security.role-tests": {
    status: "partially-verified",
    evidence: [
      "scripts/audit-local-postgres-catalog.ts",
      "scripts/audit-local-postgres-catalog.test.ts",
      "output/database-audit/isolated-runtime-catalog.json",
      "docs/security/database-migration-replay.md",
    ],
  },
  "security.server-authority.blocks": {
    status: "partially-verified",
    evidence: [
      "src/lib/realtime-service.ts",
      "src/lib/realtime-authorization.test.ts",
    ],
  },
  "security.object-authorization.conversation-id": {
    status: "partially-verified",
    evidence: ["src/lib/realtime-authorization.test.ts"],
  },
  "security.threat-messaging.presence-leakage": {
    status: "verified",
    evidence: [
      "src/lib/realtime-service.ts",
      "src/lib/realtime-authorization.test.ts",
      "src/components/hub/hub-friends-list.tsx",
      "src/components/hub/friends-polish-contract.test.ts",
    ],
  },
  "security.billing-control.server-plan": {
    status: "verified",
    evidence: [
      "src/lib/billing/stripe-readiness.test.ts",
      "src/lib/billing/stripe-webhook-settlement.test.ts",
    ],
  },
  "security.billing-control.no-client-price": {
    status: "verified",
    evidence: ["src/lib/billing/stripe-webhook-settlement.test.ts"],
  },
  "security.billing-control.no-client-entitlement": {
    status: "verified",
    evidence: ["src/lib/billing/stripe-webhook-settlement.test.ts"],
  },
  "security.billing-control.return-informational": {
    status: "verified",
    evidence: [
      "src/lib/billing/stripe-webhook-settlement.test.ts",
      "src/lib/billing/stripe-readiness.test.ts",
      "src/app/account/billing/page.tsx",
      "src/components/design-lab-release-workflow.test.ts",
    ],
  },
  "security.billing-control.authoritative-state": {
    status: "verified",
    evidence: [
      "src/lib/billing/stripe-webhook-settlement.test.ts",
      "src/lib/billing/stripe-readiness.test.ts",
      "src/lib/billing/stripe-webhooks.ts",
      "src/app/api/webhooks/stripe/route.ts",
    ],
  },
  "security.billing-control.no-failure-entitlement": {
    status: "verified",
    evidence: ["src/lib/billing/stripe-webhook-settlement.test.ts"],
  },
  "security.third-party-prohibition.browser-payment": {
    status: "verified",
    evidence: [
      "src/lib/billing/stripe-webhook-settlement.test.ts",
      "src/lib/billing/stripe-readiness.test.ts",
      "src/app/account/billing/page.tsx",
    ],
  },
  "security.threat-design-lab.public-indexing": {
    status: "verified",
    evidence: ["src/components/design-lab-route-safety.test.ts"],
  },
  "security.threat-design-lab.production-enablement": {
    status: "verified",
    evidence: ["src/components/design-lab-route-safety.test.ts"],
  },
  "security.threat-design-lab.authentication-bypass-leaking-into-production-code":
    {
      status: "partially-verified",
      evidence: [
        "src/lib/design-lab-access.ts",
        "src/lib/design-lab-access-policy.test.ts",
        "src/components/design-lab-route-safety.test.ts",
      ],
    },
  "security.threat-design-lab.production-data-access": {
    status: "partially-verified",
    evidence: ["src/lib/demo-production-isolation.test.ts"],
  },
  "security.threat-design-lab.production-mutations": {
    status: "partially-verified",
    evidence: [
      "src/components/design-lab-release-gate.test.ts",
      "src/components/design-lab-local-production-gate.test.ts",
    ],
  },
  "security.ci.25.design-lab-indexable": {
    status: "verified",
    evidence: ["src/components/design-lab-route-safety.test.ts"],
  },
  "security.supply-chain-control.dependency-inventory": {
    status: "verified",
    evidence: [
      "package-lock.json",
      "scripts/check-supply-chain-policy.ts",
      "scripts/check-supply-chain-policy.test.ts",
    ],
  },
  "security.supply-chain-control.lockfiles": {
    status: "verified",
    evidence: [
      "package-lock.json",
      "scripts/check-supply-chain-policy.ts",
      "scripts/check-supply-chain-policy.test.ts",
    ],
  },
  "security.supply-chain-control.software-bill-of-materials": {
    status: "verified",
    evidence: [
      "scripts/check-supply-chain-policy.ts",
      "scripts/check-supply-chain-policy.test.ts",
      "docs/security/supply-chain-review.md",
    ],
  },
  "security.supply-chain-control.dependency-vulnerability-scanning": {
    status: "verified",
    evidence: [
      ".github/workflows/ci.yml",
      "scripts/check-supply-chain-policy.ts",
      "scripts/check-supply-chain-policy.test.ts",
      "docs/security/supply-chain-review.md",
    ],
  },
  "security.supply-chain-control.secret-scanning": {
    status: "verified",
    evidence: [
      ".github/workflows/ci.yml",
      "scripts/check-supply-chain-policy.ts",
      "scripts/check-supply-chain-policy.test.ts",
    ],
  },
  "security.supply-chain-control.static-application-security-testing": {
    status: "verified",
    evidence: [
      ".github/workflows/ci.yml",
      "scripts/check-supply-chain-policy.ts",
      "docs/security/supply-chain-review.md",
    ],
  },
  "security.supply-chain-control.artifact-integrity": {
    status: "verified",
    evidence: [
      "package-lock.json",
      ".github/workflows/cloud-run-deploy.yml",
      "scripts/check-supply-chain-policy.ts",
      "scripts/check-supply-chain-policy.test.ts",
      "docs/security/supply-chain-review.md",
    ],
  },
  "security.ci.23.unresolved-release-blocking-dependency": {
    status: "verified",
    evidence: [
      ".github/workflows/ci.yml",
      "scripts/check-supply-chain-policy.ts",
      "scripts/check-supply-chain-policy.test.ts",
      "docs/security/supply-chain-review.md",
    ],
  },
  // This executable CI authority supersedes the legacy partial admin record
  // above and also keeps the Design Lab mutation-free.
  ...CI_ACCESS_ISOLATION_MASTER_EVIDENCE,
  // This spread is deliberately after the legacy partial records above. The
  // source-bound loopback matrix is the current RLS evidence authority.
  ...ROW_LEVEL_SECURITY_MASTER_EVIDENCE,
  // This authority closes only properties exercised as the ordinary runtime
  // role. Distinct specialist-role requirements intentionally remain open.
  ...DATABASE_ROLE_SEPARATION_MASTER_EVIDENCE,
  // Threat-model completion records are deliberately last: they verify that
  // each threat is modeled while the linked records retain unresolved control
  // status and release actions. They do not claim those controls are fixed.
  ...THREAT_MODEL_COVERAGE_MASTER_EVIDENCE,
  // A reviewed surface can remain blocked or unverified operationally. These
  // records close the review obligation, not the corresponding control gate.
  ...INFRASTRUCTURE_REVIEW_MASTER_EVIDENCE,
};
