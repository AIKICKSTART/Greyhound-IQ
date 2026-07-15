"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Loader2,
  Lock,
  MessageSquare,
  Phone,
  Users,
  Video,
} from "lucide-react";
import { startChatAction } from "@/app/actions";
import {
  createClientCallRoom,
  type ClientCallType,
} from "@/lib/call-client-actions";

export type HubFriend = {
  friendshipId: string;
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  verified: boolean;
  conversationId: string | null;
};

// Friend controls intentionally avoid a product-wide presence subscription.
// Messaging and calls remain available without exposing unrelated activity.
export function HubFriendsList({
  friends,
  canStartChat,
  canStartCall,
  senderActorId,
}: {
  friends: HubFriend[];
  canStartChat: boolean;
  canStartCall: boolean;
  senderActorId?: string | null;
}) {
  const router = useRouter();
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
      const created = await createClientCallRoom(
        friend.conversationId,
        callType,
      );
      navigating = true;
      router.push(
        `/pulse/${encodeURIComponent(friend.conversationId)}?call=${created.callType}`,
      );
    } catch (error) {
      setCallError({
        conversationId: friend.conversationId,
        message:
          error instanceof Error ? error.message : "Could not start call",
      });
    } finally {
      if (!navigating) setPendingCall(null);
    }
  }

  if (friends.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.1] px-4 py-6 text-center">
        <Users
          className="mx-auto h-6 w-6 text-[hsl(var(--primary-bright))]"
          aria-hidden="true"
        />
        <p className="mt-3 text-[13px] font-medium text-[hsl(var(--foreground))]">
          Your friends will appear here
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Search members below to connect.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="giq-social-friends-list space-y-1.5">
        {friends.map((friend) => {
          const pendingVoice =
            pendingCall?.friendshipId === friend.friendshipId &&
            pendingCall.callType === "voice";
          const pendingVideo =
            pendingCall?.friendshipId === friend.friendshipId &&
            pendingCall.callType === "video";
          return (
            <li
              key={friend.friendshipId}
              className="giq-social-messenger-row flex min-h-14 items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2 transition hover:border-white/[0.07] hover:bg-white/[0.04]"
            >
              <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-white/[0.1] bg-[hsl(var(--surface-2))] text-[12px] font-bold text-white/70 shadow-sm">
                {friend.avatarUrl ? (
                  <Image
                    src={friend.avatarUrl}
                    alt=""
                    fill
                    className="rounded-full object-cover"
                    sizes="40px"
                    unoptimized={friend.avatarUrl.startsWith("/api/media/")}
                  />
                ) : (
                  friend.displayName.slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold text-[hsl(var(--foreground))]">
                    {friend.displayName}
                  </span>
                  {friend.verified ? (
                    <BadgeCheck
                      className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--primary-bright))]"
                      aria-label="Verified member"
                    />
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[10px] font-medium text-[hsl(var(--subtle-foreground))]">
                  Friend
                </span>
              </span>
              <span
                role="group"
                aria-label={`Contact ${friend.displayName}`}
                className="flex shrink-0 items-center gap-1"
              >
                {friend.conversationId ? (
                  <Link
                    href={`/pulse/${friend.conversationId}`}
                    aria-label={`Message ${friend.displayName}`}
                    className="giq-social-rail-action giq-outline-action h-11 w-11 justify-center px-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
                  >
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                ) : canStartChat ? (
                  <form action={startChatAction}>
                    <input
                      type="hidden"
                      name="profileId"
                      value={friend.profileId}
                    />
                    {senderActorId && (
                      <input
                        type="hidden"
                        name="senderActorId"
                        value={senderActorId}
                      />
                    )}
                    <button
                      type="submit"
                      aria-label={`Start chat with ${friend.displayName}`}
                      className="giq-social-rail-action giq-outline-action h-11 w-11 justify-center px-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
                    >
                      <MessageSquare
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                    </button>
                  </form>
                ) : (
                  <Link
                    href="/pricing"
                    aria-label="Starting chats is a Pro feature"
                    className="giq-social-rail-action giq-outline-action h-11 w-11 justify-center px-0 opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
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
                      className="giq-social-rail-action giq-outline-action h-11 w-11 justify-center px-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)] disabled:cursor-wait disabled:opacity-60"
                    >
                      {pendingVoice ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
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
                      className="giq-social-rail-action giq-outline-action h-11 w-11 justify-center px-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)] disabled:cursor-wait disabled:opacity-60"
                    >
                      {pendingVideo ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Video className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </>
                ) : friend.conversationId ? (
                  <Link
                    href="/pricing"
                    aria-label="Calls are a Pro feature"
                    className="giq-social-rail-action giq-outline-action h-11 w-11 justify-center px-0 opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
                  >
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      {callError ? (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-red-300/15 bg-red-400/[0.07] px-3 py-2 text-[12px] leading-relaxed text-red-200"
        >
          {callError.message}{" "}
          <Link
            href={`/pulse/${callError.conversationId}`}
            className="font-semibold underline underline-offset-2"
          >
            Open chat
          </Link>
        </p>
      ) : null}
    </>
  );
}
