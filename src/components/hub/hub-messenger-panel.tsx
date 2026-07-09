import Link from "next/link";
import { Check, Inbox, UserPlus, Users, X } from "lucide-react";
import { respondToFriendRequestAction } from "@/app/actions";
import { AddFriendSearch } from "@/components/hub/add-friend-search";
import {
  HubFriendsList,
  type HubFriend,
} from "@/components/hub/hub-friends-list";
import {
  HubIncomingCall,
  type IncomingCallInvite,
} from "@/components/hub/hub-incoming-call";
import type { FriendRequestItem } from "@/lib/friend-service";

export type HubConversationRow = {
  id: string;
  otherName: string;
  preview: string;
  unread: number;
};

// Right-hand messenger column. Server-rendered shell; presence + search +
// call-decline are the only client islands.
export function HubMessengerPanel({
  presenceChannel,
  selfProfileId,
  invites,
  requests,
  friends,
  conversations,
  canStartChat,
  canStartCall,
}: {
  presenceChannel: string | null;
  selfProfileId: string;
  invites: IncomingCallInvite[];
  requests: FriendRequestItem[];
  friends: HubFriend[];
  conversations: HubConversationRow[];
  canStartChat: boolean;
  canStartCall: boolean;
}) {
  const incoming = requests.filter((request) => request.direction === "incoming");
  const outgoing = requests.filter((request) => request.direction === "outgoing");

  return (
    <div className="space-y-4">
      {invites.map((invite) => (
        <HubIncomingCall key={invite.inviteId} invite={invite} />
      ))}

      {incoming.length > 0 && (
        <section className="giq-panel p-4" aria-label="Friend requests">
          <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Requests
            <span className="giq-status-pill giq-status-pill-purple ml-auto">
              {incoming.length}
            </span>
          </h2>
          <ul className="space-y-2">
            {incoming.map((request) => (
              <li
                key={request.friendshipId}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-[hsl(var(--foreground))]">
                    {request.displayName}
                  </span>
                  <span className="block truncate text-[11px] text-[hsl(var(--subtle-foreground))]">
                    {request.kennelName ?? request.state ?? "GreyhoundIQ member"}
                  </span>
                </span>
                <form action={respondToFriendRequestAction}>
                  <input type="hidden" name="friendshipId" value={request.friendshipId} />
                  <input type="hidden" name="response" value="accept" />
                  <button
                    type="submit"
                    aria-label={`Accept friend request from ${request.displayName}`}
                    className="giq-button giq-button-primary min-h-8 w-8 justify-center px-0"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </form>
                <form action={respondToFriendRequestAction}>
                  <input type="hidden" name="friendshipId" value={request.friendshipId} />
                  <input type="hidden" name="response" value="decline" />
                  <button
                    type="submit"
                    aria-label={`Decline friend request from ${request.displayName}`}
                    className="giq-button giq-button-glass min-h-8 w-8 justify-center px-0"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="giq-panel p-4" aria-label="Friends">
        <h2 className="mb-3 flex items-center justify-between gap-2 text-[13px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
          <span className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Friends
          </span>
          <Link
            href="/pulse/friends"
            className="text-[11px] font-medium normal-case tracking-normal text-[hsl(var(--primary-light))] hover:underline"
          >
            View all
          </Link>
        </h2>
        <HubFriendsList
          channelName={presenceChannel}
          selfProfileId={selfProfileId}
          friends={friends}
          canStartChat={canStartChat}
          canStartCall={canStartCall}
        />
        {outgoing.length > 0 && (
          <p className="mt-3 text-[11px] text-[hsl(var(--subtle-foreground))]">
            {outgoing.length} pending sent request{outgoing.length === 1 ? "" : "s"}
          </p>
        )}
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <AddFriendSearch
            excludeProfileIds={[
              selfProfileId,
              ...friends.map((friend) => friend.profileId),
              ...requests.map((request) => request.profileId),
            ]}
          />
        </div>
      </section>

      <section className="giq-panel p-4" aria-label="Recent conversations">
        <h2 className="mb-3 flex items-center justify-between gap-2 text-[13px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
          <span className="flex items-center gap-2">
            <Inbox className="h-3.5 w-3.5" aria-hidden="true" />
            Chats
          </span>
          <Link
            href="/pulse"
            className="text-[11px] font-medium normal-case tracking-normal text-[hsl(var(--primary-light))] hover:underline"
          >
            Inbox
          </Link>
        </h2>
        {conversations.length === 0 ? (
          <p className="text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            No conversations yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/pulse/${conversation.id}`}
                  className="flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.1] bg-[hsl(var(--surface-2))] text-[12px] font-bold text-white/70">
                    {conversation.otherName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-[hsl(var(--foreground))]">
                      {conversation.otherName}
                    </span>
                    <span className="block truncate text-[11px] text-[hsl(var(--subtle-foreground))]">
                      {conversation.preview}
                    </span>
                  </span>
                  {conversation.unread > 0 && (
                    <span
                      aria-label={`${conversation.unread} unread`}
                      className="inline-flex min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary-bright))] px-1.5 text-[10px] font-bold leading-[20px] tabular-nums text-[hsl(var(--primary-foreground))]"
                    >
                      {conversation.unread > 99 ? "99+" : conversation.unread}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
