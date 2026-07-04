import "./load-env";

import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";
import { runtimeDatabaseUrl } from "../src/lib/database-url";

const dbUrl = process.env.DATABASE_URL ?? "";
if (!dbUrl.startsWith("postgresql://") && !dbUrl.startsWith("postgres://")) {
  throw new Error("DATABASE_URL must be a Postgres URL");
}

const prisma = new PrismaClient({
  datasources: { db: { url: runtimeDatabaseUrl(dbUrl) } },
});

const iterations = numberEnv("MARKETPLACE_SEARCH_ITERATIONS", 20);
const resultLimit = numberEnv("MARKETPLACE_SEARCH_LIMIT", 24);
const thresholdMs = numberEnv("MARKETPLACE_SEARCH_P95_MS", 250);

main()
  .catch((err) => {
    console.error("Marketplace search benchmark failed:");
    console.error(String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

async function main() {
  const indexNames = await installedSearchIndexes();
  const missingIndexes = [
    "ListingSearchIndex_searchText_fts_idx",
    "ListingSearchIndex_searchText_trgm_idx",
  ].filter((name) => !indexNames.includes(name));
  if (missingIndexes.length > 0) {
    throw new Error(`Missing marketplace search indexes: ${missingIndexes.join(", ")}`);
  }

  const indexedRows = await prisma.listingSearchIndex.count();
  if (indexedRows === 0) {
    console.log("Marketplace search benchmark skipped: no ListingSearchIndex rows.");
    return;
  }

  const queries = await benchmarkQueries();
  if (queries.length === 0) {
    console.log("Marketplace search benchmark skipped: no usable queries.");
    return;
  }

  const timings: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const query = queries[index % queries.length];
    const started = performance.now();
    await searchMarketplaceListings(query, resultLimit);
    timings.push(performance.now() - started);
  }

  timings.sort((a, b) => a - b);
  const p50 = percentile(timings, 0.5);
  const p95 = percentile(timings, 0.95);
  const max = timings[timings.length - 1] ?? 0;

  console.log(
    [
      "Marketplace search benchmark passed.",
      `Indexed rows: ${indexedRows}`,
      `Queries: ${queries.join(", ")}`,
      `Iterations: ${iterations}`,
      `p50: ${p50.toFixed(1)}ms`,
      `p95: ${p95.toFixed(1)}ms`,
      `max: ${max.toFixed(1)}ms`,
      `threshold p95: ${thresholdMs}ms`,
    ].join("\n")
  );

  if (p95 > thresholdMs) {
    throw new Error(`Marketplace search p95 ${p95.toFixed(1)}ms exceeded ${thresholdMs}ms`);
  }
}

async function installedSearchIndexes() {
  const rows = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'ListingSearchIndex'
      AND indexname IN (
        'ListingSearchIndex_searchText_fts_idx',
        'ListingSearchIndex_searchText_trgm_idx'
      )
  `;
  return rows.map((row) => row.indexname);
}

async function benchmarkQueries() {
  const fromEnv = process.env.MARKETPLACE_SEARCH_QUERIES
    ?.split(",")
    .map((query) => query.trim())
    .filter(Boolean);
  if (fromEnv?.length) return fromEnv.slice(0, 12);

  const rows = await prisma.listingSearchIndex.findMany({
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { searchText: true },
  });
  const terms = new Set<string>();
  for (const row of rows) {
    for (const term of row.searchText.split(/\W+/)) {
      const normalized = term.toLowerCase();
      if (normalized.length >= 3) terms.add(normalized);
      if (terms.size >= 8) return [...terms];
    }
  }
  return [...terms];
}

async function searchMarketplaceListings(query: string, limit: number) {
  const trimmed = query.trim().slice(0, 200);
  const likePattern = `%${trimmed.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  const bounded = Math.min(Math.max(Math.trunc(limit), 1), 1000);

  return prisma.$queryRaw<{ listingId: string }[]>`
    WITH search_query AS (
      SELECT websearch_to_tsquery('english', ${trimmed}) AS query
    )
    SELECT search_index."listingId" AS "listingId"
    FROM "ListingSearchIndex" search_index, search_query
    WHERE
      search_query.query @@ to_tsvector('english', COALESCE(search_index."searchText", ''))
      OR search_index."searchText" ILIKE ${likePattern} ESCAPE '\\'
    ORDER BY
      ts_rank_cd(
        to_tsvector('english', COALESCE(search_index."searchText", '')),
        search_query.query
      ) DESC,
      similarity(search_index."searchText", ${trimmed}) DESC,
      search_index."updatedAt" DESC
    LIMIT ${bounded}
  `;
}

function percentile(values: number[], fraction: number) {
  if (values.length === 0) return 0;
  const index = Math.min(
    values.length - 1,
    Math.ceil(values.length * fraction) - 1
  );
  return values[index] ?? 0;
}

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name] ?? "");
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}
