import { NextResponse } from "next/server";
import { getLagoEnv } from "@/lib/billing/lago-env";
import {
  getStripeCheckoutEnv,
  getStripeWebhookEnv,
} from "@/lib/billing/stripe-env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const checks = {
    stripeCheckout: "not_configured",
    stripeWebhook: "not_configured",
    lagoBilling: "not_configured",
  };
  let ready = true;

  try {
    getStripeCheckoutEnv();
    checks.stripeCheckout = "configured";
  } catch {
    ready = false;
  }

  try {
    getStripeWebhookEnv();
    checks.stripeWebhook = "configured";
  } catch {
    ready = false;
  }

  // ponytail: Lago metering is reported but non-blocking until delivery is scheduled.
  try {
    getLagoEnv();
    checks.lagoBilling = "configured";
  } catch {}

  return NextResponse.json(
    {
      status: ready ? "ready" : "not_ready",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 }
  );
}
