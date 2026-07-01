import { loadEnvConfig } from "@next/env";

import { normalizeDatabaseEnv } from "../src/lib/database-url";

loadEnvConfig(process.cwd());

const importDefaults = {
  connectionLimit: process.env.DATABASE_IMPORT_CONNECTION_LIMIT?.trim() || "1",
  poolTimeout: process.env.DATABASE_IMPORT_POOL_TIMEOUT?.trim() || "60",
  connectTimeout: process.env.DATABASE_IMPORT_CONNECT_TIMEOUT?.trim() || "30",
};
const importDatabaseUrl = process.env.DATABASE_IMPORT_URL?.trim();
if (importDatabaseUrl) {
  process.env.DATABASE_URL = importDatabaseUrl;
}

normalizeDatabaseEnv(process.env, importDefaults);
