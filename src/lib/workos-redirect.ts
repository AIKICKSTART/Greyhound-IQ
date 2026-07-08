export function resolveWorkosRedirectUri(requestUrl?: string | URL) {
  const requestOrigin =
    process.env.NODE_ENV !== "production" ? trustedRequestOrigin(requestUrl) : undefined;
  if (requestOrigin) return new URL("/callback", requestOrigin).toString();

  const explicit = firstSafeUrl(
    process.env.WORKOS_REDIRECT_URI,
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI
  );

  if (explicit) return explicit.toString();

  const baseUrl = resolveWorkosBaseUrl(requestUrl);
  return baseUrl ? new URL("/callback", baseUrl).toString() : undefined;
}

export function resolveWorkosBaseUrl(requestUrl?: string | URL) {
  const baseUrl = firstSafeUrl(process.env.NEXTAUTH_URL, process.env.AUTH_URL);
  const explicit = firstSafeUrl(
    process.env.WORKOS_REDIRECT_URI,
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI
  );
  if (baseUrl && process.env.NODE_ENV === "production") {
    return baseUrl.origin;
  }

  const requestOrigin = trustedRequestOrigin(requestUrl);
  if (requestOrigin) {
    return requestOrigin;
  }

  return baseUrl?.origin ?? explicit?.origin;
}

function trustedRequestOrigin(requestUrl?: string | URL) {
  if (!requestUrl) return undefined;

  try {
    const url = new URL(requestUrl);
    if (isBindHost(url.hostname)) return undefined;
    if (process.env.NODE_ENV !== "production" && isLocalhost(url.hostname)) {
      return url.origin;
    }
    if (url.protocol !== "https:") return undefined;

    const appHost = configuredAppHost();
    if (!appHost) return undefined;

    const requestHost = stripWww(url.hostname);
    if (requestHost === appHost || url.hostname.endsWith(".run.app")) {
      return url.origin;
    }
  } catch {
    return undefined;
  }
}

function isLocalhost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isBindHost(hostname: string) {
  return hostname === "0.0.0.0" || hostname === "::" || hostname === "[::]";
}

function configuredAppHost() {
  return stripWww(
    firstSafeUrl(
      process.env.NEXTAUTH_URL,
      process.env.AUTH_URL,
      process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI,
      process.env.WORKOS_REDIRECT_URI
    )?.hostname ?? ""
  );
}

function firstSafeUrl(...values: (string | undefined)[]) {
  for (const value of values) {
    const url = safeUrl(value);
    if (url) return url;
  }
  return undefined;
}

function safeUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (isBindHost(url.hostname)) return undefined;
    if (process.env.NODE_ENV === "production" && isLocalhost(url.hostname)) {
      return undefined;
    }
    if (url.protocol === "https:") return url;
    if (process.env.NODE_ENV !== "production" && url.protocol === "http:" && isLocalhost(url.hostname)) {
      return url;
    }
  } catch {
    return undefined;
  }
}

function stripWww(hostname: string) {
  return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
}
