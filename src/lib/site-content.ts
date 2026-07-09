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
      description: "Full racing data access for casual punters and form checkers.",
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
        "Message trainers and sellers about listings",
        "Create marketplace listings",
        "Custom trainer page",
        "Custom punter page",
        "Custom business page",
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
      description: "Coming soon. Not available for purchase yet.",
      features: [],
      notIncluded: [],
      cta: "Coming soon",
      highlighted: false,
    },
  ],
  yearlyNote: "GreyhoundIQ Pro yearly: $204 AUD/year. That's 15% off monthly pricing.",
};

function normalizePlan(raw: Partial<PricingPlan>, fallback: PricingPlan): PricingPlan {
  return {
    id: fallback.id,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : fallback.name,
    price: typeof raw.price === "string" ? raw.price : fallback.price,
    period: typeof raw.period === "string" ? raw.period : fallback.period,
    description: typeof raw.description === "string" ? raw.description : fallback.description,
    features: Array.isArray(raw.features) ? raw.features.filter((f) => typeof f === "string") : fallback.features,
    notIncluded: Array.isArray(raw.notIncluded)
      ? raw.notIncluded.filter((f) => typeof f === "string")
      : fallback.notIncluded,
    cta: typeof raw.cta === "string" && raw.cta.trim() ? raw.cta : fallback.cta,
    highlighted: typeof raw.highlighted === "boolean" ? raw.highlighted : fallback.highlighted,
  };
}

function normalize(raw: Partial<PricingContent>): PricingContent {
  const byId = new Map((raw.plans ?? []).map((p) => [p.id, p]));
  return {
    plans: DEFAULT_PRICING.plans.map((fallback) =>
      normalizePlan((byId.get(fallback.id) ?? {}) as Partial<PricingPlan>, fallback)
    ),
    yearlyNote:
      typeof raw.yearlyNote === "string" && raw.yearlyNote.trim()
        ? raw.yearlyNote
        : DEFAULT_PRICING.yearlyNote,
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
