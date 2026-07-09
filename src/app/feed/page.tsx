import Link from "next/link";
import { Lock, MessageSquare } from "lucide-react";
import { FeedPostCard } from "@/components/feed-post-card";
import { HubIdentityBanner } from "@/components/hub/hub-identity-banner";
import { HubLeftSidebar } from "@/components/hub/hub-left-sidebar";
import {
  HubMessengerPanel,
  type HubConversationRow,
} from "@/components/hub/hub-messenger-panel";
import {
  HubIncomingCall,
  type IncomingCallInvite,
} from "@/components/hub/hub-incoming-call";
import { InstantFeedPostComposer } from "@/components/instant-feed-controls";
import { PageHero } from "@/components/page-hero";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getCurrentUser, hasTier } from "@/lib/auth";
import { listPendingCallInvitesForProfile } from "@/lib/call-service";
import {
  countUnreadMessagesByConversation,
  listConversationsForProfile,
} from "@/lib/conversation-service";
import { resolvePageAvatarUrls } from "@/lib/custom-page-service";
import { withDbRequestContext } from "@/lib/db-context";
import { getFeedPostsForViewer, getFeedTopics } from "@/lib/feed-service";
import {
  listFriendRequestsForProfile,
  listFriendsForProfile,
} from "@/lib/friend-service";
import {
  getActiveIdentity,
  getOwnedPageIdentities,
} from "@/lib/identity";
import {
  membersPresenceChannel,
  publicFeedRealtimeChannel,
} from "@/lib/realtime-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Feed - GreyhoundIQ",
  description:
    "Your GreyhoundIQ home: community feed, pages, friends, messages, and calls in one place.",
};

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  pro_plus: "Pro+",
};

export default async function FeedPage() {
  const user = await getCurrentUser();
  const feedChannel = publicFeedRealtimeChannel();

  if (!user?.dbUserId || !user.profileId) {
    const [topics, posts] = await Promise.all([
      getFeedTopics(),
      getFeedPostsForViewer(30, null),
    ]);
    void topics;
    return (
      <div>
        <PageHero
          image="/images/wentworth-gate-hero.webp"
          title={
            <>
              Community feed.
              <br />
              <span className="gradient-text">Trackside signal.</span>
            </>
          }
          subtitle="Race notes, kennel updates, and marketplace context from the GreyhoundIQ community. Sign in to post, connect, and chat."
        >
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/sign-in"
              className="giq-button giq-button-primary px-5 text-[13px] font-semibold"
            >
              Sign in
            </a>
            <Link
              href="/pricing"
              className="giq-button giq-button-glass px-5 text-[13px] font-semibold"
            >
              View plans
            </Link>
          </div>
        </PageHero>
        <RealtimeRefresh
          channels={[{ name: feedChannel, events: ["post_created", "post_updated"] }]}
        />
        <section className="mx-auto max-w-2xl space-y-4 px-4 py-12 sm:px-6">
          {posts.length === 0 ? (
            <div className="giq-empty-state p-12 text-center">
              <p className="text-[14px] text-[hsl(var(--muted-foreground))]">
                No feed posts yet.
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <FeedPostCard
                key={post.id}
                post={post}
                canInteract={false}
                currentProfileId={null}
                signedIn={false}
              />
            ))
          )}
        </section>
      </div>
    );
  }

  const current = {
    dbUserId: user.dbUserId,
    profileId: user.profileId,
    profileRole: user.role ?? "member",
    tier: user.tier,
  };
  const isPro = hasTier(user.tier, "pro");

  const [
    topics,
    posts,
    ownedPages,
    friends,
    requests,
    conversations,
    unreadByConversation,
    pendingInvites,
    profile,
  ] = await Promise.all([
    getFeedTopics(),
    getFeedPostsForViewer(30, user.profileId),
    getOwnedPageIdentities(current),
    listFriendsForProfile(current),
    listFriendRequestsForProfile(current),
    listConversationsForProfile(current),
    countUnreadMessagesByConversation(current),
    listPendingCallInvitesForProfile(current),
    withDbRequestContext(current, (tx) =>
      tx.profile.findUnique({
        where: { id: current.profileId },
        select: {
          displayName: true,
          avatarUrl: true,
          verified: true,
          kennelName: true,
          state: true,
        },
      })
    ),
  ]);

  const identity = await getActiveIdentity(ownedPages);
  const activePage = identity.kind === "page" ? identity.page : null;

  const pagesInPosts = posts
    .map((post) => post.authorPage)
    .filter((page): page is NonNullable<typeof page> => Boolean(page));
  const pageAvatars = await resolvePageAvatarUrls(pagesInPosts);

  const personal = {
    displayName: profile?.displayName ?? user.name,
    avatarUrl: profile?.avatarUrl ?? null,
    verified: profile?.verified ?? false,
    kennelName: profile?.kennelName ?? null,
    state: profile?.state ?? null,
    tierLabel: TIER_LABELS[user.tier] ?? "Free",
  };

  const conversationRows: HubConversationRow[] = conversations
    .slice(0, 6)
    .map((conversation) => {
      const other =
        conversation.participantAId === user.profileId
          ? conversation.participantB
          : conversation.participantA;
      const message = conversation.messages[0];
      const isSent = message?.senderId === user.profileId;
      return {
        id: conversation.id,
        otherName: other.displayName,
        preview: message
          ? `${isSent ? "You: " : ""}${message.body}`
          : "Conversation started",
        unread: unreadByConversation.get(conversation.id) ?? 0,
      };
    });

  const invites: IncomingCallInvite[] = pendingInvites.map((invite) => ({
    inviteId: invite.id,
    roomId: invite.callRoomId,
    conversationId: invite.callRoom.conversationId,
    callType: invite.callRoom.callType === "voice" ? "voice" : "video",
    fromName: invite.fromProfile.displayName,
  }));

  return (
    <div className="mx-auto max-w-[1400px] px-3 py-6 sm:px-5 lg:px-6">
      <RealtimeRefresh
        channels={[
          {
            name: feedChannel,
            events: [
              "post_created",
              "post_updated",
              "comment_created",
              "reaction_updated",
              "topic_updated",
            ],
          },
        ]}
      />
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
        <aside className="hidden lg:block" aria-label="Hub navigation">
          <div className="sticky top-[170px]">
            <HubLeftSidebar
              identity={identity}
              pages={ownedPages}
              personalName={personal.displayName}
              personalAvatarUrl={personal.avatarUrl}
              isPro={isPro}
            />
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          {/* Ringing card surfaces above the feed on mobile where the right
              messenger column is hidden. */}
          <div className="space-y-3 lg:hidden">
            {invites.map((invite) => (
              <HubIncomingCall key={invite.inviteId} invite={invite} />
            ))}
          </div>

          {/* Mobile: identity switcher + shortcuts live in a left drawer. */}
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger className="giq-button giq-button-glass min-h-10 w-full justify-between px-3 text-[13px] font-semibold">
                <span className="truncate">
                  Acting as{" "}
                  <span className="text-[hsl(var(--primary-light))]">
                    {activePage ? activePage.title : personal.displayName}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="text-[11px] text-[hsl(var(--subtle-foreground))]"
                >
                  Switch
                </span>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[300px] overflow-y-auto bg-[hsl(var(--surface-1)/0.97)] p-4 backdrop-blur-xl"
              >
                <SheetTitle className="sr-only">
                  Identity and navigation
                </SheetTitle>
                <HubLeftSidebar
                  identity={identity}
                  pages={ownedPages}
                  personalName={personal.displayName}
                  personalAvatarUrl={personal.avatarUrl}
                  isPro={isPro}
                />
              </SheetContent>
            </Sheet>
          </div>

          <HubIdentityBanner identity={identity} personal={personal} />

          {isPro ? (
            <section className="giq-panel p-5">
              <div className="mb-4 flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
                <h2 className="text-[16px] font-semibold text-[hsl(var(--foreground))]">
                  Share an update
                </h2>
              </div>
              <InstantFeedPostComposer
                topics={topics}
                pageId={activePage?.id ?? null}
                identityLabel={activePage ? activePage.title : personal.displayName}
              />
            </section>
          ) : (
            <section className="giq-panel p-5">
              <div className="mb-3 flex items-center gap-3">
                <Lock className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
                <h2 className="text-[16px] font-semibold text-[hsl(var(--foreground))]">
                  Upgrade to post
                </h2>
              </div>
              <p className="text-[14px] text-[hsl(var(--muted-foreground))]">
                Free accounts can read the feed, add friends, and reply in
                chats. Posting, comments, reactions, pages, and starting calls
                are included with Pro.
              </p>
              <Link
                href="/pricing"
                className="giq-button giq-button-primary mt-4 w-fit px-4 text-[13px] font-semibold"
              >
                View Pro
              </Link>
            </section>
          )}

          {posts.length === 0 ? (
            <div className="giq-empty-state p-12 text-center">
              <MessageSquare className="mx-auto mb-4 h-8 w-8 text-[hsl(var(--primary-bright))]" />
              <h3 className="text-[16px] font-semibold text-[hsl(var(--foreground))]">
                No posts yet
              </h3>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-[hsl(var(--muted-foreground))]">
                Be the first to share a race note or kennel update.
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <FeedPostCard
                key={post.id}
                post={post}
                canInteract={isPro}
                currentProfileId={user.profileId}
                signedIn
                pageAvatarUrl={
                  post.authorPage ? pageAvatars.get(post.authorPage.id) : null
                }
              />
            ))
          )}
        </main>

        <aside className="hidden lg:block" aria-label="Messenger">
          <div className="sticky top-[170px]">
            <HubMessengerPanel
              presenceChannel={membersPresenceChannel()}
              selfProfileId={user.profileId}
              invites={invites}
              requests={requests}
              friends={friends.map((friend) => ({
                friendshipId: friend.friendshipId,
                profileId: friend.profileId,
                displayName: friend.displayName,
                verified: friend.verified,
                conversationId: friend.conversationId,
              }))}
              conversations={conversationRows}
              canStartChat={isPro}
              canStartCall={isPro}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
