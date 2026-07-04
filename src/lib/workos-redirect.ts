export function resolveWorkosRedirectUri(requestUrl?: string | URL) {
  const explicit =
    process.env.WORKOS_REDIRECT_URI ??
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;

  if (explicit) return explicit;

  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL;
  if (baseUrl && process.env.NODE_ENV === "production") {
    return new URL("/callback", baseUrl).toString();
  }

  const requestOrigin = trustedRequestOrigin(requestUrl);
  if (requestOrigin) {
    return new URL("/callback", requestOrigin).toString();
  }

  return baseUrl ? new URL("/callback", baseUrl).toString() : undefined;
}

function trustedRequestOrigin(requestUrl?: string | URL) {
  if (!requestUrl) return undefined;

  try {
    const url = new URL(requestUrl);
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

function configuredAppHost() {
  return stripWww(
    hostnameFromUrl(
      process.env.NEXTAUTH_URL ??
        process.env.AUTH_URL ??
        process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ??
        process.env.WORKOS_REDIRECT_URI
    ) ?? ""
  );
}

function hostnameFromUrl(value?: string) {
  if (!value) return undefined;
  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

function stripWww(hostname: string) {
  return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
}
