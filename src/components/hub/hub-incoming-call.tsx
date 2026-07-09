"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Phone, PhoneIncoming, PhoneOff, Video } from "lucide-react";

export type IncomingCallInvite = {
  inviteId: string;
  roomId: string;
  conversationId: string | null;
  callType: "voice" | "video";
  fromName: string;
};

// Ringing card for the hub. Accept navigates to the thread (the existing
// ConversationCallPanel owns the actual LiveKit join); decline hits the same
// authed invite API the panel uses.
export function HubIncomingCall({ invite }: { invite: IncomingCallInvite }) {
  const router = useRouter();
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [navigating, startTransition] = useTransition();

  async function decline() {
    setError(null);
    setDeclining(true);
    try {
      const response = await fetch(`/api/calls/${invite.roomId}/invite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId: invite.inviteId, action: "decline" }),
      });
      if (!response.ok) throw new Error(`Decline failed (${response.status})`);
      startTransition(() => router.refresh());
    } catch {
      setError("Could not decline the call.");
    } finally {
      setDeclining(false);
    }
  }

  const Icon = invite.callType === "video" ? Video : Phone;

  return (
    <div
      role="alert"
      className="rounded-xl border border-[hsl(var(--primary)/0.45)] bg-[hsl(var(--primary)/0.12)] p-4"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 animate-pulse place-items-center rounded-full bg-[hsl(var(--primary)/0.25)]">
          <PhoneIncoming
            className="h-4 w-4 text-[hsl(var(--primary-bright))]"
            aria-hidden="true"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-[hsl(var(--foreground))]">
            {invite.fromName}
          </p>
          <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
            Incoming {invite.callType} call
          </p>
        </div>
        <Icon
          className="h-4 w-4 shrink-0 text-[hsl(var(--primary-bright))]"
          aria-hidden="true"
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={declining || navigating || !invite.conversationId}
          onClick={() =>
            startTransition(() =>
              router.push(`/pulse/${invite.conversationId}`)
            )
          }
          className="giq-button giq-button-primary min-h-10 px-3 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {navigating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Answer
        </button>
        <button
          type="button"
          disabled={declining || navigating}
          onClick={decline}
          className="giq-button giq-button-glass min-h-10 px-3 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {declining ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <PhoneOff className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Decline
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[12px] text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
