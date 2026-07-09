import "server-only";

import { buildDogWinNotification } from "@/lib/dog-win-message";
import { withDbSystemContext } from "@/lib/db-context";
import { logError } from "@/lib/logger";
import { hasTier } from "@/lib/tier-access";

// Only look back a few days so the results cron (every 5 min) re-scans a bounded
// window; older wins are already notified. Idempotency is guaranteed per (user,
// race) by the existence check below, so re-scanning the window is safe.
const WIN_LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;
// ponytail: owned-dog wins per window are tiny; a flat cap avoids an unbounded
// scan without needing pagination. Raise if verified-owner volume grows.
const WIN_NOTIFY_BATCH = 200;

export type DogWinNotifyResult = { scanned: number; created: number };

/**
 * Notify Pro owners when a dog they have an approved ownership claim on finishes
 * first. The notification links to a one-tap winner-card generation flow (card
 * generation itself stays manual and Pro-gated). Runs under system context from
 * the results sync. Idempotent: at most one dog_win notification per (user, race).
 */
export async function notifyDogWinnersFromRecentResults(
  now = new Date()
): Promise<DogWinNotifyResult> {
  try {
    return await withDbSystemContext(async (tx) => {
      const since = new Date(now.getTime() - WIN_LOOKBACK_MS);
      const wins = await tx.result.findMany({
        where: {
          finishingPosition: 1,
          runner: {
            race: { raceTime: { gte: since, lte: now } },
            dog: { ownership: { some: { status: "approved" } } },
          },
        },
        select: {
          raceId: true,
          runner: {
            select: {
              dog: {
                select: {
                  id: true,
                  name: true,
                  ownership: {
                    where: { status: "approved" },
                    select: {
                      profileId: true,
                      profile: {
                        select: {
                          userId: true,
                          user: { select: { subscriptionTier: true } },
                        },
                      },
                    },
                  },
                },
              },
              race: {
                select: {
                  name: true,
                  meeting: { select: { track: { select: { name: true } } } },
                },
              },
            },
          },
        },
        take: WIN_NOTIFY_BATCH,
        orderBy: { createdAt: "desc" },
      });

      let created = 0;
      for (const win of wins) {
        const dog = win.runner.dog;
        const trackName = win.runner.race.meeting?.track?.name ?? null;

        for (const owner of dog.ownership) {
          if (!hasTier(owner.profile.user.subscriptionTier, "pro")) continue;
          const userId = owner.profile.userId;

          // Permanent, idempotent dedupe: one dog_win notification per (user,
          // race). Cheap because the win set is tiny; no window needed.
          const existing = await tx.notification.findFirst({
            where: {
              userId,
              type: "dog_win",
              targetType: "race",
              targetId: win.raceId,
            },
            select: { id: true },
          });
          if (existing) continue;

          const page = await tx.customPage.findFirst({
            where: {
              ownerProfileId: owner.profileId,
              pageType: "dog",
              dogId: dog.id,
            },
            select: { id: true },
          });
          const href = page
            ? `/account/pages/${page.id}`
            : `/account/pages?dogId=${dog.id}`;

          const message = buildDogWinNotification(dog.name, trackName, href);
          await tx.notification.create({
            data: {
              userId,
              type: "dog_win",
              title: message.title,
              body: message.body,
              href: message.href,
              targetType: "race",
              targetId: win.raceId,
            },
          });
          created += 1;
        }
      }

      return { scanned: wins.length, created };
    });
  } catch (err) {
    // Never break the results sync over a notification failure.
    logError("dog_win_notify.failed", {}, err);
    return { scanned: 0, created: 0 };
  }
}
