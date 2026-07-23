"use client";

import NextImage from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  Check,
  ChevronLeft,
  ExternalLink,
  Flag,
  Loader2,
  Maximize2,
  MessageSquare,
  Minus,
  Minimize2,
  MoreHorizontal,
  Paperclip,
  Phone,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ThumbsUp,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";

import {
  deleteConversationMessage,
  reportConversationMessage,
  respondToFriendRequestAction,
  toggleMessageReaction,
} from "@/app/actions";
import { AddFriendSearch } from "@/components/hub/add-friend-search";
import { MediaAttachmentFields } from "@/components/media-attachment-fields";
import { ProcessedVideo } from "@/components/processed-video";
import {
  ensureBrowserRealtimeAuthorization,
  getBrowserRealtimeClient,
} from "@/components/realtime-refresh";
import {
  dockReducer,
  minimizedWindowIds,
  openWindowIds,
  type DockWindow,
} from "@/components/hub/hub-chat-window-state";
import type { MessengerLayout } from "@/lib/messenger-layout";

export type HubDockConversation = {
  id: string;
  otherName: string;
  otherAvatarUrl: string | null;
  otherProfileId: string;
  preview: string;
  unread: number;
  attachmentCount?: number;
  realtimeChannel: string | null;
  personToPerson: boolean;
};

export type HubDockFriend = {
  friendshipId: string;
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  conversationId: string | null;
};

export type HubDockFriendRequest = {
  friendshipId: string;
  direction: "incoming" | "outgoing";
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  kennelName: string | null;
  state: string | null;
};

type QuickMessage = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  media?: Array<{
    mediaId: string;
    media?: {
      id: string;
      mimeType?: string | null;
      originalName?: string | null;
      widthPx?: number | null;
      heightPx?: number | null;
      scanStatus?: string | null;
      processingStatus?: string | null;
      playbackPath?: string | null;
      posterPath?: string | null;
      hlsPath?: string | null;
      altText?: string | null;
      captionPath?: string | null;
    };
  }>;
  pending?: boolean;
};

const OPEN_CHAT_EVENT = "giq:open-chat";
export const TOGGLE_CHAT_DOCK_EVENT = "giq:toggle-chat-dock";
const CHAT_TIME_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Australia/Sydney",
  timeZoneName: "short",
});

function actionFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [name, value] of Object.entries(fields)) fd.set(name, value);
  return fd;
}

export function HubConversationDock({
  conversations,
  friends = [],
  requests = [],
  selfProfileId,
  canStartCall,
  layout = "dual",
  mode = "list",
  externalLauncher = false,
}: {
  conversations: HubDockConversation[];
  friends?: HubDockFriend[];
  requests?: HubDockFriendRequest[];
  selfProfileId: string;
  canStartCall: boolean;
  layout?: MessengerLayout;
  mode?: "list" | "floating";
  externalLauncher?: boolean;
}) {
  const [windows, dispatch] = useReducer(dockReducer, [] as DockWindow[]);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [launcherTab, setLauncherTab] = useState<
    "inbox" | "unread" | "friends" | "requests"
  >("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const launcherButtonRef = useRef<HTMLButtonElement>(null);

  const openConversation = useCallback(
    (id: string) => {
      dispatch({ type: "open", id });
      const isDesktop = !window.matchMedia("(max-width: 1023px)").matches;
      setLauncherOpen(isDesktop && layout !== "compact");
    },
    [layout],
  );

  useEffect(() => {
    if (mode !== "floating") return;
    const handleOpenChat = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) openConversation(id);
    };
    const handleToggleDock = () => setLauncherOpen((current) => !current);
    window.addEventListener(OPEN_CHAT_EVENT, handleOpenChat);
    window.addEventListener(TOGGLE_CHAT_DOCK_EVENT, handleToggleDock);
    return () => {
      window.removeEventListener(OPEN_CHAT_EVENT, handleOpenChat);
      window.removeEventListener(TOGGLE_CHAT_DOCK_EVENT, handleToggleDock);
    };
  }, [mode, openConversation]);

  if (mode === "list") {
    return (
      <ul className="giq-social-chat-list space-y-1">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent(OPEN_CHAT_EVENT, {
                    detail: { id: conversation.id },
                  }),
                )
              }
              className="giq-social-messenger-row hidden min-h-12 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04] lg:flex"
              aria-label={`Open quick chat with ${conversation.otherName}`}
            >
              <ConversationSummary conversation={conversation} />
            </button>
            <Link
              href={`/pulse/${conversation.id}`}
              className="giq-social-messenger-row flex min-h-12 items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04] lg:hidden"
            >
              <ConversationSummary conversation={conversation} />
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  const unreadTotal = conversations.reduce(
    (total, conversation) => total + conversation.unread,
    0,
  );
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("en-AU");
  const launcherConversations = conversations.filter((conversation) => {
    if (launcherTab === "unread" && conversation.unread === 0) return false;
    if (!normalizedQuery) return true;
    return `${conversation.otherName} ${conversation.preview}`
      .toLocaleLowerCase("en-AU")
      .includes(normalizedQuery);
  });
  const incomingRequests = requests.filter(
    (request) => request.direction === "incoming",
  );
  const outgoingRequests = requests.filter(
    (request) => request.direction === "outgoing",
  );
  // Exclude self, existing friends, and anyone with a pending request from the
  // inline member search so the find -> add loop never offers a duplicate.
  const friendExcludeIds = [
    selfProfileId,
    ...friends.map((friend) => friend.profileId),
    ...requests.map((request) => request.profileId),
  ];
  const openIds = openWindowIds(windows);
  const visibleOpenIds = layout === "dual" ? openIds : openIds.slice(-1);

  return (
    <div
      className={`giq-messenger-dock fixed right-3 z-[70] flex items-end gap-3 sm:right-4 ${
        externalLauncher
          ? "bottom-[calc(92px+env(safe-area-inset-bottom))] lg:bottom-[96px]"
          : "bottom-4"
      }`}
      data-layout={layout}
      data-launcher-open={launcherOpen ? "true" : "false"}
      data-has-open-window={visibleOpenIds.length > 0 ? "true" : "false"}
    >
      {visibleOpenIds.map((id, index, ids) => {
        const conversation = conversations.find((item) => item.id === id);
        if (!conversation) return null;
        // Desktop docks multiple chat windows side by side; mobile has room for
        // one, so only the most-recently-opened stays expanded (the rest remain
        // reachable as minimised bubbles).
        return (
          <div
            key={id}
            className={`giq-messenger-window-slot pointer-events-auto ${
              index < ids.length - 1 ? "hidden lg:block" : ""
            }`}
          >
            <QuickChatWindow
              conversation={conversation}
              selfProfileId={selfProfileId}
              canStartCall={canStartCall}
              onMinimize={() => dispatch({ type: "minimize", id })}
              onClose={() => {
                dispatch({ type: "close", id });
                if (window.matchMedia("(max-width: 1023px)").matches) {
                  setLauncherOpen(true);
                  window.requestAnimationFrame(() => {
                    const conversationButton = document.getElementById(
                      `pulse-conversation-${id}`,
                    );
                    (conversationButton ?? launcherButtonRef.current)?.focus();
                  });
                }
              }}
            />
          </div>
        );
      })}

      {minimizedWindowIds(windows).length > 0 && (
        <div className="giq-messenger-minimized-rail pointer-events-auto flex flex-col-reverse items-center gap-2">
          {minimizedWindowIds(windows).map((id) => {
            const conversation = conversations.find((item) => item.id === id);
            if (!conversation) return null;
            return (
              <MinimizedChatBubble
                key={id}
                conversation={conversation}
                onRestore={() => openConversation(id)}
                onClose={() => dispatch({ type: "close", id })}
              />
            );
          })}
        </div>
      )}

      <div
        className="giq-messenger-launcher-slot pointer-events-auto relative flex flex-col items-end"
        data-open={launcherOpen ? "true" : "false"}
      >
        <section
          id="pulse-conversation-launcher"
          aria-label="Pulse conversations"
          aria-hidden={!launcherOpen}
          inert={!launcherOpen}
          data-open={launcherOpen ? "true" : "false"}
          className={`giq-messenger-launcher absolute right-0 flex max-h-[min(610px,calc(100dvh-120px))] w-[min(350px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[hsl(var(--surface-1))] shadow-2xl backdrop-blur-xl ${
            externalLauncher ? "bottom-0" : "bottom-[calc(100%+0.75rem)]"
          }`}
        >
          <header className="giq-messenger-launcher-header flex min-h-16 items-center gap-2 border-b border-white/[0.08] px-3">
            <MessageSquare
              className="h-4 w-4 text-[hsl(var(--primary-bright))]"
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold text-[hsl(var(--foreground))]">
                Pulse
              </span>
              <span className="block text-[10px] text-[hsl(var(--subtle-foreground))]">
                {unreadTotal} unread message{unreadTotal === 1 ? "" : "s"}
              </span>
            </span>
            <Link
              href="/pulse"
              className="grid min-h-11 w-11 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-white/[0.05]"
              aria-label="Open full Pulse inbox"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => setLauncherOpen(false)}
              className="grid min-h-11 w-11 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-white/[0.05]"
              aria-label="Close Pulse conversations"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          <div className="p-3 pb-2">
            <label className="giq-messenger-search flex min-h-11 items-center gap-2 rounded-xl border border-white/[0.1] bg-[hsl(var(--surface-2)/0.72)] px-3">
              <Search
                className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--subtle-foreground))]"
                aria-hidden="true"
              />
              <span className="sr-only">Search conversations</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search conversations"
                className="min-w-0 flex-1 rounded-md bg-transparent text-[12px] text-[hsl(var(--foreground))] outline-none placeholder:text-[hsl(var(--subtle-foreground))] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--primary-light)/0.55)]"
              />
            </label>
          </div>

          <nav
            aria-label="Pulse inbox filters"
            className="flex items-center gap-1 px-3 pb-2"
          >
            <button
              type="button"
              onClick={() => setLauncherTab("inbox")}
              aria-pressed={launcherTab === "inbox"}
              className="giq-messenger-filter min-h-9 rounded-full px-3 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]"
            >
              Inbox
            </button>
            <button
              type="button"
              onClick={() => setLauncherTab("unread")}
              aria-pressed={launcherTab === "unread"}
              className="giq-messenger-filter min-h-9 rounded-full px-3 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]"
            >
              Unread
            </button>
            <button
              type="button"
              onClick={() => setLauncherTab("friends")}
              aria-pressed={launcherTab === "friends"}
              className="giq-messenger-filter inline-flex min-h-9 items-center rounded-full px-3 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]"
            >
              Friends
            </button>
            <button
              type="button"
              onClick={() => setLauncherTab("requests")}
              aria-pressed={launcherTab === "requests"}
              className="giq-messenger-filter inline-flex min-h-9 items-center rounded-full px-3 text-[11px] font-semibold text-[hsl(var(--muted-foreground))]"
            >
              Requests
              {incomingRequests.length > 0 ? (
                <span className="ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-[hsl(var(--primary-bright))] px-1 text-[9px] leading-4 text-[hsl(var(--primary-foreground))]">
                  {incomingRequests.length}
                </span>
              ) : null}
            </button>
          </nav>

          <div className="giq-messenger-conversation-list min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {launcherTab === "friends" ? (
              <div className="space-y-3 px-0.5 pb-1">
                <AddFriendSearch excludeProfileIds={friendExcludeIds} />
                {friends.length > 0 ? (
                <ul className="space-y-1">
                  {friends.map((friend) => (
                    <li key={friend.friendshipId}>
                      {friend.conversationId ? (
                        <button
                          id={`pulse-conversation-${friend.conversationId}`}
                          type="button"
                          onClick={() =>
                            openConversation(friend.conversationId!)
                          }
                          className="giq-social-messenger-row flex min-h-[58px] w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04]"
                        >
                          <LauncherProfileSummary
                            name={friend.displayName}
                            avatarUrl={friend.avatarUrl}
                            detail="Open conversation"
                          />
                        </button>
                      ) : (
                        <Link
                          href="/pulse/friends"
                          className="giq-social-messenger-row flex min-h-[58px] items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.04]"
                        >
                          <LauncherProfileSummary
                            name={friend.displayName}
                            avatarUrl={friend.avatarUrl}
                            detail="Start a conversation"
                          />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
                ) : (
                  <p className="rounded-xl border border-dashed border-white/[0.1] px-3 py-4 text-center text-[12px] text-[hsl(var(--muted-foreground))]">
                    No friends yet. Search above to add people.
                  </p>
                )}
              </div>
            ) : launcherTab === "requests" ? (
              incomingRequests.length > 0 || outgoingRequests.length > 0 ? (
                <div className="space-y-3">
                  {incomingRequests.length > 0 ? (
                    <ul className="space-y-1">
                      {incomingRequests.map((request) => (
                        <li
                          key={request.friendshipId}
                          className="flex min-h-[64px] items-center gap-2 rounded-xl px-2.5 py-2 hover:bg-white/[0.04]"
                        >
                          <LauncherProfileSummary
                            name={request.displayName}
                            avatarUrl={request.avatarUrl}
                            detail={
                              request.kennelName ??
                              request.state ??
                              "GreyhoundIQ member"
                            }
                          />
                          <form action={respondToFriendRequestAction}>
                            <input
                              type="hidden"
                              name="friendshipId"
                              value={request.friendshipId}
                            />
                            <input
                              type="hidden"
                              name="response"
                              value="accept"
                            />
                            <button
                              type="submit"
                              aria-label={`Accept friend request from ${request.displayName}`}
                              className="giq-button giq-button-primary h-11 w-11 justify-center px-0"
                            >
                              <Check
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            </button>
                          </form>
                          <form action={respondToFriendRequestAction}>
                            <input
                              type="hidden"
                              name="friendshipId"
                              value={request.friendshipId}
                            />
                            <input
                              type="hidden"
                              name="response"
                              value="decline"
                            />
                            <button
                              type="submit"
                              aria-label={`Decline friend request from ${request.displayName}`}
                              className="giq-button giq-button-glass h-11 w-11 justify-center px-0"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {outgoingRequests.length > 0 ? (
                    <p className="px-2 text-[11px] text-[hsl(var(--subtle-foreground))]">
                      {outgoingRequests.length} sent request
                      {outgoingRequests.length === 1 ? "" : "s"} awaiting a
                      response.
                    </p>
                  ) : null}
                </div>
              ) : (
                <LauncherEmptyState
                  message="No pending friend requests."
                  href="/pulse/friends#requests"
                  action="View requests"
                />
              )
            ) : launcherConversations.length > 0 ? (
              <ul className="space-y-1">
                {launcherConversations.map((conversation) => {
                  const active = openIds.includes(conversation.id);
                  return (
                    <li key={conversation.id}>
                      <button
                        id={`pulse-conversation-${conversation.id}`}
                        type="button"
                        onClick={() => openConversation(conversation.id)}
                        className="giq-social-messenger-row flex min-h-[64px] w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04]"
                        aria-label={`Open quick chat with ${conversation.otherName}`}
                        aria-pressed={active}
                      >
                        <ConversationSummary conversation={conversation} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="grid min-h-32 place-items-center p-4 text-center">
                <div>
                  <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
                    {conversations.length === 0
                      ? "No conversations yet."
                      : "No conversations match this view."}
                  </p>
                  {conversations.length === 0 && (
                    <Link
                      href="/pulse/friends"
                      className="giq-button giq-button-primary mt-3 min-h-11 px-4 text-[12px]"
                    >
                      Find people
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>

          <footer className="giq-messenger-launcher-footer flex min-h-14 gap-2 border-t border-white/[0.08] p-2">
            <button
              type="button"
              onClick={() => setLauncherTab("friends")}
              aria-pressed={launcherTab === "friends"}
              className="giq-button giq-button-primary min-h-11 flex-1 px-3 text-[11px] font-semibold"
            >
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              Find friends
            </button>
            <button
              type="button"
              onClick={() => setLauncherTab("requests")}
              aria-pressed={launcherTab === "requests"}
              className="giq-button giq-button-carbon min-h-11 flex-1 px-3 text-[11px] font-semibold"
            >
              Message requests
            </button>
          </footer>
        </section>

        {!externalLauncher && (
          <button
            ref={launcherButtonRef}
            type="button"
            onClick={() => setLauncherOpen((current) => !current)}
            className="giq-button giq-button-carbon relative h-14 w-14 justify-center rounded-xl border-[hsl(var(--primary-bright)/0.5)] px-0 shadow-2xl focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
            aria-label={launcherOpen ? "Close Chat dock" : "Open Chat dock"}
            aria-expanded={launcherOpen}
            aria-controls="pulse-conversation-launcher"
          >
            {launcherOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <MessageSquare
                className="h-5 w-5 text-[hsl(var(--primary-bright))]"
                aria-hidden="true"
              />
            )}
            {unreadTotal > 0 && (
              <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-6 items-center justify-center rounded-full bg-[hsl(var(--accent))] px-1.5 text-[10px] font-bold leading-6 text-black">
                {unreadTotal > 99 ? "99+" : unreadTotal}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function LauncherProfileSummary({
  name,
  avatarUrl,
  detail,
}: {
  name: string;
  avatarUrl: string | null;
  detail: string;
}) {
  return (
    <>
      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.1] bg-[hsl(var(--surface-2))] text-[12px] font-bold text-white/70">
        {avatarUrl ? (
          <NextImage
            src={avatarUrl}
            alt=""
            fill
            className="rounded-full object-cover"
            sizes="36px"
            unoptimized={avatarUrl.startsWith("/api/media/")}
          />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-[hsl(var(--foreground))]">
          {name}
        </span>
        <span className="block truncate text-[11px] text-[hsl(var(--subtle-foreground))]">
          {detail}
        </span>
      </span>
    </>
  );
}

function LauncherEmptyState({
  message,
  href,
  action,
}: {
  message: string;
  href: string;
  action: string;
}) {
  return (
    <div className="grid min-h-32 place-items-center p-4 text-center">
      <div>
        <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
          {message}
        </p>
        <Link
          href={href}
          className="giq-button giq-button-primary mt-3 min-h-11 px-4 text-[12px]"
        >
          {action}
        </Link>
      </div>
    </div>
  );
}

function ConversationSummary({
  conversation,
}: {
  conversation: HubDockConversation;
}) {
  const preview = conversationPreview(
    conversation.preview,
    conversation.attachmentCount ?? 0,
  );

  return (
    <>
      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.1] bg-[hsl(var(--surface-2))] text-[12px] font-bold text-white/70">
        {conversation.otherAvatarUrl ? (
          <NextImage
            src={conversation.otherAvatarUrl}
            alt=""
            fill
            className="rounded-full object-cover"
            sizes="36px"
            unoptimized={conversation.otherAvatarUrl.startsWith("/api/media/")}
          />
        ) : (
          conversation.otherName.slice(0, 1).toUpperCase()
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-[hsl(var(--foreground))]">
          {conversation.otherName}
        </span>
        <span className="flex items-center gap-1 truncate text-[11px] text-[hsl(var(--subtle-foreground))]">
          {preview.attachment && (
            <Paperclip className="h-3 w-3 shrink-0" aria-hidden="true" />
          )}
          <span className="truncate">{preview.label}</span>
        </span>
      </span>
      {conversation.unread > 0 && (
        <span
          aria-label={`${conversation.unread} unread`}
          className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary-bright))] px-1.5 text-[10px] font-bold leading-5 tabular-nums text-[hsl(var(--primary-foreground))]"
        >
          {conversation.unread > 99 ? "99+" : conversation.unread}
        </span>
      )}
    </>
  );
}

export function QuickChatWindow({
  conversation,
  selfProfileId,
  canStartCall,
  onMinimize,
  onClose,
  variant = "dock",
}: {
  conversation: HubDockConversation;
  selfProfileId: string;
  canStartCall: boolean;
  onMinimize: () => void;
  onClose: () => void;
  // "page": full-bleed conversation surface at /pulse/[id] (the consolidated
  // messenger); "dock": floating window in the messenger dock.
  variant?: "dock" | "page";
}) {
  const router = useRouter();
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [attachmentResetKey, setAttachmentResetKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [otherOnline, setOtherOnline] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const tracksPresence = conversation.personToPerson;
  const hasPendingAttachments = messages.some((message) =>
    message.media?.some(({ media }) => {
      if (!media) return false;
      return (
        media.scanStatus === "pending" ||
        media.processingStatus === "pending" ||
        media.processingStatus === "scanning" ||
        media.processingStatus === "processing"
      );
    }),
  );

  useEffect(() => {
    composerInputRef.current?.focus();
  }, []);

  const loadMessages = useCallback(async () => {
    const requestGeneration = loadGenerationRef.current;
    const response = await fetch(
      `/api/conversations/${conversation.id}/messages?limit=20`,
      { cache: "no-store", credentials: "same-origin" },
    );
    if (!response.ok) throw new Error("Could not load chat");
    const payload = (await response.json()) as { items?: QuickMessage[] };
    if (requestGeneration !== loadGenerationRef.current) return;
    setMessages(payload.items ?? []);
    setLoadError(null);
  }, [conversation.id]);

  const retryLoad = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      await loadMessages();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load chat");
    } finally {
      setLoading(false);
    }
  }, [loadMessages]);

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let fallbackRefreshTimer: number | null = null;
    const stopFallbackRefresh = () => {
      if (fallbackRefreshTimer === null) return;
      window.clearInterval(fallbackRefreshTimer);
      fallbackRefreshTimer = null;
    };
    const startFallbackRefresh = () => {
      if (cancelled || fallbackRefreshTimer !== null) return;
      fallbackRefreshTimer = window.setInterval(() => {
        if (document.visibilityState === "visible" && !sendingRef.current) {
          void loadMessages().catch(() => null);
        }
      }, 5_000);
    };
    const initialLoadTimer = window.setTimeout(() => {
      if (!cancelled) void retryLoad();
    }, 0);

    const client = getBrowserRealtimeClient();
    const subscribe = async () => {
      if (!client || !conversation.realtimeChannel) {
        startFallbackRefresh();
        return;
      }
      await ensureBrowserRealtimeAuthorization(client, [
        conversation.realtimeChannel,
      ]);
      if (cancelled) return;
      const ch = client
        .channel(conversation.realtimeChannel, { config: { private: true } })
        .on("broadcast", { event: "message_created" }, () => {
          if (!sendingRef.current) {
            void loadMessages().catch(() => null);
          }
        })
        .on("broadcast", { event: "conversation_updated" }, () => {
          if (!sendingRef.current) {
            void loadMessages().catch(() => null);
          }
        });
      if (tracksPresence) {
        const applyPresence = () => {
          const state = ch.presenceState<{ profileId?: string }>();
          setOtherOnline(
            Object.values(state)
              .flat()
              .some((entry) => entry.profileId === conversation.otherProfileId),
          );
        };
        ch.on("presence", { event: "sync" }, applyPresence).on(
          "presence",
          { event: "leave" },
          applyPresence,
        );
      }
      channel = ch.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          stopFallbackRefresh();
          if (tracksPresence) {
            void ch.track({
              profileId: selfProfileId,
              onlineAt: new Date().toISOString(),
            });
          }
        } else if (
          status === "TIMED_OUT" ||
          status === "CHANNEL_ERROR" ||
          status === "CLOSED"
        ) {
          startFallbackRefresh();
        }
      });
    };
    void subscribe().catch(() => startFallbackRefresh());

    return () => {
      cancelled = true;
      window.clearTimeout(initialLoadTimer);
      stopFallbackRefresh();
      if (client && channel) void client.removeChannel(channel);
    };
  }, [
    conversation.realtimeChannel,
    conversation.otherProfileId,
    loadMessages,
    retryLoad,
    selfProfileId,
    tracksPresence,
  ]);

  useEffect(() => {
    if (!hasPendingAttachments) return;
    const pendingMediaRefreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !sendingRef.current) {
        void loadMessages().catch(() => null);
      }
    }, 5_000);
    return () => window.clearInterval(pendingMediaRefreshTimer);
  }, [hasPendingAttachments, loadMessages]);

  useEffect(() => {
    if (loading || loadError) return;
    const viewport = messagesViewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [loadError, loading, messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = String(formData.get("body") ?? "").trim();
    const mediaIds = formData.getAll("mediaIds").map(String).filter(Boolean);
    if (!body) return;
    loadGenerationRef.current += 1;
    sendingRef.current = true;
    const optimisticId = `pending-${crypto.randomUUID()}`;
    setMessages((current) => [
      ...current,
      {
        id: optimisticId,
        body,
        senderId: selfProfileId,
        createdAt: new Date().toISOString(),
        pending: true,
      },
    ]);
    setSending(true);
    setSendError(null);
    try {
      const response = await fetch(
        `/api/conversations/${conversation.id}/messages`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body, mediaIds }),
        },
      );
      if (!response.ok) throw new Error("Could not send message");
      form.reset();
      setAttachmentResetKey((current) => current + 1);
      await loadMessages();
    } catch (err) {
      setMessages((current) =>
        current.filter((message) => message.id !== optimisticId),
      );
      setSendError(
        err instanceof Error ? err.message : "Could not send message",
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  function sendOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    if (!sending) event.currentTarget.form?.requestSubmit();
  }

  // Per-message "…" actions reuse the existing server actions. They call
  // revalidatePath + redirect() for the full-page thread; here we swallow that
  // redirect so the in-place dock just re-loads, and surface only real errors.
  async function runMessageAction(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (err) {
      const digest = (err as { digest?: unknown } | null)?.digest;
      if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT")) {
        setSendError(err instanceof Error ? err.message : "Could not update message");
      }
    }
    await loadMessages().catch(() => null);
  }

  return (
    <section
      className={
        variant === "page"
          ? "giq-social-quick-chat flex h-full w-full flex-col overflow-hidden bg-[hsl(var(--surface-1)/0.98)]"
          : "giq-social-quick-chat flex h-[min(440px,calc(100dvh-176px))] w-[min(320px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-white/[0.12] bg-[hsl(var(--surface-1)/0.98)] shadow-2xl backdrop-blur-xl max-lg:fixed max-lg:inset-0 max-lg:z-[75] max-lg:h-[100dvh] max-lg:w-screen max-lg:rounded-none max-lg:border-0"
      }
      data-expanded={expanded ? "true" : "false"}
    >
      <header className="giq-social-quick-chat-header flex min-h-12 items-center gap-2 border-b border-white/[0.08] px-3 max-lg:pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={variant === "page" ? () => router.push("/pulse") : onClose}
          className={`grid min-h-11 w-11 shrink-0 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-white/[0.05] ${
            variant === "page" ? "" : "lg:hidden"
          }`}
          aria-label="Back to Pulse conversations"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="relative grid size-8 shrink-0 place-items-center">
          {conversation.otherAvatarUrl ? (
            <NextImage
              src={conversation.otherAvatarUrl}
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-full object-cover"
              unoptimized={conversation.otherAvatarUrl.startsWith(
                "/api/media/",
              )}
            />
          ) : (
            <MessageSquare className="h-4 w-4 text-[hsl(var(--primary-bright))]" />
          )}
          {tracksPresence && otherOnline && (
            <span
              className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[hsl(var(--surface-1))] bg-emerald-400"
              aria-hidden="true"
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <Link
            href={`/pulse/${conversation.id}`}
            className="block truncate text-[13px] font-semibold text-[hsl(var(--foreground))] hover:underline"
          >
            {conversation.otherName}
          </Link>
          {tracksPresence && (
            <span
              className={`block text-[11px] ${
                otherOnline
                  ? "text-emerald-300"
                  : "text-[hsl(var(--subtle-foreground))]"
              }`}
            >
              {otherOnline ? "Active now" : "Offline"}
            </span>
          )}
        </span>
        {variant === "dock" && (
          <>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="hidden min-h-11 w-11 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-white/[0.05] lg:grid"
          aria-label={`${expanded ? "Restore" : "Expand"} quick chat with ${conversation.otherName}`}
          aria-pressed={expanded}
        >
          {expanded ? (
            <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={onMinimize}
          className="hidden min-h-11 w-11 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-white/[0.05] lg:grid"
          aria-label={`Minimise quick chat with ${conversation.otherName}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="hidden min-h-11 w-11 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-white/[0.05] lg:grid"
          aria-label={`Close quick chat with ${conversation.otherName}`}
        >
          <X className="h-4 w-4" />
        </button>
          </>
        )}
      </header>

      <div
        ref={messagesViewportRef}
        className="giq-social-chat-messages flex-1 space-y-2 overflow-y-auto p-3"
        aria-busy={loading}
        aria-live="polite"
      >
        {loading ? (
          <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-[hsl(var(--primary-bright))]" />
        ) : loadError ? (
          <div
            role="alert"
            className="mx-auto mt-8 grid max-w-[220px] justify-items-center gap-3 text-center"
          >
            <p className="text-[12px] text-red-200">{loadError}</p>
            <button
              type="button"
              onClick={() => void retryLoad()}
              className="giq-outline-action min-h-10 px-3 text-[12px]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <p className="mt-8 text-center text-[12px] text-[hsl(var(--muted-foreground))]">
            Start the conversation.
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.senderId === selfProfileId;
            return (
              <div
                key={message.id}
                className={`group flex items-end gap-1 ${
                  mine ? "flex-row-reverse" : ""
                }`}
              >
                <article
                  className={`giq-social-chat-bubble max-w-[84%] rounded-xl px-3 py-2 text-[12px] ${
                    mine
                      ? "bg-[hsl(var(--primary)/0.16)] text-[hsl(var(--foreground))]"
                      : "bg-white/[0.05] text-[hsl(var(--muted-foreground))]"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">
                    {message.body}
                  </p>
                  <MessageAttachments attachments={message.media ?? []} />
                  <span className="mt-1 block text-[10px] opacity-70">
                    {message.pending ? (
                      "Sending..."
                    ) : (
                      <time dateTime={message.createdAt}>
                        {CHAT_TIME_FORMATTER.format(new Date(message.createdAt))}
                      </time>
                    )}
                  </span>
                </article>
                {!message.pending && (
                  <details className="relative shrink-0 self-center opacity-70 transition-opacity lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
                    <summary
                      aria-label={`Message actions for ${mine ? "your message" : conversation.otherName}`}
                      className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-light))] [&::-webkit-details-marker]:hidden"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </summary>
                    <div
                      className={`absolute bottom-full z-20 mb-1 flex w-36 flex-col rounded-lg border border-white/[0.12] bg-[hsl(var(--surface-1))] p-1 shadow-xl ${
                        mine ? "right-0" : "left-0"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          void runMessageAction(() =>
                            toggleMessageReaction(conversation.id, message.id),
                          )
                        }
                        className="flex min-h-11 items-center gap-2 rounded px-2 text-left text-[12px] text-[hsl(var(--foreground))] hover:bg-white/[0.06]"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                        React
                      </button>
                      {mine ? (
                        <button
                          type="button"
                          onClick={() =>
                            void runMessageAction(() =>
                              deleteConversationMessage(
                                conversation.id,
                                message.id,
                                actionFormData({ confirmation: "delete" }),
                              ),
                            )
                          }
                          className="flex min-h-11 items-center gap-2 rounded px-2 text-left text-[12px] text-red-200 hover:bg-white/[0.06]"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Delete
                        </button>
                      ) : (
                        // ponytail: report reason defaults to "other"; add a
                        // reason picker if moderation asks for one.
                        <button
                          type="button"
                          onClick={() =>
                            void runMessageAction(() =>
                              reportConversationMessage(
                                conversation.id,
                                message.id,
                                actionFormData({ reason: "other" }),
                              ),
                            )
                          }
                          className="flex min-h-11 items-center gap-2 rounded px-2 text-left text-[12px] text-[hsl(var(--foreground))] hover:bg-white/[0.06]"
                        >
                          <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                          Report
                        </button>
                      )}
                    </div>
                  </details>
                )}
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={sendMessage}
        className="giq-social-quick-chat-composer border-t border-white/[0.08] p-2 max-lg:pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      >
        <label className="sr-only" htmlFor={`quick-chat-${conversation.id}`}>
          Message {conversation.otherName}
        </label>
        <div className="flex items-end gap-2">
          <textarea
            ref={composerInputRef}
            id={`quick-chat-${conversation.id}`}
            name="body"
            required
            maxLength={5000}
            rows={2}
            disabled={sending}
            onKeyDown={sendOnEnter}
            aria-invalid={Boolean(sendError)}
            aria-errormessage={
              sendError ? `quick-chat-${conversation.id}-error` : undefined
            }
            className="giq-form-control min-h-11 flex-1 resize-none px-2 py-2 text-[12px]"
            placeholder="Write a message"
          />
          <button
            type="submit"
            disabled={sending}
            className="giq-button giq-button-primary min-h-11 w-11 px-0"
            aria-label="Send message"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <div className="mt-2 flex items-start gap-2">
          {conversation.personToPerson && (
            <>
              <Link
                href={
                  canStartCall
                    ? `/pulse/${encodeURIComponent(conversation.id)}?call=voice`
                    : "/pricing"
                }
                aria-label={
                  canStartCall
                    ? `Start voice call with ${conversation.otherName}`
                    : "Voice calls are a Pro feature"
                }
                title={
                  canStartCall
                    ? `Voice call ${conversation.otherName}`
                    : "Voice calls are a Pro feature"
                }
                className={`giq-outline-action h-11 w-11 shrink-0 justify-center px-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)] ${
                  canStartCall ? "" : "opacity-60"
                }`}
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href={
                  canStartCall
                    ? `/pulse/${encodeURIComponent(conversation.id)}?call=video`
                    : "/pricing"
                }
                aria-label={
                  canStartCall
                    ? `Start video call with ${conversation.otherName}`
                    : "Video calls are a Pro feature"
                }
                title={
                  canStartCall
                    ? `Video call ${conversation.otherName}`
                    : "Video calls are a Pro feature"
                }
                className={`giq-outline-action h-11 w-11 shrink-0 justify-center px-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)] ${
                  canStartCall ? "" : "opacity-60"
                }`}
              >
                <Video className="h-4 w-4" aria-hidden="true" />
              </Link>
            </>
          )}
          <div className="min-w-0 flex-1 max-h-44 overflow-y-auto overscroll-contain pr-1">
            <MediaAttachmentFields key={attachmentResetKey} compact />
          </div>
        </div>
        {sendError && (
          <p
            id={`quick-chat-${conversation.id}-error`}
            role="alert"
            className="mt-1 text-[11px] text-red-200"
          >
            {sendError}
          </p>
        )}
      </form>
    </section>
  );
}

function MinimizedChatBubble({
  conversation,
  onRestore,
  onClose,
}: {
  conversation: HubDockConversation;
  onRestore: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onClose}
        className="grid size-11 place-items-center rounded-full border border-white/[0.12] bg-[hsl(var(--surface-1)/0.94)] text-[hsl(var(--muted-foreground))] shadow-lg transition-colors hover:border-white/[0.2] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
        aria-label={`Close quick chat with ${conversation.otherName}`}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={onRestore}
          className="relative grid size-12 place-items-center overflow-hidden rounded-full border border-white/[0.14] bg-[hsl(var(--surface-2))] text-[13px] font-bold text-white/70 shadow-2xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
          aria-label={`Restore quick chat with ${conversation.otherName}${
            conversation.unread > 0 ? `, ${conversation.unread} unread` : ""
          }`}
        >
          {conversation.otherAvatarUrl ? (
            <NextImage
              src={conversation.otherAvatarUrl}
              alt=""
              fill
              className="rounded-full object-cover"
              sizes="48px"
              unoptimized={conversation.otherAvatarUrl.startsWith(
                "/api/media/",
              )}
            />
          ) : (
            conversation.otherName.slice(0, 1).toUpperCase()
          )}
        </button>
        {conversation.unread > 0 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[hsl(var(--primary-bright))] px-1.5 text-[10px] font-bold leading-5 tabular-nums text-[hsl(var(--primary-foreground))]"
          >
            {conversation.unread > 99 ? "99+" : conversation.unread}
          </span>
        )}
      </div>
    </div>
  );
}

function MessageAttachments({
  attachments,
}: {
  attachments: NonNullable<QuickMessage["media"]>;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-2 grid gap-2">
      {attachments.map((attachment) => (
        <MessageAttachment key={attachment.mediaId} attachment={attachment} />
      ))}
    </div>
  );
}

function MessageAttachment({
  attachment,
}: {
  attachment: NonNullable<QuickMessage["media"]>[number];
}) {
  const media = attachment.media;
  if (!media) {
    return <AttachmentStatus label="Attachment unavailable" />;
  }
  if (media.scanStatus === "pending") {
    return <AttachmentStatus label="Scanning attachment…" loading />;
  }
  if (media.scanStatus !== "clean") {
    return (
      <AttachmentStatus label="Attachment removed by safety scan" failed />
    );
  }
  if (media.processingStatus !== "ready") {
    return (
      <AttachmentStatus
        label={
          media.processingStatus === "failed"
            ? "Attachment processing failed"
            : "Preparing attachment…"
        }
        loading={media.processingStatus !== "failed"}
        failed={media.processingStatus === "failed"}
      />
    );
  }

  const originalUrl = `/api/media/${media.id}/blob`;
  const playbackUrl = media.playbackPath
    ? `${originalUrl}?variant=playback`
    : originalUrl;
  const label = media.altText ?? media.originalName ?? "Message attachment";

  if (media.mimeType?.startsWith("image/")) {
    return (
      <a
        href={playbackUrl}
        target="_blank"
        rel="noreferrer"
        className="giq-listing-media block overflow-hidden rounded-lg"
      >
        <NextImage
          src={playbackUrl}
          alt={label}
          width={media.widthPx ?? 420}
          height={media.heightPx ?? 280}
          unoptimized
          className="max-h-44 w-full object-cover"
        />
      </a>
    );
  }

  if (media.mimeType?.startsWith("video/")) {
    return (
      <ProcessedVideo
        playbackUrl={playbackUrl}
        hlsUrl={media.hlsPath ? `${originalUrl}?variant=hls` : null}
        posterUrl={media.posterPath ? `${originalUrl}?variant=poster` : null}
        captionUrl={media.captionPath ? `${originalUrl}?variant=caption` : null}
        label={label}
        compact
      />
    );
  }

  if (media.mimeType?.startsWith("audio/")) {
    return (
      <audio
        controls
        preload="metadata"
        src={playbackUrl}
        className="min-h-11 w-full"
        aria-label={label}
      />
    );
  }

  return (
    <a
      href={originalUrl}
      target="_blank"
      rel="noreferrer"
      className="giq-outline-action min-h-11 max-w-full px-3 py-2 text-[11px]"
    >
      <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">
        {media.originalName ?? "Open attachment"}
      </span>
    </a>
  );
}

function AttachmentStatus({
  label,
  loading = false,
  failed = false,
}: {
  label: string;
  loading?: boolean;
  failed?: boolean;
}) {
  return (
    <span
      role="status"
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-[11px] text-[hsl(var(--muted-foreground))]"
    >
      {loading ? (
        <Loader2
          className="h-3.5 w-3.5 shrink-0 animate-spin"
          aria-hidden="true"
        />
      ) : failed ? (
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>{label}</span>
    </span>
  );
}

function conversationPreview(value: string, attachmentCount: number) {
  const trimmed = value.trim();
  const sentByCurrentUser = trimmed.startsWith("You:");
  const body = sentByCurrentUser ? trimmed.slice(4).trim() : trimmed;
  const attachment =
    attachmentCount > 0 ||
    body.length === 0 ||
    /^(attachment|photo|video|audio)s?\b/i.test(body);
  return {
    attachment,
    label: body.length
      ? trimmed
      : sentByCurrentUser
        ? "You sent an attachment"
        : "Attachment",
  };
}
