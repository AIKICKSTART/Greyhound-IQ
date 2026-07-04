import Link from "next/link";
import NextImage from "next/image";
import {
  Flag,
  Heart,
  ImageIcon,
  MessageSquare,
  Paperclip,
  Send,
  ShieldAlert,
  UserX,
} from "lucide-react";
import {
  blockFeedPostAuthor,
  createFeedPost,
  replyToFeedPost,
  reportFeedPost,
  toggleFeedPostReaction,
} from "@/app/actions";
import { MediaAttachmentFields } from "@/components/media-attachment-fields";
import { PageHero } from "@/components/page-hero";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import {
  feedPostMediaUrl,
  getFeedPostsForViewer,
  getFeedTopics,
} from "@/lib/feed-service";
import { publicFeedRealtimeChannel } from "@/lib/realtime-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Community Feed - GreyhoundIQ",
  description:
    "GreyhoundIQ community feed for Australian greyhound racing posts, comments, reactions, and reports.",
};

export default async function FeedPage() {
  const user = await getCurrentUser();
  const realtimeChannel = publicFeedRealtimeChannel();
  const [topics, posts] = await Promise.all([
    getFeedTopics(),
    getFeedPostsForViewer(30, user?.profileId ?? null),
  ]);

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
        subtitle="Share greyhound racing context, kennel updates, marketplace notes, and practical community observations without turning the product into a generic social network."
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/forum"
            className="giq-button giq-button-glass px-5 text-[13px] font-semibold"
          >
            Forum
          </Link>
          <Link
            href="/listings"
            className="giq-button giq-button-primary px-5 text-[13px] font-semibold"
          >
            Marketplace
          </Link>
        </div>
      </PageHero>
      <RealtimeRefresh
        channels={[
          {
            name: realtimeChannel,
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

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-4">
          {user ? (
            <section className="giq-panel p-5">
              <div className="mb-4 flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
                <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
                  Post to the feed
                </h2>
              </div>
              <form action={createFeedPost} className="space-y-4">
                {topics.length > 0 && (
                  <select
                    name="topicId"
                    className="giq-form-control px-3 py-2 text-[13px]"
                    defaultValue=""
                  >
                    <option value="">General</option>
                    {topics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.name}
                      </option>
                    ))}
                  </select>
                )}
                <textarea
                  name="body"
                  required
                  minLength={2}
                  maxLength={5000}
                  rows={5}
                  className="giq-form-control giq-textarea px-3 py-2"
                  placeholder="Share a race note, kennel update, question, or marketplace context."
                />
                <MediaAttachmentFields mediaContext="feed" maxFiles={4} compact />
                <SubmitButton pendingLabel="Posting...">
                  <Send className="h-3.5 w-3.5" />
                  Post
                </SubmitButton>
              </form>
            </section>
          ) : (
            <section className="giq-panel p-5">
              <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
                Sign in to post
              </h2>
              <p className="mt-2 text-[14px] text-[hsl(var(--muted-foreground))]">
                Public posts, comments, reactions, and reports are tied to your
                GreyhoundIQ profile.
              </p>
              <a
                href="/sign-in"
                className="giq-button giq-button-primary mt-4 w-fit px-4 text-[13px] font-semibold"
              >
                Sign in
              </a>
            </section>
          )}

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
                currentProfileId={user?.profileId ?? null}
                signedIn={Boolean(user)}
              />
            ))
          )}
        </main>

        <aside className="space-y-4">
          <section className="giq-panel p-5">
            <div className="mb-4 flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-[hsl(var(--secondary))]" />
              <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
                Community safety
              </h2>
            </div>
            <p className="text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              Feed reports go into the existing admin reports queue. Marketplace,
              private message, and call moderation stay separate from public
              feed visibility.
            </p>
          </section>

          <section className="giq-panel p-5">
            <div className="mb-4 flex items-center gap-3">
              <Flag className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
              <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
                Topics
              </h2>
            </div>
            {topics.length === 0 ? (
              <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
                Topic management will appear in admin after the first feed data
                migration is applied.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <span key={topic.id} className="giq-badge giq-badge-neutral">
                    {topic.name}
                  </span>
                ))}
              </div>
            )}
          </section>
        </aside>
      </section>
    </div>
  );
}

type FeedPostRow = Awaited<ReturnType<typeof getFeedPostsForViewer>>[number];

function FeedPostCard({
  post,
  currentProfileId,
  signedIn,
}: {
  post: FeedPostRow;
  currentProfileId: string | null;
  signedIn: boolean;
}) {
  const commentAction = replyToFeedPost.bind(null, post.id);
  const reactionAction = toggleFeedPostReaction.bind(null, post.id);
  const reportAction = reportFeedPost.bind(null, post.id);
  const blockAction = blockFeedPostAuthor.bind(null, post.id);
  const liked = post.reactions.some(
    (reaction) => reaction.profileId === currentProfileId
  );
  const isAuthor = post.authorProfileId === currentProfileId;

  return (
    <article className="giq-panel p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
            {post.author.displayName}
          </p>
          <p className="mt-0.5 text-[12px] text-[hsl(var(--subtle-foreground))]">
            {post.topic?.name ?? "General"} - {formatDate(post.createdAt)}
          </p>
        </div>
        {post.pinnedAt && <span className="giq-badge giq-badge-gold">Pinned</span>}
      </header>

      <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[hsl(215_14%_76%)]">
        {post.body}
      </p>

      {post.media.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {post.media.map((attachment) => (
            <FeedMedia key={attachment.mediaId} media={attachment.media} />
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
        <form action={reactionAction}>
          <button
            disabled={!signedIn}
            className="giq-outline-action min-h-9 px-3 text-[12px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Heart
              className={`h-3.5 w-3.5 ${liked ? "fill-current text-[hsl(var(--secondary))]" : ""}`}
            />
            {post._count.reactions}
          </button>
        </form>
        <span className="giq-status-pill">
          <MessageSquare className="h-3.5 w-3.5 text-[hsl(var(--primary-bright))]" />
          {post._count.comments}
        </span>
      </div>

      {post.comments.length > 0 && (
        <div className="mt-4 space-y-2">
          {post.comments.map((comment) => (
            <div key={comment.id} className="giq-subpanel p-3">
              <p className="text-[12px] font-semibold text-[hsl(var(--foreground))]">
                {comment.author.displayName}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                {comment.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {signedIn && (
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px]">
          <form action={commentAction} className="flex gap-2">
            <input
              name="body"
              required
              minLength={2}
              maxLength={2000}
              className="giq-form-control min-w-0 flex-1 px-3 py-2 text-[13px]"
              placeholder="Add a comment"
            />
            <button className="giq-button giq-button-glass giq-icon-button">
              <Send className="h-4 w-4" />
            </button>
          </form>
          <form action={reportAction} className="flex gap-2">
            <select
              name="reason"
              className="giq-form-control min-w-0 flex-1 px-2 py-2 text-[12px]"
              defaultValue="other"
              aria-label="Report reason"
            >
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="misinformation">Misinformation</option>
              <option value="illegal">Illegal</option>
              <option value="other">Other</option>
            </select>
            <button className="giq-outline-action min-h-9 px-3 text-[12px]">
              Report
            </button>
          </form>
          {!isAuthor && (
            <form action={blockAction} className="md:col-start-2">
              <button className="giq-outline-action min-h-9 w-full px-3 text-[12px]">
                <UserX className="h-3.5 w-3.5" />
                Block author
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}

function FeedMedia({
  media,
}: {
  media: {
    id: string;
    storageBucket: string;
    storagePath: string;
    publicUrl: string | null;
    originalName: string | null;
    mimeType: string;
    widthPx: number | null;
    heightPx: number | null;
  };
}) {
  const url = feedPostMediaUrl(media);
  if (media.mimeType.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="giq-listing-media block">
        <NextImage
          src={url}
          alt={media.originalName ?? "Feed media"}
          width={media.widthPx ?? 640}
          height={media.heightPx ?? 420}
          sizes="(min-width: 1024px) 420px, (min-width: 640px) 50vw, 100vw"
          className="h-52 w-full object-cover"
        />
      </a>
    );
  }

  if (media.mimeType.startsWith("video/")) {
    return (
      <video controls className="giq-listing-media h-52 w-full object-cover">
        <source src={url} type={media.mimeType} />
      </video>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="giq-outline-action min-h-20 px-3 py-2 text-[12px]"
    >
      {media.mimeType.startsWith("image/") ? (
        <ImageIcon className="h-4 w-4 text-[hsl(var(--primary-bright))]" />
      ) : (
        <Paperclip className="h-4 w-4 text-[hsl(var(--primary-bright))]" />
      )}
      <span className="truncate">{media.originalName ?? media.mimeType}</span>
    </a>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
