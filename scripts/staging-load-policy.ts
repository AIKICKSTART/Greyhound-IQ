const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const STAGING_HOST = "staging.greyhoundsiq.com.au";
const STAGING_CLOUD_RUN_HOST =
  /^(?:[a-z0-9-]+---)?greyhoundiq-web-staging-5wsnl4feuq-ts\.a\.run\.app$/;
const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const SIGNED_UPLOAD_PATH = "/storage/v1/object/upload/sign/";

export type LoadObjectStorageProvider = "gcs" | "supabase";

export function resolveLoadObjectStorageProvider(
  value: string | undefined
): LoadObjectStorageProvider {
  const provider = value?.trim().toLowerCase() || "supabase";
  if (provider !== "gcs" && provider !== "supabase") {
    throw new Error("LOAD_OBJECT_STORAGE_PROVIDER must be supabase or gcs");
  }
  return provider;
}

export function resolveStagingLoadBaseUrl(
  value: string | undefined,
  label = "LOAD_BASE_URL"
) {
  const input = value?.trim();
  if (!input) {
    throw new Error(
      `${label} is required and must point to an approved staging or loopback host`
    );
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`${label} must be a valid HTTP(S) URL`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${label} must be a valid HTTP(S) URL`);
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const isLoopback = LOOPBACK_HOSTS.has(hostname);
  const isApprovedStaging =
    hostname === STAGING_HOST || STAGING_CLOUD_RUN_HOST.test(hostname);

  if (!isLoopback && !isApprovedStaging) {
    throw new Error(
      `Refusing ${label} host "${hostname}"; use loopback, ${STAGING_HOST}, or the greyhoundiq-web-staging Cloud Run service`
    );
  }
  if (!isLoopback && url.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS for staging host "${hostname}"`);
  }

  url.hostname = hostname;
  return url.origin;
}

export function resolveStagingRequestUrl(path: string, approvedOrigin: string) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Load probe paths must be same-origin absolute paths");
  }

  const url = new URL(path, approvedOrigin);
  if (url.origin !== approvedOrigin) {
    throw new Error("Load probe path escaped the approved staging origin");
  }

  return url;
}

export function resolveStagingRedirectUrl(
  location: string,
  currentUrl: URL,
  approvedOrigin: string
) {
  const url = new URL(location, currentUrl);
  if (url.username || url.password || url.origin !== approvedOrigin) {
    throw new Error("Redirect escaped the approved staging origin");
  }
  return url;
}

export function resolveStagingSupabaseUrl(
  value: string | undefined,
  approvedHostValue: string | undefined
) {
  const approvedHost = approvedHostValue?.trim().toLowerCase().replace(/\.$/, "");
  if (
    !approvedHost ||
    (!LOOPBACK_HOSTS.has(approvedHost) && !HOSTNAME.test(approvedHost))
  ) {
    throw new Error(
      "LOAD_APPROVED_SUPABASE_HOST is required and must be one exact staging or loopback hostname"
    );
  }

  const input = value?.trim();
  if (!input) {
    throw new Error(
      "LOAD_SUPABASE_URL is required for Realtime or media load scenarios"
    );
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("LOAD_SUPABASE_URL must be a valid HTTP(S) URL");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname !== approvedHost) {
    throw new Error(
      `Refusing LOAD_SUPABASE_URL host "${hostname}"; expected approved staging host "${approvedHost}"`
    );
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("LOAD_SUPABASE_URL must contain only the approved service origin");
  }
  if (url.protocol !== "https:" && !LOOPBACK_HOSTS.has(hostname)) {
    throw new Error(
      `LOAD_SUPABASE_URL must use HTTPS for staging host "${hostname}"`
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("LOAD_SUPABASE_URL must be a valid HTTP(S) URL");
  }

  url.hostname = hostname;
  return url.origin;
}

export function resolveApprovedSignedUploadUrl(
  value: string,
  approvedSupabaseOrigin: string
) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Signed upload URL is not a valid URL");
  }

  if (url.username || url.password || url.origin !== approvedSupabaseOrigin) {
    throw new Error("Signed upload URL does not match the approved staging Supabase origin");
  }
  if (
    !url.pathname.startsWith(SIGNED_UPLOAD_PATH) ||
    !url.searchParams.get("token")?.trim()
  ) {
    throw new Error("Signed upload URL does not match the Supabase signed-upload contract");
  }

  return url.toString();
}

export function resolveApprovedGcsSignedUploadUrl(
  value: string,
  approvedBucketValue: string | undefined,
  expectedObjectPath: string
) {
  const approvedBucket = approvedBucketValue?.trim();
  if (
    !approvedBucket ||
    approvedBucket.length < 3 ||
    approvedBucket.length > 222 ||
    !/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(approvedBucket)
  ) {
    throw new Error("LOAD_APPROVED_GCS_BUCKET must be one exact GCS bucket name");
  }

  let url: URL;
  let decodedPath: string;
  try {
    url = new URL(value);
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    throw new Error("Signed upload URL is not a valid URL");
  }

  const expires = Number(url.searchParams.get("X-Goog-Expires"));
  const signedHeaders =
    url.searchParams.get("X-Goog-SignedHeaders")?.split(";") ?? [];
  if (
    url.protocol !== "https:" ||
    url.hostname !== "storage.googleapis.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    decodedPath !== `/${approvedBucket}/${expectedObjectPath}` ||
    url.searchParams.get("X-Goog-Algorithm") !== "GOOG4-RSA-SHA256" ||
    !url.searchParams.get("X-Goog-Credential") ||
    !url.searchParams.get("X-Goog-Date") ||
    !Number.isSafeInteger(expires) ||
    expires <= 0 ||
    expires > 7200 ||
    !url.searchParams.get("X-Goog-Signature") ||
    !signedHeaders.includes("content-type") ||
    !signedHeaders.includes("host")
  ) {
    throw new Error("Signed upload URL does not match the approved staging GCS contract");
  }

  return url.toString();
}

export function resolveSignedUploadHeaders(
  value: unknown,
  provider: LoadObjectStorageProvider,
  expectedContentType: string
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Signed upload headers are missing");
  }
  const headers: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(value)) {
    const name = rawName.trim().toLowerCase();
    if (
      typeof rawValue !== "string" ||
      rawValue.length === 0 ||
      /[\r\n]/.test(rawValue) ||
      !["cache-control", "content-type", "x-upsert"].includes(name)
    ) {
      throw new Error("Signed upload headers contain an unsafe value");
    }
    headers[name] = rawValue;
  }
  if (headers["content-type"] !== expectedContentType) {
    throw new Error("Signed upload content type does not match the probe object");
  }
  if (provider === "gcs") {
    if (Object.keys(headers).length !== 1) {
      throw new Error("GCS signed uploads may only forward Content-Type");
    }
  } else if (
    headers["x-upsert"] !== "false" ||
    !headers["cache-control"]
  ) {
    throw new Error("Supabase signed upload headers are incomplete");
  }
  return headers;
}
