"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { blockConversation, unblockConversation } from "@/app/actions";
import {
  QuickChatWindow,
  type HubDockConversation,
} from "@/components/hub/hub-conversation-dock";

// The consolidated /pulse/[id] surface: the reused dock QuickChatWindow shown
// full-bleed, with the reused ConversationCallPanel as a collapsible banner
// above it (rendered by the page only when a call is active/ringing/intended).
// One messenger component family on desktop and mobile.
export function PulseThreadSurface({
  conversation,
  selfProfileId,
  canStartCall,
  callBanner,
  blockedByMe,
  blockedByOther,
}: {
  conversation: HubDockConversation;
  selfProfileId: string;
  canStartCall: boolean;
  callBanner: ReactNode;
  blockedByMe: boolean;
  blockedByOther: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [blockError, setBlockError] = useState<string | null>(null);

  // Same formless pattern as the dock's per-message menu: the server actions
  // end in redirect(); swallow that and refresh in place instead.
  function runBlockAction(fn: () => Promise<unknown>) {
    setBlockError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        const digest = (err as { digest?: unknown } | null)?.digest;
        if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT")) {
          setBlockError(
            err instanceof Error ? err.message : "Could not update the block",
          );
          return;
        }
      }
      router.refresh();
    });
  }

  const blocked = blockedByMe || blockedByOther;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[hsl(var(--background))] lg:static lg:z-auto lg:mx-auto lg:my-6 lg:h-[calc(100dvh-8rem)] lg:max-w-3xl lg:overflow-hidden lg:rounded-2xl lg:border lg:border-white/[0.1] lg:shadow-2xl">
      {blocked ? (
        <div className="flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.1)] px-4 py-2 text-[12px] text-[hsl(var(--foreground))]">
          <span>
            {blockedByMe
              ? "You blocked this conversation. Unblock before sending new messages."
              : "This conversation is blocked by the other participant."}
          </span>
          {blockedByMe && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runBlockAction(() => unblockConversation(conversation.id))
              }
              className="min-h-8 rounded-md border border-[hsl(var(--border))] px-3 text-[12px] font-medium transition-colors hover:border-[hsl(var(--primary-bright)/0.5)] disabled:opacity-50"
            >
              Unblock
            </button>
          )}
        </div>
      ) : (
        <div className="flex min-h-9 shrink-0 items-center justify-end border-b border-white/[0.06] px-4">
          <button
            type="button"
            disabled={pending}
            onClick={() => runBlockAction(() => blockConversation(conversation.id))}
            aria-label="Block this conversation"
            className="min-h-8 rounded-md px-2 text-[11px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:text-red-400 focus-visible:outline-2 focus-visible:outline-[hsl(var(--primary-bright))]"
          >
            Block
          </button>
        </div>
      )}
      {blockError && (
        <p role="alert" className="shrink-0 px-4 py-1 text-[11px] text-red-400">
          {blockError}
        </p>
      )}
      {callBanner ? (
        <div className="max-h-[45%] shrink-0 overflow-y-auto border-b border-white/[0.06] px-4">
          {callBanner}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <QuickChatWindow
          conversation={conversation}
          selfProfileId={selfProfileId}
          canStartCall={canStartCall}
          onMinimize={() => {}}
          onClose={() => {}}
          variant="page"
        />
      </div>
    </div>
  );
}
