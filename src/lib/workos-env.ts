export function sanitizeWorkosClientId(value?: string) {
  return value?.replace(/^\uFEFF/, "").trim();
}

export function workosCookiePolicyError(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  if (environment.NODE_ENV !== "production") return null;

  const sameSite = (environment.WORKOS_COOKIE_SAMESITE ?? "lax")
    .trim()
    .toLowerCase();
  if (sameSite !== "lax" && sameSite !== "strict") {
    return "WORKOS_COOKIE_SAMESITE must be lax or strict in production";
  }

  if (environment.WORKOS_COOKIE_DOMAIN?.trim()) {
    return "WORKOS_COOKIE_DOMAIN must be empty so production sessions remain host-only";
  }

  const redirectUri = environment.NEXT_PUBLIC_WORKOS_REDIRECT_URI?.trim();
  if (!redirectUri) {
    return "NEXT_PUBLIC_WORKOS_REDIRECT_URI is required in production";
  }

  try {
    const redirect = new URL(redirectUri);
    const loopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(
      redirect.hostname
    );
    if (redirect.protocol !== "https:" && !loopback) {
      return "NEXT_PUBLIC_WORKOS_REDIRECT_URI must use HTTPS outside loopback";
    }
  } catch {
    return "NEXT_PUBLIC_WORKOS_REDIRECT_URI must be a valid URL";
  }

  return null;
}

const workosClientId = sanitizeWorkosClientId(process.env.WORKOS_CLIENT_ID);
if (workosClientId) process.env.WORKOS_CLIENT_ID = workosClientId;

const cookiePolicyError = workosCookiePolicyError();
if (cookiePolicyError) throw new Error(cookiePolicyError);
