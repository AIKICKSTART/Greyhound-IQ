import Link from "next/link";
import { ArrowRight, Eye, MessageSquare, Pin, Users } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { getForumOverview, getRecentThreads } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Forum - GreyhoundIQ",
  description:
    "GreyhoundIQ community discussions for form, breeding, ownership, and Australian greyhound racing data.",
};

export default async function ForumPage() {
  const [categories, recentThreads] = await Promise.all([
    getForumOverview(),
    getRecentThreads(8),
  ]);

  return (
    <div>
      <PageHero
        image="/images/wentworth-gate-hero.webp"
        title={
          <>
            Community form room.
            <br />
            <span className="gradient-text">Signal over noise.</span>
          </>
        }
        subtitle="Discuss races, breeding, ownership, and track intelligence with the same clean, data-first experience as the racing tools."
      />

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[1.4fr_0.9fr]">
        <div>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
                Categories
              </h2>
              <p className="mt-1 text-[14px] text-[hsl(var(--muted-foreground))]">
                Seeded from the community epics in the build plan.
              </p>
            </div>
            <Users className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
          </div>

          <div className="giq-stagger space-y-3">
            {categories.map((category) => (
              <section
                key={category.id}
                className="giq-panel giq-panel-hover p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/forum/${category.slug}`}
                      className="text-[17px] font-semibold text-[hsl(var(--foreground))] transition-colors hover:text-[hsl(var(--primary-bright))]"
                    >
                      {category.name}
                    </Link>
                    <p className="mt-1 max-w-xl text-[13px] text-[hsl(var(--muted-foreground))]">
                      {category.description}
                    </p>
                  </div>
                  <span className="giq-badge giq-badge-neutral">
                    {category._count.threads} threads
                  </span>
                </div>

                <div className="mt-5 divide-y divide-white/[0.05]">
                  {category.threads.map((thread) => (
                    <ThreadRow
                      key={thread.id}
                      href={`/forum/threads/${thread.id}`}
                      title={thread.title}
                      author={thread.author.displayName}
                      replies={Math.max(thread._count.posts - 1, 0)}
                      views={thread.views}
                      pinned={thread.pinned}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <aside>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
                Latest threads
              </h2>
              <p className="mt-1 text-[14px] text-[hsl(var(--muted-foreground))]">
                Live from the current seed data.
              </p>
            </div>
            <MessageSquare className="h-5 w-5 text-[hsl(var(--secondary))]" />
          </div>

          <div className="giq-panel overflow-hidden">
            {recentThreads.map((thread) => (
              <div
                key={thread.id}
                className="border-b border-white/[0.05] p-4 last:border-0"
              >
                <div className="flex items-start gap-3">
                  {thread.pinned ? (
                    <Pin className="mt-0.5 h-4 w-4 text-[hsl(var(--secondary))]" />
                  ) : (
                    <MessageSquare className="mt-0.5 h-4 w-4 text-[hsl(var(--primary-bright))]" />
                  )}
                  <div>
                    <h3 className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
                      {thread.title}
                    </h3>
                    <p className="mt-1 text-[12px] text-[hsl(var(--subtle-foreground))]">
                      {thread.category.name} by {thread.author.displayName}
                    </p>
                    <p className="mt-2 text-[12px] text-[hsl(var(--muted-foreground))]">
                      {Math.max(thread._count.posts - 1, 0)} replies -{" "}
                      {thread.views} views
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Link
            href="/listings"
            className="giq-outline-action mt-5"
          >
            Browse marketplace
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          {categories[0] && (
            <Link
              href={`/forum/${categories[0].slug}`}
              className="giq-liquid-purple-button ml-3 mt-5 min-h-10 px-4 text-[13px] font-semibold"
            >
              Start a thread
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </aside>
      </section>
    </div>
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
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      {pinned ? (
        <Pin className="h-4 w-4 text-[hsl(var(--secondary))]" />
      ) : (
        <MessageSquare className="h-4 w-4 text-[hsl(var(--primary-bright))]" />
      )}
      <div className="min-w-0 flex-1">
        <Link
          href={href}
          className="block truncate text-[14px] font-medium text-[hsl(var(--foreground))] transition-colors hover:text-[hsl(var(--primary-bright))]"
        >
          {title}
        </Link>
        <p className="mt-0.5 text-[12px] text-[hsl(var(--subtle-foreground))]">
          by {author} - {replies} replies
        </p>
      </div>
      <span className="inline-flex items-center gap-1 text-[12px] text-[hsl(var(--subtle-foreground))]">
        <Eye className="h-3.5 w-3.5" />
        {views}
      </span>
    </div>
  );
}
