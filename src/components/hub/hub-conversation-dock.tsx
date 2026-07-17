"use client";

import NextImage from "next/image";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  ExternalLink,
  Loader2,
  MessageSquare,
  Paperclip,
  Phone,
  RotateCcw,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { MediaAttachmentFields } from "@/components/media-attachment-fields";
import { ProcessedVideo } from "@/components/processed-video";
import {
  ensureBrowserRealtimeAuthorization,
  getBrowserRealtimeClient,
} from "@/components/realtime-refresh";

export type HubDockConversation = {
  id: string;
  otherName: string;
  otherAvatarUrl: string | null;
  preview: string;
  unread: number;
  attachmentCount?: number;
  realtimeChannel: string | null;
  personToPerson: boolean;
};

type QuickMessage = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  media?: Array<{
    mediaId: string;
    media?: {
      id: string;
      mimeType?: string | null;
      originalName?: string | null;
      widthPx?: number | null;
      heightPx?: number | null;
      scanStatus?: string | null;
      processingStatus?: string | null;
      playbackPath?: string | null;
      posterPath?: string | null;
      hlsPath?: string | null;
      altText?: string | null;
      captionPath?: string | null;
    };
  }>;
  pending?: boolean;
};

const MAX_OPEN_WINDOWS = 2;
const OPEN_CHAT_EVENT = "giq:open-chat";
export const TOGGLE_CHAT_DOCK_EVENT = "giq:toggle-chat-dock";
const CHAT_TIME_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Sydney",
  timeZoneName: "short",
});

export function HubConversationDock({
  conversations,
  selfProfileId,
  canStartCall,
  mode = "list",
  externalLauncher = false,
}: {
  conversations: HubDockConversation[];
  selfProfileId: string;
  canStartCall: boolean;
  mode?: "list" | "floating";
  externalLauncher?: boolean;
}) {
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [launcherOpen, setLauncherOpen] = useState(false);

  const openConversation = useCallback((id: string) => {
    setOpenIds((current) =>
      current.includes(id)
        ? current
        : [...current, id].slice(-MAX_OPEN_WINDOWS)
    );
    setLauncherOpen(false);
  }, []);

  useEffect(() => {
    if (mode !== "floating") return;
    const handleOpenChat = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) openConversation(id);
    };
    const handleToggleDock = () => setLauncherOpen((current) => !current);
    window.addEventListener(OPEN_CHAT_EVENT, handleOpenChat);
    window.addEventListener(TOGGLE_CHAT_DOCK_EVENT, handleToggleDock);
    return () => {
      window.removeEventListener(OPEN_CHAT_EVENT, handleOpenChat);
      window.removeEventListener(TOGGLE_CHAT_DOCK_EVENT, handleToggleDock);
    };
  }, [mode, openConversation]);

  if (mode === "list") {
    return (
      <ul className="giq-social-chat-list space-y-1">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent(OPEN_CHAT_EVENT, {
                    detail: { id: conversation.id },
                  })
                )
              }
              className="giq-social-messenger-row hidden min-h-12 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04] lg:flex"
              aria-label={`Open quick chat with ${conversation.otherName}`}
            >
              <ConversationSummary conversation={conversation} />
            </button>
            <Link
              href={`/pulse/${conversation.id}`}
              className="giq-social-messenger-row flex min-h-12 items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04] lg:hidden"
            >
              <ConversationSummary conversation={conversation} />
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  const unreadTotal = conversations.reduce(
    (total, conversation) => total + conversation.unread,
    0
  );

  return (
    <div className={`fixed right-4 z-[60] hidden items-end gap-3 lg:flex ${externalLauncher ? "bottom-[96px]" : "bottom-4"}`}>
      {openIds.map((id) => {
        const conversation = conversations.find((item) => item.id === id);
        if (!conversation) return null;
        return (
          <QuickChatWindow
            key={id}
            conversation={conversation}
            selfProfileId={selfProfileId}
            canStartCall={canStartCall}
            onClose={() =>
              setOpenIds((current) => current.filter((item) => item !== id))
            }
          />
        );
      })}

      <div className="relative flex flex-col items-end">
        {launcherOpen && (
          <section
            aria-label="Chat dock"
            className={`absolute right-0 max-h-[min(520px,calc(100dvh-120px))] w-[320px] overflow-hidden rounded-xl border border-white/[0.12] bg-[hsl(var(--surface-1)/0.98)] shadow-2xl backdrop-blur-xl ${externalLauncher ? "bottom-0" : "bottom-[calc(100%+0.75rem)]"}`}
          >
            <header className="flex min-h-12 items-center gap-2 border-b border-white/[0.08] px-3">
              <MessageSquare className="h-4 w-4 text-[hsl(var(--primary-bright))]" />
              <h2 className="flex-1 text-[13px] font-semibold text-[hsl(var(--foreground))]">
                Chat
              </h2>
              <Link
                href="/pulse"
                className="grid min-h-11 w-11 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-white/[0.05]"
                aria-label="Open full Chat inbox"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </header>
            <div className="max-h-[430px] overflow-y-auto p-2">
              {conversations.length > 0 ? (
                <ul className="space-y-1">
                  {conversations.map((conversation) => (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        onClick={() => openConversation(conversation.id)}
                        className="giq-social-messenger-row flex min-h-12 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
                        aria-label={`Open quick chat with ${conversation.otherName}`}
                      >
                        <ConversationSummary conversation={conversation} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-4 text-center">
                  <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
                    No conversations yet.
                  </p>
                  <Link
                    href="/discover"
                    className="giq-button giq-button-primary mt-3 min-h-11 px-4 text-[12px]"
                  >
                    Find people
                  </Link>
                </div>
              )}
            </div>
          </section>
        )}

        {!externalLauncher && (
          <button
            type="button"
            onClick={() => setLauncherOpen((current) => !current)}
            className="giq-button giq-button-carbon relative h-14 w-14 justify-center rounded-xl border-[hsl(var(--primary-bright)/0.5)] px-0 shadow-2xl focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
            aria-label={launcherOpen ? "Close Chat dock" : "Open Chat dock"}
            aria-expanded={launcherOpen}
          >
            {launcherOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <MessageSquare className="h-5 w-5 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
            )}
            {unreadTotal > 0 && (
              <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-6 items-center justify-center rounded-full bg-[hsl(var(--accent))] px-1.5 text-[10px] font-bold leading-6 text-black">
                {unreadTotal > 99 ? "99+" : unreadTotal}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function ConversationSummary({
  conversation,
}: {
  conversation: HubDockConversation;
}) {
  const preview = conversationPreview(
    conversation.preview,
    conversation.attachmentCount ?? 0
  );

  return (
    <>
      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.1] bg-[hsl(var(--surface-2))] text-[12px] font-bold text-white/70">
        {conversation.otherAvatarUrl ? (
          <NextImage
            src={conversation.otherAvatarUrl}
            alt=""
            fill
            className="rounded-full object-cover"
            sizes="36px"
            unoptimized={conversation.otherAvatarUrl.startsWith("/api/media/")}
          />
        ) : (
          conversation.otherName.slice(0, 1).toUpperCase()
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-[hsl(var(--foreground))]">
          {conversation.otherName}
        </span>
        <span className="flex items-center gap-1 truncate text-[11px] text-[hsl(var(--subtle-foreground))]">
          {preview.attachment && (
            <Paperclip className="h-3 w-3 shrink-0" aria-hidden="true" />
          )}
          <span className="truncate">{preview.label}</span>
        </span>
      </span>
      {conversation.unread > 0 && (
        <span
          aria-label={`${conversation.unread} unread`}
          className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary-bright))] px-1.5 text-[10px] font-bold leading-5 tabular-nums text-[hsl(var(--primary-foreground))]"
        >
          {conversation.unread > 99 ? "99+" : conversation.unread}
        </span>
      )}
    </>
  );
}

function QuickChatWindow({
  conversation,
  selfProfileId,
  canStartCall,
  onClose,
}: {
  conversation: HubDockConversation;
  selfProfileId: string;
  canStartCall: boolean;
  onClose: () => void;
}) {
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [attachmentResetKey, setAttachmentResetKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    const response = await fetch(
      `/api/conversations/${conversation.id}/messages?limit=20`,
      { cache: "no-store", credentials: "same-origin" }
    );
    if (!response.ok) throw new Error("Could not load chat");
    const payload = (await response.json()) as { items?: QuickMessage[] };
    setMessages(payload.items ?? []);
    setLoadError(null);
  }, [conversation.id]);

  const retryLoad = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      await loadMessages();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load chat");
    } finally {
      setLoading(false);
    }
  }, [loadMessages]);

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    const initialLoadTimer = window.setTimeout(() => {
      if (!cancelled) void retryLoad();
    }, 0);

    const client = getBrowserRealtimeClient();
    const subscribe = async () => {
      if (!client || !conversation.realtimeChannel) return;
      await ensureBrowserRealtimeAuthorization(client, [
        conversation.realtimeChannel,
      ]);
      if (cancelled) return;
      channel = client
        .channel(conversation.realtimeChannel, { config: { private: true } })
        .on("broadcast", { event: "message_created" }, () => {
          void loadMessages().catch(() => null);
        })
        .subscribe();
    };
    void subscribe().catch(() => null);

    return () => {
      cancelled = true;
      window.clearTimeout(initialLoadTimer);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [conversation.realtimeChannel, loadMessages, retryLoad]);

  useEffect(() => {
    if (loading || loadError) return;
    const viewport = messagesViewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [loadError, loading, messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = String(formData.get("body") ?? "").trim();
    const mediaIds = formData
      .getAll("mediaIds")
      .map(String)
      .filter(Boolean);
    if (!body) return;
    const optimisticId = `pending-${crypto.randomUUID()}`;
    setMessages((current) => [
      ...current,
      {
        id: optimisticId,
        body,
        senderId: selfProfileId,
        createdAt: new Date().toISOString(),
        pending: true,
      },
    ]);
    setSending(true);
    setSendError(null);
    try {
      const response = await fetch(
        `/api/conversations/${conversation.id}/messages`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body, mediaIds }),
        }
      );
      if (!response.ok) throw new Error("Could not send message");
      form.reset();
      setAttachmentResetKey((current) => current + 1);
      await loadMessages();
    } catch (err) {
      setMessages((current) =>
        current.filter((message) => message.id !== optimisticId)
      );
      setSendError(
        err instanceof Error ? err.message : "Could not send message"
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="giq-social-quick-chat flex h-[440px] w-[320px] flex-col overflow-hidden rounded-xl border border-white/[0.12] bg-[hsl(var(--surface-1)/0.98)] shadow-2xl backdrop-blur-xl">
      <header className="giq-social-quick-chat-header flex min-h-12 items-center gap-2 border-b border-white/[0.08] px-3">
        {conversation.otherAvatarUrl ? (
          <NextImage
            src={conversation.otherAvatarUrl}
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-full object-cover"
            unoptimized={conversation.otherAvatarUrl.startsWith("/api/media/")}
          />
        ) : (
          <MessageSquare className="h-4 w-4 text-[hsl(var(--primary-bright))]" />
        )}
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[hsl(var(--foreground))]">
          {conversation.otherName}
        </h2>
        <Link
          href={`/pulse/${conversation.id}`}
          className="grid min-h-11 w-11 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-white/[0.05]"
          aria-label={`Open full conversation with ${conversation.otherName}`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="grid min-h-11 w-11 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-white/[0.05]"
          aria-label={`Close quick chat with ${conversation.otherName}`}
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div
        ref={messagesViewportRef}
        className="giq-social-chat-messages flex-1 space-y-2 overflow-y-auto p-3"
        aria-busy={loading}
        aria-live="polite"
      >
        {loading ? (
          <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-[hsl(var(--primary-bright))]" />
        ) : loadError ? (
          <div
            role="alert"
            className="mx-auto mt-8 grid max-w-[220px] justify-items-center gap-3 text-center"
          >
            <p className="text-[12px] text-red-200">{loadError}</p>
            <button
              type="button"
              onClick={() => void retryLoad()}
              className="giq-outline-action min-h-10 px-3 text-[12px]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <p className="mt-8 text-center text-[12px] text-[hsl(var(--muted-foreground))]">
            Start the conversation.
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.senderId === selfProfileId;
            return (
              <article
                key={message.id}
                className={`giq-social-chat-bubble max-w-[84%] rounded-xl px-3 py-2 text-[12px] ${
                  mine
                    ? "ml-auto bg-[hsl(var(--primary)/0.16)] text-[hsl(var(--foreground))]"
                    : "mr-auto bg-white/[0.05] text-[hsl(var(--muted-foreground))]"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
                <MessageAttachments attachments={message.media ?? []} />
                <span className="mt-1 block text-[10px] opacity-70">
                  {message.pending ? (
                    "Sending..."
                  ) : (
                    <time dateTime={message.createdAt}>
                      {CHAT_TIME_FORMATTER.format(new Date(message.createdAt))}
                    </time>
                  )}
                </span>
              </article>
            );
          })
        )}
      </div>

      <form onSubmit={sendMessage} className="giq-social-quick-chat-composer border-t border-white/[0.08] p-2">
        <label className="sr-only" htmlFor={`quick-chat-${conversation.id}`}>
          Message {conversation.otherName}
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id={`quick-chat-${conversation.id}`}
            name="body"
            required
            maxLength={5000}
            rows={2}
            disabled={sending}
            aria-invalid={Boolean(sendError)}
            aria-errormessage={sendError ? `quick-chat-${conversation.id}-error` : undefined}
            className="giq-form-control min-h-11 flex-1 resize-none px-2 py-2 text-[12px]"
            placeholder="Write a message"
          />
          <button
            type="submit"
            disabled={sending}
            className="giq-button giq-button-primary min-h-11 w-11 px-0"
            aria-label="Send message"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <div className="mt-2 flex items-start gap-2">
          {conversation.personToPerson && (
            <Link
              href={
                canStartCall
                  ? `/pulse/${encodeURIComponent(conversation.id)}?call=voice`
                  : "/pricing"
              }
              aria-label={
                canStartCall
                  ? `Start voice call with ${conversation.otherName}`
                  : "Voice calls are a Pro feature"
              }
              className={`giq-outline-action h-11 w-11 shrink-0 justify-center px-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)] ${
                canStartCall ? "" : "opacity-60"
              }`}
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
          <div className="min-w-0 flex-1 max-h-44 overflow-y-auto overscroll-contain pr-1">
            <MediaAttachmentFields key={attachmentResetKey} compact />
          </div>
        </div>
        {sendError && (
          <p id={`quick-chat-${conversation.id}-error`} role="alert" className="mt-1 text-[11px] text-red-200">
            {sendError}
          </p>
        )}
      </form>
    </section>
  );
}

function MessageAttachments({
  attachments,
}: {
  attachments: NonNullable<QuickMessage["media"]>;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-2 grid gap-2">
      {attachments.map((attachment) => (
        <MessageAttachment key={attachment.mediaId} attachment={attachment} />
      ))}
    </div>
  );
}

function MessageAttachment({
  attachment,
}: {
  attachment: NonNullable<QuickMessage["media"]>[number];
}) {
  const media = attachment.media;
  if (!media) {
    return <AttachmentStatus label="Attachment unavailable" />;
  }
  if (media.scanStatus === "pending") {
    return <AttachmentStatus label="Scanning attachment…" loading />;
  }
  if (media.scanStatus !== "clean") {
    return <AttachmentStatus label="Attachment removed by safety scan" failed />;
  }
  if (media.processingStatus !== "ready") {
    return (
      <AttachmentStatus
        label={
          media.processingStatus === "failed"
            ? "Attachment processing failed"
            : "Preparing attachment…"
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

  if (media.mimeType?.startsWith("image/")) {
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

  if (media.mimeType?.startsWith("video/")) {
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

  if (media.mimeType?.startsWith("audio/")) {
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
      className="giq-outline-action min-h-11 max-w-full px-3 py-2 text-[11px]"
    >
      <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{media.originalName ?? "Open attachment"}</span>
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
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-[11px] text-[hsl(var(--muted-foreground))]"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
      ) : failed ? (
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>{label}</span>
    </span>
  );
}

function conversationPreview(value: string, attachmentCount: number) {
  const trimmed = value.trim();
  const sentByCurrentUser = trimmed.startsWith("You:");
  const body = sentByCurrentUser ? trimmed.slice(4).trim() : trimmed;
  const attachment =
    attachmentCount > 0 ||
    body.length === 0 ||
    /^(attachment|photo|video|audio)s?\b/i.test(body);
  return {
    attachment,
    label: body.length
      ? trimmed
      : sentByCurrentUser
        ? "You sent an attachment"
        : "Attachment",
  };
}
