import "./load-env";

import { PrismaClient } from "@prisma/client";
import { runtimeDatabaseUrl } from "../src/lib/database-url";

type IndexDefinition = {
  name: string;
  table: string;
  columns: string[];
};

const indexes: IndexDefinition[] = [
  { name: "Dog_trainerId_idx", table: "Dog", columns: ["trainerId"] },
  { name: "Runner_trainerId_idx", table: "Runner", columns: ["trainerId"] },
  {
    name: "FormEntry_trackId_date_idx",
    table: "FormEntry",
    columns: ["trackId", "date"],
  },
  {
    name: "DogOwnership_profileId_status_createdAt_idx",
    table: "DogOwnership",
    columns: ["profileId", "status", "createdAt"],
  },
  {
    name: "DogOwnership_reviewedByProfileId_idx",
    table: "DogOwnership",
    columns: ["reviewedByProfileId"],
  },
  {
    name: "OrganizationInvitation_invitedByUserId_idx",
    table: "OrganizationInvitation",
    columns: ["invitedByUserId"],
  },
  {
    name: "Thread_authorId_createdAt_idx",
    table: "Thread",
    columns: ["authorId", "createdAt"],
  },
  {
    name: "Post_authorId_createdAt_idx",
    table: "Post",
    columns: ["authorId", "createdAt"],
  },
  {
    name: "Listing_dogId_status_createdAt_idx",
    table: "Listing",
    columns: ["dogId", "status", "createdAt"],
  },
  {
    name: "Report_reportedId_createdAt_idx",
    table: "Report",
    columns: ["reportedId", "createdAt"],
  },
  {
    name: "CallInvite_callRoomId_toProfileId_status_createdAt_idx",
    table: "CallInvite",
    columns: ["callRoomId", "toProfileId", "status", "createdAt"],
  },
];

const rawDatabaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";
if (!rawDatabaseUrl.startsWith("postgresql://") && !rawDatabaseUrl.startsWith("postgres://")) {
  throw new Error("DIRECT_URL or DATABASE_URL must be a Postgres URL");
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: runtimeDatabaseUrl(rawDatabaseUrl, {
        connectionLimit: "1",
        poolTimeout: "60",
        connectTimeout: "30",
      }),
    },
  },
});

main()
  .catch((error) => {
    console.error("Concurrent index preparation failed:");
    console.error(String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

async function main() {
  const tableRows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT tablename AS table_name
    FROM pg_tables
    WHERE schemaname = 'public'
  `;
  const availableTables = new Set(tableRows.map((row) => row.table_name));
  const columnRows = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `;
  const availableColumns = new Set(
    columnRows.map((row) => `${row.table_name}.${row.column_name}`),
  );

  for (const index of indexes) {
    if (!availableTables.has(index.table)) {
      console.log(`Skipping ${index.name}: table ${index.table} does not exist yet.`);
      continue;
    }
    const missingColumns = index.columns.filter(
      (column) => !availableColumns.has(`${index.table}.${column}`),
    );
    if (missingColumns.length > 0) {
      console.log(
        `Skipping ${index.name}: columns not migrated yet (${missingColumns.join(", ")}).`,
      );
      continue;
    }

    if (await isInvalidIndex(index.name)) {
      console.log(`Removing interrupted index ${index.name}.`);
      await prisma.$executeRawUnsafe(`DROP INDEX CONCURRENTLY IF EXISTS "${index.name}"`);
    }

    console.log(`Preparing ${index.name}.`);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${quoteIdentifier(index.name)} ON ${quoteIdentifier(index.table)}(${index.columns.map(quoteIdentifier).join(", ")})`,
    );

    if (await isInvalidIndex(index.name)) {
      throw new Error(`Index ${index.name} exists but is not valid`);
    }
  }

  console.log("Concurrent database index preparation passed.");
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function isInvalidIndex(name: string) {
  const rows = await prisma.$queryRaw<Array<{ is_valid: boolean }>>`
    SELECT i.indisvalid AS is_valid
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ${name}
  `;

  return rows.length > 0 && rows[0]?.is_valid === false;
}
