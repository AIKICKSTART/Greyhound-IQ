import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { resolveWorkosRedirectUri } from "@/lib/workos-redirect";

const ALLOWED_PLANS = new Set(["free", "pro", "pro_plus"]);

function getPlanReturnTo(plan: string | null) {
  if (!plan || !ALLOWED_PLANS.has(plan)) {
    return undefined;
  }

  return `/account?plan=${plan}`;
}

// Sign-in endpoint (initiate_login_uri). Redirects to the AuthKit hosted UI.
// Set this path as the "Sign-in endpoint" under Redirects in the WorkOS dashboard.
export const GET = async (request: NextRequest) => {
  const returnTo = getPlanReturnTo(request.nextUrl.searchParams.get("plan"));
  const redirectUri = resolveWorkosRedirectUri(request.url);
  const signInUrl = await getSignInUrl({
    ...(redirectUri ? { redirectUri } : {}),
    ...(returnTo ? { returnTo } : {}),
  });

  return redirect(signInUrl);
};
