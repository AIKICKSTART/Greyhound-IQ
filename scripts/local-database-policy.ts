const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function assertLocalDatabaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("LOCAL_DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !LOOPBACK_HOSTS.has(url.hostname)
  ) {
    throw new Error(
      `LOCAL_DATABASE_URL must use loopback PostgreSQL; refused ${maskDatabaseUrl(value)}`
    );
  }
}

export function maskDatabaseUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.username) url.username = "***";
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    return "<invalid-url>";
  }
}
