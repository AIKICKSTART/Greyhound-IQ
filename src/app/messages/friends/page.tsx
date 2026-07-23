import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Check,
  Lock,
  MessageSquare,
  Phone,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";

import { respondToFriendRequestAction } from "@/app/actions";
import { AddFriendSearch } from "@/components/hub/add-friend-search";
import { PageHero } from "@/components/page-hero";
import { getCurrentUser } from "@/lib/auth";
import {
  listFriendRequestsForProfile,
  listFriendsForProfile,
} from "@/lib/friend-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pulse friends - GreyhoundIQ",
  description:
    "GreyhoundIQ Pulse friends, direct messages, voice calls, and video calls.",
};

export default async function PulseFriendsPage() {
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
  const [friends, requests] = dbContext
    ? await Promise.all([
        listFriendsForProfile(dbContext),
        listFriendRequestsForProfile(dbContext),
      ])
    : [[], []];
  const incomingRequests = requests.filter(
    (request) => request.direction === "incoming",
  );
  const outgoingRequests = requests.filter(
    (request) => request.direction === "outgoing",
  );

  return (
    <div>
      <PageHero
        image="/images/feed/posts/owner-fiftieth-start.webp"
        title={
          <>
            Pulse friends.
            <br />
            <span className="gradient-text">Message, voice, and video.</span>
          </>
        }
        subtitle="Your accepted GreyhoundIQ contacts for private Pulse messaging and calls."
      />
      <section className="mx-auto max-w-5xl px-6 py-12">
        <Link
          href="/pulse"
          className="mb-6 inline-flex items-center gap-2 text-[13px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Pulse inbox
        </Link>

        {!user ? (
          <div className="giq-panel p-8">
            <Lock className="mb-4 h-7 w-7 text-[hsl(var(--primary-bright))]" />
            <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
              Sign in to view friends
            </h2>
            <a
              href="/sign-in"
              className="giq-liquid-purple-button mt-6 px-5 text-[13px] font-semibold"
            >
              Sign in
            </a>
          </div>
        ) : (
          <>
            <section
              id="requests"
              className="giq-panel scroll-mt-24 p-5"
              aria-labelledby="friend-requests-heading"
            >
              <h2
                id="friend-requests-heading"
                className="flex items-center gap-2 text-[18px] font-semibold text-[hsl(var(--foreground))]"
              >
                <UserPlus
                  className="h-4 w-4 text-[hsl(var(--primary-bright))]"
                  aria-hidden="true"
                />
                Friend requests
                {incomingRequests.length > 0 ? (
                  <span className="giq-status-pill giq-status-pill-purple ml-auto">
                    {incomingRequests.length}
                  </span>
                ) : null}
              </h2>

              {incomingRequests.length === 0 ? (
                <p className="mt-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                  No incoming requests.
                </p>
              ) : (
                <ul className="mt-4 grid gap-3 md:grid-cols-2">
                  {incomingRequests.map((request) => (
                    <li
                      key={request.friendshipId}
                      className="flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"
                    >
                      <ProfileAvatar
                        name={request.displayName}
                        src={request.avatarUrl}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-[hsl(var(--foreground))]">
                          {request.displayName}
                        </span>
                        <span className="block truncate text-[12px] text-[hsl(var(--muted-foreground))]">
                          {request.kennelName ??
                            request.state ??
                            "GreyhoundIQ member"}
                        </span>
                      </span>
                      <form action={respondToFriendRequestAction}>
                        <input
                          type="hidden"
                          name="friendshipId"
                          value={request.friendshipId}
                        />
                        <input type="hidden" name="response" value="accept" />
                        <button
                          type="submit"
                          aria-label={`Accept friend request from ${request.displayName}`}
                          className="giq-button giq-button-primary h-11 w-11 justify-center px-0"
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </form>
                      <form action={respondToFriendRequestAction}>
                        <input
                          type="hidden"
                          name="friendshipId"
                          value={request.friendshipId}
                        />
                        <input type="hidden" name="response" value="decline" />
                        <button
                          type="submit"
                          aria-label={`Decline friend request from ${request.displayName}`}
                          className="giq-button giq-button-glass h-11 w-11 justify-center px-0"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              {outgoingRequests.length > 0 ? (
                <p className="mt-4 text-[12px] text-[hsl(var(--subtle-foreground))]">
                  {outgoingRequests.length} sent request
                  {outgoingRequests.length === 1 ? "" : "s"} awaiting a
                  response.
                </p>
              ) : null}
            </section>

            {friends.length === 0 ? (
              <div className="giq-empty-state p-12 text-center">
                <Users className="mx-auto mb-4 h-8 w-8 text-[hsl(var(--primary-bright))]" />
                <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
                  No friends yet
                </h2>
                <p className="mx-auto mt-2 max-w-md text-[14px] text-[hsl(var(--muted-foreground))]">
                  Accepted friends will appear here with direct message, voice,
                  and video entry points.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {friends.map((friend) => (
                  <article key={friend.friendshipId} className="giq-panel p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <ProfileAvatar
                          name={friend.displayName}
                          src={friend.avatarUrl}
                        />
                        <div className="min-w-0">
                          <h2 className="truncate text-[18px] font-semibold text-[hsl(var(--foreground))]">
                            {friend.displayName}
                          </h2>
                          <p className="mt-1 truncate text-[13px] text-[hsl(var(--muted-foreground))]">
                            {friend.kennelName ??
                              `${friend.role.charAt(0).toUpperCase()}${friend.role.slice(1)} profile`}
                          </p>
                          <p className="mt-1 text-[12px] text-[hsl(var(--subtle-foreground))]">
                            {friend.state ?? "Australia"}
                          </p>
                        </div>
                      </div>
                      {friend.verified && (
                        <span className="giq-status-pill giq-status-pill-purple">
                          Verified
                        </span>
                      )}
                    </div>

                    {friend.conversationId ? (
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Link
                          href={`/pulse/${friend.conversationId}`}
                          className="giq-outline-action px-3 text-[12px]"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Message
                        </Link>
                        <Link
                          href={`/pulse/${friend.conversationId}`}
                          className="giq-outline-action px-3 text-[12px]"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          Voice call
                        </Link>
                        <Link
                          href={`/pulse/${friend.conversationId}`}
                          className="giq-outline-action px-3 text-[12px]"
                        >
                          <Video className="h-3.5 w-3.5" />
                          Video call
                        </Link>
                      </div>
                    ) : (
                      <p className="mt-5 text-[13px] text-[hsl(var(--muted-foreground))]">
                        Start a Pulse message from the inbox composer to open
                        calls.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        {dbContext ? (
          <section
            className="giq-panel mt-8 p-5"
            aria-labelledby="find-friends-heading"
          >
            <h2
              id="find-friends-heading"
              className="text-[18px] font-semibold text-[hsl(var(--foreground))]"
            >
              Find friends
            </h2>
            <p className="mb-4 mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
              Add any GreyhoundIQ member who allows account discovery.
            </p>
            <AddFriendSearch
              excludeProfileIds={[dbContext.profileId]}
            />
          </section>
        ) : null}
      </section>
    </div>
  );
}

function ProfileAvatar({ name, src }: { name: string; src: string | null }) {
  return (
    <span className="relative grid size-14 shrink-0 place-items-center rounded-full border border-white/10 bg-[hsl(var(--primary)/0.14)] text-[15px] font-semibold text-[hsl(var(--primary-light))]">
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          className="rounded-full object-cover"
          sizes="56px"
          unoptimized={src.startsWith("/api/media/")}
        />
      ) : (
        name.trim().charAt(0).toUpperCase() || "G"
      )}
    </span>
  );
}
