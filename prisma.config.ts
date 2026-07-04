import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";
import { runtimeDatabaseUrl } from "./src/lib/database-url";

loadEnvConfig(process.cwd());

const cliDatabaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const baseConfig = {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
};

export default defineConfig(
  cliDatabaseUrl
    ? {
        ...baseConfig,
        engine: "classic" as const,
        datasource: {
          url: runtimeDatabaseUrl(cliDatabaseUrl, { connectionLimit: "1" }),
        },
      }
    : baseConfig
);
