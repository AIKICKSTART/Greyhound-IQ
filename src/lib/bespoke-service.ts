import "server-only";
import { withDbRequestContext } from "@/lib/db-context";
import type { CurrentUserProfile } from "@/lib/auth-types";
import { createAuditLog } from "@/lib/account-service";

export const BESPOKE_STATUSES = ["paid", "in_progress", "delivered", "cancelled"] as const;
export type BespokeStatus = (typeof BESPOKE_STATUSES)[number];

// Admin/moderator: full queue. RLS select allows moderators.
export async function listCustomDesignRequests(current: CurrentUserProfile) {
  return withDbRequestContext(current, (tx) =>
    tx.customDesignRequest.findMany({ orderBy: { createdAt: "desc" }, take: 200 })
  );
}

// Buyer: their own requests (RLS scopes to buyerProfileId).
export async function listBespokeRequestsForCurrentUser(current: CurrentUserProfile) {
  return withDbRequestContext(current, (tx) =>
    tx.customDesignRequest.findMany({
      where: { buyerProfileId: current.profileId },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
  );
}

export async function updateCustomDesignRequest(
  current: CurrentUserProfile,
  id: string,
  status: BespokeStatus,
  notes: string | null
) {
  const updated = await withDbRequestContext(current, (tx) =>
    tx.customDesignRequest.update({
      where: { id },
      data: {
        status,
        notes: notes && notes.length > 0 ? notes.slice(0, 2000) : undefined,
        assignedAdminId: current.profileId,
        deliveredAt: status === "delivered" ? new Date() : undefined,
      },
    })
  );
  await createAuditLog({
    actorId: current.dbUserId,
    actorType: "admin",
    action: "bespoke_request.update",
    targetType: "custom_design_request",
    targetId: id,
    metadata: { status },
  });
  return updated;
}
