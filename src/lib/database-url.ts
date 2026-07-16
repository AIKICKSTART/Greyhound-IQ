type DatabaseUrlDefaults = {
  connectionLimit?: string;
  poolTimeout?: string;
  connectTimeout?: string;
};

type DatabaseUrlPolicy = {
  production?: boolean;
  required?: boolean;
  allowManagedSupabase?: boolean;
};

export function runtimeDatabaseUrl(rawUrl: string, defaults: DatabaseUrlDefaults = {}) {
  try {
    const url = new URL(rawUrl);
    const isSupabasePooler = isSupabasePoolerUrl(url);
    const isSupavisorTransactionPooler = isSupabasePooler && url.port === "6543";
    const isAlloyDbManagedPooler = url.port === "6432";

    if (
      (isSupavisorTransactionPooler || isAlloyDbManagedPooler) &&
      !url.searchParams.has("pgbouncer")
    ) {
      url.searchParams.set("pgbouncer", "true");
    }
    if (
      (isSupabasePooler || isAlloyDbManagedPooler) &&
      !url.searchParams.has("sslmode")
    ) {
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

export function databaseUrlConfigurationError(
  rawUrl: string | undefined,
  policy: DatabaseUrlPolicy = {}
) {
  const value = rawUrl?.trim() ?? "";
  if (!value) {
    return policy.required ? "must be set" : null;
  }
  if (!value.startsWith("postgresql://") && !value.startsWith("postgres://")) {
    return "must start with postgresql:// or postgres://";
  }

  try {
    const host = new URL(value).hostname.toLowerCase();
    if (
      policy.production &&
      !policy.allowManagedSupabase &&
      isManagedSupabaseDatabaseHost(host)
    ) {
      return "must point at the approved PostgreSQL database, such as AlloyDB, not a managed Supabase database host";
    }
    return null;
  } catch {
    return "must be a valid Postgres URL";
  }
}

function isSupabasePoolerUrl(url: URL) {
  return /(^|\.)pooler\.supabase\.com$/i.test(url.hostname);
}

function isManagedSupabaseDatabaseHost(host: string) {
  return (
    host.endsWith(".supabase.co") ||
    host.endsWith(".supabase.com") ||
    host.endsWith(".pooler.supabase.com")
  );
}
