import assert from "node:assert/strict";

import {
  buildDatabaseCompatibilityInventory,
  collectDatabaseCompatibilityInventory,
  DATABASE_COMPATIBILITY_BASELINE,
  databaseCompatibilityInventoryDiff,
} from "./check-database-compatibility-inventory";

const schema = `
model Alpha {
  id String @id
}

model Beta {
  id String @id
}
`;
const migrations = [
  {
    path: "prisma/migrations/002_second/migration.sql",
    source: `
      CREATE OR REPLACE FUNCTION public.guard() RETURNS trigger AS $$
      BEGIN RETURN NEW; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER guard_write BEFORE INSERT ON public.alpha
        FOR EACH ROW EXECUTE FUNCTION public.guard();
      CREATE POLICY alpha_read ON public.alpha FOR SELECT USING (true);
      CREATE VIEW public.alpha_public AS SELECT id FROM public.alpha;
      CREATE MATERIALIZED VIEW public.alpha_rollup AS SELECT count(*) FROM public.alpha;
      CREATE UNIQUE INDEX IF NOT EXISTS alpha_id_key ON public.alpha(id);
      DO $$ BEGIN EXECUTE 'CREATE ROLE app_runtime NOLOGIN'; END $$;
    `,
  },
  {
    path: "prisma/migrations/001_first/migration.sql",
    source: `
      -- CREATE EXTENSION fake_comment;
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE OR REPLACE FUNCTION public.guard() RETURNS trigger AS $$
      BEGIN RETURN NEW; END;
      $$ LANGUAGE plpgsql;
      /* CREATE POLICY fake_policy ON public.alpha USING (true); */
      CREATE INDEX alpha_created_idx ON public.alpha(created_at);
    `,
  },
];

const inventory = buildDatabaseCompatibilityInventory(schema, migrations);
assert.deepEqual(inventory.counts, {
  models: 2,
  migrations: 2,
  extensions: 1,
  functions: 1,
  triggers: 1,
  policies: 1,
  ordinaryViews: 1,
  materializedViews: 1,
  indexes: 2,
  createdRoles: 1,
});
assert.match(inventory.schemaSha256, /^[a-f0-9]{64}$/);
assert.match(inventory.migrationsSha256, /^[a-f0-9]{64}$/);

const reorderedWithWindowsLines = buildDatabaseCompatibilityInventory(
  schema.replaceAll("\n", "\r\n"),
  [...migrations]
    .reverse()
    .map((migration) => ({
      ...migration,
      source: migration.source.replaceAll("\n", "\r\n"),
    })),
);
assert.equal(reorderedWithWindowsLines.schemaSha256, inventory.schemaSha256);
assert.equal(
  reorderedWithWindowsLines.migrationsSha256,
  inventory.migrationsSha256,
);

const repositoryInventory = collectDatabaseCompatibilityInventory();
assert.deepEqual(repositoryInventory, DATABASE_COMPATIBILITY_BASELINE);
assert.deepEqual(databaseCompatibilityInventoryDiff(repositoryInventory), []);
assert.match(
  databaseCompatibilityInventoryDiff(
    { ...repositoryInventory, schemaSha256: "changed" },
    repositoryInventory,
  ).join("\n"),
  /schemaSha256/,
);

console.log("Database compatibility inventory tests passed.");
