import Link from "next/link";
import NextImage from "next/image";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  CheckCheck,
  Lock,
  Paperclip,
  Send,
  Trash2,
  Unlock,
} from "lucide-react";
import {
  blockConversation,
  deleteConversationMessage,
  markConversationReadAction,
  replyToConversation,
  unblockConversation,
} from "@/app/actions";
import { MediaAttachmentFields } from "@/components/media-attachment-fields";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import { getConversationForProfile } from "@/lib/conversation-service";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return {
    title: `Conversation ${id.slice(0, 8)} - GreyhoundIQ`,
    description: "Private GreyhoundIQ 1:1 conversation.",
  };
}

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  if (!user?.profileId) return <SignedOutThread />;

  let conversation: Awaited<ReturnType<typeof getConversationForProfile>>;
  try {
    conversation = await getConversationForProfile(id, user.profileId);
  } catch {
    notFound();
  }

  const other =
    conversation.participantAId === user.profileId
      ? conversation.participantB
      : conversation.participantA;
  const replyAction = replyToConversation.bind(null, conversation.id);
  const readAction = markConversationReadAction.bind(null, conversation.id);
  const blockAction = blockConversation.bind(null, conversation.id);
  const unblockAction = unblockConversation.bind(null, conversation.id);
  const blockedByMe = conversation.blockedById === user.profileId;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/messages"
        className="mb-6 inline-flex items-center gap-2 text-[13px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Inbox
      </Link>

      <header className="giq-panel mb-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[hsl(var(--primary-bright))]">
              Private 1:1 conversation
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
              {other.displayName}
            </h1>
            <p className="mt-2 text-[14px] text-[hsl(var(--muted-foreground))]">
              {other.kennelName ? `${other.kennelName} · ` : ""}
              {other.state ?? "Australia"}
            </p>
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

      <section className="giq-panel">
        <div className="space-y-4 p-5">
          {conversation.messages.length === 0 ? (
            <div className="giq-dashed-panel p-6 text-center text-[14px] text-[hsl(var(--muted-foreground))]">
              No visible messages in this conversation.
            </div>
          ) : (
            conversation.messages.map((message) => {
              const isMine = message.senderId === user.profileId;
              const deleteAction = deleteConversationMessage.bind(
                null,
                conversation.id,
                message.id
              );

              return (
                <article
                  key={message.id}
                  className={`rounded-lg border p-4 ${
                    isMine
                      ? "ml-auto max-w-[82%] border-[hsl(var(--primary)/0.22)] bg-[hsl(var(--primary)/0.08)]"
                      : "mr-auto max-w-[82%] border-white/[0.06] bg-white/[0.03]"
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[12px] font-semibold text-[hsl(var(--foreground))]">
                      {isMine ? "You" : message.sender.displayName}
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
                      {isMine && message.readAt
                        ? `Read ${message.readAt.toLocaleString("en-AU", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : isMine
                          ? "Sent"
                          : ""}
                    </span>
                    <form action={deleteAction}>
                      <SubmitButton
                        pendingLabel="Deleting..."
                        className="giq-outline-action min-h-8 px-2.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </SubmitButton>
                    </form>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <form
          action={replyAction}
          className="border-t border-white/[0.06] p-5"
        >
          <label className="block">
            <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
              Reply
            </span>
            <textarea
              name="body"
              required
              disabled={Boolean(conversation.blockedAt)}
              maxLength={5000}
              rows={5}
              className="giq-form-control giq-textarea mt-2 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={
                conversation.blockedAt
                  ? "Unblock this conversation before replying."
                  : "Type a private reply."
              }
            />
          </label>
          <div className="mt-3">
            <MediaAttachmentFields compact />
          </div>
          <div className="mt-4">
            <SubmitButton pendingLabel="Sending...">
              <Send className="h-3.5 w-3.5" />
              Send reply
            </SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
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
  };
}) {
  const url = `/api/media/${media.id}/blob`;
  if (media.mimeType.startsWith("image/")) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="giq-listing-media block"
      >
        <NextImage
          src={url}
          alt={media.originalName ?? "Message media"}
          width={media.widthPx ?? 420}
          height={media.heightPx ?? 280}
          unoptimized
          className="h-36 w-full object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="giq-outline-action min-h-14 px-3 py-2 text-[12px]"
    >
      <Paperclip className="h-4 w-4 text-[hsl(var(--primary-bright))]" />
      <span className="truncate">{media.originalName ?? media.mimeType}</span>
    </a>
  );
}

function SignedOutThread() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="giq-panel p-8">
        <Lock className="mb-4 h-7 w-7 text-[hsl(var(--primary-bright))]" />
        <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
          Sign in to view this conversation
        </h1>
        <Link
          href="/sign-in"
          className="giq-liquid-purple-button mt-6 px-5 text-[13px] font-semibold"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
