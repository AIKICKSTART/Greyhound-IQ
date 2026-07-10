"use client";

import { FormEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  Heart,
  Loader2,
  Pencil,
  Send,
  Share2,
  Tags,
  Trash2,
  VolumeX,
} from "lucide-react";
import { MediaAttachmentFields } from "@/components/media-attachment-fields";

type FeedTopicOption = {
  id: string;
  name: string;
};

export function InstantFeedPostComposer({
  topics,
  pageId = null,
  identityLabel,
}: {
  topics: FeedTopicOption[];
  // Owned CustomPage id to post as (server re-verifies ownership).
  pageId?: string | null;
  identityLabel?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const busy = submitting || refreshing;

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

      formRef.current?.reset();
      setResetKey((current) => current + 1);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post to feed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      {identityLabel && (
        <p className="text-[12px] font-medium text-[hsl(var(--muted-foreground))]">
          Posting as{" "}
          <span className="font-semibold text-[hsl(var(--primary-light))]">
            {identityLabel}
          </span>
        </p>
      )}
      {topics.length > 0 && (
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
      )}
      <textarea
        name="body"
        required
        minLength={2}
        maxLength={5000}
        rows={5}
        disabled={busy}
        className="giq-form-control giq-textarea px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
        placeholder="Share a race note, kennel update, question, or marketplace context."
      />
      <label className="grid gap-1 text-[12px] text-[hsl(var(--muted-foreground))]">
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
      <MediaAttachmentFields
        key={resetKey}
        mediaContext="feed"
        maxFiles={10}
        compact
      />
      {error && (
        <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-100">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="giq-button giq-button-primary giq-submit-stack px-4 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
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
    </form>
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
      {error && <p className="text-[11px] text-red-200">{error}</p>}
    </form>
  );
}

export function InstantFeedReactionButton({
  postId,
  initialCount,
  initiallyLiked,
  disabled,
  actorId,
}: {
  postId: string;
  initialCount: number;
  initiallyLiked: boolean;
  disabled: boolean;
  actorId?: string | null;
}) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initiallyLiked);
  const [reactionType, setReactionType] = useState("like");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const busy = submitting || refreshing;

  async function onClick() {
    if (disabled || busy) return;

    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((current) => current + (nextLiked ? 1 : -1));
    setSubmitting(true);
    try {
      const response = await fetch(`/api/feed/${postId}/reaction`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reactionType, actorId }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      startTransition(() => router.refresh());
    } catch {
      setLiked(liked);
      setCount(count);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-11 overflow-hidden rounded-lg border border-white/[0.08]">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || busy}
        className="inline-flex min-h-11 items-center gap-2 px-3 text-[12px] disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`${liked ? "Remove" : "Add"} ${reactionType} reaction`}
      >
        <Heart
          className={`h-3.5 w-3.5 ${liked ? "fill-current text-[hsl(var(--secondary))]" : ""}`}
        />
        {count}
      </button>
      <select
        aria-label="Reaction type"
        value={reactionType}
        onChange={(event) => {
          setReactionType(event.target.value);
          setLiked(event.target.value === "like" && initiallyLiked);
        }}
        disabled={disabled || busy}
        className="border-l border-white/[0.08] bg-transparent px-2 text-[11px] text-[hsl(var(--muted-foreground))]"
      >
        <option value="like">Like</option>
        <option value="love">Love</option>
        <option value="celebrate">Celebrate</option>
        <option value="insightful">Insightful</option>
        <option value="support">Support</option>
      </select>
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
      className="giq-outline-action min-h-11 px-3 text-[12px] disabled:opacity-50"
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
  const router = useRouter();
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
      router.refresh();
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
    <div className="flex min-h-11 overflow-hidden rounded-lg border border-white/[0.08]">
      <button
        type="button"
        onClick={internalShare}
        disabled={busy || disabled || shared || audiences.length === 0}
        className="inline-flex min-h-11 items-center gap-2 px-3 text-[12px] disabled:opacity-50"
      >
        <Share2 className="h-3.5 w-3.5" />
        {shared ? "Shared" : count}
      </button>
      <button
        type="button"
        onClick={() => void nativeShare()}
        className="border-l border-white/[0.08] px-2 text-[11px] text-[hsl(var(--muted-foreground))]"
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
      router.refresh();
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
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete post");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="mb-3 rounded-lg border border-white/[0.06] p-2">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[12px] text-[hsl(var(--muted-foreground))]">
        <Pencil className="h-3.5 w-3.5" />
        Manage post
      </summary>
      <form onSubmit={edit} className="mt-2 grid gap-2">
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
        {error && <p className="text-[11px] text-red-200">{error}</p>}
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
    </details>
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
