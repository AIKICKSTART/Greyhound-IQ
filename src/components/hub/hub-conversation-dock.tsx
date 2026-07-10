"use client";

import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  ExternalLink,
  Loader2,
  MessageSquare,
  Paperclip,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import {
  ensureBrowserRealtimeAuthorization,
  getBrowserRealtimeClient,
} from "@/components/realtime-refresh";

export type HubDockConversation = {
  id: string;
  otherName: string;
  preview: string;
  unread: number;
  attachmentCount?: number;
  realtimeChannel: string | null;
};

type QuickMessage = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  media?: Array<{
    mediaId: string;
    media?: {
      mimeType?: string | null;
      originalName?: string | null;
    };
  }>;
  pending?: boolean;
};

const MAX_OPEN_WINDOWS = 2;
const CHAT_TIME_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  hour: "numeric",
  minute: "2-digit",
});

export function HubConversationDock({
  conversations,
  selfProfileId,
}: {
  conversations: HubDockConversation[];
  selfProfileId: string;
}) {
  const [openIds, setOpenIds] = useState<string[]>([]);

  function openConversation(id: string) {
    setOpenIds((current) =>
      current.includes(id)
        ? current
        : [...current, id].slice(-MAX_OPEN_WINDOWS)
    );
  }

  return (
    <>
      <ul className="space-y-1">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <button
              type="button"
              onClick={() => openConversation(conversation.id)}
              className="hidden min-h-11 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04] lg:flex"
              aria-label={`Open quick chat with ${conversation.otherName}`}
            >
              <ConversationSummary conversation={conversation} />
            </button>
            <Link
              href={`/pulse/${conversation.id}`}
              className="flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04] lg:hidden"
            >
              <ConversationSummary conversation={conversation} />
            </Link>
          </li>
        ))}
      </ul>

      <div className="fixed bottom-4 right-4 z-[60] hidden items-end gap-3 lg:flex">
        {openIds.map((id) => {
          const conversation = conversations.find((item) => item.id === id);
          if (!conversation) return null;
          return (
            <QuickChatWindow
              key={id}
              conversation={conversation}
              selfProfileId={selfProfileId}
              onClose={() =>
                setOpenIds((current) => current.filter((item) => item !== id))
              }
            />
          );
        })}
      </div>
    </>
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
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.1] bg-[hsl(var(--surface-2))] text-[12px] font-bold text-white/70">
        {conversation.otherName.slice(0, 1).toUpperCase()}
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
  onClose,
}: {
  conversation: HubDockConversation;
  selfProfileId: string;
  onClose: () => void;
}) {
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
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
    const body = String(new FormData(form).get("body") ?? "").trim();
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
    form.reset();
    try {
      const response = await fetch(
        `/api/conversations/${conversation.id}/messages`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body, mediaIds: [] }),
        }
      );
      if (!response.ok) throw new Error("Could not send message");
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
    <section className="flex h-[440px] w-[320px] flex-col overflow-hidden rounded-xl border border-white/[0.12] bg-[hsl(var(--surface-1)/0.98)] shadow-2xl backdrop-blur-xl">
      <header className="flex min-h-12 items-center gap-2 border-b border-white/[0.08] px-3">
        <MessageSquare className="h-4 w-4 text-[hsl(var(--primary-bright))]" />
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
        className="flex-1 space-y-2 overflow-y-auto p-3"
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
                className={`max-w-[84%] rounded-lg px-3 py-2 text-[12px] ${
                  mine
                    ? "ml-auto bg-[hsl(var(--primary)/0.16)] text-[hsl(var(--foreground))]"
                    : "mr-auto bg-white/[0.05] text-[hsl(var(--muted-foreground))]"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
                <MessageAttachmentSummary attachments={message.media ?? []} />
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

      <form onSubmit={sendMessage} className="border-t border-white/[0.08] p-2">
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
        {sendError && (
          <p role="alert" className="mt-1 text-[11px] text-red-200">
            {sendError}
          </p>
        )}
      </form>
    </section>
  );
}

function MessageAttachmentSummary({
  attachments,
}: {
  attachments: NonNullable<QuickMessage["media"]>;
}) {
  if (attachments.length === 0) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1 text-[11px] opacity-80">
      <Paperclip className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{attachmentLabel(attachments)}</span>
    </p>
  );
}

function attachmentLabel(attachments: NonNullable<QuickMessage["media"]>) {
  if (attachments.length > 1) return `${attachments.length} attachments`;
  const attachment = attachments[0]?.media;
  if (attachment?.originalName) return attachment.originalName;
  const mimeType = attachment?.mimeType ?? "";
  if (mimeType.startsWith("image/")) return "Photo";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType.startsWith("audio/")) return "Audio";
  return "Attachment";
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
