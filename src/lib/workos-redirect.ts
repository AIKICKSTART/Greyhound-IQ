export function resolveWorkosRedirectUri(requestUrl?: string | URL) {
  if (process.env.NODE_ENV !== "production") {
    const localOrigin = localRequestOrigin(requestUrl);
    if (localOrigin) {
      return new URL("/callback", localOrigin).toString();
    }
  }

  const explicit =
    process.env.WORKOS_REDIRECT_URI ??
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;

  if (explicit) return explicit;

  const baseUrl =
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    vercelUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    vercelUrl(process.env.VERCEL_URL);

  return baseUrl ? new URL("/callback", baseUrl).toString() : undefined;
}

function localRequestOrigin(requestUrl?: string | URL) {
  if (!requestUrl) return undefined;

  try {
    const url = new URL(requestUrl);
    return isLocalhost(url.hostname) ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

function isLocalhost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function vercelUrl(host?: string) {
  if (!host) return undefined;
  return host.startsWith("http") ? host : `https://${host}`;
}
