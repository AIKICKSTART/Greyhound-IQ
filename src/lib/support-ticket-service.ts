import "server-only";

import type { CurrentUserProfile } from "@/lib/auth-types";
import { withDbRequestContext } from "@/lib/db-context";
import { resolveDemoSupportTicketFixture } from "@/lib/demo-support-ticket";

export const SUPPORT_TICKET_MESSAGE_LIMIT = 100;

export async function getSupportTicketForCurrentUser(
  current: CurrentUserProfile,
  ticketId: string,
) {
  const demoTicket = resolveDemoSupportTicketFixture(current, ticketId);
  if (demoTicket) return demoTicket;

  const ticket = await withDbRequestContext(current, (tx) =>
    tx.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId: current.dbUserId,
      },
      select: {
        id: true,
        category: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            messages: true,
          },
        },
        messages: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: SUPPORT_TICKET_MESSAGE_LIMIT,
          select: {
            id: true,
            userId: true,
            body: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    }),
  );

  if (!ticket) return null;

  return {
    ...ticket,
    messages: [...ticket.messages].reverse(),
  };
}

export function supportMessageAuthorLabel(
  messageUserId: string | null,
  ticketOwnerUserId: string,
) {
  return messageUserId === ticketOwnerUserId ? "You" : "GreyhoundIQ support";
}
