"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import {
  ImageIcon,
  MessageSquare,
  Paperclip,
  Trash2,
  UserX,
} from "lucide-react";
import { blockFeedPostAuthor, reportFeedPost } from "@/app/actions";
import {
  InstantFeedCommentForm,
  InstantFeedReactionButton,
  InstantFeedMuteButton,
  InstantFeedSaveButton,
  InstantFeedShareControls,
  InstantFeedOwnerControls,
  InstantFeedTopicFollowButton,
} from "@/components/instant-feed-controls";
import { FeedCommentsPanel } from "@/components/feed-comments-panel";
import type { CustomPageType } from "@/lib/custom-page-validation";
import type { getFeedPostsForViewer } from "@/lib/feed-service";

const CUSTOM_PAGE_TYPE_LABELS: Record<CustomPageType, string> = {
  trainer: "Trainer",
  punter: "Punter",
  business: "Business",
  dog: "Dog",
};

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
  const blockAction = blockFeedPostAuthor.bind(null, post.id);
  const liked = post.reactions.some(
    (reaction) =>
      (reaction.actorId && reaction.actorId === activeActorId) ||
      (!reaction.actorId && reaction.profileId === currentProfileId)
  );
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
      className="giq-panel scroll-mt-24 p-5"
    >
      {post.reshare && (
        <div className="mb-4 border-b border-white/[0.06] pb-3 text-[12px] text-[hsl(var(--muted-foreground))]">
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
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/[0.08] bg-[hsl(var(--surface-2))] text-[14px] font-bold text-white/70"
            style={
              page?.accentColor ? { borderColor: page.accentColor } : undefined
            }
          >
            {pageAvatarUrl ?? post.authorActor?.avatarUrl ? (
              <NextImage
                src={(pageAvatarUrl ?? post.authorActor?.avatarUrl)!}
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
        <div className="flex flex-wrap items-center gap-2">
          {signedIn && post.topic && (
            <InstantFeedTopicFollowButton
              topicId={post.topic.id}
              actorId={activeActorId}
              initiallyFollowed={post.topic.followers.length > 0}
            />
          )}
          {post.pinnedAt && (
            <span className="giq-badge giq-badge-gold">Pinned</span>
          )}
        </div>
      </header>

      {isAuthor && signedIn && (
        <InstantFeedOwnerControls
          postId={post.id}
          initialBody={post.body}
          initialVisibility={post.visibility}
        />
      )}

      <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[hsl(215_14%_76%)]">
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

      {linkPreview && (
        <a
          href={linkPreview.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="giq-subpanel mt-4 block p-4 transition hover:border-white/[0.12]"
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
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {post.media.map((attachment) => (
            <div key={attachment.mediaId} className="relative">
              <FeedMedia media={attachment.media} />
              {isAuthor && post.status !== "active" && (
                <RemoveFeedMediaButton mediaId={attachment.mediaId} />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
        <InstantFeedReactionButton
          postId={post.id}
          initialCount={post._count.reactions}
          initiallyLiked={liked}
          disabled={!canInteract}
          actorId={activeActorId}
        />
        <span className="giq-status-pill">
          <MessageSquare className="h-3.5 w-3.5 text-[hsl(var(--primary-bright))]" />
          {post._count.comments}
        </span>
        {signedIn && (
          <>
            <InstantFeedSaveButton
              postId={post.id}
              actorId={activeActorId}
              initiallySaved={post.savedBy.length > 0}
            />
            <InstantFeedShareControls
              postId={post.id}
              actorId={activeActorId}
              sourceVisibility={post.visibility}
              initialShareCount={post._count.shares}
              initiallyShared={post.shares.length > 0}
              disabled={!canInteract}
            />
          </>
        )}
      </div>

      <FeedCommentsPanel
        postId={post.id}
        initialComments={post.comments}
        totalCount={post._count.comments}
        canInteract={canInteract}
        currentProfileId={currentProfileId}
        activeActorId={activeActorId}
      />

      {canInteract && (
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px]">
          <InstantFeedCommentForm postId={post.id} actorId={activeActorId} />
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
            <div className="flex gap-2 md:col-start-2">
              {post.authorActor?.id && (
                <InstantFeedMuteButton
                  mutedActorId={post.authorActor.id}
                  muterActorId={activeActorId}
                />
              )}
              <form action={blockAction} className="flex-1">
                <button className="giq-outline-action min-h-11 w-full px-3 text-[12px]">
                  <UserX className="h-3.5 w-3.5" />
                  Block author
                </button>
              </form>
            </div>
          )}
        </div>
      )}
      {signedIn && !canInteract && (
        <p className="mt-4 text-[12px] text-[hsl(var(--muted-foreground))]">
          Switch to your personal identity to comment or react for free.
        </p>
      )}
    </article>
  );
}

function RemoveFeedMediaButton({ mediaId }: { mediaId: string }) {
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
        <span className="rounded bg-red-950/90 px-2 py-1 text-[10px] text-red-100">
          {error}
        </span>
      )}
    </div>
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
      <a href={playbackUrl} target="_blank" rel="noreferrer" className="giq-listing-media block">
        <NextImage
          src={playbackUrl}
          unoptimized={playbackUrl.startsWith("/api/media/")}
          alt={media.altText ?? media.originalName ?? "Feed media"}
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
      <div className="giq-listing-media flex min-h-24 items-center p-3">
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

function ProcessedVideo({
  playbackUrl,
  hlsUrl,
  posterUrl,
  captionUrl,
  label,
}: {
  playbackUrl: string;
  hlsUrl: string | null;
  posterUrl: string | null;
  captionUrl: string | null;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !hlsUrl) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
      return;
    }
    let disposed = false;
    let destroy: (() => void) | null = null;
    void import("hls.js").then(({ default: Hls }) => {
      if (disposed || !Hls.isSupported()) return;
      const hls = new Hls({ enableWorker: true });
      destroy = () => hls.destroy();
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
    });
    return () => {
      disposed = true;
      destroy?.();
    };
  }, [hlsUrl]);

  return (
    <video
      ref={ref}
      controls
      preload="metadata"
      poster={posterUrl ?? undefined}
      className="giq-listing-media h-52 w-full object-cover"
      aria-label={label}
    >
      <source src={playbackUrl} type="video/mp4" />
      {captionUrl && (
        <track
          kind="captions"
          srcLang="en"
          label="English"
          src={captionUrl}
          default
        />
      )}
    </video>
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
