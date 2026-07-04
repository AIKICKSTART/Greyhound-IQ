"use client";

import { useState } from "react";
import { Bookmark, Loader2 } from "lucide-react";

export function InstantSaveListingButton({
  listingId,
  initiallySaved,
}: {
  listingId: string;
  initiallySaved: boolean;
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (submitting) return;

    const previous = saved;
    setSaved(!saved);
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/listings/${listingId}/save`, {
        method: "POST",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error?.message ?? "Could not save listing");
      }
      setSaved(Boolean(data?.item?.saved));
    } catch (err) {
      setSaved(previous);
      setError(err instanceof Error ? err.message : "Could not save listing");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={onClick}
        disabled={submitting}
        className="giq-outline-action w-full disabled:cursor-not-allowed disabled:opacity-60"
        aria-pressed={saved}
      >
        {submitting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} />
        )}
        {saved ? "Saved listing" : "Save listing"}
      </button>
      {error && <p className="mt-2 text-[11px] text-red-200">{error}</p>}
    </div>
  );
}
