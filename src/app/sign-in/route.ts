import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

// Sign-in endpoint (initiate_login_uri). Redirects to the AuthKit hosted UI.
// Set this path as the "Sign-in endpoint" under Redirects in the WorkOS dashboard.
export const GET = async () => {
  const signInUrl = await getSignInUrl();
  return redirect(signInUrl);
};
