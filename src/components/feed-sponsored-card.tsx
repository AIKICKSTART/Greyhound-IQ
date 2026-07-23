import type { ReactNode } from "react";
import Link from "next/link";
import { ImageIcon, Megaphone } from "lucide-react";

/**
 * Standalone Sponsored card for a boosted Marketplace listing.
 *
 * NOT wired into the Feed. The Feed owner inserts it per the advertising
 * contract (src/components/advertising-product-contract.ts), FEED_INLINE
 * placement:
 *   - dimensions: 1600×700 (16:7) desktop, 1080×1350 (4:5) mobile
 *   - insert only after at least 8 organic Feed entries (minimumOrganicGap)
 *   - at most 3 per session (maximumPerSession); never consecutive paid modules
 *   - anchor after a stable organic entry so realtime updates cannot reorder it
 * The immutable "Sponsored" label and seller identity are always rendered.
 * Pass the Feed's own hide / report / "Why this ad" controls via
 * `disclosureSlot`, and the listing media (already domain-configured) via
 * `media`; a branded placeholder renders when `media` is omitted.
 */
export type FeedSponsoredCardListing = {
  listingId: string;
  href: string;
  title: string;
  sellerName: string;
  priceLabel?: string | null;
};

export function FeedSponsoredCard({
  listing,
  media,
  disclosureSlot,
}: {
  listing: FeedSponsoredCardListing;
  media?: ReactNode;
  disclosureSlot?: ReactNode;
}) {
  return (
    <article
      className="giq-panel min-w-0 overflow-hidden"
      data-feed-sponsored-card
      data-listing-id={listing.listingId}
      aria-label={`Sponsored: ${listing.title}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[hsl(var(--secondary-light))]">
          <Megaphone className="size-3.5" aria-hidden="true" />
          Sponsored
        </span>
        <span className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">
          {listing.sellerName}
        </span>
      </div>

      <Link
        href={listing.href}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--primary-bright))]"
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-black/20 sm:aspect-[16/7]">
          {media ?? (
            <span className="grid h-full w-full place-items-center text-[hsl(var(--subtle-foreground))]">
              <ImageIcon className="size-8" aria-hidden="true" />
            </span>
          )}
        </div>
        <div className="flex items-start justify-between gap-3 p-4">
          <h3 className="min-w-0 truncate text-[15px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
            {listing.title}
          </h3>
          {listing.priceLabel ? (
            <span className="shrink-0 text-[15px] font-semibold text-[hsl(var(--secondary-light))]">
              {listing.priceLabel}
            </span>
          ) : null}
        </div>
      </Link>

      {disclosureSlot ? (
        <div className="border-t border-white/[0.08] px-4 py-2.5">
          {disclosureSlot}
        </div>
      ) : null}
    </article>
  );
}
