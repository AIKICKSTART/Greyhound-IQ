"use client";

import { Eye, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function isDemoMutationSubmission(
  method: string | null,
  hasServerAction: boolean
) {
  return method?.trim().toLowerCase() === "post" || hasServerAction;
}

export function DemoReadOnlyGuard({ personaName }: { personaName: string }) {
  const [noticeVisible, setNoticeVisible] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const hasServerAction = Boolean(
        form.querySelector('input[name^="$ACTION_"]')
      );
      if (!isDemoMutationSubmission(form.getAttribute("method"), hasServerAction)) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      setNoticeVisible(true);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNoticeVisible(false), 5_000);
    };

    document.addEventListener("submit", handleSubmit, true);
    return () => {
      document.removeEventListener("submit", handleSubmit, true);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  return (
    <>
      <aside
        aria-label="Read-only demonstration"
        className="border-y border-[hsl(var(--primary-light)/0.16)] bg-[linear-gradient(90deg,hsl(var(--primary)/0.10),hsl(var(--secondary)/0.07),hsl(var(--primary)/0.10))] px-4 py-2.5"
        data-demo-read-only-banner
      >
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[11px] text-[hsl(var(--muted-foreground))] sm:text-left">
          <span className="inline-flex items-center gap-1.5 font-black uppercase tracking-[0.14em] text-[hsl(var(--primary-light))]">
            <Eye className="size-3.5" aria-hidden="true" />
            Read-only demo
          </span>
          <span>
            Exploring every screen as{" "}
            <strong className="text-[hsl(var(--foreground))]">{personaName}</strong>.
            Writes are safely previewed and never change staging data.
          </span>
        </div>
      </aside>

      {noticeVisible ? (
        <div
          aria-live="polite"
          className="fixed inset-x-3 bottom-[calc(var(--giq-mobile-dock-clearance)+12px)] z-[90] mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-[hsl(var(--secondary)/0.30)] bg-[hsl(var(--surface-1)/0.97)] p-4 text-left shadow-[0_24px_70px_hsl(0_0%_0%/0.55)] backdrop-blur-2xl md:bottom-5"
          role="status"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[hsl(var(--secondary)/0.24)] bg-[hsl(var(--secondary)/0.08)] text-[hsl(var(--secondary-light))]">
            <ShieldCheck className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-sm text-[hsl(var(--foreground))]">
              Demo action safely previewed
            </strong>
            <span className="mt-1 block text-xs leading-5 text-[hsl(var(--muted-foreground))]">
              This control is available to explore, but no data, payment, message or account setting was changed.
            </span>
          </span>
          <button
            aria-label="Dismiss demo notice"
            className="grid size-9 shrink-0 place-items-center rounded-xl text-[hsl(var(--muted-foreground))] transition hover:bg-white/[0.06] hover:text-[hsl(var(--foreground))]"
            onClick={() => setNoticeVisible(false)}
            type="button"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </>
  );
}
