import {
  ArrowLeft,
  Clock3,
  LifeBuoy,
  MessageSquareText,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageTitle } from "@/components/page-title";
import { requireCurrentUserProfile } from "@/lib/auth";
import {
  getSupportTicketForCurrentUser,
  SUPPORT_TICKET_MESSAGE_LIMIT,
  supportMessageAuthorLabel,
} from "@/lib/support-ticket-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Support ticket - GreyhoundIQ",
  description: "Review a GreyhoundIQ support ticket.",
  robots: { index: false, follow: false },
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Australia/Sydney",
});

export default async function AccountSupportTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await requireSupportTicketProfile();
  const { id } = await params;
  const ticket = await getSupportTicketForCurrentUser(current, id);

  if (!ticket) notFound();

  const messageCount = ticket._count.messages;
  const isMessageListCapped = messageCount > SUPPORT_TICKET_MESSAGE_LIMIT;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <Link href="/account/support" className="giq-outline-action w-fit">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to support
      </Link>

      <header className="giq-panel mt-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="program-label">Member support</p>
            <PageTitle size="compact" className="mt-2">
              {formatLabel(ticket.category)} support ticket
            </PageTitle>
            <p className="mt-2 text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
              Created {formatDateTime(ticket.createdAt)} · Last updated{" "}
              {formatDateTime(ticket.updatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="giq-status-pill giq-status-pill-gold">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              {formatLabel(ticket.status)}
            </span>
            <span className="giq-status-pill giq-status-pill-purple">
              {formatLabel(ticket.priority)} priority
            </span>
          </div>
        </div>
      </header>

      <section
        className="giq-panel mt-5 p-5 sm:p-6"
        aria-labelledby="support-ticket-conversation"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquareText
                className="h-5 w-5 text-[hsl(var(--primary-bright))]"
                aria-hidden="true"
              />
              <h2
                id="support-ticket-conversation"
                className="text-xl font-semibold text-[hsl(var(--foreground))]"
              >
                Conversation
              </h2>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
              {formatMessageCount(messageCount)} in this ticket.
            </p>
          </div>
          {isMessageListCapped ? (
            <p className="giq-status-pill" role="status">
              Latest {SUPPORT_TICKET_MESSAGE_LIMIT} shown
            </p>
          ) : null}
        </div>

        {ticket.messages.length > 0 ? (
          <ol className="mt-5 grid gap-3" aria-label="Support ticket messages">
            {ticket.messages.map((message) => {
              const author = supportMessageAuthorLabel(
                message.userId,
                current.dbUserId,
              );
              const isCurrentUser = author === "You";

              return (
                <li
                  key={message.id}
                  className={`rounded-2xl border p-4 sm:p-5 ${
                    isCurrentUser
                      ? "border-[hsl(var(--primary)/0.24)] bg-[hsl(var(--primary)/0.08)]"
                      : "border-white/[0.08] bg-white/[0.025]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold text-[hsl(var(--foreground))]">
                      {author}
                    </p>
                    <time
                      dateTime={message.createdAt.toISOString()}
                      className="text-[11px] text-[hsl(var(--subtle-foreground))]"
                    >
                      {formatDateTime(message.createdAt)}
                    </time>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
                    {message.body}
                  </p>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="giq-dashed-panel mt-5 px-5 py-10 text-center">
            <LifeBuoy
              className="mx-auto h-6 w-6 text-[hsl(var(--primary-bright))]"
              aria-hidden="true"
            />
            <h3 className="mt-3 text-[16px] font-semibold text-[hsl(var(--foreground))]">
              No messages are available
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
              The ticket exists, but its conversation does not contain a message.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

async function requireSupportTicketProfile() {
  try {
    return await requireCurrentUserProfile();
  } catch (err) {
    if (err instanceof Error && err.message === "auth.unauthorized") {
      redirect("/sign-in");
    }
    throw err;
  }
}

function formatDateTime(date: Date) {
  return DATE_TIME_FORMATTER.format(date);
}

function formatMessageCount(value: number) {
  return `${value.toLocaleString("en-AU")} ${value === 1 ? "message" : "messages"}`;
}

function formatLabel(value: string) {
  const text = value.trim();
  if (!text) return "Unknown";
  const cleaned = text.replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const clipped = cleaned.length > 64 ? `${cleaned.slice(0, 61)}...` : cleaned;
  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}
