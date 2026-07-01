"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error so it shows up in monitoring (Sentry etc)
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="fade-in min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--secondary)/0.3)] bg-[hsl(var(--secondary)/0.1)] px-3 py-1 mb-6">
          <AlertTriangle className="h-3 w-3 text-[hsl(var(--secondary))]" />
          <span
            className="text-[11px] text-[hsl(var(--secondary))] font-medium tracking-[0.04em]"
          >
            SOMETHING WENT WRONG
          </span>
        </div>
        <h1
          className="text-3xl font-semibold text-[hsl(var(--foreground))] mb-3 tracking-[-0.03em] leading-[1.1]"
        >
          A hurdle on the track.
        </h1>
        <p
          className="text-[14px] text-[hsl(var(--muted-foreground))] mb-2 leading-relaxed tracking-[-0.011em]"
        >
          We hit an error rendering this page. The team has been notified.
        </p>
        {error.digest && (
          <p
            className="text-[11px] font-mono text-[hsl(var(--subtle-foreground))] mb-6 tracking-[0.04em]"
          >
            REF: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[hsl(var(--secondary))] to-[hsl(var(--primary))] px-5 py-2.5 text-[13px] font-semibold text-white shadow-xl shadow-[hsl(var(--primary)/0.25)] hover:brightness-110 transition-all tracking-[-0.013em]"
        >
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
