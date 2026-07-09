"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, MessageSquare, Phone, Video } from "lucide-react";
import { startChatAction } from "@/app/actions";
import { getBrowserRealtimeClient } from "@/components/realtime-refresh";

export type HubFriend = {
  friendshipId: string;
  profileId: string;
  displayName: string;
  verified: boolean;
  conversationId: string | null;
};

// Friends with live presence dots. Presence payloads carry profileId ONLY
// (shared members channel) and are filtered to accepted friends client-side.
export function HubFriendsList({
  channelName,
  selfProfileId,
  friends,
  canStartChat,
  canStartCall,
}: {
  channelName: string | null;
  selfProfileId: string;
  friends: HubFriend[];
  canStartChat: boolean;
  canStartCall: boolean;
}) {
  const [onlineIds, setOnlineIds] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const client = getBrowserRealtimeClient();
    if (!client || !channelName) return;

    const channel = client.channel(channelName);
    const syncOnline = () => {
      const state = channel.presenceState<{ profileId?: string }>();
      const ids = new Set(
        Object.values(state)
          .flat()
          .map((presence) => presence.profileId)
          .filter((id): id is string => Boolean(id))
      );
      setOnlineIds(ids);
    };
    channel
      .on("presence", { event: "sync" }, syncOnline)
      .on("presence", { event: "leave" }, syncOnline)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ profileId: selfProfileId });
        }
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [channelName, selfProfileId]);

  if (friends.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
        No friends yet. Search members below to connect.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {friends.map((friend) => {
        const online = onlineIds.has(friend.profileId);
        return (
          <li
            key={friend.friendshipId}
            className="flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
          >
            <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.1] bg-[hsl(var(--surface-2))] text-[12px] font-bold text-white/70">
              {friend.displayName.slice(0, 1).toUpperCase()}
              <span
                aria-hidden="true"
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[hsl(var(--surface-1))] ${
                  online ? "bg-emerald-400" : "bg-white/25"
                }`}
              />
              <span className="sr-only">
                {online ? "Online" : "Offline"}
              </span>
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[hsl(var(--foreground))]">
              {friend.displayName}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {friend.conversationId ? (
                <Link
                  href={`/pulse/${friend.conversationId}`}
                  aria-label={`Message ${friend.displayName}`}
                  className="giq-outline-action min-h-8 w-8 justify-center px-0"
                >
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              ) : canStartChat ? (
                <form action={startChatAction}>
                  <input type="hidden" name="profileId" value={friend.profileId} />
                  <button
                    type="submit"
                    aria-label={`Start chat with ${friend.displayName}`}
                    className="giq-outline-action min-h-8 w-8 justify-center px-0"
                  >
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </form>
              ) : (
                <Link
                  href="/pricing"
                  aria-label="Starting chats is a Pro feature"
                  className="giq-outline-action min-h-8 w-8 justify-center px-0 opacity-60"
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
              {friend.conversationId && canStartCall ? (
                <>
                  <Link
                    href={`/pulse/${friend.conversationId}`}
                    aria-label={`Voice call ${friend.displayName}`}
                    className="giq-outline-action min-h-8 w-8 justify-center px-0"
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <Link
                    href={`/pulse/${friend.conversationId}`}
                    aria-label={`Video call ${friend.displayName}`}
                    className="giq-outline-action min-h-8 w-8 justify-center px-0"
                  >
                    <Video className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </>
              ) : friend.conversationId ? (
                <Link
                  href="/pricing"
                  aria-label="Calls are a Pro feature"
                  className="giq-outline-action min-h-8 w-8 justify-center px-0 opacity-60"
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
