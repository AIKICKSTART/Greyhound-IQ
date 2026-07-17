import "@/lib/workos-env";
import { handleAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { syncAuthUser } from "@/lib/auth-sync";
import { classifyAuthCallbackFailure } from "@/lib/auth-callback-recovery";
import {
  logCorrelatedError,
  logCorrelationContextFromHeaders,
  logRequestError,
} from "@/lib/logger";
import { resolveWorkosBaseUrl } from "@/lib/workos-redirect";

// WorkOS redirects here after authentication. On success we sync a local User
// row so the app can attach subscription and profile state to the identity.
// baseURL is required in production: without it handleAuth resolves the
// post-login redirect against the container bind address (https://0.0.0.0:8080).
export const GET = handleAuth({
  baseURL: resolveWorkosBaseUrl(),
  onSuccess: async ({ user }) => {
    try {
      await syncAuthUser(user, { auditAuthenticationSuccess: true });
    } catch {
      await logRequestError("auth.callback_sync_failed", {
        errorCode: "auth.local_acceptance_failed",
        errorClass: "local_acceptance",
      });
      // AuthKit routes this generic sentinel through onError. A session may be
      // created, but the callback is not reported successful until the local
      // user/profile/outbox transaction commits.
      throw new Error("auth.local_acceptance_failed");
    }
  },
  onError: ({ request }: { error?: unknown; request: NextRequest }) => {
    const reason = classifyAuthCallbackFailure(
      request.nextUrl.searchParams.get("error")
    );
    const referenceId = crypto.randomUUID();
    // The SDK already records the server-side failure. Keep this event
    // privacy-safe and give support a correlation value without copying a
    // provider payload or token into another log entry.
    logCorrelatedError(
      logCorrelationContextFromHeaders(request.headers),
      "auth.callback_failed",
      { reason, referenceId },
    );

    const baseUrl =
      resolveWorkosBaseUrl(request.url) ?? "https://greyhoundsiq.com.au";
    const recoveryUrl = new URL("/auth/error", baseUrl);
    recoveryUrl.searchParams.set("reason", reason);
    recoveryUrl.searchParams.set("ref", referenceId);
    return NextResponse.redirect(recoveryUrl);
  },
});
