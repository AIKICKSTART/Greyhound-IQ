"use client";

import { useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import {
  ImageIcon,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Trash2,
} from "lucide-react";
import { reportFeedPost } from "@/app/actions";
import {
  InstantFeedBlockButton,
  InstantFeedCommentForm,
  InstantFeedReactionButton,
  InstantFeedMuteButton,
  InstantFeedSaveButton,
  InstantFeedShareControls,
  InstantFeedOwnerControls,
  InstantFeedTopicFollowButton,
  type FeedReactionType,
} from "@/components/instant-feed-controls";
import { FeedCommentsPanel } from "@/components/feed-comments-panel";
import { ActorMediaImage } from "@/components/actor-media-image";
import { ProcessedVideo } from "@/components/processed-video";
import type { CustomPageType } from "@/lib/custom-page-validation";
import type { getFeedPostsForViewer } from "@/lib/feed-service";

const CUSTOM_PAGE_TYPE_LABELS: Record<CustomPageType, string> = {
  trainer: "Trainer",
  punter: "Punter",
  business: "Business",
  dog: "Dog",
};

const FEED_REACTION_TYPES = new Set<FeedReactionType>([
  "like",
  "love",
  "celebrate",
  "insightful",
  "support",
]);

export type FeedPostRow = Awaited<
  ReturnType<typeof getFeedPostsForViewer>
>[number];

export function FeedPostCard({
  canInteract,
  post,
  currentProfileId,
  activeActorId,
  signedIn,
  pageAvatarUrl,
}: {
  canInteract: boolean;
  post: FeedPostRow;
  currentProfileId: string | null;
  activeActorId?: string | null;
  signedIn: boolean;
  pageAvatarUrl?: string | null;
}) {
  const reportAction = reportFeedPost.bind(null, post.id);
  const currentReaction = post.reactions.find(
    (reaction) =>
      (reaction.actorId && reaction.actorId === activeActorId) ||
      (!reaction.actorId && reaction.profileId === currentProfileId)
  );
  const currentReactionType = FEED_REACTION_TYPES.has(
    currentReaction?.reactionType as FeedReactionType,
  )
    ? (currentReaction?.reactionType as FeedReactionType)
    : null;
  const isAuthor = post.authorProfileId === currentProfileId;
  const page = post.authorPage;
  const authorName = page ? page.title : post.author.displayName;
  const pageTypeLabel = page
    ? CUSTOM_PAGE_TYPE_LABELS[page.pageType as CustomPageType] ?? page.pageType
    : null;
  const linkPreview = parseLinkPreview(post.linkPreviewJson);
  const resharer = post.reshare?.actor;

  return (
    <article
      id={post.reshare ? `share-${post.reshare.id}` : `post-${post.id}`}
      className="giq-social-post giq-panel giq-panel-popovers scroll-mt-24 p-0"
    >
      {post.reshare && (
        <div className="giq-social-reshare border-b border-white/[0.06] px-5 py-3 text-[12px] text-[hsl(var(--muted-foreground))]">
          <p>
            {resharer ? (
              <Link
                href={`/p/${resharer.handle}`}
                className="font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary-light))]"
              >
                {resharer.displayName}
              </Link>
            ) : (
              <span className="font-semibold text-[hsl(var(--foreground))]">A member</span>
            )}{" "}
            shared this · {formatFeedDate(post.reshare.createdAt)}
          </p>
          {post.reshare.body && (
            <p className="mt-2 whitespace-pre-wrap text-[13px] text-[hsl(215_14%_76%)]">
              {post.reshare.body}
            </p>
          )}
        </div>
      )}
      <header className="giq-social-post-header flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="giq-social-post-avatar grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-white/[0.08] bg-[hsl(var(--surface-2))] text-[14px] font-bold text-white/70"
            style={
              page?.accentColor ? { borderColor: page.accentColor } : undefined
            }
          >
            {pageAvatarUrl ?? post.authorActor?.avatarUrl ? (
              <ActorMediaImage
                src={(pageAvatarUrl ?? post.authorActor?.avatarUrl)!}
                alt=""
                width={40}
                height={40}
                className="h-full w-full object-cover"
                focalX={post.authorActor?.avatarFocalX}
                focalY={post.authorActor?.avatarFocalY}
                zoom={post.authorActor?.avatarZoom}
                rotation={post.authorActor?.avatarRotation}
              />
            ) : (
              authorName.slice(0, 1).toUpperCase()
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {(page && page.published) || post.authorActor?.handle ? (
                <Link
                  href={`/p/${page?.handle ?? post.authorActor!.handle}`}
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
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[12px] text-[hsl(var(--subtle-foreground))]">
              {page && <span>{post.author.displayName} ·</span>}
              <span className="capitalize">{post.visibility.replace("_", " ")}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={post.createdAt.toISOString()}>
                {formatFeedDate(post.createdAt)}
              </time>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {post.pinnedAt && (
            <span className="giq-badge giq-badge-gold">Pinned</span>
          )}
          {signedIn && (
            <details className="group/post-menu relative">
              <summary
                className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full text-[hsl(var(--muted-foreground))] transition hover:bg-white/[0.05] hover:text-[hsl(var(--foreground))]"
                aria-label="Post options"
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              </summary>
              <div className="absolute right-0 top-[calc(100%+4px)] z-30 w-[min(340px,calc(100vw-32px))] space-y-3 rounded-xl border border-white/[0.12] bg-[hsl(var(--surface-1)/0.98)] p-3 shadow-2xl backdrop-blur-xl">
                {post.topic && (
                  <InstantFeedTopicFollowButton
                    topicId={post.topic.id}
                    actorId={activeActorId}
                    initiallyFollowed={post.topic.followers.length > 0}
                  />
                )}
                {isAuthor && (
                  <InstantFeedOwnerControls
                    postId={post.id}
                    initialBody={post.body}
                    initialVisibility={post.visibility}
                  />
                )}
                {canInteract && (
                  <section className="space-y-2 rounded-lg border border-white/[0.07] bg-white/[0.025] p-3">
                    <h3 className="text-[12px] font-semibold text-[hsl(var(--foreground))]">
                      Safety
                    </h3>
                    <form action={reportAction} className="flex gap-2">
                      <select
                        name="reason"
                        className="giq-form-control min-h-11 min-w-0 flex-1 px-2 py-2 text-[12px]"
                        defaultValue="other"
                        aria-label="Report reason"
                      >
                        <option value="spam">Spam</option>
                        <option value="harassment">Harassment</option>
                        <option value="misinformation">Misinformation</option>
                        <option value="illegal">Illegal</option>
                        <option value="other">Other</option>
                      </select>
                      <button className="giq-outline-action min-h-11 px-3 text-[12px]">
                        Report
                      </button>
                    </form>
                    {!isAuthor && (
                      <div className="flex gap-2">
                        {post.authorActor?.id && (
                          <InstantFeedMuteButton
                            mutedActorId={post.authorActor.id}
                            muterActorId={activeActorId}
                          />
                        )}
                        <InstantFeedBlockButton postId={post.id} />
                      </div>
                    )}
                  </section>
                )}
              </div>
            </details>
          )}
        </div>
      </header>

      <div className="giq-social-post-copy px-5">
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[hsl(215_14%_82%)]">
          {post.body}
        </p>

        {post.status !== "active" && (
          <p
            className="mt-3 rounded-lg border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2 text-[12px] text-amber-100"
            role="status"
          >
            {post.status === "failed"
              ? "This post is private to you because an attachment failed processing. Edit or remove the attachment before publishing."
              : "This post is private to you while its media is scanned and prepared. It will publish automatically when ready."}
          </p>
        )}
      </div>

      {linkPreview && (
        <a
          href={linkPreview.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="giq-social-link-preview giq-subpanel mx-5 mt-4 block p-4 transition hover:border-white/[0.12]"
        >
          <p className="text-[11px] uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
            {linkPreview.siteName ?? new URL(linkPreview.url).hostname}
          </p>
          {linkPreview.title && (
            <p className="mt-1 text-[14px] font-semibold text-[hsl(var(--foreground))]">
              {linkPreview.title}
            </p>
          )}
          {linkPreview.description && (
            <p className="mt-1 line-clamp-2 text-[12px] text-[hsl(var(--muted-foreground))]">
              {linkPreview.description}
            </p>
          )}
        </a>
      )}

      {post.media.length > 0 && (
        <FeedMediaGallery
          postId={post.id}
          attachments={post.media}
          isAuthor={isAuthor}
          postStatus={post.status}
        />
      )}

      <div className="giq-social-post-metrics mt-4 flex items-center justify-between gap-3 px-5 pb-2 text-[11px] text-[hsl(var(--subtle-foreground))]">
        <span>
          {post._count.reactions} reaction{post._count.reactions === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-3">
          <a href={`#comments-${post.id}`} className="hover:text-[hsl(var(--foreground))]">
            {post._count.comments} comment{post._count.comments === 1 ? "" : "s"}
          </a>
          {post._count.shares > 0 && (
            <span>
              {post._count.shares} share{post._count.shares === 1 ? "" : "s"}
            </span>
          )}
        </span>
      </div>

      <div className="giq-social-post-actions mx-3 grid grid-cols-4 border-y border-white/[0.07]">
        <InstantFeedReactionButton
          postId={post.id}
          initialCount={post._count.reactions}
          initialReactionType={currentReactionType}
          disabled={!canInteract}
          actorId={activeActorId}
        />
        <a
          href={`#comment-${post.id}`}
          className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-2 text-[12px] font-semibold text-[hsl(var(--muted-foreground))] transition hover:bg-white/[0.04] hover:text-[hsl(var(--foreground))]"
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Comment</span>
          <span className="sm:hidden">Reply</span>
        </a>
        {signedIn && (
          <>
            <InstantFeedShareControls
              postId={post.id}
              actorId={activeActorId}
              sourceVisibility={post.visibility}
              initialShareCount={post._count.shares}
              initiallyShared={post.shares.length > 0}
              disabled={!canInteract}
            />
            <InstantFeedSaveButton
              postId={post.id}
              actorId={activeActorId}
              initiallySaved={post.savedBy.length > 0}
            />
          </>
        )}
      </div>

      <div className="giq-social-post-comments px-5 pb-5">
        <FeedCommentsPanel
          postId={post.id}
          initialComments={post.comments}
          totalCount={post._count.comments}
          canInteract={canInteract}
          currentProfileId={currentProfileId}
          activeActorId={activeActorId}
        />

        {canInteract && (
          <div id={`comment-${post.id}`} className="mt-4 scroll-mt-24">
            <InstantFeedCommentForm postId={post.id} actorId={activeActorId} />
          </div>
        )}
        {signedIn && !canInteract && (
          <p className="mt-4 text-[12px] text-[hsl(var(--muted-foreground))]">
            Switch to your personal identity to comment or react for free.
          </p>
        )}
      </div>
    </article>
  );
}

function FeedMediaGallery({
  postId,
  attachments,
  isAuthor,
  postStatus,
}: {
  postId: string;
  attachments: FeedPostRow["media"];
  isAuthor: boolean;
  postStatus: string;
}) {
  const single = attachments.length === 1;
  const hasMotion = attachments.some((attachment) =>
    /^(video|audio)\//.test(attachment.media.mimeType)
  );

  return (
    <div
      className={`giq-social-media-gallery mx-3 mt-4 grid gap-1.5 overflow-hidden rounded-xl ${
        single ? "grid-cols-1" : "grid-cols-2"
      }`}
    >
      {attachments.map((attachment, index) => {
        const motion = /^(video|audio)\//.test(attachment.media.mimeType);
        const spanAll = !single && motion;
        const leadImage =
          !hasMotion && attachments.length === 3 && index === 0;
        return (
          <div
            key={attachment.mediaId}
            className={`relative min-w-0 ${
              spanAll ? "col-span-2" : leadImage ? "row-span-2" : ""
            }`}
          >
            <FeedMedia
              media={attachment.media}
              featured={single || motion}
              mosaic={!single && !motion}
            />
            {isAuthor && postStatus !== "active" && (
              <RemoveFeedMediaButton
                postId={postId}
                mediaId={attachment.mediaId}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function RemoveFeedMediaButton({
  postId,
  mediaId,
}: {
  postId: string;
  mediaId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/media/${mediaId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not remove attachment");
      window.dispatchEvent(
        new CustomEvent("giq:feed-refresh", { detail: { postId } }),
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not remove attachment"
      );
      setBusy(false);
    }
  }

  return (
    <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void remove()}
        disabled={busy}
        className="giq-button giq-button-carbon min-h-11 px-3 text-[11px] shadow-lg"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {busy ? "Removing..." : "Remove attachment"}
      </button>
      {error && (
        <span
          role="alert"
          className="rounded bg-red-950/90 px-2 py-1 text-[10px] text-red-100"
        >
          {error}
        </span>
      )}
    </div>
  );
}

function FeedMedia({
  media,
  featured,
  mosaic,
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
    durationSec: number | null;
    processingStatus: string;
    processingError: string | null;
    playbackPath: string | null;
    posterPath: string | null;
    hlsPath: string | null;
    waveformJson: string | null;
    altText: string | null;
    captionPath: string | null;
  };
  featured: boolean;
  mosaic: boolean;
}) {
  const originalUrl = media.publicUrl ?? `/api/media/${media.id}/blob`;
  const playbackUrl = media.playbackPath
    ? `/api/media/${media.id}/blob?variant=playback`
    : originalUrl;
  if (media.processingStatus !== "ready") {
    return (
      <div
        className="giq-listing-media grid min-h-32 place-items-center p-4 text-center text-[12px] text-[hsl(var(--muted-foreground))]"
        role="status"
      >
        {media.processingStatus === "failed"
          ? "Media processing failed. The author can retry or remove this attachment."
          : "Media is being scanned and prepared."}
      </div>
    );
  }
  if (media.mimeType.startsWith("image/")) {
    return (
      <a
        href={playbackUrl}
        target="_blank"
        rel="noreferrer"
        className={`giq-social-media-item giq-listing-media block h-full bg-black/25 ${
          featured ? "min-h-[240px]" : "min-h-[180px] sm:min-h-[220px]"
        }`}
      >
        <NextImage
          src={playbackUrl}
          unoptimized={playbackUrl.startsWith("/api/media/")}
          alt={media.altText ?? media.originalName ?? "Feed media"}
          width={media.widthPx ?? 640}
          height={media.heightPx ?? 420}
          sizes={featured ? "(min-width: 1280px) 760px, 100vw" : "(min-width: 1280px) 380px, 50vw"}
          className={
            featured
              ? "max-h-[620px] min-h-[240px] w-full object-contain"
              : `h-full min-h-[180px] w-full object-cover sm:min-h-[220px] ${mosaic ? "aspect-square" : ""}`
          }
        />
      </a>
    );
  }

  if (media.mimeType.startsWith("video/")) {
    return (
      <ProcessedVideo
        playbackUrl={playbackUrl}
        hlsUrl={
          media.hlsPath
            ? `/api/media/${media.id}/blob?variant=hls`
            : null
        }
        posterUrl={
          media.posterPath
            ? `/api/media/${media.id}/blob?variant=poster`
            : null
        }
        captionUrl={
          media.captionPath
            ? `/api/media/${media.id}/blob?variant=caption`
            : null
        }
        label={media.altText ?? media.originalName ?? "Feed video"}
      />
    );
  }

  if (media.mimeType.startsWith("audio/")) {
    return (
      <div className="giq-social-media-item giq-listing-media flex min-h-28 items-center bg-black/25 p-4">
        <audio
          controls
          preload="metadata"
          src={playbackUrl}
          className="w-full"
          aria-label={media.altText ?? media.originalName ?? "Feed audio"}
        />
      </div>
    );
  }

  return (
    <a
      href={originalUrl}
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

function parseLinkPreview(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (typeof parsed.url !== "string") {
      return null;
    }
    const previewUrl = new URL(parsed.url);
    if (previewUrl.protocol !== "http:" && previewUrl.protocol !== "https:") return null;
    return {
      url: previewUrl.toString(),
      title: typeof parsed.title === "string" ? parsed.title : null,
      description:
        typeof parsed.description === "string" ? parsed.description : null,
      siteName: typeof parsed.siteName === "string" ? parsed.siteName : null,
    };
  } catch {
    return null;
  }
}
