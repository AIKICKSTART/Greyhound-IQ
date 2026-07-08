import "server-only";

export type StripeCheckoutPlan = "pro";
export type StripeBillingInterval = "monthly" | "yearly";

type StripePriceEnvKey =
  | "STRIPE_PRICE_PRO_MONTHLY"
  | "STRIPE_PRICE_PRO_YEARLY";

export type StripeCheckoutEnv = {
  appUrl: string;
  prices: Record<StripeCheckoutPlan, Record<StripeBillingInterval, string>>;
  secretKey: string;
};

export type StripeWebhookEnv = {
  secretKey: string;
  webhookSecret: string;
};

const STRIPE_PRICE_ENV_KEYS = {
  pro: {
    monthly: "STRIPE_PRICE_PRO_MONTHLY",
    yearly: "STRIPE_PRICE_PRO_YEARLY",
  },
} as const satisfies Record<
  StripeCheckoutPlan,
  Record<StripeBillingInterval, StripePriceEnvKey>
>;

export function getStripeCheckoutEnv(
  env: NodeJS.ProcessEnv = process.env
): StripeCheckoutEnv {
  assertServerRuntime();
  return {
    appUrl: requireAppUrl(env),
    prices: {
      pro: {
        monthly: requirePriceId(env, STRIPE_PRICE_ENV_KEYS.pro.monthly),
        yearly: requirePriceId(env, STRIPE_PRICE_ENV_KEYS.pro.yearly),
      },
    },
    secretKey: requireStripeSecretKey(env),
  };
}

export function getStripeWebhookEnv(
  env: NodeJS.ProcessEnv = process.env
): StripeWebhookEnv {
  assertServerRuntime();
  return {
    secretKey: requireStripeSecretKey(env),
    webhookSecret: requireEnv(env, "STRIPE_WEBHOOK_SECRET", isStripeWebhookSecret),
  };
}

export function priceEnvKeyForStripePlan(
  plan: StripeCheckoutPlan,
  interval: StripeBillingInterval
) {
  return STRIPE_PRICE_ENV_KEYS[plan][interval];
}

function requireStripeSecretKey(env: NodeJS.ProcessEnv) {
  return requireFirstEnv(env, ["STRIPE_RESTRICTED_KEY", "STRIPE_SECRET_KEY"], (value) =>
    /^(sk|rk)_(test|live)_/.test(value)
  );
}

function requireAppUrl(env: NodeJS.ProcessEnv) {
  const value = firstEnv(env, ["STRIPE_APP_URL", "NEXTAUTH_URL"]);
  if (!value || looksLikePlaceholder(value) || !isUrl(value)) {
    throw new Error("billing.stripe_not_configured:STRIPE_APP_URL");
  }
  return new URL(value).origin;
}

function requirePriceId(env: NodeJS.ProcessEnv, key: StripePriceEnvKey) {
  return requireEnv(env, key, (value) => /^price_[A-Za-z0-9]+$/.test(value));
}

function requireFirstEnv(
  env: NodeJS.ProcessEnv,
  keys: string[],
  validate: (value: string) => boolean
) {
  const value = firstEnv(env, keys);
  if (!value || looksLikePlaceholder(value) || !validate(value)) {
    throw new Error(`billing.stripe_not_configured:${keys.join("_or_")}`);
  }
  return value;
}

function requireEnv(
  env: NodeJS.ProcessEnv,
  key: string,
  validate: (value: string) => boolean
) {
  const value = cleanEnvValue(env[key]);
  if (!value || looksLikePlaceholder(value) || !validate(value)) {
    throw new Error(`billing.stripe_not_configured:${key}`);
  }
  return value;
}

function firstEnv(env: NodeJS.ProcessEnv, keys: string[]) {
  for (const key of keys) {
    const value = cleanEnvValue(env[key]);
    if (value) return value;
  }
  return null;
}

function cleanEnvValue(value: string | undefined) {
  const cleaned = value?.trim().replace(/^['"]|['"]$/g, "");
  return cleaned ? cleaned : null;
}

function looksLikePlaceholder(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("your_") ||
    normalized.includes("your-") ||
    normalized.includes("example.com") ||
    normalized.includes("placeholder") ||
    normalized.startsWith("generate-")
  );
}

function isStripeWebhookSecret(value: string) {
  return /^whsec_[A-Za-z0-9_]+$/.test(value);
}

function isUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function assertServerRuntime() {
  if (typeof window !== "undefined") {
    throw new Error("billing.stripe_server_only");
  }
}
