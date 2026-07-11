"use client";

import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type PendingProfileMedia = {
  id: string;
  originalName: string | null;
  scanStatus: string;
  processingStatus: string;
  processingError: string | null;
};

export function ProfileMediaStatus({
  label,
  initial,
}: {
  label: string;
  initial: PendingProfileMedia | null;
}) {
  const router = useRouter();
  const [item, setItem] = useState(initial);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!item || item.processingStatus === "ready" || item.processingStatus === "failed") return;
    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/media/${encodeURIComponent(item.id)}`, {
        cache: "no-store",
        credentials: "same-origin",
      }).catch(() => null);
      if (!response?.ok) return;
      const payload = (await response.json()) as { item?: PendingProfileMedia };
      if (!payload.item) return;
      setItem(payload.item);
      if (payload.item.processingStatus === "ready") router.refresh();
    }, 2000);
    return () => window.clearInterval(interval);
  }, [item, router]);

  if (!item) return null;
  const failed = item.processingStatus === "failed";
  const ready = item.processingStatus === "ready";
  const status = failed
    ? "Processing failed"
    : ready
      ? "Ready"
      : item.scanStatus === "pending"
        ? "Scanning"
        : "Processing";

  return (
    <div className={`mt-3 flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-[12px] ${failed ? "border-red-500/30 bg-red-500/5 text-red-100" : "border-white/[0.08] bg-white/[0.03] text-[hsl(var(--muted-foreground))]"}`}>
      {failed ? (
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : ready ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
      ) : (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[hsl(var(--primary-bright))]" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">
        <strong className="block text-[hsl(var(--foreground))]">{label}: {status}</strong>
        <span className="block truncate">{item.originalName ?? "Profile image"}</span>
      </span>
      {failed ? (
        <>
          <span className="inline-flex items-center gap-1 text-[11px]">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Replace to retry
          </span>
        </>
      ) : null}
      {!ready ? (
        <button
          type="button"
          disabled={removing}
          onClick={async () => {
            setRemoving(true);
            const response = await fetch(`/api/media/${encodeURIComponent(item.id)}`, { method: "DELETE" });
            if (response.ok) {
              setItem(null);
              router.refresh();
            } else {
              setRemoving(false);
            }
          }}
          aria-label={`Cancel ${label.toLowerCase()} upload`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-white/[0.06] disabled:opacity-50"
        >
          {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        </button>
      ) : null}
    </div>
  );
}
