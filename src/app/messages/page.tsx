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
    <div className="fade-in">
      <PageHero
        image="/images/feature-pricing-product.png"
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
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(142_76%_36%/0.12)]">
                <Lock className="h-5 w-5 text-[hsl(142_60%_48%)]" />
              </div>
              <h2 className="text-2xl font-semibold text-[hsl(210_13%_97%)]">
                Sign in to open your inbox
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[hsl(215_14%_65%)]">
                Conversations are private 1:1 threads between GreyhoundIQ
                profiles, with read receipts, soft delete, and block controls.
              </p>
              <Link
                href="/sign-in"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[hsl(142_76%_36%)] to-[hsl(142_60%_40%)] px-5 py-2.5 text-[13px] font-semibold text-white shadow-xl shadow-[hsl(142_76%_36%/0.25)] transition-all hover:brightness-110"
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
                  <h2 className="text-2xl font-semibold text-[hsl(210_13%_97%)]">
                    Inbox
                  </h2>
                  <p className="mt-1 text-[14px] text-[hsl(215_14%_65%)]">
                    {conversations.length} conversations - {unread} unread
                  </p>
                </div>
                <Inbox className="h-5 w-5 text-[hsl(142_60%_48%)]" />
              </div>

              {conversations.length === 0 ? (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
                  <MessageSquare className="mx-auto mb-4 h-8 w-8 text-[hsl(142_60%_48%)]" />
                  <h3 className="text-[18px] font-semibold text-[hsl(210_13%_97%)]">
                    No conversations yet
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-[14px] text-[hsl(215_14%_65%)]">
                    Send a direct message to a verified profile from the
                    composer.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
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
                        className="block border-b border-white/[0.05] p-5 transition-colors last:border-0 hover:bg-white/[0.03]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <h3 className="text-[15px] font-semibold text-[hsl(210_13%_97%)]">
                              {other.displayName}
                            </h3>
                            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[hsl(215_14%_65%)]">
                              {message
                                ? `${isSent ? "You: " : ""}${message.body}`
                                : "Conversation started"}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              conversation.blockedAt
                                ? "bg-red-500/10 text-red-200"
                                : isUnread
                                  ? "bg-[hsl(142_76%_36%/0.12)] text-[hsl(142_60%_48%)]"
                                  : "bg-white/[0.05] text-[hsl(220_7%_42%)]"
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

            <aside className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="mb-5 flex items-center gap-3">
                <Send className="h-5 w-5 text-[hsl(142_60%_48%)]" />
                <h2 className="text-[18px] font-semibold text-[hsl(210_13%_97%)]">
                  New message
                </h2>
              </div>
              <form action={sendMessage} className="space-y-4">
                <label className="block">
                  <span className="text-[12px] font-semibold uppercase text-[hsl(220_7%_42%)]">
                    Recipient
                  </span>
                  <select
                    name="recipientProfileId"
                    required
                    className="mt-2 w-full rounded-lg border border-white/[0.08] bg-[hsl(150_30%_3%)] px-3 py-2 text-[14px] text-[hsl(210_13%_97%)] outline-none transition-colors focus:border-[hsl(142_76%_36%)]"
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
                  <span className="text-[12px] font-semibold uppercase text-[hsl(220_7%_42%)]">
                    Message
                  </span>
                  <textarea
                    name="body"
                    required
                    maxLength={5000}
                    rows={6}
                    className="mt-2 w-full resize-y rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[14px] leading-relaxed text-[hsl(210_13%_97%)] outline-none transition-colors placeholder:text-[hsl(220_7%_42%)] focus:border-[hsl(142_76%_36%)]"
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
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8">
      <h2 className="text-[18px] font-semibold text-[hsl(210_13%_97%)]">
        Messaging workflow
      </h2>
      <div className="mt-5 space-y-3">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[hsl(142_76%_36%/0.12)] text-[12px] font-bold text-[hsl(142_60%_48%)]">
              {index + 1}
            </span>
            <span className="text-[14px] text-[hsl(215_14%_65%)]">
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
