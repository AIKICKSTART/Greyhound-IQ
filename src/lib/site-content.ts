import "server-only";
import { cache } from "react";
import { withDbSystemContext, withDbRequestContext } from "@/lib/db-context";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { createAuditLog } from "@/lib/account-service";

// Admin-editable /pricing content, stored as one JSON blob in PlatformSetting.
// Falls back to DEFAULT_PRICING when unset or malformed, so the page never breaks.
export const PRICING_KEY = "site.pricing";

export type PricingPlanId = "free" | "pro" | "pro_plus";

export type PricingPlan = {
  id: PricingPlanId;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  notIncluded: string[];
  cta: string;
  highlighted: boolean;
};

export type PricingContent = {
  plans: PricingPlan[];
  yearlyNote: string;
};

export const PRICING_PLAN_IDS: PricingPlanId[] = ["free", "pro", "pro_plus"];

export const DEFAULT_PRICING: PricingContent = {
  plans: [
    {
      id: "free",
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Full racing data access for followers and form researchers.",
      features: [
        "All race data points",
        "Today's race cards (all AU tracks)",
        "Full form and results",
        "GPS tracking data",
        "Dog & track search",
        "Watchlists/basic research",
        "Browse public marketplace listings",
        "Save marketplace listings",
      ],
      notIncluded: [
        "No test mating tool",
        "No marketplace listing creation",
        "No messaging trainers/sellers",
        "No custom trainer, punter, business, or dog marketing pages",
        "No automated winner cards",
      ],
      cta: "Start Free",
      highlighted: false,
    },
    {
      id: "pro",
      name: "Pro",
      price: "$20",
      period: "/month or $204/year",
      description: "For marketplace sellers, trainers, and serious racing users.",
      features: [
        "Everything in Free",
        "Test mating — full sire × dam cross records",
        "Message trainers and sellers about listings",
        "Create marketplace listings",
        "Custom trainer, owner and breeder pages",
        "Custom kennel and business pages",
        "Custom dog marketing pages",
        "Automatic greyhound winner cards when your dog wins",
        "Easy card-to-marketplace listing flow",
        "Community feed posting",
        "Community chat",
        "Professional profile tools",
      ],
      notIncluded: [],
      cta: "Go Pro",
      highlighted: true,
    },
    {
      id: "pro_plus",
      name: "Pro+",
      price: "$39",
      period: "/month",
      description: "Not currently offered.",
      features: [],
      notIncluded: [],
      cta: "Unavailable",
      highlighted: false,
    },
  ],
  yearlyNote: "GreyhoundIQ Pro yearly: $204 AUD/year. That's 15% off monthly pricing.",
};

const PROHIBITED_PLACEHOLDER_COPY = /\bcoming\s+soon\b/i;

function safeEditableText(
  value: unknown,
  fallback: string,
  requireNonEmpty = false,
) {
  if (typeof value !== "string") return fallback;
  if (PROHIBITED_PLACEHOLDER_COPY.test(value)) return fallback;
  return requireNonEmpty && !value.trim() ? fallback : value;
}

function safeEditableTextList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  return value.filter(
    (item): item is string =>
      typeof item === "string" && !PROHIBITED_PLACEHOLDER_COPY.test(item),
  );
}

function normalizePlan(raw: Partial<PricingPlan>, fallback: PricingPlan): PricingPlan {
  return {
    id: fallback.id,
    name: safeEditableText(raw.name, fallback.name, true),
    price: safeEditableText(raw.price, fallback.price),
    period: safeEditableText(raw.period, fallback.period),
    description: safeEditableText(raw.description, fallback.description),
    features: safeEditableTextList(raw.features, fallback.features),
    notIncluded: safeEditableTextList(raw.notIncluded, fallback.notIncluded),
    cta: safeEditableText(raw.cta, fallback.cta, true),
    highlighted: typeof raw.highlighted === "boolean" ? raw.highlighted : fallback.highlighted,
  };
}

function normalize(raw: Partial<PricingContent>): PricingContent {
  const byId = new Map((raw.plans ?? []).map((p) => [p.id, p]));
  return {
    plans: DEFAULT_PRICING.plans.map((fallback) =>
      normalizePlan((byId.get(fallback.id) ?? {}) as Partial<PricingPlan>, fallback)
    ),
    yearlyNote: safeEditableText(
      raw.yearlyNote,
      DEFAULT_PRICING.yearlyNote,
      true,
    ),
  };
}

export const getPricingContent = cache(async (): Promise<PricingContent> => {
  const row = await withDbSystemContext((tx) =>
    tx.platformSetting.findUnique({ where: { key: PRICING_KEY }, select: { value: true } })
  );
  if (!row) return DEFAULT_PRICING;
  try {
    return normalize(JSON.parse(row.value) as Partial<PricingContent>);
  } catch {
    return DEFAULT_PRICING;
  }
});

export async function setPricingContent(current: CurrentUserProfile, content: PricingContent) {
  const normalized = normalize(content);
  await withDbRequestContext(current, (tx) =>
    tx.platformSetting.upsert({
      where: { key: PRICING_KEY },
      create: {
        key: PRICING_KEY,
        value: JSON.stringify(normalized),
        updatedByProfileId: current.profileId,
      },
      update: { value: JSON.stringify(normalized), updatedByProfileId: current.profileId },
    })
  );
  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "admin",
    action: "site_content.pricing.update",
    targetType: "platform_setting",
    targetId: PRICING_KEY,
    metadata: {},
  });
}

// First "$NN" -> NN dollars, for comparing displayed price to the real Stripe amount.
export function dollarsFromPriceLabel(label: string): number | null {
  const m = label.match(/\$?\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}
