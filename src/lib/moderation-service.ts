import { createAuditLog } from "@/lib/account-service";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { cleanText } from "@/lib/content";
import { prisma, safeQuery } from "@/lib/db";

export type ModerationTarget = "all" | "listing" | "feed" | "message";
export type ModerationAction = "review" | "block";

export type BannedPhraseInput = {
  phrase: string;
  target: ModerationTarget;
  action: ModerationAction;
  reason?: string | null;
};

export async function listBannedPhrasesForModerator() {
  return safeQuery(
    () =>
      prisma.bannedPhrase.findMany({
        orderBy: [{ active: "desc" }, { target: "asc" }, { phrase: "asc" }],
      }),
    []
  );
}

export async function createBannedPhraseForModerator(
  current: CurrentUserProfile,
  input: BannedPhraseInput
) {
  const phrase = normalizePhrase(input.phrase);
  if (!phrase) throw new Error("moderation.phrase_required");

  const item = await prisma.bannedPhrase.upsert({
    where: { phrase },
    update: {
      target: input.target,
      action: input.action,
      reason: input.reason ?? null,
      active: true,
    },
    create: {
      phrase,
      target: input.target,
      action: input.action,
      reason: input.reason ?? null,
      createdByProfileId: current.profileId,
    },
  });

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "admin",
    action: "moderation.phrase.upsert",
    targetType: "banned_phrase",
    targetId: item.id,
    metadata: { target: item.target, action: item.action },
  });

  return item;
}

export async function setBannedPhraseActiveForModerator(
  current: CurrentUserProfile,
  phraseId: string,
  active: boolean
) {
  const item = await prisma.bannedPhrase.update({
    where: { id: phraseId },
    data: { active },
  });

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "admin",
    action: active ? "moderation.phrase.activate" : "moderation.phrase.deactivate",
    targetType: "banned_phrase",
    targetId: item.id,
    metadata: { target: item.target },
  });

  return item;
}

export async function listTrustSafetyFlagsForModerator(limit = 50) {
  return safeQuery(
    () =>
      prisma.trustSafetyFlag.findMany({
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: limit,
      }),
    []
  );
}

export async function resolveTrustSafetyFlagForModerator(
  current: CurrentUserProfile,
  flagId: string
) {
  const flag = await prisma.trustSafetyFlag.update({
    where: { id: flagId },
    data: {
      status: "resolved",
      resolvedByProfileId: current.profileId,
      resolvedAt: new Date(),
    },
  });

  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "admin",
    action: "trust_safety_flag.resolve",
    targetType: "trust_safety_flag",
    targetId: flag.id,
    metadata: { targetType: flag.targetType, targetId: flag.targetId },
  });

  return flag;
}

export async function findBannedPhraseMatch(
  text: string,
  target: Exclude<ModerationTarget, "all">
) {
  const phrases = await prisma.bannedPhrase.findMany({
    where: {
      active: true,
      OR: [{ target: "all" }, { target }],
    },
    select: { id: true, phrase: true, action: true, reason: true },
  });
  const normalized = text.toLowerCase();

  return phrases.find((item) => normalized.includes(item.phrase)) ?? null;
}

function normalizePhrase(value: string) {
  return cleanText(value).toLowerCase().replace(/\s+/g, " ").trim();
}
