import type { FamilyScreenManifest } from "./types";

export const PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-ADMIN-CORE-INTERACTIONS",
  path: "src/components/screen-contracts/production-screen-admin-core-interactions.test.ts",
} as const;

const TEST_IDS = [
  PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_EVIDENCE_TEST.id,
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

export const PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_ROUTES = [
  "/admin",
  "/admin/bespoke",
  "/admin/page-rules",
  "/admin/site-content",
] as const;

export const PRODUCTION_SCREEN_ADMIN_CORE_INTERACTION_CONTRACTS = {
  "/admin": {
    queryParameters: [],
    actions: [
      action(
        "ADMIN.ACTION.QUEUE.OPEN",
        "Opens a selected moderation, ownership, or support queue from the needs-attention summary.",
        "The dashboard requires moderator access, redirects a non-admin moderator to /admin/reports, then requires the admin profile; queue destinations are fixed same-origin admin routes.",
      ),
      action(
        "ADMIN.ACTION.SOURCE-HEALTH.OPEN",
        "Opens source health when no data-source status is available.",
        "The empty-source branch uses the fixed same-origin /admin/source-health destination after the dashboard's admin-only access checks.",
      ),
      action(
        "ADMIN.ACTION.SECTION.OPEN",
        "Opens a selected administration section from the dashboard directory.",
        "Section links come from adminNavForRole for the authenticated admin and use the registry's fixed same-origin destinations.",
      ),
    ],
    forms: [],
  },
  "/admin/bespoke": {
    queryParameters: [],
    actions: [
      action(
        "ADMIN-BESPOKE.ACTION.REQUEST.UPDATE",
        "Updates the status and fulfilment notes for a loaded bespoke-design request.",
        "updateBespokeRequestAction requires a moderator profile, parses the loaded identifier, allowlisted status, and notes up to 2000 characters, then writes through the request context and records an admin audit event.",
      ),
    ],
    forms: [
      form(
        "ADMIN-BESPOKE.FORM.REQUEST-UPDATE",
        "SERVER ACTION updateBespokeRequestAction",
        "id:loaded-request-id,status:paid|in_progress|delivered|cancelled,notes?:string(max2000)",
      ),
    ],
  },
  "/admin/page-rules": {
    queryParameters: [],
    actions: [
      action(
        "ADMIN-PAGE-RULES.ACTION.UPDATE",
        "Updates the five custom-page, marketplace, and card-generation platform flags.",
        "updatePageRulesAction requires the admin profile, coerces only the fixed checkbox names, and setPlatformFlag writes each value through the request context with an admin audit event.",
      ),
    ],
    forms: [
      form(
        "ADMIN-PAGE-RULES.FORM.UPDATE",
        "SERVER ACTION updatePageRulesAction",
        "requirePro:boolean,requireApprovedOwnership:boolean,requireRegisteredDog:boolean,enforceDogPageLimit:boolean,cardGenerationEnabled:boolean",
      ),
    ],
  },
  "/admin/site-content": {
    queryParameters: [],
    actions: [
      action(
        "ADMIN-SITE-CONTENT.ACTION.PRICING.UPDATE",
        "Updates the public pricing-page copy for the fixed Free, Pro, and Pro+ plans.",
        "updatePricingContentAction requires the admin profile, builds only the fixed pricing-plan identifiers, normalises content before a request-context upsert, records an admin audit event, and revalidates /pricing.",
      ),
    ],
    forms: [
      form(
        "ADMIN-SITE-CONTENT.FORM.PRICING-UPDATE",
        "SERVER ACTION updatePricingContentAction",
        "plans:fixed(free|pro|pro_plus){name,price,period,description,features[],notIncluded[],cta,highlighted:boolean},yearlyNote:string",
      ),
    ],
  },
} as const satisfies Readonly<Record<string, InteractionContract>>;
