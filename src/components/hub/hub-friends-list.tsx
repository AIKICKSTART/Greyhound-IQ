"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Lock, MessageSquare, Phone, Video } from "lucide-react";
import { startChatAction } from "@/app/actions";
import {
  ensureBrowserRealtimeAuthorization,
  getBrowserRealtimeClient,
} from "@/components/realtime-refresh";
import {
  createClientCallRoom,
  type ClientCallType,
} from "@/lib/call-client-actions";

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
  senderActorId,
}: {
  channelName: string | null;
  selfProfileId: string;
  friends: HubFriend[];
  canStartChat: boolean;
  canStartCall: boolean;
  senderActorId?: string | null;
}) {
  const router = useRouter();
  const [onlineIds, setOnlineIds] = useState<ReadonlySet<string>>(new Set());
  const [pendingCall, setPendingCall] = useState<{
    friendshipId: string;
    callType: ClientCallType;
  } | null>(null);
  const [callError, setCallError] = useState<{
    conversationId: string;
    message: string;
  } | null>(null);

  async function placeCall(friend: HubFriend, callType: ClientCallType) {
    if (!friend.conversationId) return;
    setPendingCall({ friendshipId: friend.friendshipId, callType });
    setCallError(null);
    let navigating = false;
    try {
      const created = await createClientCallRoom(friend.conversationId, callType);
      navigating = true;
      router.push(
        `/pulse/${encodeURIComponent(friend.conversationId)}?call=${created.callType}`
      );
    } catch (error) {
      setCallError({
        conversationId: friend.conversationId,
        message: error instanceof Error ? error.message : "Could not start call",
      });
    } finally {
      if (!navigating) setPendingCall(null);
    }
  }

  useEffect(() => {
    const client = getBrowserRealtimeClient();
    if (!client || !channelName) return;

    let cancelled = false;
    let channel: ReturnType<typeof client.channel> | null = null;
    const subscribe = async () => {
      await ensureBrowserRealtimeAuthorization(client, [channelName]);
      if (cancelled) return;
      const subscribedChannel = client.channel(channelName, {
        config: { private: true },
      });
      channel = subscribedChannel;
      const syncOnline = () => {
        const state = subscribedChannel.presenceState<{ profileId?: string }>();
        const ids = new Set(
          Object.values(state)
            .flat()
            .map((presence) => presence.profileId)
            .filter((id): id is string => Boolean(id))
        );
        setOnlineIds(ids);
      };
      subscribedChannel
        .on("presence", { event: "sync" }, syncOnline)
        .on("presence", { event: "leave" }, syncOnline)
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void subscribedChannel.track({ profileId: selfProfileId });
          }
        });
    };
    void subscribe().catch(() => null);

    return () => {
      cancelled = true;
      if (channel) void client.removeChannel(channel);
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
    <>
    <ul className="giq-social-friends-list space-y-1">
      {friends.map((friend) => {
        const online = onlineIds.has(friend.profileId);
        const pendingVoice =
          pendingCall?.friendshipId === friend.friendshipId &&
          pendingCall.callType === "voice";
        const pendingVideo =
          pendingCall?.friendshipId === friend.friendshipId &&
          pendingCall.callType === "video";
        return (
          <li
            key={friend.friendshipId}
            className="giq-social-messenger-row flex min-h-12 items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
          >
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.1] bg-[hsl(var(--surface-2))] text-[12px] font-bold text-white/70">
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
                  className="giq-social-rail-action giq-outline-action h-11 w-11 justify-center px-0"
                >
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              ) : canStartChat ? (
                <form action={startChatAction}>
                  <input type="hidden" name="profileId" value={friend.profileId} />
                  {senderActorId && (
                    <input type="hidden" name="senderActorId" value={senderActorId} />
                  )}
                  <button
                    type="submit"
                    aria-label={`Start chat with ${friend.displayName}`}
                    className="giq-social-rail-action giq-outline-action h-11 w-11 justify-center px-0"
                  >
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </form>
              ) : (
                <Link
                  href="/pricing"
                  aria-label="Starting chats is a Pro feature"
                  className="giq-social-rail-action giq-outline-action h-11 w-11 justify-center px-0 opacity-60"
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
              {friend.conversationId && canStartCall ? (
                <>
                  <button
                    type="button"
                    onClick={() => void placeCall(friend, "voice")}
                    disabled={pendingCall !== null}
                    aria-busy={pendingVoice}
                    aria-label={
                      pendingVoice
                        ? `Starting voice call with ${friend.displayName}`
                        : `Voice call ${friend.displayName}`
                    }
                    className="giq-social-rail-action giq-outline-action h-11 w-11 justify-center px-0 disabled:cursor-wait disabled:opacity-60"
                  >
                    {pendingVoice ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void placeCall(friend, "video")}
                    disabled={pendingCall !== null}
                    aria-busy={pendingVideo}
                    aria-label={
                      pendingVideo
                        ? `Starting video call with ${friend.displayName}`
                        : `Video call ${friend.displayName}`
                    }
                    className="giq-social-rail-action giq-outline-action h-11 w-11 justify-center px-0 disabled:cursor-wait disabled:opacity-60"
                  >
                    {pendingVideo ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Video className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </>
              ) : friend.conversationId ? (
                <Link
                  href="/pricing"
                  aria-label="Calls are a Pro feature"
                  className="giq-social-rail-action giq-outline-action h-11 w-11 justify-center px-0 opacity-60"
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
    {callError && (
      <p role="alert" className="mt-2 text-[12px] text-red-200">
        {callError.message}{" "}
        <Link
          href={`/pulse/${callError.conversationId}`}
          className="font-semibold underline underline-offset-2"
        >
          Open chat
        </Link>
      </p>
    )}
    </>
  );
}
