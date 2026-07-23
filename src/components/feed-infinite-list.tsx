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
  const [paginationStarted, setPaginationStarted] = useState(false);
  const [securityResetPending, setSecurityResetPending] = useState(false);
  const [clientAuthoritative, setClientAuthoritative] = useState(false);
  const [receivedInitialPosts, setReceivedInitialPosts] = useState(initialPosts);
  const sentinel = useRef<HTMLDivElement>(null);
  const paginationAbortRef = useRef<AbortController | null>(null);
  const resetPendingRef = useRef(false);
  const feedSessionEpochRef = useRef(0);

  if (receivedInitialPosts !== initialPosts) {
    setReceivedInitialPosts(initialPosts);
    if (!securityResetPending && !clientAuthoritative) {
      setPosts((current) => mergeFeedItems(current, initialPosts));
      if (!paginationStarted) setCursor(initialCursor);
    }
  }

  useEffect(
    () => () => {
      paginationAbortRef.current?.abort();
      paginationAbortRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const resetFeed = () => {
      feedSessionEpochRef.current += 1;
      const sessionEpoch = feedSessionEpochRef.current;
      resetPendingRef.current = true;
      paginationAbortRef.current?.abort();
      const controller = new AbortController();
      paginationAbortRef.current = controller;
      setPaginationStarted(false);
      setSecurityResetPending(true);
      setClientAuthoritative(true);
      setPosts([]);
      setCursor(null);
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ mode, limit: "20" });
      if (actorId) params.set("actorId", actorId);
      void fetch(`/api/feed?${params.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Could not refresh feed");
          const page = (await response.json()) as {
            items?: unknown[];
            nextCursor?: string | null;
          };
          const items = (page.items ?? []).map(hydrateFeedPost);
          if (
            controller.signal.aborted ||
            paginationAbortRef.current !== controller ||
            feedSessionEpochRef.current !== sessionEpoch
          ) return;
          setPosts(items);
          setCursor(page.nextCursor ?? null);
          setPaginationStarted(false);
          setSecurityResetPending(false);
          resetPendingRef.current = false;
        })
        .catch((err) => {
          if (
            !controller.signal.aborted &&
            paginationAbortRef.current === controller &&
            feedSessionEpochRef.current === sessionEpoch
          ) {
            setError(
              err instanceof Error ? err.message : "Could not refresh feed",
            );
          }
        })
        .finally(() => {
          if (paginationAbortRef.current === controller) {
            paginationAbortRef.current = null;
            setLoading(false);
          }
        });
    };
    window.addEventListener("giq:feed-reset", resetFeed);
    return () => window.removeEventListener("giq:feed-reset", resetFeed);
  }, [actorId, mode]);

  const loadMore = useCallback(async () => {
    if (!cursor || resetPendingRef.current || paginationAbortRef.current) return;
    const controller = new AbortController();
    const sessionEpoch = feedSessionEpochRef.current;
    paginationAbortRef.current = controller;
    setPaginationStarted(true);
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ mode, cursor, limit: "20" });
      if (actorId) params.set("actorId", actorId);
      const response = await fetch(`/api/feed?${params.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Could not load more posts");
      const page = (await response.json()) as {
        items?: unknown[];
        nextCursor?: string | null;
      };
      const items = (page.items ?? []).map(hydrateFeedPost);
      if (
        controller.signal.aborted ||
        paginationAbortRef.current !== controller ||
        feedSessionEpochRef.current !== sessionEpoch
      ) return;
      setPosts((current) => {
        const seen = new Set(current.map(feedEntryKey));
        return [...current, ...items.filter((post) => !seen.has(feedEntryKey(post)))];
      });
      setCursor(page.nextCursor ?? null);
    } catch (err) {
      if (
        !controller.signal.aborted &&
        paginationAbortRef.current === controller &&
        feedSessionEpochRef.current === sessionEpoch
      ) {
        setError(err instanceof Error ? err.message : "Could not load more posts");
      }
    } finally {
      if (paginationAbortRef.current === controller) {
        paginationAbortRef.current = null;
        setLoading(false);
      }
    }
  }, [actorId, cursor, mode]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor) return;
    const scrollSurface = node.closest<HTMLElement>("[data-feed-scroll]");
    const desktop = window.matchMedia("(min-width: 64rem)");
    let removePaginationListener = () => {};

    const bindPaginationListener = () => {
      removePaginationListener();

      if (desktop.matches && scrollSurface) {
        const onScroll = () => {
          const remaining =
            scrollSurface.scrollHeight -
            scrollSurface.scrollTop -
            scrollSurface.clientHeight;
          if (remaining <= 500) void loadMore();
        };
        scrollSurface.addEventListener("scroll", onScroll, { passive: true });
        removePaginationListener = () =>
          scrollSurface.removeEventListener("scroll", onScroll);
        onScroll();
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) void loadMore();
        },
        { rootMargin: "400px 0px" },
      );
      observer.observe(node);
      removePaginationListener = () => observer.disconnect();
    };

    bindPaginationListener();
    desktop.addEventListener("change", bindPaginationListener);
    return () => {
      desktop.removeEventListener("change", bindPaginationListener);
      removePaginationListener();
    };
  }, [cursor, loadMore]);

  useEffect(() => {
    const client = getBrowserRealtimeClient();
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let refreshRunning = false;
    let refreshAbort: AbortController | null = null;
    let headRefreshRequested = false;
    let headRetryCount = 0;
    let fullRefreshDirty = false;
    const pendingPostIds = new Map<
      string,
      { attempts: number; insertIfMissing: boolean }
    >();
    const maxPendingPostIds = 100;
    const maxAggressiveRetries = 4;

    function scheduleRefresh(delay = 150) {
      if (cancelled || refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void runRefresh();
      }, delay);
    }

    function nextRetryDelay() {
      const maxPostRetry = Math.max(
        0,
        ...[...pendingPostIds.values()].map((item) => item.attempts),
      );
      const attempts = Math.max(headRetryCount, maxPostRetry);
      if (attempts > maxAggressiveRetries) return 60_000;
      return Math.min(5_000, 250 * 2 ** attempts);
    }

    const runRefresh = async () => {
      if (cancelled || refreshRunning) return;
      refreshRunning = true;
      try {
        while (
          !cancelled &&
          (headRefreshRequested || pendingPostIds.size > 0)
        ) {
          headRefreshRequested = false;
          const changedPostIds = [...pendingPostIds.keys()].slice(0, 20);
          const controller = new AbortController();
          const sessionEpoch = feedSessionEpochRef.current;
          refreshAbort = controller;
          const params = new URLSearchParams({ mode, limit: "20" });
          if (actorId) params.set("actorId", actorId);
          const postParams = new URLSearchParams();
          if (actorId) postParams.set("actorId", actorId);
          const [response, changedResponses] = await Promise.all([
            fetch(`/api/feed?${params.toString()}`, {
              credentials: "same-origin",
              cache: "no-store",
              signal: controller.signal,
            }).catch(() => null),
            Promise.all(
              changedPostIds.map((postId) =>
                fetch(
                  `/api/feed/${encodeURIComponent(postId)}${
                    postParams.size ? `?${postParams.toString()}` : ""
                  }`,
                  {
                    credentials: "same-origin",
                    cache: "no-store",
                    signal: controller.signal,
                  },
                ).catch(() => null),
              ),
            ),
          ]);
          if (
            cancelled ||
            controller.signal.aborted ||
            feedSessionEpochRef.current !== sessionEpoch
          ) return;
          let head: FeedPostRow[] | null = null;
          let headCursor: string | null = null;
          if (response?.ok) {
            const headBody = (await response.json()) as {
              items?: unknown[];
              nextCursor?: string | null;
            };
            head = (headBody.items ?? []).map(hydrateFeedPost);
            headCursor = headBody.nextCursor ?? null;
            headRetryCount = 0;
          } else {
            headRefreshRequested = true;
            headRetryCount += 1;
          }
          const changes = await Promise.all(
            changedResponses.map(async (changedResponse, index) => {
              const id = changedPostIds[index];
              const pending = pendingPostIds.get(id);
              if (
                changedResponse?.status === 404 ||
                changedResponse?.status === 410
              ) {
                return {
                  id,
                  item: null,
                  insertIfMissing: false,
                  resolved: true,
                };
              }
              if (!changedResponse?.ok) {
                return {
                  id,
                  insertIfMissing: pending?.insertIfMissing ?? false,
                  resolved: false,
                };
              }
              const body = (await changedResponse.json()) as { item?: unknown };
              return body.item
                ? {
                    id,
                    item: hydrateFeedPost(body.item),
                    insertIfMissing: pending?.insertIfMissing ?? false,
                    resolved: true,
                  }
                : {
                    id,
                    insertIfMissing: pending?.insertIfMissing ?? false,
                    resolved: false,
                  };
            }),
          );
          if (
            cancelled ||
            controller.signal.aborted ||
            feedSessionEpochRef.current !== sessionEpoch
          ) return;
          const resolvedChanges = changes.filter(
            (change): change is typeof change & { resolved: true } =>
              change.resolved,
          );
          for (const change of changes) {
            if (change.resolved) {
              pendingPostIds.delete(change.id);
            } else {
              const pending = pendingPostIds.get(change.id);
              pendingPostIds.set(
                change.id,
                {
                  attempts: (pending?.attempts ?? 0) + 1,
                  insertIfMissing:
                    pending?.insertIfMissing ?? change.insertIfMissing,
                },
              );
            }
          }
          if (head && fullRefreshDirty) {
            fullRefreshDirty = false;
            pendingPostIds.clear();
            resetPendingRef.current = false;
            setPosts(head);
            setCursor(headCursor);
            setPaginationStarted(false);
            setSecurityResetPending(false);
            setLoading(false);
          } else if (head || resolvedChanges.length > 0) {
            setPosts((current) => {
              const reconciled = resolvedChanges.reduce(
                (items, change) =>
                  mergeFeedItems(
                    items,
                    change.insertIfMissing && change.item ? [change.item] : [],
                    change.id,
                    change.item,
                  ),
                current,
              );
              return head ? mergeFeedItems(reconciled, head) : reconciled;
            });
          }
          if (headRefreshRequested || changes.some((change) => !change.resolved)) {
            break;
          }
        }
      } catch {
        if (!cancelled) {
          headRefreshRequested = true;
          headRetryCount += 1;
        }
      } finally {
        refreshRunning = false;
        refreshAbort = null;
        if (
          !cancelled &&
          (headRefreshRequested || pendingPostIds.size > 0)
        ) {
          scheduleRefresh(nextRetryDelay());
        }
      }
    };

    const refreshHead = (message?: unknown, insertIfMissing = false) => {
      if (cancelled) return;
      headRefreshRequested = true;
      const changedPostId = realtimePostId(message);
      if (changedPostId) {
        const pending = pendingPostIds.get(changedPostId);
        if (pending) {
          pending.insertIfMissing ||= insertIfMissing;
        } else if (pendingPostIds.size < maxPendingPostIds) {
          pendingPostIds.set(changedPostId, {
            attempts: 0,
            insertIfMissing,
          });
        } else {
          feedSessionEpochRef.current += 1;
          fullRefreshDirty = true;
          pendingPostIds.clear();
          refreshAbort?.abort();
          paginationAbortRef.current?.abort();
          paginationAbortRef.current = null;
          resetPendingRef.current = true;
          setPosts([]);
          setCursor(null);
          setPaginationStarted(false);
          setSecurityResetPending(true);
          setClientAuthoritative(true);
          setLoading(true);
        }
      }
      scheduleRefresh();
    };
    const refreshFromClientMutation = (event: Event) => {
      const detail =
        event instanceof CustomEvent && event.detail && typeof event.detail === "object"
          ? (event.detail as {
              postId?: unknown;
              insertIfMissing?: unknown;
            })
          : null;
      const postId =
        typeof detail?.postId === "string" && detail.postId.length > 0
          ? detail.postId
          : undefined;
      refreshHead(
        postId ? { payload: { postId } } : undefined,
        detail?.insertIfMissing === true,
      );
    };
    const resetRealtime = () => {
      refreshAbort?.abort();
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = null;
      headRefreshRequested = false;
      headRetryCount = 0;
      fullRefreshDirty = false;
      pendingPostIds.clear();
    };
    const resumeRealtime = () => {
      if (
        cancelled ||
        !navigator.onLine ||
        document.visibilityState !== "visible" ||
        (!headRefreshRequested && pendingPostIds.size === 0)
      ) return;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = null;
      scheduleRefresh(0);
    };
    const channel = client
      ? client
          .channel("feed:public")
          .on("broadcast", { event: "post_created" }, (message) =>
            refreshHead(message, true),
          )
          .on("broadcast", { event: "post_updated" }, refreshHead)
          .on("broadcast", { event: "comment_created" }, refreshHead)
          .on("broadcast", { event: "comment_updated" }, refreshHead)
          .on("broadcast", { event: "reaction_updated" }, refreshHead)
          .subscribe()
      : null;
    window.addEventListener("giq:feed-reset", resetRealtime);
    window.addEventListener("giq:feed-refresh", refreshFromClientMutation);
    window.addEventListener("online", resumeRealtime);
    document.addEventListener("visibilitychange", resumeRealtime);
    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshAbort?.abort();
      window.removeEventListener("giq:feed-reset", resetRealtime);
      window.removeEventListener("giq:feed-refresh", refreshFromClientMutation);
      window.removeEventListener("online", resumeRealtime);
      document.removeEventListener("visibilitychange", resumeRealtime);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [actorId, mode]);

  return (
    <div className="space-y-4">
      {posts.length === 0 && !loading && (
        <div className="giq-empty-state p-12 text-center">
          <p className="text-[14px] text-[hsl(var(--muted-foreground))]">
            {mode === "public"
              ? "No public posts yet."
              : "No posts from you or your accepted friends yet."}
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
      {error && (cursor || securityResetPending) && (
        <button
          type="button"
          onClick={() => {
            if (securityResetPending) {
              window.dispatchEvent(new Event("giq:feed-reset"));
            } else {
              void loadMore();
            }
          }}
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
