"use client";

import { FormEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2, Send } from "lucide-react";
import { MediaAttachmentFields } from "@/components/media-attachment-fields";

type FeedTopicOption = {
  id: string;
  name: string;
};

export function InstantFeedPostComposer({
  topics,
}: {
  topics: FeedTopicOption[];
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
        body: JSON.stringify({ topicId, body, mediaIds }),
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
      <MediaAttachmentFields
        key={resetKey}
        mediaContext="feed"
        maxFiles={4}
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

export function InstantFeedCommentForm({ postId }: { postId: string }) {
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
        body: JSON.stringify({ body }),
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
          placeholder="Add a comment"
        />
        <button
          type="submit"
          disabled={busy}
          className="giq-button giq-button-glass giq-icon-button disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Add comment"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-200">{error}</p>}
    </form>
  );
}

export function InstantFeedReactionButton({
  postId,
  initialCount,
  initiallyLiked,
  disabled,
}: {
  postId: string;
  initialCount: number;
  initiallyLiked: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initiallyLiked);
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="giq-outline-action min-h-9 px-3 text-[12px] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Heart
        className={`h-3.5 w-3.5 ${liked ? "fill-current text-[hsl(var(--secondary))]" : ""}`}
      />
      {count}
    </button>
  );
}

async function errorMessage(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.error?.message ?? `Request failed with ${response.status}`;
}
