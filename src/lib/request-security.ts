const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type RequestMetadata = {
  method: string;
  headers: Headers;
};

export function isCrossOriginBrowserMutation(
  request: RequestMetadata,
  expectedOrigin?: string
) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return false;

  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") {
    return true;
  }

  const origin = request.headers.get("origin");
  if (!origin) return false;
  if (!expectedOrigin) return true;

  try {
    return new URL(origin).origin !== new URL(expectedOrigin).origin;
  } catch {
    return true;
  }
}

export function hasEncodedPathSeparator(requestUrl: string | URL) {
  try {
    return /%(?:25)*(?:2f|5c)/iu.test(new URL(requestUrl).pathname);
  } catch {
    return true;
  }
}
