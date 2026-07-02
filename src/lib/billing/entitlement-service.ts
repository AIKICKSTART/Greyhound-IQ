import "server-only";

import {
  DEFAULT_TIER_ENTITLEMENT_LIMITS,
  ENTITLEMENT_KEYS,
  type BillingTier,
  type EntitlementLimits,
} from "@/lib/billing/entitlements";
import { prisma, safeQuery } from "@/lib/db";

type EntitlementSubject = {
  dbUserId: string | null;
  tier: BillingTier;
};

export async function getEntitlementLimitsForCurrentUser(
  current: EntitlementSubject
): Promise<EntitlementLimits> {
  const fallback = DEFAULT_TIER_ENTITLEMENT_LIMITS[current.tier];
  if (!current.dbUserId) return fallback;

  const now = new Date();
  const snapshot = await safeQuery(
    () =>
      prisma.entitlementSnapshot.findFirst({
        where: {
          userId: current.dbUserId,
          status: "active",
          effectiveAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: [
          { effectiveAt: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        select: { entitlementsJson: true },
      }),
    null
  );

  if (!snapshot) return fallback;

  return parseEntitlementLimits(snapshot.entitlementsJson) ?? fallback;
}

function parseEntitlementLimits(rawJson: string): EntitlementLimits | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;

  const limits: Partial<EntitlementLimits> = {};
  for (const key of ENTITLEMENT_KEYS) {
    const value = parsed[key];
    if (!isValidEntitlementValue(key, value)) return null;
    limits[key] = value;
  }

  return limits as EntitlementLimits;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidEntitlementValue(
  key: keyof EntitlementLimits,
  value: unknown
): value is EntitlementLimits[typeof key] {
  const defaultValue = DEFAULT_TIER_ENTITLEMENT_LIMITS.free[key];
  if (typeof defaultValue === "boolean") {
    return typeof value === "boolean";
  }

  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
