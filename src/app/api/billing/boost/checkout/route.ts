import { NextResponse } from "next/server";
import { z } from "zod";

import {
  MARKETPLACE_BOOST_PACKAGES,
  type MarketplaceBoostPackageId,
} from "@/components/advertising-product-contract";
import { jsonError } from "@/lib/api-errors";
import { requireCurrentUserProfile } from "@/lib/auth";
import {
  getStripeCheckoutEnv,
  type StripeCheckoutEnv,
} from "@/lib/billing/stripe-env";
import { createMarketplaceBoostCheckoutSession } from "@/lib/billing/marketplace-boost-service";
import { readBoundedJsonOrFormRequest } from "@/lib/json-request";
import { logRequestError } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  prefersHtmlFormNavigation,
  prefersHtmlRateLimitRecovery,
} from "@/lib/rate-limit-recovery";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

const boostPackageIds = MARKETPLACE_BOOST_PACKAGES.map((pkg) => pkg.id) as [
  MarketplaceBoostPackageId,
  ...MarketplaceBoostPackageId[],
];

const boostCheckoutRequestSchema = z.object({
  listingId: z.string().trim().min(1).max(64),
  packageId: z.enum(boostPackageIds),
});

export async function POST(request: Request) {
  try {
    const parsed = boostCheckoutRequestSchema.parse(
      await readBoundedJsonOrFormRequest(request),
    );
    const env = getStripeCheckoutEnv();
    assertTrustedOrigin(request, env);

    let current: Awaited<ReturnType<typeof requireCurrentUserProfile>>;
    try {
      current = await requireCurrentUserProfile();
    } catch (err) {
      if (err instanceof Error && err.message === "auth.unauthorized") {
        const signInUrl = new URL("/sign-in", env.appUrl);
        signInUrl.searchParams.set("returnTo", "/account/listings");
        return NextResponse.redirect(signInUrl, 303);
      }
      throw err;
    }

    const rateLimit = await checkRateLimit(
      `stripe:boost:${current.dbUserId}`,
      RATE_LIMIT,
      RATE_LIMIT_WINDOW_MS,
      { failClosed: true },
    );
    if (!rateLimit.allowed) {
      if (prefersHtmlRateLimitRecovery(request)) {
        return NextResponse.redirect(
          boostReturnUrl(env, "rate-limited", parsed.listingId),
          303,
        );
      }
      return rateLimitExceededResponse(rateLimit, RATE_LIMIT, {
        code: "rate_limit.exceeded",
        message: "Too many requests",
      });
    }

    try {
      const session = await createMarketplaceBoostCheckoutSession({
        current,
        env,
        listingId: parsed.listingId,
        packageId: parsed.packageId,
      });
      if (!session.url) throw new Error("billing.stripe_checkout_missing_url");
      return NextResponse.redirect(session.url, 303);
    } catch (err) {
      await logRequestError(
        "billing.boost_checkout_start_failed",
        { surface: "boost" },
        err,
      );
      if (prefersHtmlFormNavigation(request)) {
        return NextResponse.redirect(
          boostReturnUrl(env, "failed", parsed.listingId),
          303,
        );
      }
      throw err;
    }
  } catch (err) {
    return jsonError(err, "Could not start checkout");
  }
}

function boostReturnUrl(
  env: StripeCheckoutEnv,
  boost: "failed" | "rate-limited",
  listingId: string,
) {
  const url = new URL("/account/listings", env.appUrl);
  url.searchParams.set("boost", boost);
  url.searchParams.set("listing", listingId);
  return url;
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
