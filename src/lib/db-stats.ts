import { Prisma } from "@prisma/client";
import { safeQuery } from "@/lib/db";
import { withDbSystemContext } from "@/lib/db-context";

export async function getApproximateTableCounts(tableNames: string[]) {
  const rows = await safeQuery(
    () =>
      withDbSystemContext((tx) => tx.$queryRaw<{ tableName: string; estimate: number }[]>`
        SELECT c.relname AS "tableName",
               ROUND(GREATEST(c.reltuples, 0))::double precision AS estimate
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname IN (${Prisma.join(tableNames)})
      `),
    []
  );

  return new Map(
    rows.map((row) => [row.tableName, Math.max(0, Math.round(row.estimate))])
  );
}
