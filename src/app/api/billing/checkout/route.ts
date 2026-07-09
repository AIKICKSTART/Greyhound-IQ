import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/api-errors";
import { requireCurrentUserProfile } from "@/lib/auth";
import {
  getStripeCheckoutEnv,
  type StripeCheckoutEnv,
} from "@/lib/billing/stripe-env";
import { createStripeCheckoutSession } from "@/lib/billing/stripe-service";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CHECKOUT_RATE_LIMIT = 10;
const CHECKOUT_RATE_LIMIT_WINDOW_MS = 60_000;

const checkoutRequestSchema = z.object({
  interval: z.enum(["monthly", "yearly"]).default("monthly"),
  plan: z.literal("pro"),
});

export async function POST(request: Request) {
  try {
    const parsed = checkoutRequestSchema.parse(await readRequestInput(request));
    const env = getStripeCheckoutEnv();
    assertTrustedOrigin(request, env);

    let current: Awaited<ReturnType<typeof requireCurrentUserProfile>>;
    try {
      current = await requireCurrentUserProfile();
    } catch (err) {
      if (err instanceof Error && err.message === "auth.unauthorized") {
        const signInUrl = new URL("/sign-in", env.appUrl);
        signInUrl.searchParams.set("plan", parsed.plan);
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
      return NextResponse.json(
        {
          error: {
            code: "rate_limit.exceeded",
            message: "Too many requests",
          },
        },
        { status: 429 }
      );
    }

    const session = await createStripeCheckoutSession({
      current,
      env,
      interval: parsed.interval,
      plan: parsed.plan,
    });
    if (!session.url) throw new Error("billing.stripe_checkout_missing_url");

    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    return jsonError(err, "Could not start checkout");
  }
}

async function readRequestInput(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return request.json();

  const formData = await request.formData();
  return Object.fromEntries(formData);
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
