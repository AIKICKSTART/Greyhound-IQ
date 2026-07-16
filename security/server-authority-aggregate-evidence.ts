import { FRONTEND_AUTHORIZATION_MASTER_EVIDENCE } from "./frontend-authorization-evidence";

export const SERVER_AUTHORITY_AGGREGATE_REQUIREMENT_IDS = [
  "security.server-authority.client-usability-only",
  "security.release.04.protected-endpoints-server-authn",
] as const;

export type ServerAuthorityAggregateFacts = Readonly<{
  serverDenial: boolean;
  directApi: boolean;
  alternateRoutes: boolean;
  staleEntitlement: boolean;
  browserState: boolean;
  hiddenFields: boolean;
}>;

export const SERVER_AUTHORITY_AGGREGATE_FACTS: ServerAuthorityAggregateFacts = {
  serverDenial: hasEvidence("security.frontend-authorization.server-denial"),
  directApi: hasEvidence("security.frontend-authorization.direct-api"),
  alternateRoutes: hasEvidence(
    "security.frontend-authorization.alternate-routes",
  ),
  staleEntitlement: hasEvidence(
    "security.frontend-authorization.stale-entitlement",
  ),
  browserState: hasEvidence("security.frontend-authorization.browser-state"),
  hiddenFields: hasEvidence("security.frontend-authorization.hidden-fields"),
};

const EVIDENCE = [
  "security/server-authority-aggregate-evidence.ts",
  "security/server-authority-aggregate-evidence.test.ts",
  "security/frontend-authorization-evidence.ts",
  "security/frontend-authorization-evidence.test.ts",
  "security/endpoints.ts",
] as const;

export function buildServerAuthorityAggregateMasterEvidence(
  facts: ServerAuthorityAggregateFacts,
) {
  if (!Object.values(facts).every(Boolean)) return {};

  return Object.fromEntries(
    SERVER_AUTHORITY_AGGREGATE_REQUIREMENT_IDS.map((requirementId) => [
      requirementId,
      { status: "verified" as const, evidence: EVIDENCE },
    ]),
  );
}

export const SERVER_AUTHORITY_AGGREGATE_MASTER_EVIDENCE =
  buildServerAuthorityAggregateMasterEvidence(SERVER_AUTHORITY_AGGREGATE_FACTS);

function hasEvidence(
  requirementId: keyof typeof FRONTEND_AUTHORIZATION_MASTER_EVIDENCE,
) {
  return FRONTEND_AUTHORIZATION_MASTER_EVIDENCE[requirementId].status === "verified";
}
