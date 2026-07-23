"use client";

import { Loader2, UserMinus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { removeFriendAction } from "@/app/actions";

type FriendshipRemovalVariant = "cancel-request" | "remove-friend";

export function FriendshipRemovalControl({
  friendshipId,
  otherName,
  variant,
}: {
  friendshipId: string;
  otherName: string;
  variant: FriendshipRemovalVariant;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isCancellation = variant === "cancel-request";
  const actionLabel = isCancellation ? "Cancel request" : "Remove friend";
  const confirmationId = `friendship-removal-${friendshipId}`;

  async function confirmRemoval() {
    if (pending) return;

    setError(null);
    setPending(true);
    const formData = new FormData();
    formData.set("friendshipId", friendshipId);

    try {
      await removeFriendAction(formData);
      setSuccess(
        isCancellation ? "Friend request cancelled." : "Connection removed.",
      );
      setConfirming(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("rate_limit")
          ? "Too many friend changes. Please try again later."
          : isCancellation
            ? "Could not cancel the friend request. Please try again."
            : "Could not remove this connection. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="giq-status-pill min-h-11 flex-1 px-4 sm:flex-none"
      >
        {success}
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-none">
      <button
        type="button"
        aria-expanded={confirming}
        aria-controls={confirming ? confirmationId : undefined}
        onClick={() => {
          setConfirming((current) => !current);
          setError(null);
        }}
        disabled={pending}
        className="giq-button giq-button-glass min-h-11 w-full px-4 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isCancellation ? (
          <X className="h-4 w-4" aria-hidden="true" />
        ) : (
          <UserMinus className="h-4 w-4" aria-hidden="true" />
        )}
        {actionLabel}
      </button>

      {confirming ? (
        <div
          id={confirmationId}
          className="w-full rounded-xl border border-red-400/20 bg-red-500/[0.06] p-3 sm:w-72"
        >
          <p className="text-[12px] leading-5 text-[hsl(var(--foreground))]">
            {isCancellation
              ? `Cancel your friend request to ${otherName}?`
              : `Remove ${otherName} from your friends? This does not block them.`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="giq-outline-action min-h-11 justify-center px-3 text-[11px] disabled:opacity-60"
            >
              Keep
            </button>
            <button
              type="button"
              onClick={confirmRemoval}
              disabled={pending}
              className="giq-outline-action min-h-11 justify-center border-red-400/25 px-3 text-[11px] text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              {pending ? "Working…" : actionLabel}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="max-w-72 text-[11px] leading-5 text-red-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
