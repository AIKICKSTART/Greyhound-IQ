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

// Starting an audio/video call is Pro+ only. Pro keeps text chat but loses the
// ability to INITIATE calls; free/pro members may still join a call a Pro+
// member started (see createCallTokenForCurrentUser).
export function assertCallInitiationAccess(current: { tier: Tier }) {
  if (!hasTier(current.tier, "pro_plus")) throw new Error("payment.required");
}
