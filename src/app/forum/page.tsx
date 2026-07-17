import Link from "next/link";
import { ArrowRight, Eye, MessageSquare, Pin, Users } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { PageTitle } from "@/components/page-title";
import { getCurrentUser } from "@/lib/auth";
import { getForumOverview, getRecentThreads } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Groups - GreyhoundIQ",
  description:
    "GreyhoundIQ public community groups for form, breeding, ownership, and Australian greyhound racing data.",
};

export default async function ForumPage() {
  const [user, categories, recentThreads] = await Promise.all([
    getCurrentUser(),
    getForumOverview(),
    getRecentThreads(8),
  ]);
  const signedIn = Boolean(user);

  return (
    <div>
      {signedIn ? (
        <CommunityMemberHeader
          categoryCount={categories.length}
          recentThreadCount={recentThreads.length}
          firstCategorySlug={categories[0]?.slug}
        />
      ) : (
        <PageHero
          image="/images/feed/posts/lisa-community-night.webp"
          title={
            <>
              GreyhoundIQ Groups.
              <br />
              <span className="gradient-text">Signal over noise.</span>
            </>
          }
          subtitle="Join public community groups for races, breeding, ownership, marketplace discussion, and track intelligence with the same clean, data-first experience as the racing tools."
        />
      )}

      <section
        className={`mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)] lg:gap-8 lg:px-8 ${
          signedIn ? "py-8 sm:py-10" : "py-10 sm:py-12"
        }`}
      >
        <div className="min-w-0">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
                Community groups
              </h2>
              <p className="mt-1 text-[14px] leading-6 text-[hsl(var(--muted-foreground))]">
                Public spaces for GreyhoundIQ members to share racing context.
              </p>
            </div>
            <span className="giq-status-pill giq-status-pill-purple hidden min-h-8 px-3 sm:inline-flex">
              {categories.length} {categories.length === 1 ? "group" : "groups"}
            </span>
          </div>

          {categories.length ? (
            <div className="giq-stagger space-y-4">
              {categories.map((category) => (
                <section
                  key={category.id}
                  className="giq-panel overflow-hidden"
                  aria-labelledby={`group-${category.id}`}
                >
                  <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <h3 id={`group-${category.id}`}>
                        <Link
                          href={`/groups/${category.slug}`}
                          className="inline-flex min-h-11 items-center break-words text-[17px] font-semibold text-[hsl(var(--foreground))] transition-colors hover:text-[hsl(var(--primary-bright))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
                        >
                          {category.name}
                        </Link>
                      </h3>
                      <p className="max-w-xl [overflow-wrap:anywhere] text-[13px] leading-5 text-[hsl(var(--muted-foreground))]">
                        {category.description}
                      </p>
                    </div>
                    <span className="giq-badge giq-badge-neutral min-h-8 shrink-0 self-start">
                      {category._count.threads} {category._count.threads === 1 ? "thread" : "threads"}
                    </span>
                  </div>

                  {category.threads.length ? (
                    <div className="divide-y divide-white/[0.05] px-3 sm:px-4">
                      {category.threads.map((thread) => (
                        <ThreadRow
                          key={thread.id}
                          href={`/groups/threads/${thread.id}`}
                          title={thread.title}
                          author={thread.author.displayName}
                          replies={Math.max(thread._count.posts - 1, 0)}
                          views={thread.views}
                          pinned={thread.pinned}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-5 sm:px-5">
                      <p className="text-[13px] text-[hsl(var(--subtle-foreground))]">
                        No threads in this group yet.
                      </p>
                      <Link
                        href={`/groups/${category.slug}`}
                        className="mt-2 inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-[hsl(var(--primary-light))] hover:text-[hsl(var(--primary-bright))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
                      >
                        Open group
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="giq-empty-state px-5 py-12 text-center" role="status">
              <Users className="mx-auto h-8 w-8 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
              <h3 className="mt-4 text-[18px] font-semibold text-[hsl(var(--foreground))]">
                No community groups yet
              </h3>
              <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-[hsl(var(--muted-foreground))]">
                Public groups will appear here when they are available.
              </p>
            </div>
          )}
        </div>

        <aside className="min-w-0 self-start lg:sticky lg:top-24">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
                Latest threads
              </h2>
              <p className="mt-1 text-[14px] leading-6 text-[hsl(var(--muted-foreground))]">
                New public group activity.
              </p>
            </div>
            <MessageSquare className="h-5 w-5 shrink-0 text-[hsl(var(--secondary))]" aria-hidden="true" />
          </div>

          <div className="giq-panel overflow-hidden">
            {recentThreads.length ? (
              recentThreads.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/groups/threads/${thread.id}`}
                  className="group flex min-h-20 items-start gap-3 border-b border-white/[0.05] p-4 transition-colors last:border-0 hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
                >
                  {thread.pinned ? (
                    <Pin className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--secondary))]" aria-hidden="true" />
                  ) : (
                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
                  )}
                  <span className="min-w-0">
                    {thread.pinned && <span className="sr-only">Pinned thread: </span>}
                    <span className="block [overflow-wrap:anywhere] text-[14px] font-semibold leading-5 text-[hsl(var(--foreground))] transition-colors group-hover:text-[hsl(var(--primary-bright))]">
                      {thread.title}
                    </span>
                    <span className="mt-1 block [overflow-wrap:anywhere] text-[12px] leading-5 text-[hsl(var(--subtle-foreground))]">
                      {thread.category.name} by {thread.author.displayName}
                    </span>
                    <span className="mt-1.5 block text-[12px] text-[hsl(var(--muted-foreground))]">
                      {Math.max(thread._count.posts - 1, 0)} replies · {thread.views} views
                    </span>
                  </span>
                </Link>
              ))
            ) : (
              <div className="px-4 py-8 text-center" role="status">
                <MessageSquare className="mx-auto h-7 w-7 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
                <p className="mt-3 text-[14px] font-semibold text-[hsl(var(--foreground))]">
                  No recent threads
                </p>
                <p className="mt-1 text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
                  New public conversations will appear here.
                </p>
              </div>
            )}
          </div>

          {!signedIn && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Link href="/marketplace" className="giq-outline-action min-h-11 justify-center px-4">
                Browse marketplace
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              {categories[0] && (
                <Link
                  href={`/groups/${categories[0].slug}`}
                  className="giq-liquid-purple-button min-h-11 justify-center px-4 text-[13px] font-semibold"
                >
                  Start a group thread
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

function CommunityMemberHeader({
  categoryCount,
  recentThreadCount,
  firstCategorySlug,
}: {
  categoryCount: number;
  recentThreadCount: number;
  firstCategorySlug?: string;
}) {
  return (
    <header className="relative overflow-hidden border-b border-white/[0.07] bg-[linear-gradient(135deg,hsl(var(--card)/0.92),hsl(var(--background))_72%)]">
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(var(--primary-bright)/0.12)] blur-3xl"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-4 py-7 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-8">
        <div className="max-w-2xl">
          <p className="program-label">Member community</p>
          <PageTitle className="mt-2">
            Groups
          </PageTitle>
          <p className="mt-2 text-[14px] leading-6 text-[hsl(var(--muted-foreground))] sm:text-[15px]">
            Join public conversations about racing, breeding, ownership, and
            marketplace activity.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-[hsl(var(--subtle-foreground))]">
            <span>{categoryCount} {categoryCount === 1 ? "group" : "groups"}</span>
            <span aria-hidden="true">·</span>
            <span>{recentThreadCount} recent {recentThreadCount === 1 ? "thread" : "threads"}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/marketplace"
            className="giq-button giq-button-glass min-h-11 px-5 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
          >
            Browse marketplace
          </Link>
          {firstCategorySlug && (
            <Link
              href={`/groups/${firstCategorySlug}`}
              className="giq-button giq-button-primary min-h-11 px-5 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
            >
              Start a group thread
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function ThreadRow({
  href,
  title,
  author,
  replies,
  views,
  pinned,
}: {
  href: string;
  title: string;
  author: string;
  replies: number;
  views: number;
  pinned: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-16 items-center gap-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
    >
      {pinned ? (
        <Pin className="h-4 w-4 shrink-0 text-[hsl(var(--secondary))]" aria-hidden="true" />
      ) : (
        <MessageSquare className="h-4 w-4 shrink-0 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">
        {pinned && <span className="sr-only">Pinned thread: </span>}
        <span className="block [overflow-wrap:anywhere] text-[14px] font-medium leading-5 text-[hsl(var(--foreground))] transition-colors group-hover:text-[hsl(var(--primary-bright))]">
          {title}
        </span>
        <span className="mt-0.5 block [overflow-wrap:anywhere] text-[12px] leading-5 text-[hsl(var(--subtle-foreground))]">
          by {author} · {replies} {replies === 1 ? "reply" : "replies"}
        </span>
      </span>
      <span className="inline-flex min-h-11 shrink-0 items-center gap-1 text-[12px] text-[hsl(var(--subtle-foreground))]" aria-label={`${views} views`}>
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        {views}
      </span>
    </Link>
  );
}
