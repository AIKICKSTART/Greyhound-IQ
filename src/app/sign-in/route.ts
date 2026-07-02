import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

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
  const signInUrl = await getSignInUrl(returnTo ? { returnTo } : undefined);
  return redirect(signInUrl);
};
