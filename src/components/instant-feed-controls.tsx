"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import {
  AudioLines,
  Bookmark,
  ChevronDown,
  HandHeart,
  Heart,
  ImageIcon,
  Lightbulb,
  Loader2,
  PartyPopper,
  Pencil,
  Send,
  Share2,
  SlidersHorizontal,
  Tags,
  ThumbsUp,
  Trash2,
  UserX,
  Video,
  VolumeX,
} from "lucide-react";
import { blockFeedPostAuthor } from "@/app/actions";
import { MediaAttachmentFields } from "@/components/media-attachment-fields";

type FeedTopicOption = {
  id: string;
  name: string;
};

const REACTIONS = [
  { type: "like", label: "Like", icon: ThumbsUp, tone: "text-sky-300" },
  { type: "love", label: "Love", icon: Heart, tone: "text-rose-300" },
  {
    type: "celebrate",
    label: "Celebrate",
    icon: PartyPopper,
    tone: "text-amber-300",
  },
  {
    type: "insightful",
    label: "Insightful",
    icon: Lightbulb,
    tone: "text-yellow-200",
  },
  { type: "support", label: "Support", icon: HandHeart, tone: "text-violet-300" },
] as const;

export type FeedReactionType = (typeof REACTIONS)[number]["type"];

export function InstantFeedPostComposer({
  topics,
  pageId = null,
  identityLabel,
  identityAvatarUrl,
}: {
  topics: FeedTopicOption[];
  // Owned CustomPage id to post as (server re-verifies ownership).
  pageId?: string | null;
  identityLabel?: string;
  identityAvatarUrl?: string | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const busy = submitting || refreshing;

  useEffect(() => {
    let focusFrame = 0;
    let expandTimer = 0;
    const expandComposer = () => {
      window.clearTimeout(expandTimer);
      expandTimer = window.setTimeout(() => {
        setExpanded(true);
        window.cancelAnimationFrame(focusFrame);
        focusFrame = window.requestAnimationFrame(() =>
          formRef.current
            ?.querySelector<HTMLTextAreaElement>("textarea")
            ?.focus(),
        );
      }, 0);
    };
    const expandFromHash = () => {
      if (window.location.hash === "#feed-composer") expandComposer();
    };
    expandFromHash();
    window.addEventListener("hashchange", expandFromHash);
    window.addEventListener("giq:open-feed-composer", expandComposer);
    return () => {
      window.clearTimeout(expandTimer);
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("hashchange", expandFromHash);
      window.removeEventListener("giq:open-feed-composer", expandComposer);
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = String(formData.get("body") ?? "").trim();
    const topicId = String(formData.get("topicId") ?? "") || null;
    const visibility = String(formData.get("visibility") ?? "");
    const mediaIds = formData
      .getAll("mediaIds")
      .map(String)
      .filter(Boolean);
    if (!body) return;

    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/feed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topicId, body, mediaIds, pageId, visibility }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const payload = (await response.json()) as { item?: { id?: string } };

      formRef.current?.reset();
      setResetKey((current) => current + 1);
      setExpanded(false);
      requestFeedRefresh(payload.item?.id, true);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post to feed");
    } finally {
      setSubmitting(false);
    }
  }

  function chooseMedia(kind: "image" | "video" | "audio") {
    setExpanded(true);
    window.setTimeout(() => {
      const input = formRef.current?.querySelector<HTMLInputElement>(
        'input[type="file"][accept]'
      );
      if (!input) return;
      const accepted = input.accept;
      input.accept = `${kind}/*`;
      input.click();
      window.setTimeout(() => {
        input.accept = accepted;
      }, 0);
    }, 0);
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="giq-social-composer space-y-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="giq-social-composer-avatar grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-[hsl(var(--secondary)/0.45)] bg-[hsl(var(--primary)/0.16)] text-[13px] font-bold text-[hsl(var(--primary-light))]"
        >
          {identityAvatarUrl ? (
            <NextImage
              src={identityAvatarUrl}
              alt=""
              width={44}
              height={44}
              unoptimized={identityAvatarUrl.startsWith("/api/media/")}
              className="h-full w-full object-cover"
            />
          ) : (
            (identityLabel ?? "You").slice(0, 1).toUpperCase()
          )}
        </span>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={expanded}
          aria-controls="feed-composer-details"
          className="giq-social-composer-prompt min-h-11 min-w-0 flex-1 rounded-full border border-white/[0.09] bg-white/[0.035] px-4 text-left text-[13px] text-[hsl(var(--muted-foreground))] transition hover:border-white/[0.16] hover:bg-white/[0.055] hover:text-[hsl(var(--foreground))]"
        >
          Share an update...
        </button>
      </div>

      <div className="giq-social-composer-media grid grid-cols-3 divide-x divide-white/[0.07] border-y border-white/[0.07]">
        <ComposerMediaButton
          label="Photo"
          icon={ImageIcon}
          tone="text-emerald-300"
          onClick={() => chooseMedia("image")}
        />
        <ComposerMediaButton
          label="Video"
          icon={Video}
          tone="text-violet-300"
          onClick={() => chooseMedia("video")}
        />
        <ComposerMediaButton
          label="Audio"
          icon={AudioLines}
          tone="text-amber-300"
          onClick={() => chooseMedia("audio")}
        />
      </div>

      <div
        id="feed-composer-details"
        className={expanded ? "space-y-3" : "hidden"}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          {identityLabel && (
            <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
              Posting as{" "}
              <span className="font-semibold text-[hsl(var(--primary-light))]">
                {identityLabel}
              </span>
            </p>
          )}
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="ml-auto min-h-10 rounded-lg px-3 text-[11px] font-semibold text-[hsl(var(--muted-foreground))] hover:bg-white/[0.04] hover:text-[hsl(var(--foreground))]"
          >
            Collapse
          </button>
        </div>

        <textarea
          name="body"
          required
          minLength={2}
          maxLength={5000}
          rows={3}
          disabled={busy}
          className="giq-form-control giq-textarea px-3 py-3 text-[14px] disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Share a race note, kennel update, question, or marketplace context."
        />

        <details className="rounded-xl border border-white/[0.07] bg-white/[0.02]">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-[12px] font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            Topic and audience
            <ChevronDown className="ml-auto h-3.5 w-3.5" aria-hidden="true" />
          </summary>
          <div className="grid gap-3 border-t border-white/[0.07] p-3 sm:grid-cols-2">
            <label className="grid gap-1 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">
              Topic
              <select
                name="topicId"
                className="giq-form-control px-3 py-2 text-[13px]"
                defaultValue=""
                disabled={busy}
              >
                <option value="">General</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">
              Audience
              <select
                name="visibility"
                defaultValue={pageId ? "public" : "connections"}
                disabled={busy}
                className="giq-form-control px-3 py-2 text-[13px]"
              >
                <option value="public">Public</option>
                <option value="members">Members</option>
                <option value="connections">Connections</option>
                <option value="only_me">Only me</option>
              </select>
            </label>
          </div>
        </details>

        <MediaAttachmentFields
          key={resetKey}
          mediaContext="feed"
          maxFiles={10}
          compact
        />
        {error && (
          <p
            role="alert"
            className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-100"
          >
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="submit"
            disabled={busy}
            className="giq-button giq-button-primary giq-submit-stack min-w-28 px-5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 ${busy ? "invisible" : ""}`}>
              <Send className="h-3.5 w-3.5" />
              Post
            </span>
            <span
              aria-hidden={!busy}
              className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 ${busy ? "" : "invisible"}`}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Posting...
            </span>
          </button>
        </div>
      </div>
    </form>
  );
}

function ComposerMediaButton({
  label,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  icon: typeof ImageIcon;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center justify-center gap-2 px-2 text-[12px] font-semibold text-[hsl(var(--muted-foreground))] transition hover:bg-white/[0.035] hover:text-[hsl(var(--foreground))]"
      aria-label={`Add ${label.toLowerCase()} to post`}
    >
      <Icon className={`h-4 w-4 ${tone}`} aria-hidden="true" />
      {label}
    </button>
  );
}

export function InstantFeedCommentForm({
  postId,
  actorId,
  parentCommentId,
  compact = false,
}: {
  postId: string;
  actorId?: string | null;
  parentCommentId?: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const busy = submitting || refreshing;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    if (!body) return;

    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/feed/${postId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body, actorId, parentCommentId }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));

      formRef.current?.reset();
      requestFeedRefresh(postId);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not comment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-2">
      <div className="flex gap-2">
        <input
          name="body"
          required
          minLength={2}
          maxLength={2000}
          disabled={busy}
          className="giq-form-control min-w-0 flex-1 px-3 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={parentCommentId ? "Write a reply" : "Add a comment"}
        />
        <button
          type="submit"
          disabled={busy}
          className="giq-button giq-button-glass giq-icon-button disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={parentCommentId ? "Add reply" : "Add comment"}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
      {!compact && parentCommentId && (
        <p className="text-[11px] text-[hsl(var(--subtle-foreground))]">
          Replies inherit the post audience.
        </p>
      )}
      {error && (
        <p role="alert" className="text-[11px] text-red-200">
          {error}
        </p>
      )}
    </form>
  );
}

export function InstantFeedReactionButton({
  postId,
  initialCount,
  initialReactionType,
  disabled,
  actorId,
}: {
  postId: string;
  initialCount: number;
  initialReactionType: FeedReactionType | null;
  disabled: boolean;
  actorId?: string | null;
}) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [reactionType, setReactionType] = useState<FeedReactionType | null>(
    initialReactionType
  );
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const busy = submitting || refreshing;

  async function toggle(nextType: FeedReactionType) {
    if (disabled || busy) return;

    const previous = { count, reactionType };
    const removing = reactionType === nextType;
    const nextReaction = removing ? null : nextType;
    setReactionType(nextReaction);
    setCount((current) =>
      Math.max(0, current + (reactionType ? (removing ? -1 : 0) : 1))
    );
    setSubmitting(true);
    try {
      const response = await fetch(`/api/feed/${postId}/reaction`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reactionType: nextType, actorId }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const payload = (await response.json()) as {
        item?: { active?: boolean; reactionType?: FeedReactionType };
      };
      setReactionType(
        payload.item?.active ? payload.item.reactionType ?? nextType : null
      );
      requestFeedRefresh(postId);
      startTransition(() => router.refresh());
    } catch {
      setReactionType(previous.reactionType);
      setCount(previous.count);
    } finally {
      setSubmitting(false);
    }
  }

  const selected =
    REACTIONS.find((reaction) => reaction.type === reactionType) ?? REACTIONS[0];
  const SelectedIcon = selected.icon;

  return (
    <div className="relative flex min-h-11 min-w-0 flex-1 items-stretch">
      <button
        type="button"
        onClick={() => void toggle(reactionType ?? "like")}
        disabled={disabled || busy}
        className={`inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-l-lg px-2 text-[12px] font-semibold transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50 ${
          reactionType ? selected.tone : "text-[hsl(var(--muted-foreground))]"
        }`}
        aria-label={`${reactionType ? "Remove" : "Add"} ${selected.label} reaction`}
        aria-pressed={Boolean(reactionType)}
      >
        <SelectedIcon
          className={`h-4 w-4 ${reactionType === "love" ? "fill-current" : ""}`}
          aria-hidden="true"
        />
        <span className="truncate">{reactionType ? selected.label : "Like"}</span>
      </button>
      <details className="group/reactions relative">
        <summary
          className="grid min-h-11 w-8 cursor-pointer list-none place-items-center rounded-r-lg text-[hsl(var(--subtle-foreground))] transition hover:bg-white/[0.04] hover:text-[hsl(var(--foreground))]"
          aria-label="Choose a reaction"
        >
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </summary>
        <div className="absolute bottom-[calc(100%+8px)] left-0 z-20 flex gap-1 rounded-full border border-white/[0.12] bg-[hsl(var(--surface-1)/0.98)] p-1.5 shadow-2xl backdrop-blur-xl">
          {REACTIONS.map((reaction) => {
            const Icon = reaction.icon;
            return (
              <button
                key={reaction.type}
                type="button"
                onClick={(event) => {
                  void toggle(reaction.type);
                  const details = event.currentTarget.closest("details");
                  if (details) details.open = false;
                }}
                disabled={disabled || busy}
                aria-label={reaction.label}
                aria-pressed={reactionType === reaction.type}
                className={`grid h-10 w-10 place-items-center rounded-full transition hover:-translate-y-0.5 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-bright))] ${reaction.tone}`}
              >
                <Icon
                  className={`h-5 w-5 ${reaction.type === "love" && reactionType === reaction.type ? "fill-current" : ""}`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </details>
      <span className="sr-only" aria-live="polite">
        {count} reaction{count === 1 ? "" : "s"}
      </span>
    </div>
  );
}

export function InstantFeedSaveButton({
  postId,
  actorId,
  initiallySaved,
}: {
  postId: string;
  actorId?: string | null;
  initiallySaved: boolean;
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const previous = saved;
    setSaved(!previous);
    setBusy(true);
    try {
      const response = await fetch(`/api/feed/${postId}/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actorId }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
    } catch {
      setSaved(previous);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-2 text-[12px] font-semibold text-[hsl(var(--muted-foreground))] transition hover:bg-white/[0.04] hover:text-[hsl(var(--foreground))] disabled:opacity-50"
    >
      <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} />
      {saved ? "Saved" : "Save"}
    </button>
  );
}

export function InstantFeedMuteButton({
  mutedActorId,
  muterActorId,
}: {
  mutedActorId: string;
  muterActorId?: string | null;
}) {
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleMute() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/actors/${mutedActorId}/mute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ muterActorId }),
      });
      if (!response.ok) throw new Error("Could not update mute");
      const payload = (await response.json()) as {
        item?: { muted?: boolean };
      };
      setMuted(Boolean(payload.item?.muted));
      requestFeedReset();
    } catch {
      // Keep the current UI state; the member can retry.
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggleMute()}
      disabled={busy}
      aria-pressed={muted}
      className="giq-outline-action min-h-11 px-3 text-[11px]"
    >
      <VolumeX className="h-3.5 w-3.5" />
      {muted ? "Muted" : "Mute"}
    </button>
  );
}

export function InstantFeedBlockButton({ postId }: { postId: string }) {
  const [busy, setBusy] = useState(false);

  async function blockAuthor() {
    if (busy) return;
    setBusy(true);
    try {
      await blockFeedPostAuthor(postId);
      requestFeedReset();
    } catch {
      // Keep the action available so the member can retry.
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void blockAuthor()}
      disabled={busy}
      className="giq-outline-action min-h-11 flex-1 px-3 text-[12px]"
    >
      <UserX className="h-3.5 w-3.5" aria-hidden="true" />
      Block
    </button>
  );
}

export function InstantFeedTopicFollowButton({
  topicId,
  actorId,
  initiallyFollowed,
}: {
  topicId: string;
  actorId?: string | null;
  initiallyFollowed: boolean;
}) {
  const [followed, setFollowed] = useState(initiallyFollowed);
  const [busy, setBusy] = useState(false);

  async function toggleFollow() {
    if (busy) return;
    const previous = followed;
    setFollowed(!previous);
    setBusy(true);
    try {
      const response = await fetch(`/api/feed/topics/${topicId}/follow`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actorId }),
      });
      if (!response.ok) throw new Error("Could not update followed topic");
      const payload = (await response.json()) as {
        item?: { followed?: boolean };
      };
      setFollowed(Boolean(payload.item?.followed));
      // Topic affinity changes the For You ranking buckets, so the existing
      // keyset cursor is no longer valid. Restart from an authoritative head.
      requestFeedReset();
    } catch {
      setFollowed(previous);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggleFollow()}
      disabled={busy}
      aria-pressed={followed}
      className="giq-outline-action min-h-11 px-3 text-[11px]"
    >
      <Tags className="h-3.5 w-3.5" />
      {followed ? "Following" : "Follow topic"}
    </button>
  );
}

export function InstantFeedShareControls({
  postId,
  actorId,
  sourceVisibility,
  initialShareCount,
  initiallyShared,
  disabled,
}: {
  postId: string;
  actorId?: string | null;
  sourceVisibility: string;
  initialShareCount: number;
  initiallyShared: boolean;
  disabled: boolean;
}) {
  const [count, setCount] = useState(initialShareCount);
  const [shared, setShared] = useState(initiallyShared);
  const [busy, setBusy] = useState(false);
  const audiences = allowedShareAudiences(sourceVisibility);

  async function internalShare() {
    if (busy || disabled || shared) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/feed/${postId}/share`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actorId, visibility: sourceVisibility }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setCount((current) => current + 1);
      setShared(true);
      requestFeedRefresh(postId);
    } catch {
      // Keep the control retryable; the API remains the source of truth.
    } finally {
      setBusy(false);
    }
  }

  async function nativeShare() {
    try {
      const url = `${window.location.origin}/feed#post-${postId}`;
      if (navigator.share) {
        await navigator.share({ title: "GreyhoundIQ feed post", url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // User cancellation and clipboard denial require no state change.
    }
  }

  return (
    <div className="flex min-h-11 min-w-0 flex-1 overflow-hidden rounded-lg">
      <button
        type="button"
        onClick={internalShare}
        disabled={busy || disabled || shared || audiences.length === 0}
        className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 px-2 text-[12px] font-semibold text-[hsl(var(--muted-foreground))] transition hover:bg-white/[0.04] hover:text-[hsl(var(--foreground))] disabled:opacity-50"
      >
        <Share2 className="h-3.5 w-3.5" />
        {shared ? "Shared" : "Share"}
        <span className="sr-only">
          , {count} share{count === 1 ? "" : "s"}
        </span>
      </button>
      <button
        type="button"
        onClick={() => void nativeShare()}
        className="min-h-11 border-l border-white/[0.07] px-2 text-[10px] font-semibold text-[hsl(var(--subtle-foreground))] transition hover:bg-white/[0.04] hover:text-[hsl(var(--foreground))]"
        aria-label="Share link"
      >
        Link
      </button>
    </div>
  );
}

export function InstantFeedOwnerControls({
  postId,
  initialBody,
  initialVisibility,
}: {
  postId: string;
  initialBody: string;
  initialVisibility: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function edit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/feed/${postId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body: String(data.get("body") ?? ""),
          visibility: String(data.get("visibility") ?? initialVisibility),
        }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      if (String(data.get("visibility") ?? initialVisibility) !== initialVisibility) {
        requestFeedReset();
      } else {
        requestFeedRefresh(postId);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not edit post");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy || !window.confirm("Delete this post?")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/feed/${postId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await errorMessage(response));
      requestFeedReset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete post");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3">
      <h3 className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-[hsl(var(--foreground))]">
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        Edit post
      </h3>
      <form onSubmit={edit} className="grid gap-2">
        <textarea
          name="body"
          defaultValue={initialBody}
          minLength={2}
          maxLength={5000}
          required
          rows={4}
          className="giq-form-control giq-textarea px-3 py-2 text-[13px]"
        />
        <select
          name="visibility"
          defaultValue={initialVisibility}
          className="giq-form-control px-3 py-2 text-[13px]"
        >
          <option value="public">Public</option>
          <option value="members">Members</option>
          <option value="connections">Connections</option>
          <option value="only_me">Only me</option>
        </select>
        {error && (
          <p role="alert" className="text-[11px] text-red-200">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy}
            className="giq-button giq-button-primary min-h-10 px-3 text-[12px] disabled:opacity-50"
          >
            Save changes
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="giq-outline-action min-h-10 px-3 text-[12px] text-red-200 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </form>
    </section>
  );
}

function requestFeedReset() {
  window.dispatchEvent(new Event("giq:feed-reset"));
}

function requestFeedRefresh(postId?: string, insertIfMissing = false) {
  window.dispatchEvent(
    new CustomEvent("giq:feed-refresh", {
      detail: { postId, insertIfMissing },
    }),
  );
}

function allowedShareAudiences(source: string) {
  const openness: Record<string, number> = {
    only_me: 1,
    connections: 2,
    members: 3,
    public: 4,
  };
  const sourceRank = openness[source] ?? 0;
  return Object.keys(openness).filter((audience) => openness[audience] <= sourceRank);
}

async function errorMessage(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error?.message ?? `Request failed with ${response.status}`;
}
