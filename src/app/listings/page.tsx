import Link from "next/link";
import NextImage from "next/image";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  DollarSign,
  MapPin,
  Paperclip,
  Search,
  ShoppingBag,
} from "lucide-react";
import { PageHero } from "@/components/page-hero";
import {
  getDemoListingImages,
  type DemoListingImage,
} from "@/lib/demo-listing-media";
import { mediaDeliveryUrl } from "@/lib/media-service";
import { getMarketplaceListings } from "@/lib/queries";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Marketplace - GreyhoundIQ",
  description:
    "Browse Australian greyhound pups, dogs, stud services, wanted ads, and ownership listings on GreyhoundIQ.",
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

function listingHref(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value);
  }
  const query = searchParams.toString();
  return query ? `/listings?${query}` : "/listings";
}

export default function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  return (
    <div className="fade-in">
      <PageHero
        image="/images/wentworth-track-hero.webp"
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
            href="/forum"
            className="giq-button giq-button-glass px-5 text-[13px] font-semibold"
          >
            Discuss listings
          </Link>
          <Link
            href="/listings/new"
            className="giq-button giq-button-primary px-5 text-[13px] font-semibold"
          >
            Create listing
          </Link>
        </div>
      </PageHero>

      <Suspense fallback={<ListingsFallback status="active" q="" />}>
        <ListingsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ListingsContent({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const status = params.status === "sold" ? "sold" : "active";
  const q = typeof params.q === "string" ? params.q.trim() : "";

  return <ListingsResults status={status} q={q} />;
}

async function ListingsResults({
  status,
  q,
}: {
  status: "active" | "sold";
  q: string;
}) {
  const listings = await getMarketplaceListings(24, { status, q });

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <ListingsToolbar status={status} q={q} count={listings.length} />

      {listings.length === 0 ? (
        <div className="race-panel p-12 text-center">
          <p className="text-[14px] text-[hsl(var(--muted-foreground))]">
            No listings loaded yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <article
              key={listing.id}
              className="race-panel flex min-h-[360px] flex-col transition-all hover:-translate-y-0.5 hover:border-white/[0.13]"
            >
              {(() => {
                const demoImage = getDemoListingImages(listing, 1)[0];
                if (listing.media[0]) {
                  return (
                    <div className="p-2 pb-0">
                      <ListingMediaPreview media={listing.media[0].media} />
                    </div>
                  );
                }
                if (demoImage) {
                  return (
                    <div className="p-2 pb-0">
                      <ListingDemoMediaPreview image={demoImage} />
                    </div>
                  );
                }
                return null;
              })()}
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="program-label">Marketplace</p>
                    <span className="mt-2 inline-flex rounded-md bg-[hsl(var(--primary)/0.12)] px-2.5 py-1 text-[11px] font-semibold text-[hsl(var(--primary-bright))]">
                      {TYPE_LABEL[listing.type] ?? listing.type}
                    </span>
                  </div>
                  <span
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                      listing.status === "active"
                        ? "bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary-bright))]"
                        : "bg-white/[0.05] text-[hsl(var(--subtle-foreground))]"
                    }`}
                  >
                    {listing.status}
                  </span>
                </div>

                <h3 className="text-[18px] font-semibold leading-snug text-[hsl(var(--foreground))]">
                  <Link
                    href={`/listings/${listing.id}`}
                    className="transition-colors hover:text-[hsl(var(--primary-bright))]"
                  >
                    {listing.title}
                  </Link>
                </h3>
                <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-[hsl(215_14%_68%)]">
                  {listing.description}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3 text-[12px] text-[hsl(var(--muted-foreground))]">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[hsl(var(--foreground))]">
                    <DollarSign className="h-3.5 w-3.5 text-[hsl(var(--secondary))]" />
                    {formatPrice(listing.price)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[hsl(var(--primary-bright))]" />
                    {listing.state ?? "Australia"}
                  </span>
                  <span className="col-span-2 inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                    {status === "sold"
                      ? `Sold ${formatDate(listing.soldAt)}`
                      : `Expires ${formatDate(listing.expiresAt)}`}
                  </span>
                </div>

                {listing.dog && (
                  <Link
                    href={`/dogs/${listing.dog.id}`}
                    className="race-panel-muted mt-4 block p-3 transition-colors hover:bg-white/[0.05]"
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
                    href={`/listings/${listing.id}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-[hsl(var(--foreground))] transition-colors hover:bg-white/[0.07]"
                  >
                    View listing
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
  status,
  q,
}: {
  status: "active" | "sold";
  q: string;
}) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <ListingsToolbar status={status} q={q} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div
            key={item}
            className="race-panel min-h-[360px] animate-pulse bg-white/[0.02]"
          />
        ))}
      </div>
    </section>
  );
}

function ListingsToolbar({
  status,
  q,
  count,
}: {
  status: "active" | "sold";
  q: string;
  count?: number;
}) {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="race-box-strip mb-4 w-40" />
          <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
            {status === "sold" ? "Recently sold" : "Current listings"}
          </h2>
          <p className="mt-1 text-[14px] text-[hsl(var(--muted-foreground))]">
            {typeof count === "number"
              ? `${count} ${status === "sold" ? "sold" : "active"} listings${q ? ` matching "${q}".` : "."}`
              : "Loading marketplace listings."}
          </p>
        </div>
        <div className="race-panel-muted flex h-10 w-10 items-center justify-center">
          <ShoppingBag className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="race-panel-muted flex p-1">
          <Link
            href={listingHref({ q })}
            className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              status === "active"
                ? "bg-[hsl(var(--primary)/0.16)] text-[hsl(var(--primary-bright))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            Available
          </Link>
          <Link
            href={listingHref({ status: "sold", q })}
            className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              status === "sold"
                ? "bg-[hsl(var(--primary)/0.16)] text-[hsl(var(--primary-bright))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            Recently sold
          </Link>
        </div>

        <form
          action="/listings"
          className="flex min-w-0 flex-1 gap-2 md:max-w-md"
        >
          {status === "sold" && <input type="hidden" name="status" value="sold" />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search title or description"
            className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-[hsl(var(--foreground))] outline-none transition-colors placeholder:text-[hsl(var(--subtle-foreground))] focus:border-[hsl(var(--primary))]"
          />
          <button
            type="submit"
            aria-label="Search listings"
            className="giq-button giq-button-glass giq-icon-button text-[hsl(215_14%_84%)]"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>
      </div>
    </>
  );
}

function ListingDemoMediaPreview({ image }: { image: DemoListingImage }) {
  return (
    <div className="block overflow-hidden rounded-md border border-white/[0.08] bg-black/20">
      <NextImage
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        sizes="(min-width: 1024px) 30vw, (min-width: 768px) 50vw, 100vw"
        className="h-40 w-full object-cover"
      />
    </div>
  );
}

function ListingMediaPreview({
  media,
}: {
  media: {
    id: string;
    storageBucket: string;
    storagePath: string;
    publicUrl: string | null;
    originalName: string | null;
    mimeType: string;
    widthPx: number | null;
    heightPx: number | null;
  };
}) {
  const url = mediaDeliveryUrl(media);
  if (!media.mimeType.startsWith("image/")) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex h-40 items-center justify-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] text-[12px] font-semibold text-[hsl(215_14%_80%)]"
      >
        <Paperclip className="h-4 w-4 text-[hsl(var(--primary-bright))]" />
        {media.originalName ?? media.mimeType}
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block overflow-hidden rounded-md border border-white/[0.08] bg-black/20"
    >
      <NextImage
        src={url}
        alt={media.originalName ?? "Listing media"}
        width={media.widthPx ?? 520}
        height={media.heightPx ?? 320}
        sizes="(min-width: 1024px) 30vw, (min-width: 768px) 50vw, 100vw"
        className="h-40 w-full object-cover"
      />
    </a>
  );
}
