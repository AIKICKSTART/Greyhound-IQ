import type { BannedPhrase, TrustSafetyFlag } from "@prisma/client";
import { createAuditLog } from "@/lib/account-service";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { cleanText } from "@/lib/content";
import { safeQuery } from "@/lib/db";
import { withDbRequestContext, withDbSystemContext } from "@/lib/db-context";

export type ModerationTarget = "all" | "listing" | "feed" | "message";
export type ModerationAction = "review" | "block";

export type BannedPhraseInput = {
  phrase: string;
  target: ModerationTarget;
  action: ModerationAction;
  reason?: string | null;
};

export async function listBannedPhrasesForModerator() {
  // System context: BannedPhrase reads are gated to system/moderator by RLS, and
  // this listing is only reachable behind a moderator-gated surface.
  return safeQuery<BannedPhrase[]>(
    () =>
      withDbSystemContext((tx) =>
        tx.bannedPhrase.findMany({
          orderBy: [{ active: "desc" }, { target: "asc" }, { phrase: "asc" }],
          take: 1_000,
        })
      ),
    []
  );
}

export async function createBannedPhraseForModerator(
  current: CurrentUserProfile,
  input: BannedPhraseInput
) {
  const phrase = normalizePhrase(input.phrase);
  if (!phrase) throw new Error("moderation.phrase_required");

  const item = await withDbRequestContext(current, (tx) =>
    tx.bannedPhrase.upsert({
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
    })
  );

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
  const item = await withDbRequestContext(current, (tx) =>
    tx.bannedPhrase.update({
      where: { id: phraseId },
      data: { active },
    })
  );

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
  return safeQuery<TrustSafetyFlag[]>(
    () =>
      withDbSystemContext((tx) =>
        tx.trustSafetyFlag.findMany({
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          take: Math.min(Math.max(1, Math.trunc(limit)), 100),
        })
      ),
    []
  );
}

export async function resolveTrustSafetyFlagForModerator(
  current: CurrentUserProfile,
  flagId: string
) {
  const flag = await withDbRequestContext(current, (tx) =>
    tx.trustSafetyFlag.update({
      where: { id: flagId },
      data: {
        status: "resolved",
        resolvedByProfileId: current.profileId,
        resolvedAt: new Date(),
      },
    })
  );

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
  // System context: the banned-phrase filter must run for every author (a normal
  // sender has no moderator RLS grant), so read the list under system context.
  const phrases = await withDbSystemContext((tx) =>
    tx.bannedPhrase.findMany({
      where: {
        active: true,
        OR: [{ target: "all" }, { target }],
      },
      select: { id: true, phrase: true, action: true, reason: true },
      take: 1_001,
    })
  );
  if (phrases.length > 1_000) throw new Error("moderation.phrase_catalog_too_large");
  const normalized = text.toLowerCase();

  return phrases.find((item) => normalized.includes(item.phrase)) ?? null;
}

function normalizePhrase(value: string) {
  return cleanText(value).toLowerCase().replace(/\s+/g, " ").trim();
}
