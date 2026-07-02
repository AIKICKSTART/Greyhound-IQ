import Link from "next/link";
import { Inbox, Lock, MessageSquare, Send } from "lucide-react";
import { sendMessage } from "@/app/actions";
import { MediaAttachmentFields } from "@/components/media-attachment-fields";
import { PageHero } from "@/components/page-hero";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import {
  getConversationsForUserEmail,
  getMessagingProfiles,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Messages - GreyhoundIQ",
  description:
    "Private 1:1 GreyhoundIQ messaging for owners, breeders, trainers, and marketplace conversations.",
};

export default async function MessagesPage() {
  const user = await getCurrentUser();
  const [conversations, profiles] = user
    ? await Promise.all([
        getConversationsForUserEmail(user.email),
        getMessagingProfiles(user.email),
      ])
    : [[], []];
  const unread = conversations.filter(
    (conversation) =>
      conversation.messages[0]?.recipientId === user?.profileId &&
      !conversation.messages[0]?.readAt
  ).length;

  return (
    <div>
      <PageHero
        image="/images/wentworth-gate-hero.webp"
        title={
          <>
            Private racing
            <br />
            <span className="gradient-text">conversations.</span>
          </>
        }
        subtitle="1:1 messaging for owner, breeder, trainer, and marketplace conversations. Message records are tied to verified GreyhoundIQ profiles."
      />

      <section className="mx-auto max-w-5xl px-6 py-12">
        {!user ? (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="giq-panel p-8">
              <div className="giq-icon-plate mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
                <Lock className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
              </div>
              <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
                Sign in to open your inbox
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                Conversations are private 1:1 threads between GreyhoundIQ
                profiles, with read receipts, soft delete, and block controls.
              </p>
              <Link
                href="/sign-in"
                className="giq-liquid-purple-button mt-6 px-5 text-[13px] font-semibold"
              >
                Sign in
                <Send className="h-3.5 w-3.5" />
              </Link>
            </div>

            <MessagingWorkflow />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div>
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
                    Inbox
                  </h2>
                  <p className="mt-1 text-[14px] text-[hsl(var(--muted-foreground))]">
                    {conversations.length} conversations - {unread} unread
                  </p>
                </div>
                <Inbox className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
              </div>

              {conversations.length === 0 ? (
                <div className="giq-empty-state p-12 text-center">
                  <MessageSquare className="mx-auto mb-4 h-8 w-8 text-[hsl(var(--primary-bright))]" />
                  <h3 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
                    No conversations yet
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-[14px] text-[hsl(var(--muted-foreground))]">
                    Send a direct message to a verified profile from the
                    composer.
                  </p>
                </div>
              ) : (
                <div className="giq-panel overflow-hidden">
                  {conversations.map((conversation) => {
                    const other =
                      conversation.participantAId === user.profileId
                        ? conversation.participantB
                        : conversation.participantA;
                    const message = conversation.messages[0];
                    const isSent = message?.senderId === user.profileId;
                    const isUnread =
                      message?.recipientId === user.profileId && !message.readAt;

                    return (
                      <Link
                        key={conversation.id}
                        href={`/messages/${conversation.id}`}
                        className="giq-table-row block p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">
                              {other.displayName}
                            </h3>
                            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                              {message
                                ? `${isSent ? "You: " : ""}${message.body}`
                                : "Conversation started"}
                            </p>
                          </div>
                          <span
                            className={`giq-status-pill ${
                              conversation.blockedAt
                                ? "border-red-500/25 bg-red-500/10 text-red-200"
                                : isUnread
                                  ? "giq-status-pill-purple"
                                  : ""
                            }`}
                          >
                            {conversation.blockedAt
                              ? "Blocked"
                              : isUnread
                                ? "Unread"
                                : message?.readAt
                                  ? "Read"
                                  : "Open"}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="giq-panel p-5">
              <div className="mb-5 flex items-center gap-3">
                <Send className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
                <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
                  New message
                </h2>
              </div>
              <form action={sendMessage} className="space-y-4">
                <label className="block">
                  <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                    Recipient
                  </span>
                  <select
                    name="recipientProfileId"
                    required
                    className="giq-form-control mt-2 px-3 py-2"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select profile
                    </option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.displayName}
                        {profile.verified ? " - verified" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                    Message
                  </span>
                  <textarea
                    name="body"
                    required
                    maxLength={5000}
                    rows={6}
                    className="giq-form-control giq-textarea mt-2 px-3 py-2"
                    placeholder="Ask about a listing, dog record, or race note."
                  />
                </label>
                <MediaAttachmentFields compact />
                <SubmitButton pendingLabel="Sending...">Send message</SubmitButton>
              </form>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}

function MessagingWorkflow() {
  const steps = [
    "Find a verified owner or seller",
    "Open a private 1:1 thread",
    "Share form notes and listing context",
    "Keep audit-friendly records",
  ];

  return (
    <div className="giq-panel p-8">
      <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
        Messaging workflow
      </h2>
      <div className="mt-5 space-y-3">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3">
            <span className="giq-icon-plate flex h-7 w-7 items-center justify-center rounded-md text-[12px] font-bold">
              {index + 1}
            </span>
            <span className="text-[14px] text-[hsl(var(--muted-foreground))]">
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
