"use client";

import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="min-h-screen bg-[hsl(150_30%_3%)] text-[hsl(210_13%_97%)]">
        <div className="min-h-screen flex items-center justify-center px-6 font-sans">
          <div className="max-w-md w-full text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(25_95%_53%/0.3)] bg-[hsl(25_95%_53%/0.1)] px-3 py-1 mb-6">
              <AlertTriangle className="h-3 w-3 text-[hsl(25_95%_53%)]" />
              <span className="text-[11px] text-[hsl(25_95%_53%)] font-medium tracking-[0.04em]">
                CRITICAL ERROR
              </span>
            </div>
            <h1 className="text-4xl font-semibold mb-3 tracking-[-0.04em]">
              Off-track.
            </h1>
            <p className="text-[15px] text-[hsl(215_14%_65%)] mb-6 leading-relaxed tracking-[-0.011em]">
              A critical error broke the layout. The site is unreachable right now.
            </p>
            {error.digest && (
              <p className="text-[11px] font-mono text-[hsl(220_7%_42%)] mb-6 tracking-[0.04em]">
                REF: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[hsl(142_76%_36%)] to-[hsl(142_60%_40%)] px-5 py-2.5 text-[13px] font-semibold text-white tracking-[-0.013em]"
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
