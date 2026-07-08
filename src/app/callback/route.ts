import "@/lib/workos-env";
import { handleAuth } from "@workos-inc/authkit-nextjs";
import { syncAuthUser } from "@/lib/auth-sync";
import { logError } from "@/lib/logger";
import { resolveWorkosBaseUrl } from "@/lib/workos-redirect";

// WorkOS redirects here after authentication. On success we sync a local User
// row so the app can attach subscription and profile state to the identity.
// baseURL is required in production: without it handleAuth resolves the
// post-login redirect against the container bind address (https://0.0.0.0:8080).
export const GET = handleAuth({
  baseURL: resolveWorkosBaseUrl(),
  onSuccess: async ({ user }) => {
    try {
      await syncAuthUser(user);
    } catch (err) {
      // Swallowed on purpose: getCurrentUser self-heals the local row later.
      logError("auth.callback_sync_failed", {}, err);
    }
  },
});
