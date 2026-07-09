import Link from "next/link";
import NextImage from "next/image";
import {
  ImageIcon,
  MessageSquare,
  Paperclip,
  UserX,
} from "lucide-react";
import { blockFeedPostAuthor, reportFeedPost } from "@/app/actions";
import {
  InstantFeedCommentForm,
  InstantFeedReactionButton,
} from "@/components/instant-feed-controls";
import { CUSTOM_PAGE_TYPE_LABELS } from "@/lib/custom-page-service";
import type { CustomPageType } from "@/lib/custom-page-validation";
import { feedPostMediaUrl, getFeedPostsForViewer } from "@/lib/feed-service";

export type FeedPostRow = Awaited<
  ReturnType<typeof getFeedPostsForViewer>
>[number];

export function FeedPostCard({
  canInteract,
  post,
  currentProfileId,
  signedIn,
  pageAvatarUrl,
}: {
  canInteract: boolean;
  post: FeedPostRow;
  currentProfileId: string | null;
  signedIn: boolean;
  pageAvatarUrl?: string | null;
}) {
  const reportAction = reportFeedPost.bind(null, post.id);
  const blockAction = blockFeedPostAuthor.bind(null, post.id);
  const liked = post.reactions.some(
    (reaction) => reaction.profileId === currentProfileId
  );
  const isAuthor = post.authorProfileId === currentProfileId;
  const page = post.authorPage;
  const authorName = page ? page.title : post.author.displayName;
  const pageTypeLabel = page
    ? CUSTOM_PAGE_TYPE_LABELS[page.pageType as CustomPageType] ?? page.pageType
    : null;

  return (
    <article className="giq-panel p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/[0.08] bg-[hsl(var(--surface-2))] text-[14px] font-bold text-white/70"
            style={
              page?.accentColor ? { borderColor: page.accentColor } : undefined
            }
          >
            {pageAvatarUrl ? (
              <NextImage
                src={pageAvatarUrl}
                alt=""
                width={40}
                height={40}
                className="h-full w-full object-cover"
              />
            ) : (
              authorName.slice(0, 1).toUpperCase()
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {page && page.published ? (
                <Link
                  href={`/p/${page.handle}`}
                  className="truncate text-[14px] font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary-light))]"
                >
                  {authorName}
                </Link>
              ) : (
                <p className="truncate text-[14px] font-semibold text-[hsl(var(--foreground))]">
                  {authorName}
                </p>
              )}
              {pageTypeLabel && (
                <span className="giq-badge giq-badge-neutral text-[10px] uppercase tracking-wide">
                  {pageTypeLabel}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[12px] text-[hsl(var(--subtle-foreground))]">
              {page ? `${post.author.displayName} - ` : ""}
              {post.topic?.name ?? "General"} - {formatFeedDate(post.createdAt)}
            </p>
          </div>
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
        <InstantFeedReactionButton
          postId={post.id}
          initialCount={post._count.reactions}
          initiallyLiked={liked}
          disabled={!canInteract}
        />
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

      {canInteract && (
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px]">
          <InstantFeedCommentForm postId={post.id} />
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
      {signedIn && !canInteract && (
        <p className="mt-4 text-[12px] text-[hsl(var(--muted-foreground))]">
          Upgrade to Pro to comment or react.
        </p>
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

export function formatFeedDate(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
