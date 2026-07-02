type DatabaseUrlDefaults = {
  connectionLimit?: string;
  poolTimeout?: string;
  connectTimeout?: string;
};

export function runtimeDatabaseUrl(rawUrl: string, defaults: DatabaseUrlDefaults = {}) {
  try {
    const url = new URL(rawUrl);
    const isSupabasePooler = isSupabasePoolerUrl(url);
    const isSupavisorTransactionPooler = isSupabasePooler && url.port === "6543";

    if (isSupavisorTransactionPooler && !url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
    }
    if (isSupabasePooler && !url.searchParams.has("sslmode")) {
      url.searchParams.set("sslmode", "require");
    }
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", defaults.connectionLimit ?? "1");
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", defaults.poolTimeout ?? "10");
    }
    if (!url.searchParams.has("connect_timeout")) {
      url.searchParams.set("connect_timeout", defaults.connectTimeout ?? "15");
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function normalizeDatabaseEnv(
  env: NodeJS.ProcessEnv = process.env,
  defaults: DatabaseUrlDefaults = {}
) {
  if (env.DATABASE_URL) {
    env.DATABASE_URL = runtimeDatabaseUrl(env.DATABASE_URL, defaults);
  }
  if (env.DIRECT_URL) {
    env.DIRECT_URL = runtimeDatabaseUrl(env.DIRECT_URL, defaults);
  }
}

function isSupabasePoolerUrl(url: URL) {
  return /(^|\.)pooler\.supabase\.com$/i.test(url.hostname);
}
