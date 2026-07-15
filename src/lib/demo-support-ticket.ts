import type { CurrentUserProfile } from "@/lib/auth-types";
import {
  DEMO_ADMIN_EMAIL,
  isFullAccessDemo,
  type DemoAccessEnv,
} from "@/lib/demo-access";

export const DEMO_SUPPORT_TICKET_ID = "demo-support-ticket-control-room";

const CREATED_AT = new Date("2026-07-12T10:00:00.000Z");
const REPLIED_AT = new Date("2026-07-12T10:05:00.000Z");

export function resolveDemoSupportTicketFixture(
  current: Pick<CurrentUserProfile, "dbUserId" | "email">,
  ticketId: string,
  env?: DemoAccessEnv,
) {
  if (
    !isFullAccessDemo(env) ||
    current.email !== DEMO_ADMIN_EMAIL ||
    ticketId !== DEMO_SUPPORT_TICKET_ID
  ) {
    return null;
  }

  return {
    id: DEMO_SUPPORT_TICKET_ID,
    category: "technical",
    status: "open",
    priority: "normal",
    createdAt: CREATED_AT,
    updatedAt: REPLIED_AT,
    _count: { messages: 2 },
    messages: [
      {
        id: "demo-support-message-member",
        userId: current.dbUserId,
        body: "Please confirm the Design Lab support workflow is ready for production review.",
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      },
      {
        id: "demo-support-message-team",
        userId: null,
        body: "The ticket is owner-scoped and ready for the review walkthrough.",
        createdAt: REPLIED_AT,
        updatedAt: REPLIED_AT,
      },
    ],
  };
}
