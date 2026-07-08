export type Tier = "free" | "pro" | "pro_plus";

const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, pro_plus: 2 };

export function normalizeTier(value?: string | null): Tier {
  if (value === "pro" || value === "pro_plus") return value;
  return "free";
}

export function hasTier(userTier: string | null | undefined, min: Tier): boolean {
  return TIER_RANK[normalizeTier(userTier)] >= TIER_RANK[min];
}

export function assertPaidFeatureAccess(current: { tier: Tier }) {
  if (!hasTier(current.tier, "pro")) throw new Error("payment.required");
}
