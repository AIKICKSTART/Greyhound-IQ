import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  DollarSign,
  MapPin,
  Search,
  ShoppingBag,
} from "lucide-react";
import { ListingCardMediaCarousel } from "@/components/listing-card-media-carousel";
import { PageHero } from "@/components/page-hero";
import { getDemoListingImages } from "@/lib/demo-listing-media";
import { mediaDeliveryUrl } from "@/lib/media-service";
import {
  getMarketplaceCategories,
  getMarketplaceListings,
} from "@/lib/queries";
import {
  Skeleton,
  SkeletonGroup,
  SkeletonPanel,
  SkeletonText,
} from "@/components/skeleton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Marketplace - GreyhoundIQ",
  description:
    "Browse Australian greyhound pups, dogs, stud services, wanted ads, and ownership marketplace items on GreyhoundIQ.",
};

const TYPE_LABEL: Record<string, string> = {
  pup_for_sale: "Pup for sale",
  dog_for_sale: "Dog for sale",
  stud_service: "Stud service",
  wanted: "Wanted",
  share: "Share",
};

function formatPrice(price: number | null): string {
  if (price == null) return "POA";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(date: Date | null): string {
  if (!date) return "No expiry";
  return date.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; submitted?: string }>;
}) {
  return (
    <div>
      <PageHero
        image="/images/wentworth-gate-hero.webp"
        title={
          <>
            Marketplace.
            <br />
            <span className="gradient-text">Verified context.</span>
          </>
        }
        subtitle="Browse pups, dogs, stud services, and wanted ads with dog records and seller context connected to the racing database."
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/groups"
            className="giq-button giq-button-glass px-5 text-[13px] font-semibold"
          >
            Discuss in Groups
          </Link>
          <Link
            href="/marketplace/new"
            className="giq-button giq-button-primary px-5 text-[13px] font-semibold"
          >
            Create marketplace item
          </Link>
        </div>
      </PageHero>

      <Suspense fallback={<ListingsFallback q="" />}>
        <ListingsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ListingsContent({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; submitted?: string }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const category =
    typeof params.category === "string" ? params.category.trim() : "";

  return (
    <ListingsResults
      q={q}
      category={category}
      submitted={params.submitted === "review"}
    />
  );
}

async function ListingsResults({
  q,
  category,
  submitted,
}: {
  q: string;
  category: string;
  submitted: boolean;
}) {
  const [listings, categories] = await Promise.all([
    getMarketplaceListings(24, { q, categorySlug: category || null }),
    getMarketplaceCategories(),
  ]);

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      {submitted && (
        <div className="giq-panel mb-6 border border-[hsl(var(--primary-bright)/0.35)] p-4">
          <p className="text-[13px] font-semibold text-[hsl(var(--foreground))]">
            Marketplace item submitted for review.
          </p>
          <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
            It will appear in the marketplace after moderator approval.
          </p>
        </div>
      )}

      <ListingsToolbar
        q={q}
        category={category}
        categories={categories}
        count={listings.length}
      />

      {listings.length === 0 ? (
        <div className="giq-empty-state p-12 text-center">
          <p className="text-[14px] text-[hsl(var(--muted-foreground))]">
            No marketplace items loaded yet.
          </p>
        </div>
      ) : (
        <div className="giq-stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <article
              key={listing.id}
              className="giq-panel giq-panel-hover giq-listing-card flex min-h-[360px] flex-col"
            >
              {(() => {
                const demoImage = getDemoListingImages(listing, 1)[0];
                return (
                  <div className="p-2 pb-0">
                    <ListingCardMediaCarousel
                      listingHref={`/marketplace/${listing.id}`}
                      listingTitle={listing.title}
                      media={listing.media.map(({ media }) => ({
                        id: media.id,
                        src: mediaDeliveryUrl(media),
                        alt: media.originalName ?? listing.title,
                        originalName: media.originalName,
                        mimeType: media.mimeType,
                        widthPx: media.widthPx,
                        heightPx: media.heightPx,
                      }))}
                      fallbackImage={demoImage}
                    />
                  </div>
                );
              })()}
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="program-label">Marketplace</p>
                    <span className="giq-badge giq-badge-purple mt-2">
                      {TYPE_LABEL[listing.type] ?? listing.type}
                    </span>
                  </div>
                  <span
                    className={`giq-badge ${
                      listing.status === "active"
                        ? "giq-badge-purple"
                        : "giq-badge-neutral"
                    }`}
                  >
                    {listing.status}
                  </span>
                </div>

                <h3 className="text-[18px] font-semibold leading-snug text-[hsl(var(--foreground))]">
                  <Link
                    href={`/marketplace/${listing.id}`}
                    className="transition-colors hover:text-[hsl(var(--primary-bright))]"
                  >
                    {listing.title}
                  </Link>
                </h3>
                <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-[hsl(215_14%_68%)]">
                  {listing.description}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3 text-[12px] text-[hsl(var(--muted-foreground))]">
                  <span className="giq-listing-price inline-flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-[hsl(var(--secondary))]" />
                    {formatPrice(listing.price)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[hsl(var(--primary-bright))]" />
                    {listing.state ?? "Australia"}
                  </span>
                  <span className="col-span-2 inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                    Expires {formatDate(listing.expiresAt)}
                  </span>
                </div>

                {listing.dog && (
                  <Link
                    href={`/dogs/${listing.dog.id}`}
                    className="giq-subpanel mt-4 block p-3 transition-colors hover:bg-white/[0.04]"
                  >
                    <p className="text-[12px] font-semibold text-[hsl(var(--foreground))]">
                      {listing.dog.name}
                    </p>
                    <p className="mt-1 text-[11px] text-[hsl(var(--subtle-foreground))]">
                      {listing.dog.sire?.name ?? "Unknown sire"} x{" "}
                      {listing.dog.dam?.name ?? "unknown dam"}
                    </p>
                  </Link>
                )}

                <div className="mt-auto border-t border-white/[0.05] pt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--primary-bright))]" />
                      {listing.profile.verified ? "Verified seller" : "Community seller"}
                    </span>
                    <span className="text-[12px] text-[hsl(var(--subtle-foreground))]">
                      {listing.profile.displayName}
                    </span>
                  </div>
                  <Link
                    href={`/marketplace/${listing.id}`}
                    className="giq-outline-action w-full text-[12px]"
                  >
                    View marketplace item
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ListingsFallback({
  q,
  category = "",
}: {
  q: string;
  category?: string;
}) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <ListingsToolbar q={q} category={category} categories={[]} />
      <SkeletonGroup label="Loading marketplace">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <SkeletonPanel
              key={item}
              className="giq-listing-card flex min-h-[360px] flex-col"
            >
              <Skeleton className="h-40 w-full rounded-[10px]" />
              <div className="mt-4 flex items-start justify-between gap-3">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="mt-4 h-5 w-4/5" />
              <SkeletonText lines={2} className="mt-3" />
              <div className="mt-auto border-t border-white/[0.05] pt-4">
                <Skeleton className="h-9 w-full rounded-[10px]" />
              </div>
            </SkeletonPanel>
          ))}
        </div>
      </SkeletonGroup>
    </section>
  );
}

function ListingsToolbar({
  q,
  category,
  categories,
  count,
}: {
  q: string;
  category: string;
  categories: Array<{ slug: string; name: string }>;
  count?: number;
}) {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="race-box-strip mb-4 w-40" />
          <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
            Current marketplace
          </h2>
          <p className="mt-1 text-[14px] text-[hsl(var(--muted-foreground))]">
            {typeof count === "number"
              ? `${count} active marketplace items${q ? ` matching "${q}".` : "."}`
              : "Loading marketplace items."}
          </p>
        </div>
        <div className="giq-icon-plate flex h-10 w-10 items-center justify-center rounded-xl">
          <ShoppingBag className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <form
          action="/marketplace"
          className="flex min-w-0 flex-1 gap-2 md:max-w-md"
        >
          <input
            name="q"
            defaultValue={q}
            placeholder="Search title or description"
            className="giq-form-control min-w-0 flex-1 px-3 py-2 text-[13px]"
          />
          <select
            name="category"
            defaultValue={category}
            className="giq-form-control w-36 px-3 py-2 text-[13px]"
          >
            <option value="">All</option>
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            aria-label="Search marketplace"
            className="giq-button giq-button-glass giq-icon-button text-[hsl(215_14%_84%)]"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>
      </div>
    </>
  );
}
