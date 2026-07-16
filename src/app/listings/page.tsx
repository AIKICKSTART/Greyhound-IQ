import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Plus,
  Search,
  SearchX,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { ListingCardMediaCarousel } from "@/components/listing-card-media-carousel";
import { AutoSubmitSelect } from "@/components/auto-submit-select";
import { MarketplaceDogPlayerCard } from "@/components/marketplace-dog-player-card";
import { MARKETPLACE_TEMPLATE_LISTINGS } from "@/components/marketplace-template-data";
import { PageHero } from "@/components/page-hero";
import { PageTitle } from "@/components/page-title";
import { getCurrentUser } from "@/lib/auth";
import { getDemoListingImages } from "@/lib/demo-listing-media";
import { getSavedListingIdsForProfile } from "@/lib/listing-service";
import {
  MARKETPLACE_MAX_PAGE,
  MARKETPLACE_PAGE_SIZE,
  marketplacePageHref,
  marketplacePageOffset,
  parseMarketplaceCategory,
  parseMarketplacePage,
  parseMarketplaceSearch,
  parseMarketplaceSort,
  type MarketplaceSort,
} from "@/lib/marketplace-navigation";
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

type MarketplaceSearchParams = {
  q?: string;
  category?: string;
  sort?: string;
  page?: string;
  submitted?: string;
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
  searchParams: Promise<MarketplaceSearchParams>;
}) {
  const user = await getCurrentUser();
  const signedIn = Boolean(user);

  return (
    <div>
      {signedIn ? <MarketplaceMemberHeader /> : <MarketplaceMarketingHero />}

      <Suspense fallback={<ListingsFallback q="" />}>
        <ListingsContent
          searchParams={searchParams}
          viewerProfileId={user?.profileId ?? null}
        />
      </Suspense>
    </div>
  );
}

function MarketplaceMarketingHero() {
  return (
    <PageHero
      image="/images/demo-listing-dog-for-sale.webp"
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
          <PageTitle className="mt-2">
            Marketplace
          </PageTitle>
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
  viewerProfileId,
}: {
  searchParams: Promise<MarketplaceSearchParams>;
  viewerProfileId: string | null;
}) {
  const params = await searchParams;
  const q = parseMarketplaceSearch(params.q);
  const category = parseMarketplaceCategory(params.category);
  const sort = parseMarketplaceSort(params.sort);
  const page = parseMarketplacePage(params.page);

  return (
    <ListingsResults
      q={q}
      category={category}
      sort={sort}
      page={page}
      submitted={params.submitted === "review"}
      viewerProfileId={viewerProfileId}
    />
  );
}

async function ListingsResults({
  q,
  category,
  sort,
  page,
  submitted,
  viewerProfileId,
}: {
  q: string;
  category: string;
  sort: MarketplaceSort;
  page: number;
  submitted: boolean;
  viewerProfileId: string | null;
}) {
  const [listingPage, categories] = await Promise.all([
    getMarketplaceListings(MARKETPLACE_PAGE_SIZE + 1, {
      q,
      categorySlug: category || null,
      sort: sort || null,
      offset: marketplacePageOffset(page),
    }),
    getMarketplaceCategories(),
  ]);
  const hasNextPage =
    page < MARKETPLACE_MAX_PAGE && listingPage.length > MARKETPLACE_PAGE_SIZE;
  const listings = listingPage.slice(0, MARKETPLACE_PAGE_SIZE);
  const savedListingIds = viewerProfileId
    ? await getSavedListingIdsForProfile(
        viewerProfileId,
        listings.map((listing) => listing.id)
      )
    : new Set<string>();
  const hasFilters = Boolean(q || category || sort);
  const isBeyondFirstPage = page > 1;

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

      {!q && !category && page === 1 ? <MarketplaceProfileShowcase /> : null}

      <ListingsToolbar
        q={q}
        category={category}
        sort={sort}
        categories={categories}
        count={listings.length}
      />

      {listings.length === 0 ? (
        <div className="giq-empty-state px-6 py-14 text-center">
          <span className="giq-icon-plate mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
            {hasFilters || isBeyondFirstPage ? (
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
            {isBeyondFirstPage
              ? "Use the previous-page control to return to available marketplace inventory."
              : hasFilters
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
          {listings.map((listing) =>
            listing.dog ? (
              <MarketplaceDogListingPlayerCard
                key={listing.id}
                listing={listing}
                dog={listing.dog}
                initiallySaved={savedListingIds.has(listing.id)}
                canSave={Boolean(
                  viewerProfileId && viewerProfileId !== listing.profile.id
                )}
              />
            ) : (
            <article
              key={listing.id}
              aria-label={`${listing.title} marketplace item`}
              data-marketplace-inventory-item
              data-marketplace-inventory-kind={listing.type}
              className="giq-panel giq-panel-hover giq-listing-card group flex min-h-[430px] min-w-0 flex-col overflow-hidden"
            >
              {(() => {
                const demoImage = getDemoListingImages(listing, 1)[0];
                return (
                  <div
                    data-marketplace-item-media
                    className="relative order-first w-full p-2 pb-0"
                  >
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
                    {demoImage ? (
                      <span className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/20 bg-black/75 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.13em] text-white/78 shadow-lg backdrop-blur">
                        Illustrative demo media
                      </span>
                    ) : null}
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
            )
          )}
        </div>
      )}

      <MarketplacePagination
        page={page}
        hasNextPage={hasNextPage}
        q={q}
        category={category}
        sort={sort}
      />
    </section>
  );
}

function MarketplacePagination({
  page,
  hasNextPage,
  q,
  category,
  sort,
}: {
  page: number;
  hasNextPage: boolean;
  q: string;
  category: string;
  sort: MarketplaceSort;
}) {
  if (page === 1 && !hasNextPage) return null;

  const navigationState = { q, category, sort };

  return (
    <nav
      aria-label="Marketplace pagination"
      className="giq-panel mt-8 flex flex-wrap items-center justify-between gap-3 p-4"
    >
      <p className="text-[12px] font-semibold text-[hsl(var(--muted-foreground))]">
        Page {page} of at most {MARKETPLACE_MAX_PAGE}
      </p>
      <div className="flex flex-wrap gap-2">
        {page > 1 ? (
          <Link
            rel="prev"
            href={marketplacePageHref(navigationState, page - 1)}
            className="giq-button giq-button-glass min-h-11 px-4 text-[12px] font-semibold"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Previous
          </Link>
        ) : null}
        {hasNextPage ? (
          <Link
            rel="next"
            href={marketplacePageHref(navigationState, page + 1)}
            className="giq-button giq-button-primary min-h-11 px-4 text-[12px] font-semibold"
          >
            Next
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

function MarketplaceProfileShowcase() {
  return (
    <section
      aria-labelledby="marketplace-profile-showcase-heading"
      className="mb-10"
      data-marketplace-profile-showcase
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <div className="race-box-strip mb-4 w-40" />
          <h2
            id="marketplace-profile-showcase-heading"
            className="text-2xl font-semibold text-[hsl(var(--foreground))]"
          >
            Verified dog card showcase
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-[hsl(var(--muted-foreground))] sm:text-[14px]">
            Six interactive public-profile cards built from existing racing
            records. These are demo discovery cards, not active sale
            advertisements; browse all active marketplace items below.
          </p>
        </div>
        <span className="giq-badge giq-badge-gold">
          {MARKETPLACE_TEMPLATE_LISTINGS.length} public profiles
        </span>
      </div>

      <div className="grid min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {MARKETPLACE_TEMPLATE_LISTINGS.map((listing) => (
          <article
            key={listing.listingId}
            data-template-player-card={listing.listingId}
            className="giq-panel giq-panel-hover min-w-0 p-3"
          >
            <MarketplaceDogPlayerCard
              dog={listing}
              artwork={{ kind: "image", src: listing.artworkSrc }}
              saveMode="local"
            />
            <Link
              href={listing.profileHref}
              className="giq-outline-action mt-3 min-h-11 w-full justify-center text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-bright))]"
            >
              View {listing.name}&apos;s public profile
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

type MarketplaceListing = Awaited<
  ReturnType<typeof getMarketplaceListings>
>[number];

function MarketplaceDogListingPlayerCard({
  listing,
  dog,
  initiallySaved,
  canSave,
}: {
  listing: MarketplaceListing;
  dog: NonNullable<MarketplaceListing["dog"]>;
  initiallySaved: boolean;
  canSave: boolean;
}) {
  const primaryImage = listing.media.find(({ media }) =>
    media.mimeType.startsWith("image/")
  )?.media;
  const fallbackImage = getDemoListingImages(listing, 1)[0];
  const artworkSrc = primaryImage
    ? mediaDeliveryUrl(primaryImage)
    : fallbackImage?.src ?? "/images/demo-listing-dog.webp";
  const sex = normaliseDogSex(dog.sex);
  const colourSex = [dog.colour, sex].filter(Boolean).join(" ") || "Greyhound";
  const location =
    listing.location?.region ??
    listing.state ??
    listing.profile.state ??
    "Australia";

  return (
    <div
      data-marketplace-dog-listing
      data-marketplace-inventory-item
      data-marketplace-inventory-kind={listing.type}
      className="giq-panel giq-panel-hover min-w-0 p-3"
    >
      <MarketplaceDogPlayerCard
        dog={{
          listingId: listing.id,
          dogId: dog.id,
          name: dog.name,
          colourSex,
          starts: dog.careerStarts,
          wins: dog.careerWins,
          seconds: dog.careerSeconds,
          thirds: dog.careerThirds,
          strikeRate: dog.winPercentage,
          prizeMoney: formatPrice(dog.prizeMoney),
          pedigree: `${dog.sire?.name ?? "Unknown sire"} × ${dog.dam?.name ?? "unknown dam"}`,
          price: formatPrice(listing.price),
          description: listing.description,
          listingLabel: TYPE_LABEL[listing.type] ?? listing.type,
          listingHref: `/marketplace/${listing.id}`,
          profileHref: `/dogs/${dog.id}`,
          seller: {
            displayName: listing.profile.displayName,
            verified: listing.profile.verified,
            region: location,
            memberSince: `Member since ${listing.profile.createdAt.getFullYear()}`,
            responseTime: "Enquiries in Pulse",
            history: listing.profile.verified
              ? "Verified Marketplace seller"
              : "Community Marketplace seller",
          },
        }}
        artwork={{ kind: "image", src: artworkSrc }}
        initiallySaved={initiallySaved}
        saveMode={canSave ? "account" : "none"}
      />

      <div className="px-1 pb-1 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[hsl(var(--foreground))]">
              {listing.title}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))]">
              <MapPin className="size-3.5 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
              {location}
            </p>
          </div>
          <span className="giq-badge giq-badge-purple shrink-0">
            {listing.status}
          </span>
        </div>
        <Link
          href={`/marketplace/${listing.id}`}
          className="giq-outline-action mt-3 min-h-10 w-full justify-center text-[11px]"
        >
          View marketplace item
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function normaliseDogSex(sex: string | null) {
  const value = sex?.trim().toLowerCase();
  if (!value) return null;
  if (["m", "male", "dog"].includes(value)) return "dog";
  if (["f", "female", "bitch"].includes(value)) return "bitch";
  return sex;
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
      <ListingsToolbar q={q} category={category} sort="" categories={[]} />
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
  sort,
  categories,
  count,
}: {
  q: string;
  category: string;
  sort: MarketplaceSort;
  categories: Array<{ slug: string; name: string }>;
  count?: number;
}) {
  const hasFilters = Boolean(q || category || sort);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="race-box-strip mb-4 w-40" />
          <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
            All marketplace items
          </h2>
          <p className="mt-1 text-[14px] text-[hsl(var(--muted-foreground))]">
            {typeof count === "number"
              ? `${count} marketplace item${count === 1 ? "" : "s"} shown${
                  q ? ` matching "${q}".` : "."
                }`
              : "Loading marketplace items."}
          </p>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-[hsl(var(--subtle-foreground))]">
            Where shown, illustrative fallback media demonstrates the product
            experience and does not verify a listing or seller.
          </p>
        </div>
        <div className="giq-icon-plate flex h-10 w-10 items-center justify-center rounded-xl">
          <ShoppingBag className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
        </div>
      </div>

      <form
        action="/marketplace"
        className="giq-panel mb-6 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_14rem_12rem_auto_auto] xl:items-end"
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
          <AutoSubmitSelect
            name="category"
            aria-label="Category"
            defaultValue={category}
            className="giq-form-control min-h-11 w-full px-3 py-2 text-[13px]"
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </AutoSubmitSelect>
        </label>
        <label className="min-w-0">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">
            Sort
          </span>
          <AutoSubmitSelect
            name="sort"
            aria-label="Sort listings"
            defaultValue={sort}
            className="giq-form-control min-h-11 w-full px-3 py-2 text-[13px]"
          >
            <option value="">Recommended</option>
            <option value="created_at">Newest</option>
            <option value="price">Price: low to high</option>
            <option value="expires_at">Ending soon</option>
          </AutoSubmitSelect>
        </label>
        <button
          type="submit"
          className="giq-button giq-button-primary min-h-11 w-full px-5 text-[13px] font-semibold sm:col-span-2 xl:col-span-1 xl:w-auto"
        >
          <Search className="h-4 w-4" />
          Search
        </button>
        {hasFilters && (
          <Link
            href="/marketplace"
            className="giq-button giq-button-glass min-h-11 w-full px-5 text-[13px] font-semibold sm:col-span-2 xl:col-span-1 xl:w-auto"
          >
            Clear
          </Link>
        )}
      </form>
    </>
  );
}
