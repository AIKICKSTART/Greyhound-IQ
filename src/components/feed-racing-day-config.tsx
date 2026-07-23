"use client";

import { Check, Loader2, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { RacingDayTrackOption } from "@/lib/feed-race-day";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function FeedRacingDayConfig({
  trackOptions,
  selectedTrackIds,
}: {
  trackOptions: RacingDayTrackOption[];
  selectedTrackIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(
    () => new Set(selectedTrackIds),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/feed/racing-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackIds: [...selection] }),
      });
      if (!res.ok) throw new Error("save_failed");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not save your racing day. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const activeCount = selectedTrackIds.length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="giq-button giq-button-carbon px-5 text-[13px] font-semibold">
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        {activeCount > 0
          ? `My racing day · ${activeCount}`
          : "Configure my racing day"}
      </SheetTrigger>
      <SheetContent
        side="right"
        style={{
          width:
            "min(320px, calc(100vw - max(1rem, env(safe-area-inset-left)) - max(1rem, env(safe-area-inset-right))))",
        }}
        className="overflow-y-auto bg-[hsl(var(--surface-1)/0.97)] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl"
      >
        <SheetTitle className="text-white">My racing day</SheetTitle>
        <p className="mt-1 text-[12px] leading-5 text-white/55">
          Pick the tracks you want in your Race day command. Leave everything
          unchecked to follow every meeting today.
        </p>

        {trackOptions.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-[12px] text-white/48">
            No meetings are scheduled today.
          </p>
        ) : (
          <ul className="mt-4 space-y-1.5">
            {trackOptions.map((track) => {
              const checked = selection.has(track.id);
              return (
                <li key={track.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(track.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3 text-left transition hover:border-white/16 hover:bg-white/[0.045] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-light))]"
                  >
                    <span
                      aria-hidden="true"
                      className={`grid size-5 shrink-0 place-items-center rounded-md border ${
                        checked
                          ? "border-transparent bg-[hsl(var(--primary))] text-white"
                          : "border-white/25 bg-transparent"
                      }`}
                    >
                      {checked ? <Check className="size-3.5" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[13px] text-white">
                        {track.name}
                      </strong>
                      <small className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                        {track.state}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {error ? (
          <p role="alert" className="mt-3 text-[11px] leading-5 text-red-200">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending || trackOptions.length === 0}
            className="giq-button giq-button-primary min-h-10 flex-1 px-4 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {pending ? "Saving…" : "Save racing day"}
          </button>
          {selection.size > 0 ? (
            <button
              type="button"
              onClick={() => setSelection(new Set())}
              disabled={pending}
              className="giq-button giq-button-carbon min-h-10 px-4 text-[13px] font-semibold disabled:opacity-60"
            >
              Clear
            </button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
