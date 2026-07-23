import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { ConversationCallPanel } from "@/components/conversation-call-panel";
import { ConversationDeliveryAcknowledger } from "@/components/conversation-delivery-acknowledger";
import { PulseThreadSurface } from "@/components/pulse-thread-surface";
import { getCurrentUser, hasTier } from "@/lib/auth";
import {
  getActiveCallRoomForConversation,
  getPendingCallInviteForConversation,
} from "@/lib/call-service";
import { getConversationForProfile } from "@/lib/conversation-service";
import { messageThreadQuerySchema } from "@/lib/query-validation";
import { conversationRealtimeChannel } from "@/lib/realtime-service";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return {
    title: `Pulse ${id.slice(0, 8)} - GreyhoundIQ`,
    description: "Private GreyhoundIQ Pulse conversation.",
  };
}

// The conversation view is the shared messenger surface (the dock's
// QuickChatWindow full-bleed) with the reused ConversationCallPanel as a call
// banner. This page only validates access and hands off; the deep-link URL is
// preserved.
export default async function MessageThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ call?: string | string[] }>;
}) {
  const [{ id }, rawQuery, user] = await Promise.all([
    params,
    searchParams,
    getCurrentUser(),
  ]);
  if (!user?.profileId || !user.dbUserId) return <SignedOutThread />;
  const callContext = {
    dbUserId: user.dbUserId,
    profileId: user.profileId,
    profileRole: user.role ?? "member",
    tier: user.tier,
  };
  const parsedQuery = messageThreadQuerySchema.safeParse({ call: rawQuery.call });
  const callIntent = parsedQuery.success ? (parsedQuery.data.call ?? null) : null;

  let conversation: Awaited<ReturnType<typeof getConversationForProfile>>;
  try {
    conversation = await getConversationForProfile(callContext, id);
  } catch {
    notFound();
  }

  const currentIsParticipantA = conversation.participantAId === user.profileId;
  const other = currentIsParticipantA
    ? conversation.participantB
    : conversation.participantA;
  const otherActor = currentIsParticipantA
    ? conversation.participantBActor
    : conversation.participantAActor;
  const otherLabel = otherActor?.displayName ?? other.displayName;
  const otherAvatarUrl = otherActor?.avatarUrl ?? other.avatarUrl;
  const isPageConversation =
    conversation.participantAActor?.kind === "page" ||
    conversation.participantBActor?.kind === "page";

  const [activeCallRoomResult, pendingCallInviteResult] =
    await Promise.allSettled([
      conversation.blockedAt || isPageConversation
        ? null
        : getActiveCallRoomForConversation(callContext, conversation.id),
      conversation.blockedAt || isPageConversation
        ? null
        : getPendingCallInviteForConversation(callContext, conversation.id),
    ]);
  const activeCallRoom =
    activeCallRoomResult.status === "fulfilled"
      ? activeCallRoomResult.value
      : null;
  const pendingCallInvite =
    pendingCallInviteResult.status === "fulfilled"
      ? pendingCallInviteResult.value
      : null;

  const canStartCall = hasTier(user.tier, "pro_plus") && !isPageConversation;
  const callableIntent = isPageConversation ? null : callIntent;
  const prioritizeCallPanel =
    callableIntent !== null ||
    activeCallRoom !== null ||
    pendingCallInvite !== null;

  const lastMessage =
    conversation.messages[conversation.messages.length - 1] ?? null;
  const sentByCurrentUser = lastMessage?.senderId === user.profileId;
  const dockConversation = {
    id: conversation.id,
    otherName: otherLabel,
    otherAvatarUrl,
    otherProfileId: other.id,
    preview: lastMessage
      ? `${sentByCurrentUser ? "You: " : ""}${lastMessage.body}`
      : "Conversation started",
    unread: 0,
    realtimeChannel: conversationRealtimeChannel(conversation.id),
    personToPerson: !isPageConversation,
  };

  // Gate-driven, join-only for non-pro_plus: the panel only renders the call
  // surface when a call is active/ringing/intended. Idle start-call links live
  // in the QuickChatWindow composer and are themselves canStartCall-gated.
  const callBanner = prioritizeCallPanel ? (
    <ConversationCallPanel
      conversationId={conversation.id}
      activeRoom={
        activeCallRoom
          ? {
              id: activeCallRoom.id,
              callType: activeCallRoom.callType === "voice" ? "voice" : "video",
            }
          : null
      }
      pendingInvite={
        pendingCallInvite
          ? {
              id: pendingCallInvite.id,
              roomId: pendingCallInvite.callRoomId,
              callType:
                pendingCallInvite.callRoom.callType === "voice"
                  ? "voice"
                  : "video",
              fromName: pendingCallInvite.fromProfile.displayName,
              expiresAt: pendingCallInvite.expiresAt.toISOString(),
              forMe: pendingCallInvite.toProfileId === user.profileId,
            }
          : null
      }
      blocked={Boolean(conversation.blockedAt)}
      otherName={otherLabel}
      canStartCall={canStartCall}
      autoCallIntent={callableIntent}
    />
  ) : null;

  return (
    <>
      <ConversationDeliveryAcknowledger conversationId={conversation.id} />
      <PulseThreadSurface
        conversation={dockConversation}
        selfProfileId={user.profileId}
        canStartCall={canStartCall}
        callBanner={callBanner}
        blockedByMe={
          Boolean(conversation.blockedAt) &&
          conversation.blockedById === user.profileId
        }
        blockedByOther={
          Boolean(conversation.blockedAt) &&
          conversation.blockedById !== user.profileId
        }
      />
    </>
  );
}

function SignedOutThread() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="giq-panel p-8">
        <Lock className="mb-4 h-7 w-7 text-[hsl(var(--primary-bright))]" />
        <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
          Sign in to view this Pulse conversation
        </h1>
        <a
          href="/sign-in"
          className="giq-liquid-purple-button mt-6 px-5 text-[13px] font-semibold"
        >
          Sign in
        </a>
      </div>
    </div>
  );
}
