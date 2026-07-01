import { loadEnvConfig } from "@next/env";

import { normalizeDatabaseEnv } from "../src/lib/database-url";

loadEnvConfig(process.cwd());
normalizeDatabaseEnv();
