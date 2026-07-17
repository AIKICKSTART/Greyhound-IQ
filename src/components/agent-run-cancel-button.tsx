"use client";

import { Loader2, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  getAgentRunPresentation,
  isAgentRunCancellable,
} from "./agent-run-lifecycle";

type CancelRequestState = "idle" | "submitting" | "success" | "error";

export function AgentRunCancelButton({
  runId,
  status,
}: {
  runId: string;
  status: string;
}) {
  const router = useRouter();
  const [requestState, setRequestState] = useState<CancelRequestState>("idle");
  const [message, setMessage] = useState("");

  if (!isAgentRunCancellable(status)) return null;

  async function cancelRun() {
    if (requestState === "submitting" || requestState === "success") return;
    setRequestState("submitting");
    setMessage("Cancelling this run…");

    try {
      const response = await fetch(
        `/api/agents/runs/${encodeURIComponent(runId)}/cancel`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        item?: { id?: unknown; status?: unknown };
      } | null;
      if (
        !response.ok ||
        payload?.item?.id !== runId ||
        typeof payload.item.status !== "string"
      ) {
        throw new Error("agent.cancel_failed");
      }

      const result = getAgentRunPresentation(payload.item.status);
      setRequestState("success");
      setMessage(
        result.state === "interrupted"
          ? "Run interrupted."
          : `Run is already ${result.label.toLocaleLowerCase("en-AU")}.`,
      );
      router.refresh();
    } catch {
      setRequestState("error");
      setMessage("Could not cancel this run. Refresh its status and try again.");
    }
  }

  return (
    <div className="flex min-w-[132px] flex-col items-end gap-1">
      <button
        type="button"
        onClick={cancelRun}
        disabled={requestState === "submitting" || requestState === "success"}
        className="giq-button giq-button-carbon min-h-11 px-3 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-55"
      >
        {requestState === "submitting" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Square className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {requestState === "submitting" ? "Cancelling…" : "Cancel run"}
      </button>
      {message ? (
        <span
          role={requestState === "error" ? "alert" : "status"}
          aria-live="polite"
          className="max-w-48 text-right text-[10px] leading-4 text-[hsl(var(--muted-foreground))]"
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}
