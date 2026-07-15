const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SUPPORTED_HTTP_METHODS = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
]);

type RequestMetadata = {
  method: string;
  headers: Headers;
  body?: ReadableStream<Uint8Array> | null;
};

const API_BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);
const ALLOWED_API_BODY_MEDIA_TYPES = new Set([
  "application/json",
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain",
]);
const API_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/;

export function isCrossOriginBrowserMutation(
  request: RequestMetadata,
  expectedOrigin?: string
) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return false;

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site" || fetchSite === "same-site") {
    return true;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    // Browser cookie-authenticated mutations must carry an independently
    // verifiable same-origin signal. Native/server clients do not carry the
    // browser session cookie and remain compatible with bearer credentials.
    return request.headers.has("cookie") && fetchSite !== "same-origin";
  }
  if (!expectedOrigin) return true;

  try {
    return new URL(origin).origin !== new URL(expectedOrigin).origin;
  } catch {
    return true;
  }
}

/**
 * GreyhoundIQ's browser API is same-origin only. Native mobile clients and
 * trusted server integrations do not use browser CORS preflights, so any API
 * request carrying preflight metadata is rejected instead of maintaining a
 * second, easy-to-drift cross-origin allowlist.
 */
export function isBrowserCorsPreflight(request: RequestMetadata) {
  if (request.method.toUpperCase() !== "OPTIONS") return false;

  return Boolean(
    request.headers.get("origin") ||
      request.headers.get("access-control-request-method") ||
      request.headers.get("access-control-request-headers")
  );
}

/**
 * Next route handlers support this fixed method set. Reject extension and
 * tunnelling methods at the common boundary so they cannot fall through to a
 * framework-specific error path or be interpreted differently downstream.
 */
export function isUnsupportedHttpMethod(request: RequestMetadata) {
  return !SUPPORTED_HTTP_METHODS.has(request.method.toUpperCase());
}

export function hasUnsupportedApiBodyContentType(request: RequestMetadata) {
  if (!API_BODY_METHODS.has(request.method.toUpperCase())) return false;

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  const hasDeclaredBody =
    request.body != null ||
    (Number.isFinite(contentLength) && contentLength > 0) ||
    request.headers.has("transfer-encoding");
  if (!hasDeclaredBody) return false;

  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (!mediaType) return true;

  return !(
    ALLOWED_API_BODY_MEDIA_TYPES.has(mediaType) ||
    (mediaType.startsWith("application/") && mediaType.endsWith("+json"))
  );
}

export function shouldDisableSharedApiCaching(
  request: RequestMetadata,
  pathname: string,
) {
  if (!pathname.startsWith("/api/")) return false;
  if (!SAFE_METHODS.has(request.method.toUpperCase())) return true;

  return request.headers.has("cookie") || request.headers.has("authorization");
}

export function hasEncodedPathSeparator(requestUrl: string | URL) {
  try {
    return /%(?:25)*(?:2f|5c)/iu.test(new URL(requestUrl).pathname);
  } catch {
    return true;
  }
}

/**
 * Reject malformed API path identifiers at the shared boundary before auth,
 * routing, database work, or per-route parsing. Query values are deliberately
 * excluded; routes validate those according to their own typed contracts.
 */
export function hasInvalidApiPathSegment(pathname: string) {
  if (pathname !== "/api" && !pathname.startsWith("/api/")) return false;
  if (pathname === "/api") return false;

  const segments = pathname.slice(5).split("/");
  return segments.some(
    (segment) =>
      !API_PATH_SEGMENT.test(segment) || segment === "." || segment === "..",
  );
}
