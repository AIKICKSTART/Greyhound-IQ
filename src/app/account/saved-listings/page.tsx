import { ArrowLeft, Bookmark, Clock3, DollarSign, MapPin } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { PageHero } from "@/components/page-hero";
import { requireCurrentUserProfile } from "@/lib/auth";
import { getSavedListingsForCurrentUser } from "@/lib/listing-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Saved listings - GreyhoundIQ",
  description: "Review marketplace listings saved to your GreyhoundIQ account.",
};

const ACTION_CLASS = "giq-outline-action";

export default async function SavedListingsPage() {
  const current = await requireSavedListingsProfile();
  const savedListings = await getSavedListingsForCurrentUser(current);

  return (
    <div>
      <PageHero
        image="/images/wentworth-gate-hero.webp"
        title={
          <>
            Saved
            <br />
            <span className="gradient-text">listings.</span>
          </>
        }
        subtitle="Marketplace listings you have saved for later review."
      />

      <section className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/account" className={`${ACTION_CLASS} mb-6 w-fit`}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to account
        </Link>

        {savedListings.length > 0 ? (
          <div className="grid gap-4">
            {savedListings.map((item) => (
              <article key={item.listingId} className="giq-panel p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="program-label">Saved listing</p>
                    <h2 className="mt-2 text-xl font-semibold text-[hsl(var(--foreground))]">
                      {item.listing.title}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                      {item.listing.description}
                    </p>
                  </div>
                  <Link
                    href={`/listings/${item.listingId}`}
                    className={`${ACTION_CLASS} shrink-0`}
                  >
                    View listing
                  </Link>
                </div>

                <div className="mt-5 grid gap-3 text-[12px] text-[hsl(var(--muted-foreground))] sm:grid-cols-2 lg:grid-cols-4">
                  <Metric
                    icon={<DollarSign className="h-3.5 w-3.5" />}
                    label="Price"
                    value={formatPrice(item.listing.price, item.listing.currency)}
                  />
                  <Metric
                    icon={<MapPin className="h-3.5 w-3.5" />}
                    label="Location"
                    value={item.listing.state ?? "Australia"}
                  />
                  <Metric
                    icon={<Clock3 className="h-3.5 w-3.5" />}
                    label="Expires"
                    value={formatDate(item.listing.expiresAt)}
                  />
                  <Metric
                    icon={<Bookmark className="h-3.5 w-3.5" />}
                    label="Saved"
                    value={formatDate(item.createdAt)}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="giq-empty-state p-10 text-center">
            <Bookmark className="mx-auto mb-4 h-8 w-8 text-[hsl(var(--primary-bright))]" />
            <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
              No saved listings yet
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              Save active marketplace listings from their detail page.
            </p>
            <Link href="/listings" className={`${ACTION_CLASS} mt-5`}>
              Browse listings
            </Link>
          </div>
        )}
      </section>
    </div>
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
