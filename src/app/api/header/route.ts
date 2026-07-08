import { NextResponse } from "next/server";
import { getCurrentUser, isModeratorRole } from "@/lib/auth";
import { countUnreadMessagesTotal } from "@/lib/conversation-service";
import { countUnreadNotificationsForUser } from "@/lib/notification-service";
import { profileRealtimeChannel } from "@/lib/realtime-service";
import { cached } from "@/lib/ttl-cache";

// Per-user header state for the client auth island. Always no-store — this is
// the dynamic sidecar that lets the page HTML itself stay user-agnostic and
// cacheable. Returns { signedIn: false } for anonymous callers.
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { signedIn: false },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const [unreadMessages, unreadNotifications] =
    user.profileId && user.dbUserId
      ? await Promise.all([
          countUnreadMessagesTotal({
            dbUserId: user.dbUserId,
            profileId: user.profileId,
            profileRole: user.role ?? "member",
            tier: user.tier,
          }),
          cached(`notif:unread:${user.dbUserId}`, 30_000, () =>
            countUnreadNotificationsForUser(user.dbUserId!)
          ),
        ])
      : [0, 0];

  return NextResponse.json(
    {
      signedIn: true,
      firstName: user.firstName,
      name: user.name,
      email: user.email,
      tier: user.tier,
      canAccessAdmin: isModeratorRole(user.role),
      unreadMessages,
      unreadNotifications,
      profileChannel: user.profileId
        ? profileRealtimeChannel(user.profileId)
        : null,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
