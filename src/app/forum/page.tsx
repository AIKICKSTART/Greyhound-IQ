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
    <div className="fade-in">
      <PageHero
        image="/images/hero-greyhoundiq-brand.webp"
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
              <h2 className="text-2xl font-semibold text-[hsl(210_13%_97%)]">
                Categories
              </h2>
              <p className="mt-1 text-[14px] text-[hsl(215_14%_65%)]">
                Seeded from the community epics in the build plan.
              </p>
            </div>
            <Users className="h-5 w-5 text-[hsl(142_60%_48%)]" />
          </div>

          <div className="space-y-3">
            {categories.map((category) => (
              <section
                key={category.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/forum/${category.slug}`}
                      className="text-[17px] font-semibold text-[hsl(210_13%_97%)] transition-colors hover:text-[hsl(142_60%_48%)]"
                    >
                      {category.name}
                    </Link>
                    <p className="mt-1 max-w-xl text-[13px] text-[hsl(215_14%_65%)]">
                      {category.description}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[hsl(215_14%_65%)]">
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
              <h2 className="text-2xl font-semibold text-[hsl(210_13%_97%)]">
                Latest threads
              </h2>
              <p className="mt-1 text-[14px] text-[hsl(215_14%_65%)]">
                Live from the current seed data.
              </p>
            </div>
            <MessageSquare className="h-5 w-5 text-[hsl(25_95%_53%)]" />
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
            {recentThreads.map((thread) => (
              <div
                key={thread.id}
                className="border-b border-white/[0.05] p-4 last:border-0"
              >
                <div className="flex items-start gap-3">
                  {thread.pinned ? (
                    <Pin className="mt-0.5 h-4 w-4 text-[hsl(25_95%_53%)]" />
                  ) : (
                    <MessageSquare className="mt-0.5 h-4 w-4 text-[hsl(142_60%_48%)]" />
                  )}
                  <div>
                    <h3 className="text-[14px] font-semibold text-[hsl(210_13%_97%)]">
                      {thread.title}
                    </h3>
                    <p className="mt-1 text-[12px] text-[hsl(220_7%_42%)]">
                      {thread.category.name} by {thread.author.displayName}
                    </p>
                    <p className="mt-2 text-[12px] text-[hsl(215_14%_65%)]">
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
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[13px] font-semibold text-[hsl(210_13%_97%)] transition-all hover:bg-white/[0.06]"
          >
            Browse marketplace
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          {categories[0] && (
            <Link
              href={`/forum/${categories[0].slug}`}
              className="ml-3 mt-5 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[hsl(142_76%_36%)] to-[hsl(142_60%_40%)] px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-[hsl(142_76%_36%/0.2)] transition-all hover:brightness-110"
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
        <Pin className="h-4 w-4 text-[hsl(25_95%_53%)]" />
      ) : (
        <MessageSquare className="h-4 w-4 text-[hsl(142_60%_48%)]" />
      )}
      <div className="min-w-0 flex-1">
        <Link
          href={href}
          className="block truncate text-[14px] font-medium text-[hsl(210_13%_97%)] transition-colors hover:text-[hsl(142_60%_48%)]"
        >
          {title}
        </Link>
        <p className="mt-0.5 text-[12px] text-[hsl(220_7%_42%)]">
          by {author} - {replies} replies
        </p>
      </div>
      <span className="inline-flex items-center gap-1 text-[12px] text-[hsl(220_7%_42%)]">
        <Eye className="h-3.5 w-3.5" />
        {views}
      </span>
    </div>
  );
}
