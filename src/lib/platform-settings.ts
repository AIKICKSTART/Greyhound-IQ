import "server-only";
import { cache } from "react";
import { withDbSystemContext, withDbRequestContext } from "@/lib/db-context";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { createAuditLog } from "@/lib/account-service";

// Admin-relaxable rule flags. Default = true (strict) when no row exists, so the
// safe/fraud-protective behaviour holds until an admin explicitly relaxes it.
export const PLATFORM_FLAGS = {
  requireApprovedOwnership: "custom_pages.require_approved_ownership",
  requireRegisteredDog: "custom_pages.require_registered_dog",
  enforceDogPageLimit: "custom_pages.enforce_dog_page_limit",
  requirePro: "custom_pages.require_pro",
  // Default OFF — enable once gpt-image-2 prompts are tuned in prod.
  cardGenerationEnabled: "dog_cards.generation_enabled",
} as const;

export type PlatformFlagKey =
  (typeof PLATFORM_FLAGS)[keyof typeof PLATFORM_FLAGS];

// Cached per request. Missing row → default (strict = true).
export const getPlatformFlag = cache(
  async (key: PlatformFlagKey, fallback = true): Promise<boolean> => {
    const row = await withDbSystemContext((tx) =>
      tx.platformSetting.findUnique({ where: { key }, select: { value: true } })
    );
    if (!row) return fallback;
    return row.value === "true";
  }
);

export async function getAllPlatformFlags(): Promise<Record<PlatformFlagKey, boolean>> {
  const rows = await withDbSystemContext((tx) =>
    tx.platformSetting.findMany({ select: { key: true, value: true } })
  );
  const byKey = new Map(rows.map((r) => [r.key, r.value === "true"]));
  const out = {} as Record<PlatformFlagKey, boolean>;
  for (const key of Object.values(PLATFORM_FLAGS)) {
    out[key] = byKey.has(key) ? byKey.get(key)! : true;
  }
  return out;
}

export async function setPlatformFlag(
  current: CurrentUserProfile,
  key: PlatformFlagKey,
  value: boolean
) {
  await withDbRequestContext(current, (tx) =>
    tx.platformSetting.upsert({
      where: { key },
      create: { key, value: String(value), updatedByProfileId: current.profileId },
      update: { value: String(value), updatedByProfileId: current.profileId },
    })
  );
  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "admin",
    action: "platform_setting.update",
    targetType: "platform_setting",
    targetId: key,
    metadata: { value },
  });
}
