import Link from "next/link";
import { Lock } from "lucide-react";
import { FeedInfiniteList } from "@/components/feed-infinite-list";
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
import { getFeedPageForViewer, getFeedTopics } from "@/lib/feed-service";
import type { FeedMode } from "@/lib/feed-pagination";
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
} from "@/lib/realtime-service";
import {
  ensureOwnedPageActor,
  ensurePersonalActor,
} from "@/lib/social-actor-service";

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

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const requestedMode = (await searchParams).mode;
  const mode: FeedMode = requestedMode === "latest" ? "latest" : "for-you";
  const user = await getCurrentUser();

  if (!user?.dbUserId || !user.profileId) {
    const [topics, feedPage] = await Promise.all([
      getFeedTopics(),
      getFeedPageForViewer({ mode, limit: 20, current: null }),
    ]);
    const posts = feedPage.items;
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
        <section className="mx-auto max-w-2xl space-y-4 px-4 py-12 sm:px-6">
          <FeedInfiniteList
            key={feedListKey(mode, null)}
            initialPosts={posts}
            initialCursor={feedPage.nextCursor}
            mode={mode}
            actorId={null}
            canInteract={false}
            currentProfileId={null}
            signedIn={false}
          />
        </section>
      </div>
    );
  }

  const current = {
    id: user.id,
    dbUserId: user.dbUserId,
    profileId: user.profileId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name,
    profileRole: user.role ?? "member",
    role: user.role,
    tier: user.tier,
    isBanned: user.isBanned,
    deletionRequestedAt: user.deletionRequestedAt,
    displayName: user.name,
    verified: false,
  };
  const isPro = hasTier(user.tier, "pro");
  const ownedPages = await getOwnedPageIdentities(current);
  const identity = await getActiveIdentity(ownedPages);
  const activePage = identity.kind === "page" ? identity.page : null;
  const activeActor = activePage
    ? await ensureOwnedPageActor(current, activePage.id)
    : await ensurePersonalActor(current);

  const [
    topics,
    feedPage,
    friends,
    requests,
    conversations,
    unreadByConversation,
    pendingInvites,
    profile,
  ] = await Promise.all([
    getFeedTopics(),
    getFeedPageForViewer({
      mode,
      actorId: activeActor.id,
      limit: 20,
      current,
    }),
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
  const posts = feedPage.items;
  const canUseFeedAsActiveIdentity = !activePage || isPro;

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
  const activeIdentityAvatarUrl =
    activeActor.avatarUrl ?? activePage?.media.avatarUrl ?? personal.avatarUrl;

  const actorConversations = conversations.filter((conversation) => {
    const belongsToActiveActor =
      conversation.participantAActorId === activeActor.id ||
      conversation.participantBActorId === activeActor.id;
    const isLegacyPersonalConversation =
      !activePage &&
      !conversation.participantAActorId &&
      !conversation.participantBActorId;
    return belongsToActiveActor || isLegacyPersonalConversation;
  });
  const conversationRows: HubConversationRow[] = actorConversations
    .slice(0, 12)
    .map((conversation) => {
      const other =
        conversation.participantAId === user.profileId
          ? conversation.participantB
          : conversation.participantA;
      const otherActor =
        conversation.participantAId === user.profileId
          ? conversation.participantBActor
          : conversation.participantAActor;
      const message = conversation.messages[0];
      const isSent = message?.senderId === user.profileId;
      return {
        id: conversation.id,
        otherName: otherActor?.displayName ?? other.displayName,
        preview: message
          ? `${isSent ? "You: " : ""}${message.body}`
          : "Conversation started",
        attachmentCount: message?._count.media ?? 0,
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
    <div className="giq-social-hub mx-auto w-full max-w-[1680px] px-2 py-4 sm:px-4 lg:px-5 2xl:px-6">
      <div className="giq-social-hub-grid grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_300px] 2xl:grid-cols-[260px_minmax(0,1fr)_340px]">
        <aside className="hidden lg:block" aria-label="Hub navigation">
          <div className="sticky top-[84px] max-h-[calc(100dvh-105px)] overflow-y-auto pr-1">
            <HubLeftSidebar
              identity={identity}
              pages={ownedPages}
              personalName={personal.displayName}
              personalAvatarUrl={personal.avatarUrl}
              isPro={isPro}
            />
          </div>
        </aside>

        <main
          data-feed-scroll
          aria-label="Community feed"
          tabIndex={0}
          className="giq-social-feed-scroll min-w-0 space-y-4 lg:h-[calc(100dvh-105px)] lg:overflow-y-auto lg:overscroll-contain lg:pb-8 lg:pr-1 [scrollbar-gutter:stable]"
        >
          {/* Ringing card surfaces above the feed on mobile where the right
              messenger column is hidden. */}
          <div className="space-y-3 xl:hidden">
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

          <HubIdentityBanner
            actor={activeActor}
            identity={identity}
            personal={personal}
          />

          <nav
            aria-label="Feed order"
            className="giq-social-feed-tabs giq-panel flex min-h-11 items-center gap-1 p-1"
          >
            <Link
              href="/feed?mode=for-you"
              aria-current={mode === "for-you" ? "page" : undefined}
              className={`min-h-10 flex-1 rounded-lg px-4 py-2 text-center text-[13px] font-semibold transition ${
                mode === "for-you"
                  ? "bg-[hsl(var(--primary)/0.18)] text-[hsl(var(--primary-light))]"
                  : "text-[hsl(var(--muted-foreground))] hover:bg-white/[0.04]"
              }`}
            >
              For You
            </Link>
            <Link
              href="/feed?mode=latest"
              aria-current={mode === "latest" ? "page" : undefined}
              className={`min-h-10 flex-1 rounded-lg px-4 py-2 text-center text-[13px] font-semibold transition ${
                mode === "latest"
                  ? "bg-[hsl(var(--primary)/0.18)] text-[hsl(var(--primary-light))]"
                  : "text-[hsl(var(--muted-foreground))] hover:bg-white/[0.04]"
              }`}
            >
              Latest
            </Link>
          </nav>

          {canUseFeedAsActiveIdentity ? (
            <section
              id="feed-composer"
              className="giq-social-composer-shell giq-panel scroll-mt-24 p-4"
            >
              <InstantFeedPostComposer
                topics={topics}
                pageId={activePage?.id ?? null}
                identityLabel={activePage ? activePage.title : personal.displayName}
                identityAvatarUrl={activeIdentityAvatarUrl}
              />
            </section>
          ) : (
            <section className="giq-panel p-5">
              <div className="mb-3 flex items-center gap-3">
                <Lock className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
                <h2 className="text-[16px] font-semibold text-[hsl(var(--foreground))]">
                  Managed pages require Pro
                </h2>
              </div>
              <p className="text-[14px] text-[hsl(var(--muted-foreground))]">
                Switch to your personal identity to post, comment, and react
                for free. Pro is required to publish as {activePage?.title}.
              </p>
              <Link
                href="/pricing"
                className="giq-button giq-button-primary mt-4 w-fit px-4 text-[13px] font-semibold"
              >
                View Pro
              </Link>
            </section>
          )}

          <FeedInfiniteList
            key={feedListKey(mode, activeActor.id)}
            initialPosts={posts}
            initialCursor={feedPage.nextCursor}
            mode={mode}
            actorId={activeActor.id}
            canInteract={canUseFeedAsActiveIdentity}
            currentProfileId={user.profileId}
            activeActorId={activeActor.id}
            signedIn
            pageAvatarUrls={Object.fromEntries(pageAvatars)}
          />
        </main>

        <aside className="giq-social-messenger-rail hidden xl:block" aria-label="Messenger">
          <div className="sticky top-[84px] max-h-[calc(100dvh-105px)]">
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
                conversationId: activePage
                  ? actorConversations.find((conversation) =>
                      (conversation.participantAActorId === activeActor.id ||
                        conversation.participantBActorId === activeActor.id) &&
                      (conversation.participantAId === friend.profileId ||
                        conversation.participantBId === friend.profileId)
                    )?.id ?? null
                  : friend.conversationId,
              }))}
              conversations={conversationRows}
              canStartChat={!activePage || isPro}
              canStartCall={isPro && !activePage}
              senderActorId={activeActor.id}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function feedListKey(
  mode: FeedMode,
  actorId: string | null
) {
  return `${mode}:${actorId ?? "anonymous"}`;
}
