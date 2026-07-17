"use client";

import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("admin.segment_error", { digest: error.digest ?? "unknown" });
  }, [error.digest]);

  return (
    <main className="mx-auto grid min-h-[70vh] max-w-3xl place-items-center px-4 py-10 sm:px-6">
      <section className="giq-panel w-full overflow-hidden p-6 text-center sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-red-300/25 bg-red-300/[0.08] text-red-200">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </span>
        <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-[hsl(var(--primary-light))]">
          Protected operation interrupted
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[hsl(var(--foreground))]">
          The control centre could not complete that request.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
          No success state has been recorded. Retry the protected view, or return
          to the dashboard before attempting another audited change.
        </p>
        {error.digest ? (
          <p className="mt-4 font-mono text-[10px] text-[hsl(var(--subtle-foreground))]">
            Reference {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="giq-button giq-button-primary min-h-11 px-5"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Retry securely
          </button>
          <Link href="/admin" className="giq-button giq-button-carbon min-h-11 px-5">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Admin dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
