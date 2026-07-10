import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  DollarSign,
  Globe,
  ImageIcon,
  Mail,
  MessageCircle,
  Phone,
  Settings,
  Trophy,
  UserPlus,
  UserRoundCheck,
  Users,
} from "lucide-react";
import {
  getPublishedCustomPageByHandle,
  resolveCustomPageMedia,
  CUSTOM_PAGE_TYPE_LABELS,
  type CustomPageMediaUrls,
  type PublicCustomPage,
} from "@/lib/custom-page-service";
import { getDogPrizeMoney, getActiveListingsForProfile } from "@/lib/queries";
import { mediaDeliveryUrl } from "@/lib/media-service";
import { FinishBadge } from "@/components/finish-badge";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import type { DbContextUser } from "@/lib/db-context";
import {
  getSocialActorProfileByHandle,
  type SocialActorProfileView,
} from "@/lib/social-actor-service";
import { getFriendshipState, type FriendshipState } from "@/lib/friend-service";
import { sendFriendRequestAction, startChatAction } from "@/app/actions";
import { toggleActorFollowAction } from "./actions";

export const dynamic = "force-dynamic";

const BRAND_PURPLE = "#A127CE";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const viewer = toViewerContext(await getCurrentUser());
  const profile = await getSocialActorProfileByHandle(handle, viewer);
  if (!profile) {
    return { title: "Page not found - GreyhoundsIQ" };
  }
  const label = profile.page
    ? CUSTOM_PAGE_TYPE_LABELS[
        profile.page.pageType as keyof typeof CUSTOM_PAGE_TYPE_LABELS
      ]
    : "Member";
  const title = `${profile.actor.displayName} — ${label} | GreyhoundIQ`;
  const description =
    profile.page?.tagline ??
    profile.page?.about?.slice(0, 155) ??
    profile.profile?.bio?.slice(0, 155) ??
    `${profile.actor.displayName} on GreyhoundIQ.`;
  return {
    title,
    description,
    alternates: { canonical: `/p/${handle}` },
    openGraph: { title, description, url: `/p/${handle}`, type: "profile" },
  };
}

function money(value: number | null | undefined) {
  if (value == null) return null;
  return value.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

export default async function SocialActorPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const viewer = toViewerContext(await getCurrentUser());
  const profile = await getSocialActorProfileByHandle(handle, viewer);
  if (!profile) notFound();

  if (profile.actor.kind === "personal") {
    const friendship =
      viewer && profile.profile && !profile.viewer.isOwner
        ? await getFriendshipState(viewer, profile.profile.id)
        : null;
    return (
      <PersonalProfileView
        profile={profile}
        friendship={friendship}
        viewer={viewer}
      />
    );
  }

  const page = await getPublishedCustomPageByHandle(profile.actor.handle);
  if (!page) notFound();

  const media = await resolveCustomPageMedia(page.contentJson, profile.actor.id);
  const accent = page.accentColor || BRAND_PURPLE;

  return (
    <ManagedPageView
      page={page}
      media={media}
      accent={accent}
      profile={profile}
      viewer={viewer}
    />
  );
}

function toViewerContext(
  current: Awaited<ReturnType<typeof getCurrentUser>>,
): DbContextUser | null {
  if (
    !current?.dbUserId ||
    !current.profileId ||
    current.isBanned ||
    current.deletionRequestedAt
  ) {
    return null;
  }
  return {
    dbUserId: current.dbUserId,
    profileId: current.profileId,
    profileRole: current.role ?? "member",
    tier: current.tier,
  };
}

function PersonalProfileView({
  profile,
  friendship,
  viewer,
}: {
  profile: SocialActorProfileView;
  friendship: FriendshipState | null;
  viewer: DbContextUser | null;
}) {
  const personal = profile.profile;
  if (!personal) return null;
  const avatarUrl = profile.actor.avatarUrl ?? personal.avatarUrl;
  const details = [personal.kennelName, personal.state]
    .filter((value): value is string => Boolean(value))
    .join(" · ");

  return (
    <main className="giq-custom-page mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[hsl(var(--surface-1))]">
        <div className="relative aspect-[16/5] w-full bg-gradient-to-br from-[hsl(var(--surface-2))] via-[hsl(var(--primary)/0.18)] to-black">
          {profile.actor.coverUrl && (
            <Image
              src={profile.actor.coverUrl}
              alt=""
              fill
              sizes="(max-width:768px) 100vw, 1024px"
              className="object-cover"
              style={{
                objectPosition: `${profile.actor.coverFocalX * 100}% ${profile.actor.coverFocalY * 100}%`,
              }}
              priority
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
        </div>
        <div className="flex flex-wrap items-end gap-4 px-5 pb-5 sm:px-7">
          <div className="-mt-10 h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-[hsl(var(--primary-bright))] bg-black">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={profile.actor.displayName}
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-2xl font-bold text-white/70">
                {profile.actor.displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))] sm:text-3xl">
                {profile.actor.displayName}
              </h1>
              {personal.verified && (
                <BadgeCheck
                  className="h-5 w-5 text-[hsl(var(--primary-bright))]"
                  aria-label="Verified member"
                />
              )}
              <span className="rounded-full bg-[hsl(var(--primary)/0.18)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--primary-bright))]">
                Member
              </span>
            </div>
            {details && (
              <p className="mt-1 text-[14px] text-[hsl(var(--muted-foreground))]">
                {details}
              </p>
            )}
          </div>
          <PersonalProfileActions
            profile={profile}
            friendship={friendship}
            viewer={viewer}
          />
        </div>
        <ProfileSectionNav finalLabel="Friends" finalHref="#friends" />
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <TimelineSection profile={profile} />
          <section id="about" className="giq-panel scroll-mt-24 p-6">
            <h2 className="mb-3 text-[16px] font-semibold text-[hsl(var(--foreground))]">
              About
            </h2>
            <p className="whitespace-pre-line text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              {personal.bio ?? "This member has not added a bio yet."}
            </p>
            <dl className="mt-5 grid gap-3 border-t border-white/[0.06] pt-5 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--subtle-foreground))]">
                  Role
                </dt>
                <dd className="mt-1 capitalize text-[hsl(var(--foreground))]">
                  {personal.role.replaceAll("_", " ")}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--subtle-foreground))]">
                  Member since
                </dt>
                <dd className="mt-1 flex items-center gap-1.5 text-[hsl(var(--foreground))]">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  {personal.createdAt.toLocaleDateString("en-AU", {
                    month: "long",
                    year: "numeric",
                  })}
                </dd>
              </div>
            </dl>
          </section>
          <section id="media" className="giq-panel scroll-mt-24 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-[16px] font-semibold text-[hsl(var(--foreground))]">
              <ImageIcon
                className="h-4 w-4 text-[hsl(var(--primary-bright))]"
                aria-hidden="true"
              />
              Media
            </h2>
            {profile.gallery.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {profile.gallery.map((item) => (
                  <div
                    key={item.mediaId}
                    className="overflow-hidden rounded-lg border border-white/[0.06]"
                  >
                    <Image
                      src={item.url}
                      alt={
                        item.altText ??
                        `${profile.actor.displayName} gallery image`
                      }
                      width={300}
                      height={300}
                      className="aspect-square w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
                No profile media is available to you yet.
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <FriendsCard profile={profile} />
          <ContactCard contact={profile.contact} />
          <p className="text-center text-[11px] text-[hsl(var(--subtle-foreground))]">
            Member profile on{" "}
            <Link
              href="/feed"
              className="font-semibold text-[hsl(var(--primary-bright))]"
            >
              GreyhoundIQ
            </Link>
          </p>
        </aside>
      </div>
    </main>
  );
}

function PersonalProfileActions({
  profile,
  friendship,
  viewer,
}: {
  profile: SocialActorProfileView;
  friendship: FriendshipState | null;
  viewer: DbContextUser | null;
}) {
  if (profile.viewer.isOwner) {
    return (
      <Link
        href="/account"
        className="giq-button giq-button-primary min-h-10 px-4 text-[13px] font-semibold"
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
        Manage
      </Link>
    );
  }
  if (!viewer || !profile.profile) {
    return (
      <Link
        href="/sign-in"
        className="giq-button giq-button-primary min-h-10 px-4 text-[13px] font-semibold"
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        Sign in to connect
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {friendship?.status === "accepted" ? (
        <span className="giq-button giq-button-glass min-h-10 px-4 text-[13px] font-semibold">
          <UserRoundCheck className="h-4 w-4" aria-hidden="true" />
          Connected
        </span>
      ) : friendship?.status === "pending" ? (
        friendship.direction === "incoming" ? (
          <Link
            href="/pulse/friends"
            className="giq-button giq-button-glass min-h-10 px-4 text-[13px] font-semibold"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Respond
          </Link>
        ) : (
          <span className="giq-button giq-button-glass min-h-10 px-4 text-[13px] font-semibold">
            <UserRoundCheck className="h-4 w-4" aria-hidden="true" />
            Request sent
          </span>
        )
      ) : (
        <form action={sendFriendRequestAction}>
          <input type="hidden" name="profileId" value={profile.profile.id} />
          <SubmitButton
            pendingLabel="Connecting..."
            className="giq-button giq-button-primary min-h-10 px-4 text-[13px] font-semibold"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Connect
          </SubmitButton>
        </form>
      )}
      <form action={startChatAction}>
        <input type="hidden" name="profileId" value={profile.profile.id} />
        <SubmitButton
          pendingLabel="Opening..."
          className="giq-button giq-button-glass min-h-10 px-4 text-[13px] font-semibold"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          Message
        </SubmitButton>
      </form>
    </div>
  );
}

function ProfileSectionNav({
  finalLabel,
  finalHref,
}: {
  finalLabel: string;
  finalHref: string;
}) {
  const links = [
    ["Timeline", "#timeline"],
    ["About", "#about"],
    ["Media", "#media"],
    [finalLabel, finalHref],
  ] as const;
  return (
    <nav
      aria-label="Profile sections"
      className="flex gap-1 overflow-x-auto border-t border-white/[0.06] px-4 sm:px-6"
    >
      {links.map(([label, href]) => (
        <a
          key={href}
          href={href}
          className="min-h-11 shrink-0 border-b-2 border-transparent px-3 py-3 text-[13px] font-medium text-[hsl(var(--muted-foreground))] transition hover:border-[hsl(var(--primary)/0.7)] hover:text-[hsl(var(--foreground))]"
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

function TimelineSection({ profile }: { profile: SocialActorProfileView }) {
  return (
    <section id="timeline" className="giq-panel scroll-mt-24 p-6">
      <h2 className="mb-4 text-[16px] font-semibold text-[hsl(var(--foreground))]">
        Timeline
      </h2>
      {profile.timeline.length > 0 ? (
        <div className="divide-y divide-white/[0.06]">
          {profile.timeline.map((post) => (
            <article key={post.id} className="py-4 first:pt-0 last:pb-0">
              {post.sharedFrom && (
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--primary-bright))]">
                  Shared {post.sharedFrom.displayName}&apos;s post
                </p>
              )}
              <p className="whitespace-pre-line text-[14px] leading-relaxed text-[hsl(var(--foreground))]">
                {post.body}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[hsl(var(--subtle-foreground))]">
                <time dateTime={post.createdAt.toISOString()}>
                  {post.createdAt.toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </time>
                {post.editedAt && <span>Edited</span>}
                {post.mediaCount > 0 && <span>{post.mediaCount} media</span>}
                {post.reactionCount > 0 && (
                  <span>{post.reactionCount} reactions</span>
                )}
                {post.commentCount > 0 && (
                  <span>{post.commentCount} comments</span>
                )}
                <Link
                  href={`/feed#post-${post.sourcePostId}`}
                  className="text-[hsl(var(--primary-light))] hover:underline"
                >
                  View in Feed
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
          No posts are visible to you yet.
        </p>
      )}
    </section>
  );
}

function FriendsCard({ profile }: { profile: SocialActorProfileView }) {
  return (
    <section id="friends" className="giq-panel scroll-mt-24 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[hsl(var(--foreground))]">
          <Users
            className="h-4 w-4 text-[hsl(var(--primary-bright))]"
            aria-hidden="true"
          />
          Friends
        </h2>
        {profile.friendCount != null && (
          <span className="text-[12px] tabular-nums text-[hsl(var(--muted-foreground))]">
            {profile.friendCount}
          </span>
        )}
      </div>
      {profile.viewer.isOwner ? (
        profile.friends.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {profile.friends.map((friend) => (
              <li key={friend.profileId}>
                {friend.handle ? (
                  <Link
                    href={`/p/${friend.handle}`}
                    className="flex items-center gap-3 text-[13px] text-[hsl(var(--foreground))] hover:underline"
                  >
                    <FriendAvatar friend={friend} />
                    <span className="min-w-0 truncate">
                      {friend.displayName}
                    </span>
                    {friend.verified && (
                      <BadgeCheck
                        className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--primary-bright))]"
                        aria-label="Verified member"
                      />
                    )}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 text-[13px] text-[hsl(var(--foreground))]">
                    <FriendAvatar friend={friend} />
                    <span className="min-w-0 truncate">
                      {friend.displayName}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[13px] text-[hsl(var(--muted-foreground))]">
            No connections yet.
          </p>
        )
      ) : (
        <p className="mt-3 text-[13px] text-[hsl(var(--muted-foreground))]">
          {profile.viewer.isConnected
            ? "You are connected with this member."
            : "This member’s friend list is private."}
        </p>
      )}
    </section>
  );
}

function FriendAvatar({
  friend,
}: {
  friend: SocialActorProfileView["friends"][number];
}) {
  return friend.avatarUrl ? (
    <Image
      src={friend.avatarUrl}
      alt=""
      width={32}
      height={32}
      className="h-8 w-8 shrink-0 rounded-full object-cover"
    />
  ) : (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[11px] font-semibold">
      {friend.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function FollowersCard({ profile }: { profile: SocialActorProfileView }) {
  return (
    <section id="followers" className="giq-panel scroll-mt-24 p-5">
      <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[hsl(var(--foreground))]">
        <Users
          className="h-4 w-4 text-[hsl(var(--primary-bright))]"
          aria-hidden="true"
        />
        Followers
      </h2>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-[hsl(var(--foreground))]">
        {profile.followerCount.toLocaleString("en-AU")}
      </p>
      <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
        {profile.followerCount === 1 ? "person follows" : "people follow"} this
        page
      </p>
    </section>
  );
}

function ManagedPageView({
  page,
  media,
  accent,
  profile,
  viewer,
}: {
  page: PublicCustomPage;
  media: CustomPageMediaUrls;
  accent: string;
  profile: SocialActorProfileView;
  viewer: DbContextUser | null;
}) {
  const bannerUrl = media.bannerUrl ?? profile.actor.coverUrl;
  const avatarUrl = media.avatarUrl ?? profile.actor.avatarUrl;

  return (
    <main
      className="giq-custom-page mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10"
      style={{ ["--page-accent" as string]: accent }}
    >
      {/* Banner + identity header (LinkedIn/FB style, brand-framed) */}
      <header className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[hsl(var(--surface-1))]">
        <div className="relative aspect-[16/5] w-full bg-gradient-to-br from-[hsl(var(--surface-2))] to-black">
          {bannerUrl && (
            <Image
              src={bannerUrl}
              alt=""
              fill
              sizes="(max-width:768px) 100vw, 1024px"
              className="object-cover"
              style={{
                objectPosition: `${profile.actor.coverFocalX * 100}% ${profile.actor.coverFocalY * 100}%`,
              }}
              priority
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        </div>
        <div className="flex flex-wrap items-end gap-4 px-5 pb-5 sm:px-7">
          <div
            className="-mt-10 h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 bg-black"
            style={{ borderColor: accent }}
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={page.title}
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-2xl font-bold text-white/70">
                {page.title.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))] sm:text-3xl">
                {page.title}
              </h1>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-black"
                style={{ background: accent }}
              >
                {
                  CUSTOM_PAGE_TYPE_LABELS[
                    page.pageType as keyof typeof CUSTOM_PAGE_TYPE_LABELS
                  ]
                }
              </span>
            </div>
            {page.tagline && (
              <p className="mt-1 text-[14px] text-[hsl(var(--muted-foreground))]">
                {page.tagline}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {profile.viewer.isOwner ? (
              <Link
                href={`/account/pages/${page.id}`}
                className="giq-button giq-button-primary min-h-10 px-4 text-[13px] font-semibold"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                Manage
              </Link>
            ) : viewer ? (
              <>
                <form action={toggleActorFollowAction}>
                  <input type="hidden" name="actorId" value={profile.actor.id} />
                  <SubmitButton
                    pendingLabel={
                      profile.viewer.isFollowing
                        ? "Unfollowing..."
                        : "Following..."
                    }
                    className="giq-button giq-button-primary min-h-10 px-4 text-[13px] font-semibold"
                  >
                    {profile.viewer.isFollowing ? (
                      <UserRoundCheck className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <UserPlus className="h-4 w-4" aria-hidden="true" />
                    )}
                    {profile.viewer.isFollowing ? "Following" : "Follow"}
                  </SubmitButton>
                </form>
                <form action={startChatAction}>
                  <input
                    type="hidden"
                    name="profileId"
                    value={profile.actor.id}
                  />
                  <SubmitButton
                    pendingLabel="Opening..."
                    className="giq-button giq-button-glass min-h-10 px-4 text-[13px] font-semibold"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    Message
                  </SubmitButton>
                </form>
              </>
            ) : (
              <Link
                href="/sign-in"
                className="giq-button giq-button-primary min-h-10 px-4 text-[13px] font-semibold"
              >
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Sign in to follow
              </Link>
            )}
          </div>
          {media.logoUrl && (
            <Image
              src={media.logoUrl}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 rounded-lg object-contain"
            />
          )}
        </div>
        <ProfileSectionNav finalLabel="Followers" finalHref="#followers" />
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <TimelineSection profile={profile} />

          <section id="about" className="giq-panel scroll-mt-24 p-6">
            <h2 className="mb-3 text-[16px] font-semibold text-[hsl(var(--foreground))]">
              About
            </h2>
            <p className="whitespace-pre-line text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              {page.about ?? "This page has not added an introduction yet."}
            </p>
          </section>

          {page.pageType === "dog" && media.cardUrl && (
            <div className="mb-6 flex justify-center">
              <Image
                src={media.cardUrl}
                alt={`${page.dog?.name ?? "Dog"} trading card`}
                width={340}
                height={510}
                className="w-64 rounded-xl border border-white/10 shadow-2xl sm:w-72"
                priority
              />
            </div>
          )}

          {page.pageType === "dog" && page.dog && (
            <DogBody page={page} accent={accent} />
          )}

          {page.pageType === "business" && (
            <StorefrontBody profileId={page.ownerProfile.id} />
          )}

          <section id="media" className="giq-panel scroll-mt-24 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-[16px] font-semibold text-[hsl(var(--foreground))]">
              <ImageIcon
                className="h-4 w-4 text-[hsl(var(--primary-bright))]"
                aria-hidden="true"
              />
              Media
            </h2>
            {media.galleryUrls.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {media.galleryUrls.map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    className="overflow-hidden rounded-lg border border-white/[0.06]"
                  >
                    <Image
                      src={url}
                      alt={`${page.title} gallery image ${i + 1}`}
                      width={300}
                      height={300}
                      className="aspect-square w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
                No gallery media has been published yet.
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <FollowersCard profile={profile} />
          <ContactCard contact={profile.contact} />
          <p className="text-center text-[11px] text-[hsl(var(--subtle-foreground))]">
            Verified on{" "}
            <Link
              href="/"
              className="font-semibold text-[hsl(var(--primary-bright))]"
            >
              GreyhoundIQ
            </Link>
          </p>
        </aside>
      </div>
    </main>
  );
}

function ContactCard({
  contact,
}: {
  contact: SocialActorProfileView["contact"];
}) {
  const hasContact = contact?.email || contact?.phone || contact?.website;
  if (!hasContact) return null;
  return (
    <section className="giq-panel p-5">
      <h2 className="mb-3 text-[14px] font-semibold text-[hsl(var(--foreground))]">
        Contact
      </h2>
      <ul className="space-y-2 text-[13px] text-[hsl(var(--muted-foreground))]">
        {contact?.email && (
          <li className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5" />
            <a
              href={`mailto:${contact.email}`}
              className="break-all hover:underline"
            >
              {contact.email}
            </a>
          </li>
        )}
        {contact?.phone && (
          <li className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5" />
            <a href={`tel:${contact.phone}`} className="hover:underline">
              {contact.phone}
            </a>
          </li>
        )}
        {contact?.website && (
          <li className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5" />
            <a
              href={contact.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="break-all hover:underline"
            >
              {contact.website.replace(/^https?:\/\//, "")}
            </a>
          </li>
        )}
      </ul>
    </section>
  );
}

async function StorefrontBody({ profileId }: { profileId: string }) {
  const listings = await getActiveListingsForProfile(profileId, 12);
  if (listings.length === 0) return null;
  return (
    <section className="giq-panel p-6">
      <h2 className="mb-4 text-[16px] font-semibold text-[hsl(var(--foreground))]">
        For sale
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {listings.map((listing) => {
          const first = listing.media[0]?.media;
          const img = first ? mediaDeliveryUrl(first) : null;
          return (
            <Link
              key={listing.id}
              href={`/listings/${listing.id}`}
              className="group overflow-hidden rounded-lg border border-white/[0.06] bg-[hsl(var(--surface-1))]"
            >
              <div className="aspect-square w-full bg-black/40">
                {img && (
                  <Image
                    src={img}
                    alt={listing.title}
                    width={240}
                    height={240}
                    className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                  />
                )}
              </div>
              <div className="p-2">
                <div className="truncate text-[12px] font-medium text-[hsl(var(--foreground))]">
                  {listing.title}
                </div>
                {listing.price != null && (
                  <div className="text-[12px] text-[hsl(var(--secondary))]">
                    {money(listing.price)}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

async function DogBody({
  page,
  accent,
}: {
  page: PublicCustomPage;
  accent: string;
}) {
  const dog = page.dog!;
  const prize = await getDogPrizeMoney(dog.id);
  const careerWinnings = Math.max(dog.prizeMoney ?? 0, prize.careerWon);
  const stats = [
    { label: "Starts", value: dog.careerStarts ?? 0 },
    { label: "Wins", value: dog.careerWins ?? 0 },
    { label: "Prize money", value: money(careerWinnings) ?? "—" },
  ];
  const saleLabel =
    page.saleStatus === "for_sale"
      ? "For sale"
      : page.saleStatus === "stud"
        ? "At stud"
        : null;

  return (
    <section className="giq-panel p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-[hsl(var(--foreground))]">
          {dog.name}
        </h2>
        <div className="flex items-center gap-2">
          {saleLabel && (
            <span
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold text-black"
              style={{ background: accent }}
            >
              <DollarSign className="h-3.5 w-3.5" />
              {saleLabel}
              {page.priceOrFee != null && ` · ${money(page.priceOrFee)}`}
            </span>
          )}
          {page.saleStatus === "for_sale" && (
            <Link
              href={`/listings/new?dogId=${dog.id}&title=${encodeURIComponent(dog.name)}${
                page.priceOrFee != null ? `&price=${page.priceOrFee}` : ""
              }`}
              className="giq-outline-action text-[12px]"
            >
              List on marketplace
            </Link>
          )}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="giq-metric-card text-center">
            <div className="text-xl font-semibold tabular-nums text-[hsl(var(--foreground))]">
              {s.value}
            </div>
            <div className="mt-1 text-[11px] text-[hsl(var(--subtle-foreground))]">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {(dog.sire || dog.dam) && (
        <p className="mb-4 text-[13px] text-[hsl(var(--muted-foreground))]">
          {dog.sire && (
            <>
              by{" "}
              <span className="text-[hsl(var(--foreground))]">
                {dog.sire.name}
              </span>
            </>
          )}
          {dog.sire && dog.dam && " · "}
          {dog.dam && (
            <>
              from{" "}
              <span className="text-[hsl(var(--foreground))]">
                {dog.dam.name}
              </span>
            </>
          )}
        </p>
      )}

      {dog.formEntries.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wider text-[hsl(var(--subtle-foreground))]">
            <Trophy className="h-3.5 w-3.5" /> Recent form
          </h3>
          <div className="space-y-1.5">
            {dog.formEntries.slice(0, 8).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-white/[0.05] px-3 py-2 text-[13px]"
              >
                <span className="text-[hsl(var(--muted-foreground))]">
                  {entry.date.toLocaleDateString("en-AU", {
                    day: "2-digit",
                    month: "short",
                    year: "2-digit",
                  })}
                </span>
                <span className="flex-1 px-3 text-[hsl(var(--foreground))]">
                  {entry.track?.name ?? "—"}
                  {entry.distance ? ` · ${entry.distance}m` : ""}
                </span>
                <FinishBadge finish={entry.finish} />
                <span className="ml-3 font-mono text-[12px] text-[hsl(var(--primary-bright))]">
                  {entry.time ? `${entry.time.toFixed(2)}s` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
