import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireCurrentUserProfile } from "@/lib/auth";
import {
  getStripeCheckoutEnv,
  type StripeCheckoutEnv,
} from "@/lib/billing/stripe-env";
import { createBespokeDesignCheckoutSession } from "@/lib/billing/stripe-service";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RATE_LIMIT = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  try {
    const env = getStripeCheckoutEnv();
    assertTrustedOrigin(request, env);

    let current: Awaited<ReturnType<typeof requireCurrentUserProfile>>;
    try {
      current = await requireCurrentUserProfile();
    } catch (err) {
      if (err instanceof Error && err.message === "auth.unauthorized") {
        return NextResponse.redirect(new URL("/sign-in", env.appUrl), 303);
      }
      throw err;
    }

    const rateLimit = await checkRateLimit(
      `stripe:bespoke:${current.dbUserId}`,
      RATE_LIMIT,
      RATE_LIMIT_WINDOW_MS,
      { failClosed: true }
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: { code: "rate_limit.exceeded", message: "Too many requests" } },
        { status: 429 }
      );
    }

    const session = await createBespokeDesignCheckoutSession({ current, env });
    if (!session.url) throw new Error("billing.stripe_checkout_missing_url");
    return NextResponse.redirect(session.url, 303);
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
