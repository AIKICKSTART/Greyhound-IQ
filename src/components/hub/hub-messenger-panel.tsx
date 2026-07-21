import Link from "next/link";
import Image from "next/image";
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
import { HubConversationDock } from "@/components/hub/hub-conversation-dock";
import type { FriendRequestItem } from "@/lib/friend-service";
import { conversationRealtimeChannel } from "@/lib/realtime-service";

export type HubConversationRow = {
  id: string;
  otherName: string;
  otherAvatarUrl: string | null;
  preview: string;
  unread: number;
  attachmentCount?: number;
  personToPerson: boolean;
};

// Right-hand messenger column. Server-rendered shell with focused client
// islands for presence, discovery, calls, and docked desktop quick chats.
export function HubMessengerPanel({
  selfProfileId,
  invites,
  requests,
  friends,
  conversations,
  canStartChat,
  canStartCall,
  senderActorId,
}: {
  selfProfileId: string;
  invites: IncomingCallInvite[];
  requests: FriendRequestItem[];
  friends: HubFriend[];
  conversations: HubConversationRow[];
  canStartChat: boolean;
  canStartCall: boolean;
  senderActorId?: string | null;
}) {
  const incoming = requests.filter((request) => request.direction === "incoming");
  const outgoing = requests.filter((request) => request.direction === "outgoing");

  return (
    <div className="giq-social-messenger min-h-0 space-y-4 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
      {invites.map((invite) => (
        <HubIncomingCall key={invite.inviteId} invite={invite} />
      ))}

      {incoming.length > 0 && (
        <section className="giq-social-messenger-section giq-panel p-4" aria-label="Friend requests">
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
                className="giq-social-messenger-row flex min-h-11 items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2"
              >
                <span className="relative grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-[hsl(var(--primary)/0.14)] text-[12px] font-bold text-[hsl(var(--primary-light))]">
                  {request.avatarUrl ? (
                    <Image
                      src={request.avatarUrl}
                      alt=""
                      fill
                      className="rounded-full object-cover"
                      sizes="40px"
                      unoptimized={request.avatarUrl.startsWith("/api/media/")}
                    />
                  ) : (
                    request.displayName.trim().charAt(0).toUpperCase() || "G"
                  )}
                </span>
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
                    className="giq-button giq-button-primary h-11 w-11 justify-center px-0"
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
                    className="giq-button giq-button-glass h-11 w-11 justify-center px-0"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="giq-social-messenger-section giq-panel p-4" aria-label="Friends">
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
          friends={friends}
          canStartChat={canStartChat}
          canStartCall={canStartCall}
          senderActorId={senderActorId}
        />
        {outgoing.length > 0 && (
          <p className="mt-3 text-[11px] text-[hsl(var(--subtle-foreground))]">
            {outgoing.length} pending sent request{outgoing.length === 1 ? "" : "s"}
          </p>
        )}
      </section>

      <section className="giq-social-messenger-section giq-panel p-4" aria-label="Recent conversations">
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
          <HubConversationDock
            selfProfileId={selfProfileId}
            canStartCall={canStartCall}
            conversations={conversations.map((conversation) => ({
              ...conversation,
              realtimeChannel: conversationRealtimeChannel(conversation.id),
            }))}
          />
        )}
      </section>

      <section className="giq-social-messenger-section giq-panel p-4" aria-label="Find people">
        <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
          Find people
        </h2>
        <AddFriendSearch
          excludeProfileIds={[
            selfProfileId,
            ...friends.map((friend) => friend.profileId),
            ...requests.map((request) => request.profileId),
          ]}
        />
      </section>
    </div>
  );
}
