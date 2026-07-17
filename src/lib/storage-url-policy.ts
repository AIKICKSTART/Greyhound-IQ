export type SupabaseStorageUrlEnvironment = {
  readonly NODE_ENV?: string;
  readonly SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
};

const MAX_SIGNED_STORAGE_URL_LENGTH = 8_192;

export function assertTrustedSupabaseStorageUrl(
  value: string,
  env: SupabaseStorageUrlEnvironment = process.env,
) {
  if (!value || value.length > MAX_SIGNED_STORAGE_URL_LENGTH) {
    throw new Error("storage.untrusted_provider_url");
  }

  const configured = configuredSupabaseUrl(env);
  let candidate: URL;
  try {
    candidate = new URL(value);
  } catch {
    throw new Error("storage.untrusted_provider_url");
  }

  if (
    candidate.origin !== configured.origin ||
    candidate.username ||
    candidate.password ||
    candidate.hash ||
    !candidate.pathname.startsWith("/storage/v1/")
  ) {
    throw new Error("storage.untrusted_provider_url");
  }

  return candidate;
}

export function shouldPinSupabaseStorageDns(
  value: string | URL,
  env: SupabaseStorageUrlEnvironment = process.env,
) {
  const url = typeof value === "string" ? new URL(value) : value;
  return !isLoopbackHostname(url.hostname) || env.NODE_ENV === "production";
}

function configuredSupabaseUrl(env: SupabaseStorageUrlEnvironment) {
  const value = env.SUPABASE_URL?.trim() || env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value || value.includes("YOUR_PROJECT_REF")) {
    throw new Error("storage.supabase_not_configured");
  }

  let configured: URL;
  try {
    configured = new URL(value);
  } catch {
    throw new Error("storage.supabase_not_configured");
  }

  const localDevelopmentOrigin =
    env.NODE_ENV !== "production" &&
    configured.protocol === "http:" &&
    isLoopbackHostname(configured.hostname);
  if (
    (configured.protocol !== "https:" && !localDevelopmentOrigin) ||
    configured.username ||
    configured.password ||
    configured.search ||
    configured.hash ||
    (configured.pathname !== "/" && configured.pathname !== "")
  ) {
    throw new Error("storage.supabase_not_configured");
  }

  return configured;
}

function isLoopbackHostname(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
}
