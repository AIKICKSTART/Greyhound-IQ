import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireCurrentUserProfile } from "@/lib/auth";
import {
  getStripeCheckoutEnv,
  type StripeCheckoutEnv,
} from "@/lib/billing/stripe-env";
import {
  buildBillingFailureUrl,
  buildBillingRateLimitUrl,
} from "@/lib/billing/billing-return-recovery";
import { createStripePortalSession } from "@/lib/billing/stripe-service";
import { logRequestError } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  prefersHtmlFormNavigation,
  prefersHtmlRateLimitRecovery,
} from "@/lib/rate-limit-recovery";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PORTAL_RATE_LIMIT = 10;
const PORTAL_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  try {
    const env = getStripeCheckoutEnv();
    assertTrustedOrigin(request, env);

    const current = await requireCurrentUserProfile();
    const rateLimit = await checkRateLimit(
      `stripe:portal:${current.dbUserId}`,
      PORTAL_RATE_LIMIT,
      PORTAL_RATE_LIMIT_WINDOW_MS,
      { failClosed: true }
    );
    if (!rateLimit.allowed) {
      if (prefersHtmlRateLimitRecovery(request)) {
        return NextResponse.redirect(
          buildBillingRateLimitUrl({
            appUrl: env.appUrl,
            surface: "portal",
          }),
          303,
        );
      }
      return rateLimitExceededResponse(
        rateLimit,
        PORTAL_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    try {
      const session = await createStripePortalSession({ current, env });
      if (!session?.url) {
        const pricingUrl = new URL("/pricing", env.appUrl);
        pricingUrl.searchParams.set("billing", "not_started");
        return NextResponse.redirect(pricingUrl, 303);
      }

      return NextResponse.redirect(session.url, 303);
    } catch (err) {
      await logRequestError(
        "billing.portal_start_failed",
        { surface: "portal" },
        err,
      );
      if (prefersHtmlFormNavigation(request)) {
        return NextResponse.redirect(
          buildBillingFailureUrl({ appUrl: env.appUrl, surface: "portal" }),
          303,
        );
      }
      throw err;
    }
  } catch (err) {
    return jsonError(err, "Could not open billing portal");
  }
}

function assertTrustedOrigin(request: Request, env: StripeCheckoutEnv) {
  const origin = request.headers.get("origin")?.trim();
  if (!origin) {
    if (process.env.NODE_ENV === "production") throw new Error("auth.forbidden");
    return;
  }

  if (new URL(origin).origin !== new URL(env.appUrl).origin) {
    throw new Error("auth.forbidden");
  }
}
