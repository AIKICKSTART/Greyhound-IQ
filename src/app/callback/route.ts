import { handleAuth } from "@workos-inc/authkit-nextjs";
import { syncAuthUser } from "@/lib/auth-sync";

// WorkOS redirects here after authentication. On success we sync a local User
// row so the app can attach subscription and profile state to the identity.
export const GET = handleAuth({
  onSuccess: async ({ user }) => {
    try {
      await syncAuthUser(user);
    } catch (err) {
      console.error("[callback] local user sync failed:", err);
    }
  },
});
