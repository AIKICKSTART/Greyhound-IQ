import { ArrowLeft, Bookmark, Clock3, DollarSign, MapPin } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { ListingCardMediaCarousel } from "@/components/listing-card-media-carousel";
import { requireCurrentUserProfile } from "@/lib/auth";
import { getSavedListingsForCurrentUser } from "@/lib/listing-service";
import { mediaDeliveryUrl } from "@/lib/media-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Saved Marketplace - GreyhoundIQ",
  description: "Review marketplace items saved to your GreyhoundIQ account.",
};

const ACTION_CLASS = "giq-outline-action";

export default async function SavedListingsPage() {
  const current = await requireSavedListingsProfile();
  const savedListings = await getSavedListingsForCurrentUser(current);

  return (
    <div>
      <SavedListingsMemberHeader count={savedListings.length} />

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {savedListings.length > 0 ? (
          <div className="grid gap-5">
            {savedListings.map((item) => (
              <article
                key={item.listingId}
                className="giq-panel p-3 sm:p-4 [content-visibility:auto] [contain-intrinsic-size:auto_360px]"
              >
                <div className="grid gap-4 md:grid-cols-[minmax(240px,0.42fr)_minmax(0,1fr)] md:items-stretch">
                  <div className="min-w-0">
                    <ListingCardMediaCarousel
                      listingHref={`/marketplace/${item.listingId}`}
                      listingTitle={item.listing.title}
                      media={item.listing.media
                        .slice(0, 4)
                        .map(({ media }) => ({
                          id: media.id,
                          src: mediaDeliveryUrl(media),
                          alt: media.originalName ?? item.listing.title,
                          originalName: media.originalName,
                          mimeType: media.mimeType,
                          widthPx: media.widthPx,
                          heightPx: media.heightPx,
                        }))}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col p-1 sm:p-2">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="program-label">Saved marketplace item</p>
                        <h2 className="mt-2 text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
                          {item.listing.title}
                        </h2>
                        <p className="mt-2 line-clamp-3 text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
                          {item.listing.description}
                        </p>
                      </div>
                      <Link
                        href={`/marketplace/${item.listingId}`}
                        className={`${ACTION_CLASS} w-full shrink-0 sm:w-auto`}
                      >
                        View item
                      </Link>
                    </div>

                    <div className="mt-auto grid gap-3 pt-5 text-[12px] text-[hsl(var(--muted-foreground))] sm:grid-cols-2 lg:grid-cols-4">
                      <Metric
                        icon={<DollarSign className="h-3.5 w-3.5" aria-hidden="true" />}
                        label="Price"
                        value={formatPrice(item.listing.price, item.listing.currency)}
                      />
                      <Metric
                        icon={<MapPin className="h-3.5 w-3.5" aria-hidden="true" />}
                        label="Location"
                        value={item.listing.state ?? "Australia"}
                      />
                      <Metric
                        icon={<Clock3 className="h-3.5 w-3.5" aria-hidden="true" />}
                        label="Expires"
                        value={formatDate(item.listing.expiresAt)}
                      />
                      <Metric
                        icon={<Bookmark className="h-3.5 w-3.5" aria-hidden="true" />}
                        label="Saved"
                        value={formatDate(item.createdAt)}
                      />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="giq-empty-state px-5 py-12 text-center sm:px-8">
            <span className="giq-icon-plate mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
              <Bookmark
                className="h-6 w-6 text-[hsl(var(--primary-bright))]"
                aria-hidden="true"
              />
            </span>
            <h2 className="mt-4 text-xl font-semibold text-[hsl(var(--foreground))]">
              No saved marketplace items yet
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
              Save active marketplace items from their detail page.
            </p>
            <Link
              href="/marketplace"
              className={`${ACTION_CLASS} mt-5 w-full sm:w-auto`}
            >
              Browse marketplace
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function SavedListingsMemberHeader({ count }: { count: number }) {
  return (
    <header className="relative overflow-hidden border-b border-white/[0.07] bg-[linear-gradient(135deg,hsl(var(--card)/0.92),hsl(var(--background))_72%)]">
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(var(--primary-bright)/0.12)] blur-3xl"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-4 py-7 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-8">
        <div className="max-w-2xl">
          <p className="program-label">Member marketplace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[hsl(var(--foreground))] sm:text-4xl">
            Saved items
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-[hsl(var(--muted-foreground))] sm:text-[15px]">
            Return to marketplace items you saved for later review.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="giq-status-pill giq-status-pill-purple min-h-8 px-3">
            <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
            {count.toLocaleString("en-AU")} saved
          </span>
          <Link href="/account" className={ACTION_CLASS}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to account
          </Link>
        </div>
      </div>
    </header>
  );
}

async function requireSavedListingsProfile() {
  try {
    return await requireCurrentUserProfile();
  } catch (err) {
    if (err instanceof Error && err.message === "auth.unauthorized") {
      redirect("/sign-in");
    }
    throw err;
  }
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="giq-metric-card">
      <span className="inline-flex items-center gap-1.5 text-[hsl(var(--subtle-foreground))]">
        {icon}
        {label}
      </span>
      <p className="mt-1 font-semibold text-[hsl(var(--foreground))]">{value}</p>
    </div>
  );
}

function formatPrice(price: number | null, currency = "AUD") {
  if (price == null) return "POA";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(date: Date | null) {
  if (!date) return "Not set";
  return date.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
