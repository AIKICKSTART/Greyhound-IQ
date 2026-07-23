import { createHash } from "node:crypto";

export const SELECT_STAR_SENSITIVE_RECORD_REQUIREMENT_ID =
  "security.explicit-data-selection.no-select-star";

export type RawSqlSource = Readonly<{
  path: string;
  source: string;
}>;

export type SelectStarProjection = Readonly<{
  path: string;
  line: number;
  projection: string;
  relation: string | null;
  signature: string;
  contextSha256: string;
}>;

export type ReviewedSelectStarProjection = Readonly<{
  path: string;
  signature: string;
  contextSha256: string;
  disposition: string;
}>;

const IDENTIFIER = String.raw`(?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_$]*)`;
const QUALIFIED_IDENTIFIER = `${IDENTIFIER}(?:\s*\.\s*${IDENTIFIER})*`;

export const REVIEWED_SELECT_STAR_PROJECTIONS = [
  {
    path: "src/lib/feed-service.ts",
    signature: "SELECT ranked.* FROM ranked",
    contextSha256: "f009f2f6454ced8cfd22c8e059d5d35de9c9b2e31d47a2da9e7fb76bb0fb4a0c",
    disposition:
      "This exact internal CTE projection is accepted because both UNION branches explicitly construct only the RankedFeedRow fields; it is not a star selection from a database table or sensitive record. Any CTE context change invalidates the review digest.",
  },
  {
    path: "src/lib/queries.ts",
    signature: "SELECT *",
    contextSha256: "5f3acfcd3c2d9d98fb5e8060a83d2fed1b13b359a8c02b3aa3e2f99752902d52",
    disposition:
      "This exact internal scored CTE projection is accepted because race_search explicitly constructs the bounded race-search working fields and the outer query returns only id; it is not a table or sensitive-record star. Any CTE context change invalidates the review digest.",
  },
] as const satisfies readonly ReviewedSelectStarProjection[];

export function auditSelectStarSensitiveRecords(
  sources: readonly RawSqlSource[],
  reviews: readonly ReviewedSelectStarProjection[] =
    REVIEWED_SELECT_STAR_PROJECTIONS,
) {
  const issues: string[] = [];
  const records: SelectStarProjection[] = [];
  const paths = new Set<string>();
  let rawQueryPrimitiveCount = 0;

  if (sources.length < 1) issues.push("SELECT_STAR_SOURCE_INVENTORY_VACUOUS");
  for (const source of sources.toSorted((left, right) =>
    left.path.localeCompare(right.path),
  )) {
    if (!source.path || paths.has(source.path)) {
      issues.push(`SELECT_STAR_SOURCE_PATH_INVALID:${source.path || "missing"}`);
      continue;
    }
    paths.add(source.path);
    const primitiveCount = [
      ...source.source.matchAll(
        /\$(?:queryRaw|executeRaw)(?:Unsafe)?\b|\bPrisma\.sql\b/gu,
      ),
    ].length;
    rawQueryPrimitiveCount += primitiveCount;
    if (primitiveCount < 1) {
      issues.push(`SELECT_STAR_SOURCE_WITHOUT_RAW_SQL:${source.path}`);
    }

    const sql = maskComments(source.source);
    const pattern = new RegExp(
      `(?:\\bSELECT\\b|,)\\s*(?:DISTINCT\\s+|ALL\\s+)?((?:${IDENTIFIER}\\s*\\.\\s*)?\\*)`,
      "giu",
    );
    for (const match of sql.matchAll(pattern)) {
      const projection = match[1].replace(/\s+/gu, "");
      const afterIndex = match.index + match[0].length;
      const fromMatch = sql
        .slice(afterIndex)
        .match(new RegExp(`^\\s+FROM\\s+(${QUALIFIED_IDENTIFIER})`, "iu"));
      const relation = fromMatch ? normalizeIdentifier(fromMatch[1]) : null;
      const signature = `SELECT ${projection}${relation ? ` FROM ${relation}` : ""}`;
      const endIndex = afterIndex + (fromMatch?.[0].length ?? 0);
      records.push({
        path: source.path,
        line: lineAt(sql, match.index),
        projection,
        relation,
        signature,
        contextSha256: sha256(
          projectionContext(sql, match.index, endIndex),
        ),
      });
    }
  }

  if (rawQueryPrimitiveCount < 1) {
    issues.push("SELECT_STAR_RAW_SQL_INVENTORY_VACUOUS");
  }
  validateReviews(records, reviews, issues);

  return {
    issues: [...new Set(issues)].sort(),
    records,
    rawQueryPrimitiveCount,
    sourceCount: paths.size,
  } as const;
}

function validateReviews(
  records: readonly SelectStarProjection[],
  reviews: readonly ReviewedSelectStarProjection[],
  issues: string[],
) {
  const reviewKeys = new Set<string>();
  for (const review of reviews) {
    const key = reviewKey(review.path, review.signature);
    if (reviewKeys.has(key)) {
      issues.push(`SELECT_STAR_REVIEW_DUPLICATE:${key}`);
      continue;
    }
    reviewKeys.add(key);
    if (
      review.disposition.length < 120 ||
      !/\bexact\b/iu.test(review.disposition) ||
      !/\bexplicit/iu.test(review.disposition) ||
      !/\bsensitive\b/iu.test(review.disposition) ||
      !/\bcontext\b/iu.test(review.disposition)
    ) {
      issues.push(`SELECT_STAR_REVIEW_DISPOSITION_INCOMPLETE:${key}`);
    }
  }

  const matchedReviews = new Set<string>();
  for (const record of records) {
    const key = reviewKey(record.path, record.signature);
    const review = reviews.find(
      (candidate) => reviewKey(candidate.path, candidate.signature) === key,
    );
    if (!review) {
      issues.push(`SELECT_STAR_PROJECTION_UNREVIEWED:${record.path}:${record.line}`);
      continue;
    }
    matchedReviews.add(key);
    if (review.contextSha256 !== record.contextSha256) {
      issues.push(`SELECT_STAR_REVIEW_CONTEXT_DRIFT:${record.path}:${record.line}`);
    }
  }
  for (const review of reviews) {
    const key = reviewKey(review.path, review.signature);
    if (!matchedReviews.has(key)) issues.push(`SELECT_STAR_REVIEW_STALE:${key}`);
  }
}

function projectionContext(
  sql: string,
  start: number,
  end: number,
) {
  const prefix = sql.slice(0, start);
  const ctePattern = new RegExp(
    `\\bWITH\\s+${IDENTIFIER}\\s+AS\\s*\\(`,
    "giu",
  );
  const nearest = [...prefix.matchAll(ctePattern)].at(-1);
  if (nearest) return normalizeSql(sql.slice(nearest.index, end));
  return normalizeSql(sql.slice(start, end));
}

function maskComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, (comment) =>
      comment.replace(/[^\n]/gu, " "),
    )
    .replace(/\/\/[^\n]*/gu, (comment) => " ".repeat(comment.length))
    .replace(/--[^\n]*/gu, (comment) => " ".repeat(comment.length));
}

function normalizeIdentifier(value: string) {
  return value.replace(/\s+/gu, "");
}

function normalizeSql(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function reviewKey(path: string, signature: string) {
  return `${path}:${signature}`;
}

function lineAt(source: string, index: number) {
  return source.slice(0, index).split("\n").length;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export const SELECT_STAR_SENSITIVE_RECORD_SCOPE =
  "Every production TypeScript/TSX source containing a Prisma raw-SQL execution or fragment primitive is discovered recursively and scanned for bare or alias-qualified SQL star projections. The two reviewed internal CTE projections are bound to their exact field-construction context digests and are not database-table or sensitive-record stars. ORM result shaping and deployed query capture remain separate gates.";

export const SELECT_STAR_SENSITIVE_RECORD_EVIDENCE = [
  "src/lib/feed-service.ts",
  "security/select-star-sensitive-record-evidence.ts",
  "security/select-star-sensitive-record-evidence.test.ts",
] as const;

export const SELECT_STAR_SENSITIVE_RECORD_MASTER_EVIDENCE = {
  [SELECT_STAR_SENSITIVE_RECORD_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: SELECT_STAR_SENSITIVE_RECORD_EVIDENCE,
  },
} as const;
