import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare, Pin, PlusCircle } from "lucide-react";
import { createForumThread } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import { getForumCategoryBySlug } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await getForumCategoryBySlug(slug);
  if (!category) {
    return {
      title: "Forum category not found - GreyhoundIQ",
      description: "Forum category not found.",
    };
  }
  return {
    title: `${category.name} Forum - GreyhoundIQ`,
    description:
      category.description ??
      "GreyhoundIQ community discussion category for Australian greyhound racing.",
  };
}

export default async function ForumCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [category, user] = await Promise.all([
    getForumCategoryBySlug(slug),
    getCurrentUser(),
  ]);
  if (!category) notFound();

  return (
    <div className="fade-in mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/forum"
        className="mb-6 inline-flex items-center gap-2 text-[13px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Forum
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <main>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
                {category.name}
              </h1>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                {category.description}
              </p>
            </div>
            <span className="giq-badge giq-badge-neutral">
              {category.threads.length} threads
            </span>
          </div>

          <div className="giq-panel overflow-hidden">
            {category.threads.length === 0 ? (
              <div className="p-10 text-center">
                <MessageSquare className="mx-auto mb-4 h-8 w-8 text-[hsl(var(--primary-bright))]" />
                <p className="text-[14px] text-[hsl(var(--muted-foreground))]">
                  No threads in this category yet.
                </p>
              </div>
            ) : (
              category.threads.map((thread) => {
                const lastPost = thread.posts[0];
                return (
                  <article
                    key={thread.id}
                    className="giq-table-row p-5"
                  >
                    <div className="flex items-start gap-3">
                      {thread.pinned ? (
                        <Pin className="mt-0.5 h-4 w-4 text-[hsl(var(--secondary))]" />
                      ) : (
                        <MessageSquare className="mt-0.5 h-4 w-4 text-[hsl(var(--primary-bright))]" />
                      )}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/forum/threads/${thread.id}`}
                          className="text-[16px] font-semibold text-[hsl(var(--foreground))] transition-colors hover:text-[hsl(var(--primary-bright))]"
                        >
                          {thread.title}
                        </Link>
                        <p className="mt-1 text-[12px] text-[hsl(var(--subtle-foreground))]">
                          Started by {thread.author.displayName} -{" "}
                          {Math.max(thread._count.posts - 1, 0)} replies -{" "}
                          {thread.views} views
                        </p>
                        {lastPost && (
                          <p className="mt-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                            Latest by {lastPost.author.displayName}
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </main>

        <aside className="giq-panel p-5">
          <div className="mb-5 flex items-center gap-3">
            <PlusCircle className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
            <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
              Start a thread
            </h2>
          </div>
          {user ? (
            <form action={createForumThread} className="space-y-4">
              <input type="hidden" name="categoryId" value={category.id} />
              <label className="block">
                <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  Title
                </span>
                <input
                  name="title"
                  required
                  minLength={5}
                  maxLength={200}
                  className="giq-form-control mt-2 px-3 py-2"
                  placeholder="Best young sires for 2026?"
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  Body
                </span>
                <textarea
                  name="body"
                  required
                  minLength={20}
                  maxLength={20000}
                  rows={8}
                  className="giq-form-control giq-textarea mt-2 px-3 py-2"
                  placeholder="Share the context, data, or question you want the community to discuss."
                />
              </label>
              <SubmitButton pendingLabel="Creating...">Create thread</SubmitButton>
            </form>
          ) : (
            <div>
              <p className="text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                Sign in to start a thread. Public browsing stays open.
              </p>
              <Link
                href="/sign-in"
                className="giq-liquid-purple-button mt-5 min-h-10 px-4 text-[13px] font-semibold"
              >
                Sign in
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
