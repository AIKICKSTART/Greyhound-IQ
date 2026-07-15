"use client";

import { Clock3 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { normalizeRateLimitRecoverySeconds } from "@/lib/rate-limit-recovery";

export function RateLimitRecoveryCard({
  action,
  detail,
  retryAfterSeconds,
  title,
}: {
  action: ReactNode;
  detail: string;
  retryAfterSeconds: number;
  title: string;
}) {
  const initialSeconds = normalizeRateLimitRecoverySeconds(retryAfterSeconds);
  const [remaining, setRemaining] = useState(initialSeconds);

  useEffect(() => {
    const deadline = Date.now() + initialSeconds * 1_000;
    const timer = window.setInterval(() => {
      const nextRemaining = Math.max(
        0,
        Math.ceil((deadline - Date.now()) / 1_000),
      );
      setRemaining(nextRemaining);
      if (nextRemaining === 0) window.clearInterval(timer);
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [initialSeconds]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className="rounded-xl border border-amber-300/30 bg-amber-300/[0.08] p-4"
    >
      <div className="flex items-start gap-3">
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
            {title}
          </p>
          <p className="mt-1 text-[13px] leading-5 text-[hsl(var(--muted-foreground))]">
            {detail}
          </p>
          {remaining > 0 ? (
            <>
              <p className="mt-3 text-[12px] font-semibold text-amber-100">
                Try again in {remaining} second{remaining === 1 ? "" : "s"}.
              </p>
              <noscript>
                <div className="mt-3">{action}</div>
              </noscript>
            </>
          ) : (
            <div className="mt-3">{action}</div>
          )}
        </div>
      </div>
    </div>
  );
}
