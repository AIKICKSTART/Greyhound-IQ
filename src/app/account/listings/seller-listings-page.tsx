import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  Clock3,
  FilePenLine,
  Megaphone,
  Plus,
  ShoppingBag,
} from "lucide-react";

import {
  MARKETPLACE_BOOST_PACKAGES,
  formatAud,
} from "@/components/advertising-product-contract";
import { PageTitle } from "@/components/page-title";
import { hasTier, requireCurrentUserProfile } from "@/lib/auth";
import {
  getSellerListingsForCurrentUser,
} from "@/lib/listing-service";
import type { SellerListingView } from "@/lib/seller-listing-view";

const VIEW_LINKS: Array<{
  view: SellerListingView;
  href: string;
  label: string;
}> = [
  { view: "all", href: "/account/listings", label: "All listings" },
  { view: "drafts", href: "/account/listings/drafts", label: "Drafts" },
  { view: "archived", href: "/account/listings/archived", label: "Archived" },
];

const VIEW_COPY: Record<
  SellerListingView,
  { title: string; description: string; empty: string }
> = {
  all: {
    title: "My marketplace listings",
    description:
      "Review the latest 100 marketplace items owned by your account across every lifecycle state.",
    empty: "You have not created a marketplace listing yet.",
  },
  drafts: {
    title: "Draft listings",
    description:
      "Review owner-only draft records before they are submitted for moderation.",
    empty: "You do not have any draft listings.",
  },
  archived: {
    title: "Archived listings",
    description:
      "Review owner-only archived records that no longer appear in active inventory.",
    empty: "You do not have any archived listings.",
  },
};

export async function SellerListingsViewPage({
  view,
}: {
  view: SellerListingView;
}) {
  const current = await requireSellerListingsProfile(view);
  const listings = await getSellerListingsForCurrentUser(current, view);
  const copy = VIEW_COPY[view];

  return (
    <div>
      <header className="relative overflow-hidden border-b border-white/[0.07] bg-[linear-gradient(135deg,hsl(var(--card)/0.92),hsl(var(--background))_72%)]">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(var(--primary-bright)/0.12)] blur-3xl"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-4 py-7 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-8">
          <div className="max-w-3xl">
            <p className="program-label">Seller workspace</p>
            <PageTitle className="mt-2">
              {copy.title}
            </PageTitle>
            <p className="mt-2 text-[14px] leading-6 text-[hsl(var(--muted-foreground))]">
              {copy.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/account" className="giq-button giq-button-glass min-h-11 px-4 text-[13px] font-semibold">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Account
            </Link>
            <Link href="/marketplace/new" className="giq-button giq-button-primary min-h-11 px-4 text-[13px] font-semibold">
              <Plus className="size-4" aria-hidden="true" />
              Create item
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <nav
          aria-label="Seller listing views"
          className="giq-panel mb-6 flex flex-wrap gap-2 p-3"
        >
          {VIEW_LINKS.map((item) => (
            <Link
              key={item.view}
              href={item.href}
              aria-current={item.view === view ? "page" : undefined}
              className={
                item.view === view
                  ? "giq-button giq-button-primary min-h-11 px-4 text-[12px] font-semibold"
                  : "giq-button giq-button-glass min-h-11 px-4 text-[12px] font-semibold"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
            {listings.length.toLocaleString("en-AU")} listing
            {listings.length === 1 ? "" : "s"} shown
          </p>
          <p className="text-[11px] text-[hsl(var(--subtle-foreground))]">
            Bounded to the 100 most recently updated records
          </p>
        </div>

        {listings.length > 0 ? (
          <div className="grid gap-4">
            {listings.map((listing) => (
              <article key={listing.id} className="giq-panel p-4 sm:p-5">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="giq-badge giq-badge-purple">
                        {humanise(listing.status)}
                      </span>
                      <span className="giq-badge giq-badge-neutral">
                        {listing.category?.name ?? humanise(listing.type)}
                      </span>
                    </div>
                    <h2 className="mt-3 text-xl font-semibold text-[hsl(var(--foreground))]">
                      {listing.title}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
                      {listing.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[hsl(var(--subtle-foreground))]">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="size-3.5" aria-hidden="true" />
                        Updated {formatDate(listing.updatedAt)}
                      </span>
                      <span>{formatPrice(listing.price, listing.currency)}</span>
                      <span>{listing.state ?? "Australia"}</span>
                    </div>
                  </div>
                  <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-48">
                    <Link
                      href={`/marketplace/${listing.id}`}
                      className="giq-button giq-button-glass min-h-11 w-full px-4 text-[12px] font-semibold"
                    >
                      <ShoppingBag className="size-4" aria-hidden="true" />
                      View listing
                    </Link>
                    {listing.status !== "archived" ? (
                      <Link
                        href={`/marketplace/${listing.id}/edit`}
                        className="giq-button giq-button-primary min-h-11 w-full px-4 text-[12px] font-semibold"
                      >
                        <FilePenLine className="size-4" aria-hidden="true" />
                        Edit listing
                      </Link>
                    ) : null}
                    {hasTier(current.tier, "pro") &&
                    listing.status === "active" &&
                    listing.moderationStatus === "approved" ? (
                      <BoostListingForm listingId={listing.id} />
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="giq-empty-state px-5 py-12 text-center sm:px-8">
            <span className="giq-icon-plate mx-auto grid size-12 place-items-center rounded-2xl">
              <Archive className="size-5 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-xl font-semibold text-[hsl(var(--foreground))]">
              Nothing in this view
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
              {copy.empty}
            </p>
            <Link href="/marketplace/new" className="giq-button giq-button-primary mt-5 min-h-11 px-5 text-[13px] font-semibold">
              <Plus className="size-4" aria-hidden="true" />
              Create marketplace item
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}

// Native POST to the server-side boost checkout — server verifies ownership,
// tier and active/approved state, and resolves the price. No client JS needed.
function BoostListingForm({ listingId }: { listingId: string }) {
  return (
    <form
      action="/api/billing/boost/checkout"
      method="post"
      className="grid gap-2 rounded-lg border border-white/[0.1] bg-white/[0.02] p-2"
    >
      <input type="hidden" name="listingId" value={listingId} />
      <label className="sr-only" htmlFor={`boost-${listingId}`}>
        Boost package
      </label>
      <select
        id={`boost-${listingId}`}
        name="packageId"
        className="min-h-11 rounded-lg border border-white/[0.12] bg-[hsl(var(--background))] px-3 text-[12px] text-[hsl(var(--foreground))]"
      >
        {MARKETPLACE_BOOST_PACKAGES.map((pkg) => (
          <option key={pkg.id} value={pkg.id}>
            {pkg.name} — {formatAud(pkg.priceCentsIncludingGst)}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="giq-button giq-button-gold min-h-11 w-full px-4 text-[12px] font-semibold"
      >
        <Megaphone className="size-4" aria-hidden="true" />
        Boost listing
      </button>
    </form>
  );
}

async function requireSellerListingsProfile(view: SellerListingView) {
  try {
    return await requireCurrentUserProfile();
  } catch (error) {
    if (error instanceof Error && error.message === "auth.unauthorized") {
      const suffix = view === "all" ? "" : `/${view}`;
      const returnTo = `/account/listings${suffix}`;
      redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
    }
    throw error;
  }
}

function humanise(value: string) {
  return value.replaceAll("_", " ");
}

function formatPrice(price: number | null, currency: string) {
  if (price === null) return "Price on application";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
