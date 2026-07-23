import type { ProductMasterRequirementStatus } from "./product-master-requirements";

export const PRODUCT_BREAKPOINT_LINK_CRAWL_EVIDENCE_FILE =
  "src/components/product-breakpoint-link-crawl-evidence.ts" as const;
export const PRODUCT_BREAKPOINT_LINK_CRAWL_TEST_FILE =
  "src/components/product-breakpoint-link-crawl-evidence.test.ts" as const;

export const PRODUCT_BREAKPOINT_LINK_CRAWL_REQUIREMENT_ID =
  "DISC.CRAWL.breakpoint-links" as const;

export const PRODUCT_BREAKPOINT_LINK_CRAWL_SCOPE =
  "Deterministic local source-crawl verification that all three discovered production-owned internal JSX links whose own or ancestor class source changes visibility at a responsive breakpoint remain included as exact route/source/target rows. The three source links belong to /feed and cover three internal targets; one carries a link-level condition, two inherit ancestor conditions, and all three rows include lg conditions. Responsive visibility requires an explicit breakpoint hide/invisible token or a base hidden/invisible token paired with a breakpoint reveal/display token. This closes only source-static inclusion of breakpoint-conditioned links; it does not prove rendered CSS, dynamic class values, browser viewport behaviour, destination behaviour, external links, deployed crawling, or production readiness.";

export type ProductBreakpointLinkVisibilitySource = {
  origin: "ancestor" | "link";
  sourceLine: number;
  classSource: string;
  classTokens: readonly string[];
};

export type ProductBreakpointLinkCrawlRecord = {
  id: string;
  sourceRoute: string;
  sourceFile: string;
  sourceLine: number;
  sourceColumn: number;
  kind: "jsx-href";
  normalizedTarget: string;
  responsiveVisibilitySources: readonly ProductBreakpointLinkVisibilitySource[];
};

export type ProductBreakpointLinkCrawlIssue = {
  code:
    | "CLASS_SOURCE_BLANK"
    | "DUPLICATE_OBSERVATION"
    | "DUPLICATE_VISIBILITY_SOURCE"
    | "INVALID_KIND"
    | "INVALID_TARGET"
    | "INVALID_VISIBILITY_SOURCE"
    | "OBSERVATION_ID_MISSING"
    | "SOURCE_FILE_INVALID"
    | "SOURCE_POSITION_INVALID"
    | "SOURCE_ROUTE_INVALID"
    | "VISIBILITY_SOURCE_MISSING";
  recordId: string;
};

const RESPONSIVE_TOKEN_PATTERN =
  /^(?:max-)?(?:sm|md|lg|xl|2xl):(?:[a-z-]+:)*(?:hidden|invisible|visible|block|inline|inline-block|flex|inline-flex|grid|contents|table|table-row|table-cell)$/u;
const RESPONSIVE_HIDE_PATTERN =
  /:(?:hidden|invisible)$/u;
const RESPONSIVE_REVEAL_PATTERN =
  /:(?:visible|block|inline|inline-block|flex|inline-flex|grid|contents|table|table-row|table-cell)$/u;

function hasValidResponsiveVisibilityTokens(tokens: readonly string[]) {
  if (
    tokens.length === 0 ||
    tokens.some(
      (token) =>
        !["hidden", "invisible"].includes(token) &&
        !RESPONSIVE_TOKEN_PATTERN.test(token),
    )
  ) {
    return false;
  }
  if (tokens.some((token) => RESPONSIVE_HIDE_PATTERN.test(token))) return true;
  return (
    tokens.some((token) => ["hidden", "invisible"].includes(token)) &&
    tokens.some((token) => RESPONSIVE_REVEAL_PATTERN.test(token))
  );
}

export function findBreakpointLinkCrawlIssues(
  records: readonly ProductBreakpointLinkCrawlRecord[],
): ProductBreakpointLinkCrawlIssue[] {
  const issues: ProductBreakpointLinkCrawlIssue[] = [];
  const seenIds = new Set<string>();

  for (const record of records) {
    const recordId = record.id.trim();
    if (!recordId) {
      issues.push({ code: "OBSERVATION_ID_MISSING", recordId: record.id });
    } else if (seenIds.has(recordId)) {
      issues.push({ code: "DUPLICATE_OBSERVATION", recordId });
    }
    seenIds.add(recordId);

    if (record.kind !== "jsx-href") {
      issues.push({ code: "INVALID_KIND", recordId: record.id });
    }
    if (!record.sourceRoute.startsWith("/")) {
      issues.push({ code: "SOURCE_ROUTE_INVALID", recordId: record.id });
    }
    if (!record.sourceFile.startsWith("src/")) {
      issues.push({ code: "SOURCE_FILE_INVALID", recordId: record.id });
    }
    if (
      !Number.isInteger(record.sourceLine) ||
      record.sourceLine < 1 ||
      !Number.isInteger(record.sourceColumn) ||
      record.sourceColumn < 1
    ) {
      issues.push({ code: "SOURCE_POSITION_INVALID", recordId: record.id });
    }
    if (!record.normalizedTarget.startsWith("/")) {
      issues.push({ code: "INVALID_TARGET", recordId: record.id });
    }
    if (record.responsiveVisibilitySources.length === 0) {
      issues.push({ code: "VISIBILITY_SOURCE_MISSING", recordId: record.id });
    }

    const seenSources = new Set<string>();
    for (const source of record.responsiveVisibilitySources) {
      if (!source.classSource.trim()) {
        issues.push({ code: "CLASS_SOURCE_BLANK", recordId: record.id });
      }
      if (
        !["ancestor", "link"].includes(source.origin) ||
        !Number.isInteger(source.sourceLine) ||
        source.sourceLine < 1 ||
        new Set(source.classTokens).size !== source.classTokens.length ||
        !hasValidResponsiveVisibilityTokens(source.classTokens)
      ) {
        issues.push({ code: "INVALID_VISIBILITY_SOURCE", recordId: record.id });
      }
      const key = `${source.origin}:${source.sourceLine}:${source.classSource}`;
      if (seenSources.has(key)) {
        issues.push({
          code: "DUPLICATE_VISIBILITY_SOURCE",
          recordId: record.id,
        });
      }
      seenSources.add(key);
    }
  }

  return issues;
}

type ProductBreakpointLinkCrawlEvidenceRecord = {
  status: ProductMasterRequirementStatus;
  evidence: readonly string[];
};

export const PRODUCT_BREAKPOINT_LINK_CRAWL_MASTER_EVIDENCE = {
  [PRODUCT_BREAKPOINT_LINK_CRAWL_REQUIREMENT_ID]: {
    status: "tested",
    evidence: [
      PRODUCT_BREAKPOINT_LINK_CRAWL_EVIDENCE_FILE,
      PRODUCT_BREAKPOINT_LINK_CRAWL_TEST_FILE,
      "src/components/product-automated-source-gate-registry.ts",
      "src/components/demo-experience-registry.ts",
    ],
  },
} as const satisfies Readonly<
  Record<string, ProductBreakpointLinkCrawlEvidenceRecord>
>;
