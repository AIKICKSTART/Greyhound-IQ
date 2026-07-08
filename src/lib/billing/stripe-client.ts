import "server-only";

import Stripe from "stripe";

import { getStripeCheckoutEnv } from "@/lib/billing/stripe-env";

let cachedStripe: Stripe | null = null;
let cachedKey: string | null = null;

export function getStripeClient(secretKey = getStripeCheckoutEnv().secretKey) {
  if (cachedStripe && cachedKey === secretKey) return cachedStripe;

  cachedStripe = new Stripe(secretKey, {
    apiVersion: "2026-06-24.dahlia",
    appInfo: {
      name: "Greyhounds IQ",
      url: "https://greyhoundsiq.com.au",
      version: "0.1.0",
    },
    maxNetworkRetries: 2,
    typescript: true,
  });
  cachedKey = secretKey;
  return cachedStripe;
}
