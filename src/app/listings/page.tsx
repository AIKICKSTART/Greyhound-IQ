import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Plus,
  Search,
  SearchX,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { ListingCardMediaCarousel } from "@/components/listing-card-media-carousel";
import { PageHero } from "@/components/page-hero";
import { getCurrentUser } from "@/lib/auth";
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

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; submitted?: string }>;
}) {
  const user = await getCurrentUser();
  const signedIn = Boolean(user);

  return (
    <div>
      {signedIn ? <MarketplaceMemberHeader /> : <MarketplaceMarketingHero />}

      <Suspense fallback={<ListingsFallback q="" />}>
        <ListingsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function MarketplaceMarketingHero() {
  return (
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
  );
}

function MarketplaceMemberHeader() {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.07] bg-[linear-gradient(135deg,hsl(var(--card)/0.92),hsl(var(--background))_72%)]">
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(var(--primary-bright)/0.12)] blur-3xl"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-5 px-4 py-7 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-8">
        <div className="max-w-2xl">
          <p className="program-label">Member marketplace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[hsl(var(--foreground))] sm:text-4xl">
            Marketplace
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-[hsl(var(--muted-foreground))] sm:text-[15px]">
            Browse pups, dogs, stud services, and wanted ads with seller and
            racing context in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/groups"
            className="giq-button giq-button-glass min-h-11 px-5 text-[13px] font-semibold"
          >
            Discuss in Groups
          </Link>
          <Link
            href="/marketplace/new"
            className="giq-button giq-button-primary min-h-11 px-5 text-[13px] font-semibold"
          >
            <Plus className="h-4 w-4" />
            Create item
          </Link>
        </div>
      </div>
    </section>
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
  const hasFilters = Boolean(q || category);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {submitted && (
        <div
          role="status"
          aria-live="polite"
          className="giq-panel mb-6 flex items-start gap-3 border border-[hsl(var(--primary-bright)/0.35)] p-4"
        >
          <span className="giq-icon-plate flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <CheckCircle2 className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-[hsl(var(--foreground))]">
              Marketplace item submitted for review.
            </p>
            <p className="mt-1 text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
              It will appear in the marketplace after moderator approval.
            </p>
          </div>
        </div>
      )}

      <ListingsToolbar
        q={q}
        category={category}
        categories={categories}
        count={listings.length}
      />

      {listings.length === 0 ? (
        <div className="giq-empty-state px-6 py-14 text-center">
          <span className="giq-icon-plate mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
            {hasFilters ? (
              <SearchX className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
            ) : (
              <ShoppingBag className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
            )}
          </span>
          <h3 className="mt-4 text-[18px] font-semibold text-[hsl(var(--foreground))]">
            {hasFilters
              ? "No items match these filters"
              : "No marketplace items yet"}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
            {hasFilters
              ? "Clear the current filters to browse every active item, or create a new listing."
              : "Be the first member to create a marketplace item for the community."}
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            {hasFilters && (
              <Link
                href="/marketplace"
                className="giq-button giq-button-glass min-h-11 px-5 text-[13px] font-semibold"
              >
                Clear filters
              </Link>
            )}
            <Link
              href="/marketplace/new"
              className="giq-button giq-button-primary min-h-11 px-5 text-[13px] font-semibold"
            >
              <Plus className="h-4 w-4" />
              Create marketplace item
            </Link>
          </div>
        </div>
      ) : (
        <div className="giq-stagger grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <article
              key={listing.id}
              className="giq-panel giq-panel-hover giq-listing-card flex min-h-[430px] flex-col"
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
              <div className="flex flex-1 flex-col p-5 pt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="giq-badge giq-badge-purple">
                    {TYPE_LABEL[listing.type] ?? listing.type}
                  </span>
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

                <p className="giq-listing-price text-[21px] font-semibold tracking-[-0.025em] text-[hsl(var(--secondary))]">
                  {formatPrice(listing.price)}
                </p>
                <h3 className="mt-1 text-[18px] font-semibold leading-snug text-[hsl(var(--foreground))]">
                  <Link
                    href={`/marketplace/${listing.id}`}
                    className="rounded-sm transition-colors hover:text-[hsl(var(--primary-bright))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-bright))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--card))]"
                  >
                    {listing.title}
                  </Link>
                </h3>
                <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-[hsl(var(--muted-foreground))]">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--primary-bright))]" />
                  {listing.state ?? "Australia"}
                </p>
                <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-[hsl(215_14%_68%)]">
                  {listing.description}
                </p>

                <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-[hsl(var(--subtle-foreground))]">
                  <Clock3 className="h-3.5 w-3.5" />
                  Expires {formatDate(listing.expiresAt)}
                </p>

                {listing.dog && (
                  <Link
                    href={`/dogs/${listing.dog.id}`}
                    className="giq-subpanel mt-4 block p-3 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-bright))]"
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
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className="giq-icon-plate flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                      <ShieldCheck
                        className={`h-4 w-4 ${
                          listing.profile.verified
                            ? "text-[hsl(var(--secondary))]"
                            : "text-[hsl(var(--primary-bright))]"
                        }`}
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-[hsl(var(--foreground))]">
                        {listing.profile.displayName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                        {listing.profile.verified
                          ? "Verified seller"
                          : "Community seller"}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/marketplace/${listing.id}`}
                    className="giq-outline-action min-h-11 w-full justify-center text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-bright))]"
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
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <ListingsToolbar q={q} category={category} categories={[]} />
      <SkeletonGroup label="Loading marketplace">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <SkeletonPanel
              key={item}
              className="giq-listing-card flex min-h-[360px] flex-col"
            >
              <Skeleton className="aspect-[16/10] w-full rounded-[10px]" />
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
  const hasFilters = Boolean(q || category);

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
              ? `${count} marketplace item${count === 1 ? "" : "s"} shown${
                  q ? ` matching "${q}".` : "."
                }`
              : "Loading marketplace items."}
          </p>
        </div>
        <div className="giq-icon-plate flex h-10 w-10 items-center justify-center rounded-xl">
          <ShoppingBag className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
        </div>
      </div>

      <form
        action="/marketplace"
        className="giq-panel mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_15rem_auto_auto] lg:items-end"
      >
        <label className="min-w-0">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">
            Search
          </span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Title or description"
            className="giq-form-control min-h-11 w-full min-w-0 px-3 py-2 text-[13px]"
          />
        </label>
        <label className="min-w-0">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">
            Category
          </span>
          <select
            name="category"
            defaultValue={category}
            className="giq-form-control min-h-11 w-full px-3 py-2 text-[13px]"
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="giq-button giq-button-primary min-h-11 w-full px-5 text-[13px] font-semibold sm:col-span-2 lg:col-span-1 lg:w-auto"
        >
          <Search className="h-4 w-4" />
          Show results
        </button>
        {hasFilters && (
          <Link
            href="/marketplace"
            className="giq-button giq-button-glass min-h-11 w-full px-5 text-[13px] font-semibold sm:col-span-2 lg:col-span-1 lg:w-auto"
          >
            Clear
          </Link>
        )}
      </form>
    </>
  );
}
