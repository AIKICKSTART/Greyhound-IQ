"use client";

import { Check, Copy, Loader2, Share2 } from "lucide-react";
import { useState } from "react";

type ListingShareStatus =
  | "idle"
  | "sharing"
  | "shared"
  | "copied"
  | "cancelled"
  | "error";

type ListingShareAdapter = {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: {
    writeText(value: string): Promise<void>;
  };
};

export function buildListingShareUrl(origin: string, listingId: string) {
  return new URL(
    `/marketplace/${encodeURIComponent(listingId)}`,
    origin,
  ).toString();
}

export async function executeListingShare({
  adapter,
  listingId,
  origin,
  title,
}: {
  adapter: ListingShareAdapter;
  listingId: string;
  origin: string;
  title: string;
}): Promise<Exclude<ListingShareStatus, "idle" | "sharing" | "error">> {
  const url = buildListingShareUrl(origin, listingId);
  if (adapter.share) {
    try {
      await adapter.share({ title, text: title, url });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  if (adapter.clipboard) {
    await adapter.clipboard.writeText(url);
    return "copied";
  }
  throw new Error("listing.share_unavailable");
}

export function ListingShareButton({
  listingId,
  title,
}: {
  listingId: string;
  title: string;
}) {
  const [status, setStatus] = useState<ListingShareStatus>("idle");

  async function onShare() {
    setStatus("sharing");
    try {
      setStatus(
        await executeListingShare({
          adapter: navigator,
          listingId,
          origin: window.location.origin,
          title,
        }),
      );
    } catch {
      setStatus("error");
    }
  }

  const label =
    status === "sharing"
      ? "Opening share options..."
      : status === "shared"
        ? "Listing shared"
        : status === "copied"
          ? "Listing link copied"
          : status === "cancelled"
            ? "Share listing"
            : status === "error"
              ? "Copy unavailable — try again"
              : "Share listing";
  const Icon =
    status === "sharing"
      ? Loader2
      : status === "shared"
        ? Check
        : status === "copied"
          ? Copy
          : Share2;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onShare}
        disabled={status === "sharing"}
        className="giq-outline-action min-h-11 w-full justify-center text-[12px] disabled:cursor-wait disabled:opacity-70"
      >
        <Icon
          className={`h-4 w-4 ${status === "sharing" ? "animate-spin" : ""}`}
          aria-hidden="true"
        />
        {label}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {status === "error"
          ? "Sharing is unavailable in this browser. Copy the address from the browser bar."
          : label}
      </span>
    </div>
  );
}
