import "server-only";

import { withDbSystemContext } from "@/lib/db-context";
import { fetchLinkPreview } from "@/lib/link-preview";
import { logRequestError } from "@/lib/logger";
import { broadcastFeedRealtimeEvent } from "@/lib/realtime-service";

const LINK_PREVIEW_BATCH_SIZE = 25;

export async function runLinkPreviewMaintenance() {
  const candidates = await withDbSystemContext((tx) =>
    tx.feedPost.findMany({
      where: {
        deletedAt: null,
        linkPreviewStatus: "pending",
        linkPreviewUrl: { not: null },
      },
      select: { id: true, linkPreviewUrl: true, visibility: true },
      orderBy: { createdAt: "asc" },
      take: LINK_PREVIEW_BATCH_SIZE,
    })
  );

  let ready = 0;
  let failed = 0;
  for (const candidate of candidates) {
    const claimed = await withDbSystemContext((tx) =>
      tx.feedPost.updateMany({
        where: { id: candidate.id, linkPreviewStatus: "pending" },
        data: { linkPreviewStatus: "processing" },
      })
    );
    if (claimed.count !== 1 || !candidate.linkPreviewUrl) continue;

    try {
      const preview = await fetchLinkPreview(candidate.linkPreviewUrl);
      await withDbSystemContext((tx) =>
        tx.feedPost.update({
          where: { id: candidate.id },
          data: {
            linkPreviewStatus: "ready",
            linkPreviewJson: JSON.stringify(preview),
          },
        })
      );
      if (candidate.visibility === "public") {
        await broadcastFeedRealtimeEvent("post_updated", {
          postId: candidate.id,
          action: "link_preview_ready",
        });
      }
      ready += 1;
    } catch (err) {
      await logRequestError("feed.link_preview_failed", { postId: candidate.id }, err);
      await withDbSystemContext((tx) =>
        tx.feedPost.update({
          where: { id: candidate.id },
          data: { linkPreviewStatus: "failed", linkPreviewJson: null },
        })
      );
      if (candidate.visibility === "public") {
        await broadcastFeedRealtimeEvent("post_updated", {
          postId: candidate.id,
          action: "link_preview_failed",
        });
      }
      failed += 1;
    }
  }

  return { candidates: candidates.length, ready, failed };
}
