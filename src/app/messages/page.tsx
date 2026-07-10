import Link from "next/link";
import {
  Inbox,
  Lock,
  MessageSquare,
  Phone,
  Send,
  Users,
  Video,
} from "lucide-react";
import { sendMessage } from "@/app/actions";
import { MediaAttachmentFields } from "@/components/media-attachment-fields";
import { PageHero } from "@/components/page-hero";
import { RecipientPicker } from "@/components/recipient-picker";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import {
  countUnreadMessagesByConversation,
  listConversationsForProfile,
} from "@/lib/conversation-service";
import { listFriendsForProfile } from "@/lib/friend-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pulse - GreyhoundIQ",
  description:
    "Pulse private 1:1 GreyhoundIQ messaging, media, calls, and marketplace conversations.",
};

export default async function MessagesPage() {
  const user = await getCurrentUser();
  const dbContext =
    user?.dbUserId && user.profileId
      ? {
          dbUserId: user.dbUserId,
          profileId: user.profileId,
          profileRole: user.role ?? "member",
          tier: user.tier,
        }
      : null;
  // Live refresh comes from the site header's profile-channel subscription;
  // subscribing the same channel here would double-subscribe the singleton client.
  const [conversations, unreadByConversation, friends] = await Promise.all([
    dbContext ? listConversationsForProfile(dbContext) : [],
    dbContext
      ? countUnreadMessagesByConversation(dbContext)
      : new Map<string, number>(),
    dbContext ? listFriendsForProfile(dbContext) : [],
  ]);
  const unread = unreadByConversation.size;

  return (
    <div>
      <PageHero
        image="/images/wentworth-gate-hero.webp"
        title={
          <>
            Pulse.
            <br />
            <span className="gradient-text">Private racing conversations.</span>
          </>
        }
        subtitle="Private messaging, media, read receipts, and LiveKit-powered calls for owner, breeder, trainer, and marketplace conversations."
      />
      <section className="mx-auto max-w-5xl px-6 py-12">
        {!user ? (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="giq-panel p-8">
              <div className="giq-icon-plate mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
                <Lock className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
              </div>
              <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
                Sign in to open Pulse
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                Pulse conversations are private 1:1 threads between GreyhoundIQ
                profiles, with read receipts, soft delete, and block controls.
              </p>
              <a
                href="/sign-in"
                className="giq-liquid-purple-button mt-6 px-5 text-[13px] font-semibold"
              >
                Sign in
                <Send className="h-3.5 w-3.5" />
              </a>
            </div>

            <MessagingWorkflow />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div>
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
                    Pulse inbox
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
                    const otherActor =
                      conversation.participantAId === user.profileId
                        ? conversation.participantBActor
                        : conversation.participantAActor;
                    const otherName = otherActor?.displayName ?? other.displayName;
                    const message = conversation.messages[0];
                    const isSent = message?.senderId === user.profileId;
                    const unreadCount =
                      unreadByConversation.get(conversation.id) ?? 0;

                    return (
                      <Link
                        key={conversation.id}
                        href={`/pulse/${conversation.id}`}
                        className="giq-table-row block p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">
                              {otherName}
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
                                : unreadCount > 0
                                  ? "giq-status-pill-purple"
                                  : ""
                            }`}
                          >
                            {conversation.blockedAt
                              ? "Blocked"
                              : unreadCount > 0
                                ? `Unread (${unreadCount})`
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

            <aside className="space-y-5">
              <div className="giq-panel p-5">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
                    <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
                      Friends
                    </h2>
                  </div>
                  <Link
                    href="/pulse/friends"
                    className="giq-outline-action min-h-8 px-2.5 text-[11px]"
                  >
                    View all
                  </Link>
                </div>
                {friends.length === 0 ? (
                  <p className="text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                    No friends added yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {friends.slice(0, 4).map((friend) => (
                      <div
                        key={friend.friendshipId}
                        className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-[hsl(var(--foreground))]">
                              {friend.displayName}
                            </p>
                            <p className="truncate text-[12px] text-[hsl(var(--muted-foreground))]">
                              {friend.kennelName ?? friend.state ?? "GreyhoundIQ profile"}
                            </p>
                          </div>
                          {friend.verified && (
                            <span className="giq-status-pill giq-status-pill-purple">
                              Verified
                            </span>
                          )}
                        </div>
                        {friend.conversationId && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Link
                              href={`/pulse/${friend.conversationId}`}
                              className="giq-outline-action min-h-8 px-2.5 text-[11px]"
                            >
                              <MessageSquare className="h-3 w-3" />
                              Message
                            </Link>
                            <Link
                              href={`/pulse/${friend.conversationId}`}
                              className="giq-outline-action min-h-8 px-2.5 text-[11px]"
                            >
                              <Phone className="h-3 w-3" />
                              Voice
                            </Link>
                            <Link
                              href={`/pulse/${friend.conversationId}`}
                              className="giq-outline-action min-h-8 px-2.5 text-[11px]"
                            >
                              <Video className="h-3 w-3" />
                              Video
                            </Link>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="giq-panel p-5">
                <div className="mb-5 flex items-center gap-3">
                  <Send className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
                  <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
                    New Pulse message
                  </h2>
                </div>
                <form action={sendMessage} className="space-y-4">
                  <RecipientPicker />
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
                  <SubmitButton pendingLabel="Sending...">
                    Send message
                  </SubmitButton>
                </form>
              </div>
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
    "Open a private Pulse thread",
    "Share form notes and listing context",
    "Keep audit-friendly records",
  ];

  return (
    <div className="giq-panel p-8">
      <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
        Pulse workflow
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
