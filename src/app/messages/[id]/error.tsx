"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";

export default function ConversationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("conversation.segment_error", {
      digest: error.digest ?? "unknown",
    });
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--secondary)/0.3)] bg-[hsl(var(--secondary)/0.1)] px-3 py-1">
          <AlertTriangle className="h-3 w-3 text-[hsl(var(--secondary))]" />
          <span className="text-[11px] font-medium tracking-[0.04em] text-[hsl(var(--secondary))]">
            CONVERSATION UNAVAILABLE
          </span>
        </div>
        <h1 className="mb-3 text-3xl font-semibold leading-[1.1] tracking-[-0.03em] text-[hsl(var(--foreground))]">
          This conversation hit a hurdle.
        </h1>
        <p className="mb-2 text-[14px] leading-relaxed tracking-[-0.011em] text-[hsl(var(--muted-foreground))]">
          Something went wrong loading this conversation. Try again, or contact
          support if it keeps happening.
        </p>
        {error.digest && (
          <p className="mb-6 font-mono text-[11px] tracking-[0.04em] text-[hsl(var(--subtle-foreground))]">
            REF: {error.digest}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={reset}
            className="giq-liquid-purple-button px-5 text-[13px] font-semibold"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/pulse"
            className="giq-outline-action px-4 text-[13px] font-semibold"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Pulse
          </Link>
        </div>
      </div>
    </div>
  );
}
