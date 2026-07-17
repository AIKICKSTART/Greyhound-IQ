import Link from "next/link";
import NextImage from "next/image";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  CheckCheck,
  ChevronsDown,
  ChevronsUp,
  Flag,
  Loader2,
  Lock,
  Paperclip,
  Search,
  ShieldAlert,
  ThumbsUp,
  Trash2,
  Unlock,
} from "lucide-react";
import { PageTitle } from "@/components/page-title";
import {
  blockConversation,
  deleteConversationMessage,
  markConversationReadAction,
  reportConversationMessage,
  toggleMessageReaction,
  unblockConversation,
} from "@/app/actions";
import { ConversationCallPanel } from "@/components/conversation-call-panel";
import { ConversationDeliveryAcknowledger } from "@/components/conversation-delivery-acknowledger";
import { InstantMessageComposer } from "@/components/instant-message-composer";
import { ProcessedVideo } from "@/components/processed-video";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser, hasTier } from "@/lib/auth";
import {
  getActiveCallRoomForConversation,
  getPendingCallInviteForConversation,
  getRecentCallLogForConversation,
} from "@/lib/call-service";
import {
  getConversationForProfile,
  searchConversationMessages,
} from "@/lib/conversation-service";
import { withDbRequestContext } from "@/lib/db-context";
import { messageThreadQuerySchema } from "@/lib/query-validation";
import { conversationRealtimeChannel } from "@/lib/realtime-service";

export const dynamic = "force-dynamic";

const MESSAGE_PAGE_SIZE = 50;

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

export default async function MessageThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    before?: string | string[];
    call?: string | string[];
    q?: string | string[];
  }>;
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
  const parsedQuery = messageThreadQuerySchema.safeParse({
    before: rawQuery.before,
    call: rawQuery.call,
    q: rawQuery.q,
  });
  const before = parsedQuery.success ? parsedQuery.data.before : undefined;
  const callIntent = parsedQuery.success ? (parsedQuery.data.call ?? null) : null;
  const messageQuery = parsedQuery.success ? parsedQuery.data.q : "";

  let conversation: Awaited<ReturnType<typeof getConversationForProfile>>;
  try {
    conversation = await getConversationForProfile(
      callContext,
      id,
      before ? { before } : undefined
    );
  } catch {
    notFound();
  }

  const currentIsParticipantA = conversation.participantAId === user.profileId;
  const other = currentIsParticipantA
    ? conversation.participantB
    : conversation.participantA;
  const selfActor = currentIsParticipantA
    ? conversation.participantAActor
    : conversation.participantBActor;
  const otherActor = currentIsParticipantA
    ? conversation.participantBActor
    : conversation.participantAActor;
  const selfLabel = selfActor?.displayName ?? user.name;
  const otherLabel = otherActor?.displayName ?? other.displayName;
  const otherAvatarUrl = otherActor?.avatarUrl ?? other.avatarUrl;
  const isPageConversation =
    conversation.participantAActor?.kind === "page" ||
    conversation.participantBActor?.kind === "page";
  const [
    activeCallRoomResult,
    pendingCallInviteResult,
    callLogResult,
    otherPresenceResult,
  ] = await Promise.allSettled([
      conversation.blockedAt || isPageConversation
        ? null
        : getActiveCallRoomForConversation(callContext, conversation.id),
      conversation.blockedAt || isPageConversation
        ? null
        : getPendingCallInviteForConversation(callContext, conversation.id),
      getRecentCallLogForConversation(callContext, conversation.id),
      withDbRequestContext(callContext, (tx) =>
        tx.userPresence.findUnique({
          where: { profileId: other.id },
          select: { lastSeenAt: true },
        })
      ),
    ] as const);
  const activeCallRoom =
    activeCallRoomResult.status === "fulfilled"
      ? activeCallRoomResult.value
      : null;
  const pendingCallInvite =
    pendingCallInviteResult.status === "fulfilled"
      ? pendingCallInviteResult.value
      : null;
  const callLog =
    callLogResult.status === "fulfilled" ? callLogResult.value : [];
  const otherPresence =
    otherPresenceResult.status === "fulfilled"
      ? otherPresenceResult.value
      : null;

  const readAction = markConversationReadAction.bind(null, conversation.id);
  const blockAction = blockConversation.bind(null, conversation.id);
  const unblockAction = unblockConversation.bind(null, conversation.id);
  const blockedByMe = conversation.blockedById === user.profileId;
  const realtimeChannel = conversationRealtimeChannel(conversation.id);
  const hasEarlierPage = conversation.messages.length === MESSAGE_PAGE_SIZE;
  const oldestMessageId = conversation.messages[0]?.id ?? null;
  const threadItems = [
    ...conversation.messages.map((message) => ({
      kind: "message" as const,
      at: message.createdAt,
      message,
    })),
    ...callLog.map((entry) => ({
      kind: "call" as const,
      at: entry.createdAt,
      entry,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const messageSearch =
    messageQuery.length >= 2
      ? await searchConversationMessages(
          callContext,
          conversation.id,
          messageQuery,
          { limit: 20 }
        )
      : null;
  const callableIntent = isPageConversation ? null : callIntent;
  const prioritizeCallPanel =
    callableIntent !== null ||
    activeCallRoom !== null ||
    pendingCallInvite !== null;
  const callPanel = (
    <div
      className={`${prioritizeCallPanel ? "border-b" : "border-t"} border-white/[0.06] p-5`}
    >
      <ConversationCallPanel
        conversationId={conversation.id}
        activeRoom={
          activeCallRoom
            ? {
                id: activeCallRoom.id,
                callType:
                  activeCallRoom.callType === "voice" ? "voice" : "video",
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
        canStartCall={hasTier(user.tier, "pro") && !isPageConversation}
        autoCallIntent={callableIntent}
      />
    </div>
  );

  return (
    <div className="giq-social-thread mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <ConversationDeliveryAcknowledger conversationId={conversation.id} />
      <Link
        href="/pulse"
        className="mb-6 inline-flex items-center gap-2 text-[13px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Pulse inbox
      </Link>

      <header className="giq-social-thread-header giq-panel mb-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="relative grid size-16 shrink-0 place-items-center rounded-full border border-white/12 bg-[hsl(var(--primary)/0.14)] text-[18px] font-semibold text-[hsl(var(--primary-light))]">
              {otherAvatarUrl ? (
                <NextImage
                  src={otherAvatarUrl}
                  alt=""
                  fill
                  className="rounded-full object-cover"
                  sizes="64px"
                  unoptimized={otherAvatarUrl.startsWith("/api/media/")}
                />
              ) : (
                otherLabel.trim().charAt(0).toUpperCase() || "G"
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[hsl(var(--primary-bright))]">
                Private Pulse conversation
              </p>
              <PageTitle size="compact" className="mt-2">
                {otherLabel}
              </PageTitle>
              <p className="mt-2 text-[14px] text-[hsl(var(--muted-foreground))]">
                {other.kennelName ? `${other.kennelName} · ` : ""}
                {other.state ?? "Australia"}
              </p>
            </div>
            {realtimeChannel && (
              <RealtimeRefresh
                channels={[
                  {
                    name: realtimeChannel,
                    events: [
                      "message_created",
                      "conversation_updated",
                      "call_room_created",
                      "call_room_ended",
                    ],
                    presence: {
                      selfProfileId: user.profileId,
                      selfLabel,
                      otherProfileId: other.id,
                      otherLabel,
                      offlineLabel: otherPresence
                        ? lastSeenLabel(otherPresence.lastSeenAt)
                        : undefined,
                    },
                    typing: {
                      selfProfileId: user.profileId,
                      otherProfileId: other.id,
                      otherLabel,
                    },
                  },
                ]}
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <form action={readAction}>
              <SubmitButton
                pendingLabel="Marking..."
                className="giq-outline-action disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark read
              </SubmitButton>
            </form>
            {blockedByMe ? (
              <form action={unblockAction}>
                <SubmitButton
                  pendingLabel="Unblocking..."
                  className="giq-outline-action disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Unlock className="h-3.5 w-3.5" />
                  Unblock
                </SubmitButton>
              </form>
            ) : (
              <form action={blockAction}>
                <SubmitButton
                  pendingLabel="Blocking..."
                  className="giq-danger-action disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Block
                </SubmitButton>
              </form>
            )}
          </div>
        </div>

        {conversation.blockedAt && (
          <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-[13px] text-red-100">
            {blockedByMe
              ? "You blocked this conversation. Unblock before sending new messages."
              : "This conversation is blocked by the other participant."}
          </div>
        )}
      </header>

      <section className="giq-social-thread-search giq-panel mb-6 p-5" aria-label="Search this conversation">
        <form className="flex flex-wrap gap-2" action={`/pulse/${conversation.id}`}>
          <label className="sr-only" htmlFor="message-search">
            Search messages in this conversation
          </label>
          <input
            id="message-search"
            name="q"
            type="search"
            minLength={2}
            maxLength={100}
            defaultValue={messageQuery}
            className="giq-form-control min-h-11 min-w-0 flex-1 px-3"
            placeholder="Search this conversation"
          />
          <button
            type="submit"
            className="giq-button giq-button-glass min-h-11 px-4 text-[13px]"
          >
            <Search className="h-3.5 w-3.5" />
            Search
          </button>
          {messageQuery && (
            <Link
              href={`/pulse/${conversation.id}`}
              className="giq-outline-action min-h-11 px-3 text-[12px]"
            >
              Clear
            </Link>
          )}
        </form>
        {messageSearch && (
          <div className="mt-4 border-t border-white/[0.06] pt-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
              {messageSearch.items.length} result
              {messageSearch.items.length === 1 ? "" : "s"}
            </p>
            {messageSearch.items.length > 0 ? (
              <ol className="mt-3 space-y-2">
                {messageSearch.items.map((message) => (
                  <li key={message.id} className="giq-subpanel p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[hsl(var(--subtle-foreground))]">
                      <span>
                        {message.senderActor?.displayName ??
                          message.sender.displayName}
                      </span>
                      <time dateTime={message.createdAt.toISOString()}>
                        {message.createdAt.toLocaleString("en-AU")}
                      </time>
                    </div>
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[13px] text-[hsl(var(--muted-foreground))]">
                      {message.body}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                No matching messages.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="giq-social-thread-panel giq-panel">
        {prioritizeCallPanel && callPanel}
        <div className="space-y-4 p-5">
          {(hasEarlierPage || before) && (
            <div className="flex flex-wrap items-center justify-center gap-2 pb-1">
              {hasEarlierPage && oldestMessageId && (
                <Link
                  href={`/pulse/${conversation.id}?before=${oldestMessageId}`}
                  className="giq-outline-action px-3 text-[12px]"
                >
                  <ChevronsUp className="h-3.5 w-3.5" />
                  Load earlier messages
                </Link>
              )}
              {before && (
                <Link
                  href={`/pulse/${conversation.id}`}
                  className="giq-outline-action px-3 text-[12px]"
                >
                  <ChevronsDown className="h-3.5 w-3.5" />
                  Back to latest
                </Link>
              )}
            </div>
          )}
          {threadItems.length === 0 ? (
            <div className="giq-dashed-panel p-6 text-center text-[14px] text-[hsl(var(--muted-foreground))]">
              No visible messages in this conversation.
            </div>
          ) : (
            threadItems.map((item) => {
              if (item.kind === "call") {
                return (
                  <CallLogLine key={`call-${item.entry.id}`} entry={item.entry} />
                );
              }
              const { message } = item;
              const isMine = message.senderId === user.profileId;
              const deleteAction = deleteConversationMessage.bind(
                null,
                conversation.id,
                message.id
              );
              const reactionAction = toggleMessageReaction.bind(
                null,
                conversation.id,
                message.id
              );
              const reportAction = reportConversationMessage.bind(
                null,
                conversation.id,
                message.id
              );
              const reactedByMe = message.reactions.some(
                (reaction) => reaction.profileId === user.profileId
              );
              const readReceipt = message.readReceipts.find(
                (receipt) => receipt.profileId === message.recipientId
              );
              const deliveryReceipt = message.deliveryReceipts.find(
                (receipt) => receipt.profileId === message.recipientId
              );
              const readAt = readReceipt?.readAt ?? message.readAt;

              return (
                <article
                  key={message.id}
                  className={`giq-social-chat-bubble rounded-2xl border p-4 ${
                    isMine
                      ? "ml-auto max-w-[82%] border-[hsl(var(--primary)/0.22)] bg-[hsl(var(--primary)/0.08)]"
                      : "mr-auto max-w-[82%] border-white/[0.06] bg-white/[0.03]"
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[12px] font-semibold text-[hsl(var(--foreground))]">
                      {isMine
                        ? selfActor?.kind === "page"
                          ? `You as ${selfLabel}`
                          : "You"
                        : message.senderActor?.displayName ??
                          message.sender.displayName}
                    </span>
                    <span className="text-[11px] text-[hsl(var(--subtle-foreground))]">
                      {message.createdAt.toLocaleString("en-AU", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[hsl(215_14%_80%)]">
                    {message.body}
                  </p>
                  {message.media.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {message.media.map((attachment) => (
                        <MessageAttachment
                          key={attachment.mediaId}
                          media={attachment.media}
                        />
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-[hsl(var(--subtle-foreground))]">
                      {isMine && readAt
                        ? `Read ${readAt.toLocaleString("en-AU", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : isMine && deliveryReceipt
                          ? `Delivered ${deliveryReceipt.deliveredAt.toLocaleString(
                              "en-AU",
                              {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}`
                        : isMine
                          ? "Sent"
                          : ""}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <form action={reactionAction}>
                        <SubmitButton
                          pendingLabel="..."
                          className={`giq-outline-action min-h-11 px-2.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-60 ${
                            reactedByMe
                              ? "border-[hsl(var(--primary)/0.35)] bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary-bright))]"
                              : ""
                          }`}
                        >
                          <ThumbsUp className="h-3 w-3" />
                          {message.reactions.length}
                        </SubmitButton>
                      </form>
                      <form action={deleteAction} className="grid gap-1.5">
                        <label className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                          <input
                            type="checkbox"
                            name="confirmation"
                            value="delete"
                            required
                            className="size-4 shrink-0 accent-[hsl(var(--primary))]"
                          />
                          Confirm delete
                        </label>
                        <SubmitButton
                          pendingLabel="Deleting..."
                          className="giq-outline-action min-h-11 px-2.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </SubmitButton>
                      </form>
                      {!isMine && (
                        <form action={reportAction} className="flex gap-2">
                          <select
                            name="reason"
                            defaultValue="other"
                            aria-label="Report reason"
                            className="giq-form-control min-h-11 w-32 px-2 py-1 text-[11px]"
                          >
                            <option value="spam">Spam</option>
                            <option value="harassment">Harassment</option>
                            <option value="misinformation">Misinformation</option>
                            <option value="illegal">Illegal</option>
                            <option value="other">Other</option>
                          </select>
                          <SubmitButton
                            pendingLabel="..."
                            className="giq-outline-action min-h-11 px-2.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Flag className="h-3 w-3" />
                            Report
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
        {!prioritizeCallPanel && callPanel}

        <InstantMessageComposer
          conversationId={conversation.id}
          disabled={Boolean(conversation.blockedAt)}
        />
      </section>
    </div>
  );
}

function CallLogLine({
  entry,
}: {
  entry: {
    id: string;
    eventType: string;
    createdAt: Date;
    callRoom: { callType: string; createdAt: Date; endedAt: Date | null };
  };
}) {
  const time = entry.createdAt.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
  const callType = entry.callRoom.callType === "voice" ? "voice" : "video";
  const label =
    entry.eventType === "invite_missed"
      ? `Missed ${callType} call`
      : entry.eventType === "room_expired"
        ? "Call expired"
        : "Call ended";
  const durationSeconds =
    entry.eventType !== "invite_missed" && entry.callRoom.endedAt
      ? Math.floor(
          (entry.callRoom.endedAt.getTime() - entry.callRoom.createdAt.getTime()) /
            1000
        )
      : null;

  return (
    <div className="flex justify-center py-1">
      <span className="text-[11px] text-[hsl(var(--subtle-foreground))]">
        {label} · {time}
        {durationSeconds !== null && durationSeconds > 0
          ? ` · ${formatCallLogDuration(durationSeconds)}`
          : ""}
      </span>
    </div>
  );
}

function lastSeenLabel(lastSeenAt: Date) {
  const minutes = Math.floor((Date.now() - lastSeenAt.getTime()) / 60_000);
  if (minutes < 1) return "Last seen just now";
  if (minutes < 60) return `Last seen ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;
  return `Last seen ${lastSeenAt.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
  })}`;
}

function formatCallLogDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function MessageAttachment({
  media,
}: {
  media: {
    id: string;
    originalName: string | null;
    mimeType: string;
    widthPx: number | null;
    heightPx: number | null;
    scanStatus: string;
    processingStatus: string;
    playbackPath: string | null;
    posterPath: string | null;
    hlsPath: string | null;
    altText: string | null;
    captionPath: string | null;
  };
}) {
  // Blob endpoints only serve clean media - never emit a link for non-clean.
  if (media.scanStatus === "pending") {
    return <AttachmentStatus label="Scanning attachment…" loading />;
  }
  if (media.scanStatus !== "clean") {
    return (
      <AttachmentStatus
        label={
          media.scanStatus === "infected"
            ? "Attachment removed by safety scan"
            : "Attachment safety scan failed"
        }
        failed
      />
    );
  }
  if (media.processingStatus !== "ready") {
    return (
      <AttachmentStatus
        label={
          media.processingStatus === "failed"
            ? "Attachment processing failed"
            : media.processingStatus === "processing"
              ? "Preparing attachment…"
              : media.processingStatus === "scanning"
                ? "Scanning attachment…"
                : "Attachment queued for processing…"
        }
        loading={media.processingStatus !== "failed"}
        failed={media.processingStatus === "failed"}
      />
    );
  }

  const originalUrl = `/api/media/${media.id}/blob`;
  const playbackUrl = media.playbackPath
    ? `${originalUrl}?variant=playback`
    : originalUrl;
  const label = media.altText ?? media.originalName ?? "Message attachment";

  if (media.mimeType.startsWith("image/")) {
    return (
      <a
        href={playbackUrl}
        target="_blank"
        rel="noreferrer"
        className="giq-listing-media block overflow-hidden rounded-lg"
      >
        <NextImage
          src={playbackUrl}
          alt={label}
          width={media.widthPx ?? 420}
          height={media.heightPx ?? 280}
          unoptimized
          className="max-h-44 w-full object-cover"
        />
      </a>
    );
  }

  if (media.mimeType.startsWith("video/")) {
    return (
      <ProcessedVideo
        playbackUrl={playbackUrl}
        hlsUrl={media.hlsPath ? `${originalUrl}?variant=hls` : null}
        posterUrl={media.posterPath ? `${originalUrl}?variant=poster` : null}
        captionUrl={media.captionPath ? `${originalUrl}?variant=caption` : null}
        label={label}
        compact
      />
    );
  }

  if (media.mimeType.startsWith("audio/")) {
    return (
      <audio
        controls
        preload="metadata"
        src={playbackUrl}
        className="min-h-11 w-full"
        aria-label={label}
      />
    );
  }

  return (
    <a
      href={originalUrl}
      target="_blank"
      rel="noreferrer"
      className="giq-outline-action min-h-11 max-w-full px-3 py-2 text-[12px]"
    >
      <Paperclip
        className="h-4 w-4 shrink-0 text-[hsl(var(--primary-bright))]"
        aria-hidden="true"
      />
      <span className="truncate">{media.originalName ?? media.mimeType}</span>
    </a>
  );
}

function AttachmentStatus({
  label,
  loading = false,
  failed = false,
}: {
  label: string;
  loading?: boolean;
  failed?: boolean;
}) {
  return (
    <span
      role="status"
      className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-[12px] text-[hsl(var(--muted-foreground))]"
    >
      {loading ? (
        <Loader2
          className="h-3.5 w-3.5 shrink-0 animate-spin"
          aria-hidden="true"
        />
      ) : failed ? (
        <ShieldAlert
          className="h-3.5 w-3.5 shrink-0"
          aria-hidden="true"
        />
      ) : (
        <Paperclip
          className="h-3.5 w-3.5 shrink-0"
          aria-hidden="true"
        />
      )}
      <span>{label}</span>
    </span>
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
