import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_QUERY_VALIDATION_EVIDENCE_FILE =
  "src/components/product-query-validation-evidence.ts" as const;
export const PRODUCT_QUERY_VALIDATION_TEST_FILE =
  "src/components/product-query-validation-evidence.test.ts" as const;

export const PRODUCT_QUERY_VALIDATION_SCOPE =
  "Focused source-static verification of the 11 previously raw high-impact page and API query boundaries for listing prefills, directory search, feed pagination, comment cursors, message search/thread state, marketplace filters, and messaging-profile search. Every consumed value now passes a strict bounded Zod schema; repeated values fail, pages fall back without reflecting invalid data, and APIs return validation errors. This does not prove hydrated browser behavior, proxy normalization, or deployed traffic handling.";

export const PRODUCT_QUERY_VALIDATION_REQUIREMENT_IDS = [
  "GLOBAL.FUNC.query-validation",
] as const;

export type ProductQueryValidationRequirementId =
  (typeof PRODUCT_QUERY_VALIDATION_REQUIREMENT_IDS)[number];

export const PRODUCT_QUERY_VALIDATION_EXPECTED_GAIN =
  PRODUCT_QUERY_VALIDATION_REQUIREMENT_IDS.length;

export type ProductQueryValidationContract = {
  id: string;
  route: string;
  sourceFile: string;
  schemaSymbol: string;
  parseToken: string;
  failureToken: string;
  behavior: "api-validation-error" | "page-safe-fallback";
};

export const PRODUCT_QUERY_VALIDATION_CONTRACTS = [
  {
    id: "PAGE.LISTINGS.NEW.PREFILL",
    route: "/listings/new",
    sourceFile: "src/app/listings/new/page.tsx",
    schemaSymbol: "listingCreatePrefillQuerySchema",
    parseToken: "listingCreatePrefillQuerySchema.safeParse(",
    failureToken: "parsedPrefill.success ? parsedPrefill.data : {}",
    behavior: "page-safe-fallback",
  },
  {
    id: "PAGE.DISCOVER.SEARCH",
    route: "/discover",
    sourceFile: "src/app/discover/page.tsx",
    schemaSymbol: "directorySearchQuerySchema",
    parseToken: "directorySearchQuerySchema.safeParse(",
    failureToken: 'parsedQuery.success ? parsedQuery.data.q : ""',
    behavior: "page-safe-fallback",
  },
  {
    id: "PAGE.DOGS.SEARCH",
    route: "/dogs",
    sourceFile: "src/app/dogs/page.tsx",
    schemaSymbol: "directorySearchQuerySchema",
    parseToken: "directorySearchQuerySchema.safeParse(",
    failureToken: 'parsedQuery.success ? parsedQuery.data.q : ""',
    behavior: "page-safe-fallback",
  },
  {
    id: "PAGE.MESSAGES.THREAD",
    route: "/messages/[id]",
    sourceFile: "src/app/messages/[id]/page.tsx",
    schemaSymbol: "messageThreadQuerySchema",
    parseToken: "messageThreadQuerySchema.safeParse(",
    failureToken: 'parsedQuery.success ? parsedQuery.data.q : ""',
    behavior: "page-safe-fallback",
  },
  {
    id: "API.FEED.PAGE",
    route: "/api/feed",
    sourceFile: "src/app/api/feed/route.ts",
    schemaSymbol: "feedPageQuerySchema",
    parseToken: "feedPageQuerySchema.parse(",
    failureToken: 'jsonError(err, "Could not load feed")',
    behavior: "api-validation-error",
  },
  {
    id: "API.FEED.COMMENTS.PAGE",
    route: "/api/feed/[postId]/comments",
    sourceFile: "src/app/api/feed/[postId]/comments/route.ts",
    schemaSymbol: "feedCommentPageQuerySchema",
    parseToken: "feedCommentPageQuerySchema.parse(",
    failureToken: 'jsonError(err, "Could not load feed comments")',
    behavior: "api-validation-error",
  },
  {
    id: "API.DOGS.SEARCH",
    route: "/api/dogs/search",
    sourceFile: "src/app/api/dogs/search/route.ts",
    schemaSymbol: "directorySearchQuerySchema",
    parseToken: "directorySearchQuerySchema.safeParse(",
    failureToken: 'code: "validation.invalid"',
    behavior: "api-validation-error",
  },
  {
    id: "API.DISCOVER.SEARCH",
    route: "/api/discover",
    sourceFile: "src/app/api/discover/route.ts",
    schemaSymbol: "directorySearchQuerySchema",
    parseToken: "directorySearchQuerySchema.parse(",
    failureToken: 'jsonError(err, "Could not search discovery")',
    behavior: "api-validation-error",
  },
  {
    id: "API.MESSAGES.SEARCH",
    route: "/api/conversations/[id]/search",
    sourceFile: "src/app/api/conversations/[id]/search/route.ts",
    schemaSymbol: "messageSearchQuerySchema",
    parseToken: "messageSearchQuerySchema.parse(",
    failureToken: 'jsonError(err, "Could not search messages")',
    behavior: "api-validation-error",
  },
  {
    id: "API.LISTINGS.SEARCH",
    route: "/api/listings",
    sourceFile: "src/app/api/listings/route.ts",
    schemaSymbol: "listingApiQuerySchema",
    parseToken: "listingApiQuerySchema.parse(",
    failureToken: 'jsonError(err, "Could not load listings")',
    behavior: "api-validation-error",
  },
  {
    id: "API.PROFILES.MESSAGING.SEARCH",
    route: "/api/profiles/messaging",
    sourceFile: "src/app/api/profiles/messaging/route.ts",
    schemaSymbol: "directorySearchQuerySchema",
    parseToken: "directorySearchQuerySchema.parse(",
    failureToken: 'jsonError(err, "Could not search profiles")',
    behavior: "api-validation-error",
  },
] as const satisfies readonly ProductQueryValidationContract[];

export function findProductQueryValidationIssues(
  contracts: readonly ProductQueryValidationContract[],
) {
  const issues: string[] = [];
  const seen = new Set<string>();

  for (const item of contracts) {
    if (seen.has(item.id)) issues.push(`${item.id}:DUPLICATE`);
    seen.add(item.id);
    if (!item.route.startsWith("/")) issues.push(`${item.id}:INVALID_ROUTE`);
    if (!item.sourceFile || !item.schemaSymbol || !item.parseToken) {
      issues.push(`${item.id}:VALIDATION_BINDING_MISSING`);
    }
    if (!item.failureToken) issues.push(`${item.id}:FAILURE_BEHAVIOR_MISSING`);
  }

  return issues.toSorted();
}

type ProductQueryValidationEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_QUERY_VALIDATION_MASTER_EVIDENCE = {
  "GLOBAL.FUNC.query-validation": {
    status: "tested",
    evidence: [
      PRODUCT_QUERY_VALIDATION_EVIDENCE_FILE,
      PRODUCT_QUERY_VALIDATION_TEST_FILE,
      "src/lib/query-validation.ts",
      "src/lib/query-validation.test.ts",
      ...PRODUCT_QUERY_VALIDATION_CONTRACTS.map(({ sourceFile }) => sourceFile),
    ].filter((path, index, paths) => paths.indexOf(path) === index),
  },
} as const satisfies Readonly<
  Record<ProductQueryValidationRequirementId, ProductQueryValidationEvidenceRecord>
>;
