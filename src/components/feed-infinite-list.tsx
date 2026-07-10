"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { FeedPostCard, type FeedPostRow } from "@/components/feed-post-card";
import { getBrowserRealtimeClient } from "@/components/realtime-refresh";
import { mergeFeedItems } from "@/lib/feed-client-state";
import type { FeedMode } from "@/lib/feed-pagination";

export function FeedInfiniteList({
  initialPosts,
  initialCursor,
  mode,
  actorId,
  canInteract,
  currentProfileId,
  activeActorId,
  signedIn,
  pageAvatarUrls = {},
}: {
  initialPosts: FeedPostRow[];
  initialCursor: string | null;
  mode: FeedMode;
  actorId: string | null;
  canInteract: boolean;
  currentProfileId: string | null;
  activeActorId?: string | null;
  signedIn: boolean;
  pageAvatarUrls?: Record<string, string | null>;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ mode, cursor, limit: "20" });
      if (actorId) params.set("actorId", actorId);
      const response = await fetch(`/api/feed?${params.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not load more posts");
      const page = (await response.json()) as {
        items?: unknown[];
        nextCursor?: string | null;
      };
      const items = (page.items ?? []).map(hydrateFeedPost);
      setPosts((current) => {
        const seen = new Set(current.map(feedEntryKey));
        return [...current, ...items.filter((post) => !seen.has(feedEntryKey(post)))];
      });
      setCursor(page.nextCursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more posts");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [actorId, cursor, mode]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  useEffect(() => {
    const client = getBrowserRealtimeClient();
    if (!client) return;
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const refreshHead = (message?: unknown) => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(async () => {
        const changedPostId = realtimePostId(message);
        const params = new URLSearchParams({ mode, limit: "20" });
        if (actorId) params.set("actorId", actorId);
        const postParams = new URLSearchParams();
        if (actorId) postParams.set("actorId", actorId);
        const [response, changedResponse] = await Promise.all([
          fetch(`/api/feed?${params.toString()}`, {
            credentials: "same-origin",
            cache: "no-store",
          }).catch(() => null),
          changedPostId
            ? fetch(
                `/api/feed/${encodeURIComponent(changedPostId)}${
                  postParams.size ? `?${postParams.toString()}` : ""
                }`,
                { credentials: "same-origin", cache: "no-store" }
              ).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (cancelled || !response?.ok) return;
        const page = (await response.json()) as { items?: unknown[] };
        const head = (page.items ?? []).map(hydrateFeedPost);
        const changedBody = changedResponse?.ok
          ? ((await changedResponse.json()) as { item?: unknown })
          : null;
        const changedPost = changedBody?.item
          ? hydrateFeedPost(changedBody.item)
          : changedResponse?.status === 404
            ? null
            : undefined;
        setPosts((current) =>
          mergeFeedItems(current, head, changedPostId, changedPost)
        );
      }, 150);
    };
    const channel = client
      .channel("feed:public")
      .on("broadcast", { event: "post_created" }, refreshHead)
      .on("broadcast", { event: "post_updated" }, refreshHead)
      .on("broadcast", { event: "comment_created" }, refreshHead)
      .on("broadcast", { event: "comment_updated" }, refreshHead)
      .on("broadcast", { event: "reaction_updated" }, refreshHead)
      .subscribe();
    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      void client.removeChannel(channel);
    };
  }, [actorId, mode]);

  return (
    <div className="space-y-4">
      {posts.length === 0 && (
        <div className="giq-empty-state p-12 text-center">
          <p className="text-[14px] text-[hsl(var(--muted-foreground))]">
            No feed posts yet.
          </p>
        </div>
      )}
      {posts.map((post) => (
        <FeedPostCard
          key={feedEntryKey(post)}
          post={post}
          canInteract={canInteract}
          currentProfileId={currentProfileId}
          activeActorId={activeActorId}
          signedIn={signedIn}
          pageAvatarUrl={
            post.authorPage ? pageAvatarUrls[post.authorPage.id] ?? null : null
          }
        />
      ))}
      <div ref={sentinel} className="min-h-1" aria-hidden={!cursor} />
      <p
        role="status"
        aria-live="polite"
        className="min-h-5 text-center text-[12px] text-[hsl(var(--muted-foreground))]"
      >
        {loading
          ? "Loading more posts..."
          : error
            ? error
            : cursor
              ? "Scroll for more"
              : posts.length
                ? "You are all caught up"
                : ""}
      </p>
      {error && cursor && (
        <button
          type="button"
          onClick={() => void loadMore()}
          className="giq-button giq-button-glass mx-auto min-h-10 px-4 text-[12px]"
        >
          Retry
        </button>
      )}
    </div>
  );
}

function hydrateFeedPost(raw: unknown): FeedPostRow {
  const post = raw as FeedPostRow & Record<string, unknown>;
  return {
    ...post,
    createdAt: hydrateDate(post.createdAt),
    updatedAt: hydrateDate(post.updatedAt),
    pinnedAt: post.pinnedAt ? hydrateDate(post.pinnedAt) : null,
    editedAt: post.editedAt ? hydrateDate(post.editedAt) : null,
    deletedAt: post.deletedAt ? hydrateDate(post.deletedAt) : null,
    publishedAt: post.publishedAt ? hydrateDate(post.publishedAt) : null,
    reshare: post.reshare
      ? { ...post.reshare, createdAt: hydrateDate(post.reshare.createdAt) }
      : null,
    comments: post.comments.map((comment) => ({
      ...comment,
      createdAt: hydrateDate(comment.createdAt),
      updatedAt: hydrateDate(comment.updatedAt),
      editedAt: comment.editedAt ? hydrateDate(comment.editedAt) : null,
      deletedAt: comment.deletedAt ? hydrateDate(comment.deletedAt) : null,
    })),
  };
}

function feedEntryKey(post: FeedPostRow) {
  return post.feedEntryId ?? `post:${post.id}`;
}

function realtimePostId(message: unknown) {
  if (!message || typeof message !== "object") return undefined;
  const payload = (message as { payload?: unknown }).payload;
  if (!payload || typeof payload !== "object") return undefined;
  const postId = (payload as { postId?: unknown }).postId;
  return typeof postId === "string" && postId.length > 0 ? postId : undefined;
}

function hydrateDate(value: unknown) {
  return value instanceof Date ? value : new Date(String(value));
}
