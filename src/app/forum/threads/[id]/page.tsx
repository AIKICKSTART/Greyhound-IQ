import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, MessageSquare, Reply } from "lucide-react";
import { replyToForumThread } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import { getForumThreadById } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const thread = await getForumThreadById(id);
  if (!thread) {
    return {
      title: "Thread not found - GreyhoundIQ",
      description: "Forum thread not found.",
    };
  }
  return {
    title: `${thread.title} - GreyhoundIQ Forum`,
    description: `GreyhoundIQ forum thread in ${thread.category.name}.`,
  };
}

export default async function ForumThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [thread, user] = await Promise.all([
    getForumThreadById(id),
    getCurrentUser(),
  ]);
  if (!thread) notFound();

  const replyAction = replyToForumThread.bind(null, thread.id);

  return (
    <div className="fade-in mx-auto max-w-4xl px-6 py-10">
      <Link
        href={`/forum/${thread.category.slug}`}
        className="mb-6 inline-flex items-center gap-2 text-[13px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {thread.category.name}
      </Link>

      <header className="giq-panel mb-6 p-6">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[12px] text-[hsl(var(--subtle-foreground))]">
          <span>{thread.category.name}</span>
          <span>-</span>
          <span>Started by {thread.author.displayName}</span>
          <span>-</span>
          <span>{thread.views} views</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
          {thread.title}
        </h1>
      </header>

      <div className="space-y-3">
        {thread.posts.map((post, index) => (
          <article
            key={post.id}
            className="giq-panel p-5"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
                  {post.author.displayName}
                </p>
                <p className="mt-0.5 text-[12px] text-[hsl(var(--subtle-foreground))]">
                  {post.createdAt.toLocaleString("en-AU")}
                </p>
              </div>
              <span className="giq-badge giq-badge-neutral">
                {index === 0 ? "Original post" : `Reply ${index}`}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[hsl(215_14%_75%)]">
              {post.body}
            </p>
          </article>
        ))}
      </div>

      <section className="giq-panel mt-6 p-5">
        <div className="mb-5 flex items-center gap-3">
          {thread.locked ? (
            <Lock className="h-5 w-5 text-[hsl(var(--secondary))]" />
          ) : (
            <Reply className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
          )}
          <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
            Reply
          </h2>
        </div>

        {thread.locked ? (
          <p className="text-[14px] text-[hsl(var(--muted-foreground))]">
            This thread is locked.
          </p>
        ) : user ? (
          <form action={replyAction} className="space-y-4">
            <textarea
              name="body"
              required
              minLength={20}
              maxLength={20000}
              rows={6}
              className="giq-form-control giq-textarea px-3 py-2"
              placeholder="Add a useful reply with data, context, or practical experience."
            />
            <SubmitButton pendingLabel="Posting...">Post reply</SubmitButton>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[14px] text-[hsl(var(--muted-foreground))]">
              Sign in to reply to this thread.
            </p>
            <Link
              href="/sign-in"
              className="giq-liquid-purple-button min-h-10 px-4 text-[13px] font-semibold"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Sign in
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
