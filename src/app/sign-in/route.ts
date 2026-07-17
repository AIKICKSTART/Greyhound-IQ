import "@/lib/workos-env";
import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import {
  resolveWorkosRedirectUri,
  resolveWorkosReturnTo,
} from "@/lib/workos-redirect";
import { isFullAccessDemo } from "@/lib/demo-access";

// Sign-in endpoint (initiate_login_uri). Redirects to the AuthKit hosted UI.
// Set this path as the "Sign-in endpoint" under Redirects in the WorkOS dashboard.
export const GET = async (request: NextRequest) => {
  const returnTo = resolveWorkosReturnTo({
    interval: request.nextUrl.searchParams.get("interval"),
    plan: request.nextUrl.searchParams.get("plan"),
    returnTo: request.nextUrl.searchParams.get("returnTo"),
  });
  if (isFullAccessDemo()) {
    return redirect(new URL(returnTo, request.url).toString());
  }

  const redirectUri = resolveWorkosRedirectUri(request.url);
  const signInUrl = await getSignInUrl({
    ...(redirectUri ? { redirectUri } : {}),
    returnTo,
  });

  return redirect(signInUrl);
};
