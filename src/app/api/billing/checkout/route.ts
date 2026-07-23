import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { billingCheckoutRequestSchema } from "@/lib/billing/checkout-validation";
import { readBoundedJsonOrFormRequest } from "@/lib/json-request";
import { requireCurrentUserProfile } from "@/lib/auth";
import {
  getStripeCheckoutEnv,
  type StripeCheckoutEnv,
} from "@/lib/billing/stripe-env";
import {
  buildBillingFailureUrl,
  buildBillingRateLimitUrl,
} from "@/lib/billing/billing-return-recovery";
import { createStripeCheckoutSession } from "@/lib/billing/stripe-service";
import { logRequestError } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  prefersHtmlFormNavigation,
  prefersHtmlRateLimitRecovery,
} from "@/lib/rate-limit-recovery";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CHECKOUT_RATE_LIMIT = 10;
const CHECKOUT_RATE_LIMIT_WINDOW_MS = 60_000;

const checkoutRequestSchema = billingCheckoutRequestSchema;

export async function POST(request: Request) {
  try {
    const parsed = checkoutRequestSchema.parse(
      await readBoundedJsonOrFormRequest(request),
    );
    const env = getStripeCheckoutEnv();
    assertTrustedOrigin(request, env);

    let current: Awaited<ReturnType<typeof requireCurrentUserProfile>>;
    try {
      current = await requireCurrentUserProfile();
    } catch (err) {
      if (err instanceof Error && err.message === "auth.unauthorized") {
        const returnTo = new URL("/account", env.appUrl);
        returnTo.searchParams.set("plan", parsed.plan);
        returnTo.searchParams.set("interval", parsed.interval);
        returnTo.searchParams.set("checkout", "continue");

        const signInUrl = new URL("/sign-in", env.appUrl);
        signInUrl.searchParams.set(
          "returnTo",
          `${returnTo.pathname}${returnTo.search}`
        );
        return NextResponse.redirect(signInUrl, 303);
      }
      throw err;
    }

    const rateLimit = await checkRateLimit(
      `stripe:checkout:${current.dbUserId}`,
      CHECKOUT_RATE_LIMIT,
      CHECKOUT_RATE_LIMIT_WINDOW_MS,
      { failClosed: true }
    );
    if (!rateLimit.allowed) {
      if (prefersHtmlRateLimitRecovery(request)) {
        return NextResponse.redirect(
          buildBillingRateLimitUrl({
            appUrl: env.appUrl,
            interval: parsed.interval,
            surface: "subscription",
          }),
          303,
        );
      }
      return rateLimitExceededResponse(
        rateLimit,
        CHECKOUT_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    try {
      const session = await createStripeCheckoutSession({
        current,
        env,
        interval: parsed.interval,
        plan: parsed.plan,
      });
      if (!session.url) throw new Error("billing.stripe_checkout_missing_url");

      return NextResponse.redirect(session.url, 303);
    } catch (err) {
      await logRequestError(
        "billing.checkout_start_failed",
        { surface: "subscription" },
        err,
      );
      if (prefersHtmlFormNavigation(request)) {
        return NextResponse.redirect(
          buildBillingFailureUrl({
            appUrl: env.appUrl,
            interval: parsed.interval,
            surface: "subscription",
          }),
          303,
        );
      }
      throw err;
    }
  } catch (err) {
    return jsonError(err, "Could not start checkout");
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
