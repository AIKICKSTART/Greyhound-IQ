"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Search } from "lucide-react";

export default function RacesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Race route error:", error);
  }, [error]);

  return (
    <main className="mx-auto grid min-h-[60vh] max-w-3xl place-items-center px-6 py-14">
      <section className="giq-panel w-full p-8 text-center">
        <span className="giq-badge giq-badge-gold">
          <AlertTriangle className="h-3.5 w-3.5" />
          Race data unavailable
        </span>
        <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-[hsl(var(--foreground))]">
          The race view could not load.
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[hsl(var(--muted-foreground))]">
          This is usually temporary. Try again, or return to race search and
          open the card from there.
        </p>
        {error.digest && (
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-[hsl(var(--subtle-foreground))]">
            Ref {error.digest}
          </p>
        )}
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="giq-button giq-button-primary px-5 text-[13px] font-semibold"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/races"
            className="giq-button giq-button-glass px-5 text-[13px] font-semibold"
          >
            <Search className="h-4 w-4" />
            Search races
          </Link>
        </div>
      </section>
    </main>
  );
}
