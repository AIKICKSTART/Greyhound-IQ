"use client";

import { Heart, Loader2, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";

import { InstantFeedCommentForm } from "@/components/instant-feed-controls";
import { ActorMediaImage } from "@/components/actor-media-image";

export type FeedCommentItem = {
  id: string;
  body: string;
  authorProfileId: string;
  editedAt?: Date | string | null;
  author: { displayName: string };
  authorActor?: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    avatarFocalX?: number;
    avatarFocalY?: number;
    avatarZoom?: number;
    avatarRotation?: number;
  } | null;
  replies?: FeedCommentItem[];
  reactions?: Array<{ profileId: string; reactionType: string }>;
  _count?: { reactions: number; replies?: number };
};

export function FeedCommentsPanel({
  postId,
  initialComments,
  totalCount,
  canInteract,
  currentProfileId,
  activeActorId,
}: {
  postId: string;
  initialComments: FeedCommentItem[];
  totalCount: number;
  canInteract: boolean;
  currentProfileId: string | null;
  activeActorId?: string | null;
}) {
  const [comments, setComments] = useState(initialComments);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasMore = hasLoaded
    ? Boolean(nextCursor)
    : totalCount > initialComments.length;

  async function loadComments() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (hasLoaded && nextCursor) params.set("cursor", nextCursor);
      const response = await fetch(
        `/api/feed/${postId}/comments?${params.toString()}`,
        { cache: "no-store", credentials: "same-origin" }
      );
      if (!response.ok) throw new Error("Could not load comments");
      const payload = (await response.json()) as {
        items?: FeedCommentItem[];
        nextCursor?: string | null;
      };
      const incoming = payload.items ?? [];
      setComments((current) => {
        if (!hasLoaded) return incoming;
        const seen = new Set(current.map((comment) => comment.id));
        return [
          ...current,
          ...incoming.filter((comment) => !seen.has(comment.id)),
        ];
      });
      setNextCursor(payload.nextCursor ?? null);
      setHasLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load comments");
    } finally {
      setLoading(false);
    }
  }

  async function showComments() {
    setExpanded(true);
    if (comments.length === 0 && totalCount > 0) await loadComments();
  }

  function updateComment(commentId: string, patch: Partial<FeedCommentItem>) {
    setComments((current) =>
      current.map((comment) => ({
        ...comment,
        ...(comment.id === commentId ? patch : {}),
        replies: comment.replies?.map((reply) =>
          reply.id === commentId ? { ...reply, ...patch } : reply
        ),
      }))
    );
  }

  function removeComment(commentId: string) {
    setComments((current) =>
      current
        .filter((comment) => comment.id !== commentId)
        .map((comment) => ({
          ...comment,
          replies: comment.replies?.filter((reply) => reply.id !== commentId),
        }))
    );
  }

  return (
    <section
      id={`comments-${postId}`}
      className="mt-3 scroll-mt-24"
      aria-label="Comments"
    >
      {!expanded && totalCount > 0 && (
        <button
          type="button"
          onClick={() => void showComments()}
          disabled={loading}
          className="min-h-11 text-[12px] font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          {loading ? "Loading comments..." : `View ${totalCount} comment${totalCount === 1 ? "" : "s"}`}
        </button>
      )}

      {expanded && comments.length > 0 && (
        <div className="space-y-2">
          {comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              postId={postId}
              canInteract={canInteract}
              currentProfileId={currentProfileId}
              activeActorId={activeActorId}
              onUpdate={updateComment}
              onDelete={removeComment}
            />
          ))}
        </div>
      )}

      {expanded && hasMore && (
        <button
          type="button"
          onClick={() => void loadComments()}
          disabled={loading}
          className="giq-button giq-button-glass mt-3 min-h-11 px-4 text-[12px]"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MessageSquare className="h-3.5 w-3.5" />
          )}
          {hasLoaded ? "Load more comments" : `View all ${totalCount} comments`}
        </button>
      )}
      {expanded && comments.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-2 min-h-10 text-[11px] font-semibold text-[hsl(var(--subtle-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          Hide comments
        </button>
      )}
      {error && (
        <p role="status" className="mt-2 text-[11px] text-red-200">
          {error}
        </p>
      )}
    </section>
  );
}

function CommentCard({
  comment,
  postId,
  canInteract,
  currentProfileId,
  activeActorId,
  onUpdate,
  onDelete,
  isReply = false,
}: {
  comment: FeedCommentItem;
  postId: string;
  canInteract: boolean;
  currentProfileId: string | null;
  activeActorId?: string | null;
  onUpdate: (commentId: string, patch: Partial<FeedCommentItem>) => void;
  onDelete: (commentId: string) => void;
  isReply?: boolean;
}) {
  const isMine = comment.authorProfileId === currentProfileId;
  const authorName = comment.authorActor?.displayName ?? comment.author.displayName;

  return (
    <div
      className={`rounded-xl bg-white/[0.035] px-3 py-2.5 ${
        isReply ? "ml-5 border-l-2 border-[hsl(var(--primary)/0.35)] bg-white/[0.025]" : ""
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[12px] font-semibold text-[hsl(var(--foreground))]">
          <span
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-[hsl(var(--primary)/0.15)] text-[10px] font-bold text-[hsl(var(--primary-light))]"
          >
            {comment.authorActor?.avatarUrl ? (
              <ActorMediaImage
                src={comment.authorActor.avatarUrl}
                alt=""
                width={28}
                height={28}
                focalX={comment.authorActor.avatarFocalX}
                focalY={comment.authorActor.avatarFocalY}
                zoom={comment.authorActor.avatarZoom}
                rotation={comment.authorActor.avatarRotation}
              />
            ) : authorName.slice(0, 1).toUpperCase()}
          </span>
          {authorName}
        </p>
        {comment.editedAt && (
          <span className="text-[10px] text-[hsl(var(--subtle-foreground))]">
            Edited
          </span>
        )}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
        {comment.body}
      </p>

      {canInteract && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CommentReactionButton
            commentId={comment.id}
            actorId={activeActorId}
            initialCount={comment._count?.reactions ?? 0}
            initiallyActive={Boolean(comment.reactions?.length)}
          />
          {!isReply && (
            <details>
              <summary className="giq-outline-action min-h-11 cursor-pointer list-none px-3 text-[11px]">
                Reply
              </summary>
              <div className="mt-2 min-w-[260px]">
                <InstantFeedCommentForm
                  postId={postId}
                  actorId={activeActorId}
                  parentCommentId={comment.id}
                  compact
                />
              </div>
            </details>
          )}
          {isMine && (
            <CommentOwnerActions
              comment={comment}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          )}
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              postId={postId}
              canInteract={canInteract}
              currentProfileId={currentProfileId}
              activeActorId={activeActorId}
              onUpdate={onUpdate}
              onDelete={onDelete}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentReactionButton({
  commentId,
  actorId,
  initialCount,
  initiallyActive,
}: {
  commentId: string;
  actorId?: string | null;
  initialCount: number;
  initiallyActive: boolean;
}) {
  const [active, setActive] = useState(initiallyActive);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const previous = { active, count };
    setActive(!active);
    setCount((current) => Math.max(0, current + (active ? -1 : 1)));
    setBusy(true);
    try {
      const response = await fetch(`/api/feed/comments/${commentId}/reaction`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reactionType: "like", actorId }),
      });
      if (!response.ok) throw new Error("Could not react to comment");
      const payload = (await response.json()) as {
        item?: { active?: boolean };
      };
      if (typeof payload.item?.active === "boolean") {
        const serverActive = payload.item.active;
        setActive(serverActive);
        setCount(
          Math.max(
            0,
            previous.count +
              (serverActive ? 1 : 0) -
              (previous.active ? 1 : 0)
          )
        );
      }
    } catch {
      setActive(previous.active);
      setCount(previous.count);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={active}
      className="giq-outline-action min-h-11 px-3 text-[11px]"
    >
      <Heart className={`h-3 w-3 ${active ? "fill-current" : ""}`} />
      {count}
    </button>
  );
}

function CommentOwnerActions({
  comment,
  onUpdate,
  onDelete,
}: {
  comment: FeedCommentItem;
  onUpdate: (commentId: string, patch: Partial<FeedCommentItem>) => void;
  onDelete: (commentId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function edit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const body = String(new FormData(event.currentTarget).get("body") ?? "").trim();
    if (body.length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/feed/comments/${comment.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!response.ok) throw new Error("Could not edit comment");
      onUpdate(comment.id, { body, editedAt: new Date().toISOString() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not edit comment");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/feed/comments/${comment.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Could not delete comment");
      onDelete(comment.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete comment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <details>
        <summary className="giq-outline-action min-h-11 cursor-pointer list-none px-3 text-[11px]">
          <Pencil className="h-3 w-3" />
          Edit
        </summary>
        <form onSubmit={edit} className="mt-2 flex min-w-[260px] gap-2">
          <input
            name="body"
            aria-label="Edit comment"
            defaultValue={comment.body}
            minLength={2}
            maxLength={2000}
            className="giq-form-control min-h-11 min-w-0 flex-1 px-2 text-[12px]"
          />
          <button
            type="submit"
            disabled={busy}
            className="giq-button giq-button-primary min-h-11 px-3 text-[11px]"
          >
            Save
          </button>
        </form>
      </details>
      <button
        type="button"
        onClick={() => void remove()}
        disabled={busy}
        className="giq-outline-action min-h-11 px-3 text-[11px]"
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </button>
      {error && (
        <span role="alert" className="text-[11px] text-red-200">
          {error}
        </span>
      )}
    </>
  );
}
