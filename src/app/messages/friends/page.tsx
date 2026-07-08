import Link from "next/link";
import {
  ArrowLeft,
  Lock,
  MessageSquare,
  Phone,
  Users,
  Video,
} from "lucide-react";

import { PageHero } from "@/components/page-hero";
import { getCurrentUser } from "@/lib/auth";
import { listFriendsForProfile } from "@/lib/friend-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pulse friends - GreyhoundIQ",
  description: "GreyhoundIQ Pulse friends, direct messages, voice calls, and video calls.",
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
  const friends = dbContext ? await listFriendsForProfile(dbContext) : [];

  return (
    <div>
      <PageHero
        image="/images/wentworth-gate-hero.webp"
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
        ) : friends.length === 0 ? (
          <div className="giq-empty-state p-12 text-center">
            <Users className="mx-auto mb-4 h-8 w-8 text-[hsl(var(--primary-bright))]" />
            <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
              No friends yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[14px] text-[hsl(var(--muted-foreground))]">
              Accepted friends will appear here with direct message, voice, and
              video entry points.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {friends.map((friend) => (
              <article key={friend.friendshipId} className="giq-panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[18px] font-semibold text-[hsl(var(--foreground))]">
                      {friend.displayName}
                    </h2>
                    <p className="mt-1 truncate text-[13px] text-[hsl(var(--muted-foreground))]">
                      {friend.email ?? friend.kennelName ?? friend.state ?? "GreyhoundIQ profile"}
                    </p>
                    <p className="mt-1 text-[12px] text-[hsl(var(--subtle-foreground))]">
                      {friend.kennelName ? `${friend.kennelName} · ` : ""}
                      {friend.state ?? "Australia"}
                    </p>
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
                    Start a Pulse message from the inbox composer to open calls.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
