import { NextResponse } from "next/server";
import { getLagoEnv } from "@/lib/billing/lago-env";
import {
  getStripeCheckoutEnv,
  getStripeWebhookEnv,
} from "@/lib/billing/stripe-env";
import { isInternalRequest } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
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

  // Public probe gets ready/not_ready only; per-provider readiness is
  // operational detail behind the internal secret.
  const body = isInternalRequest(request)
    ? { status: ready ? "ready" : "not_ready", checks, timestamp: new Date().toISOString() }
    : { status: ready ? "ready" : "not_ready", timestamp: new Date().toISOString() };

  return NextResponse.json(body, { status: ready ? 200 : 503 });
}
