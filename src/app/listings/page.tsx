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
import { getMarketplaceListings } from "@/lib/queries";

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

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const status = params.status === "sold" ? "sold" : "active";
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const listings = await getMarketplaceListings(24, { status, q });

  return (
    <div className="fade-in">
      <PageHero
        image="/images/feature-breeding-analytics.png"
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
            className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-[13px] font-semibold text-[hsl(210_13%_97%)] transition-all hover:bg-white/[0.07]"
          >
            Discuss listings
          </Link>
          <Link
            href="/listings/new"
            className="inline-flex items-center gap-2 rounded-md bg-[hsl(142_60%_42%)] px-5 py-2.5 text-[13px] font-semibold text-white shadow-xl shadow-[hsl(142_76%_36%/0.2)] transition-colors hover:bg-[hsl(142_60%_48%)]"
          >
            Create listing
          </Link>
        </div>
      </PageHero>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="race-box-strip mb-4 w-40" />
            <h2 className="text-2xl font-semibold text-[hsl(210_13%_97%)]">
              {status === "sold" ? "Recently sold" : "Current listings"}
            </h2>
            <p className="mt-1 text-[14px] text-[hsl(215_14%_65%)]">
              {listings.length} {status === "sold" ? "sold" : "active"} listings
              {q ? ` matching "${q}".` : "."}
            </p>
          </div>
          <div className="race-panel-muted flex h-10 w-10 items-center justify-center">
            <ShoppingBag className="h-5 w-5 text-[hsl(142_60%_48%)]" />
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="race-panel-muted flex p-1">
            <Link
              href={listingHref({ q })}
              className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                status === "active"
                  ? "bg-[hsl(142_76%_36%/0.16)] text-[hsl(142_60%_48%)]"
                  : "text-[hsl(215_14%_65%)] hover:text-[hsl(210_13%_97%)]"
              }`}
            >
              Available
            </Link>
            <Link
              href={listingHref({ status: "sold", q })}
              className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                status === "sold"
                  ? "bg-[hsl(142_76%_36%/0.16)] text-[hsl(142_60%_48%)]"
                  : "text-[hsl(215_14%_65%)] hover:text-[hsl(210_13%_97%)]"
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
              className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-[hsl(210_13%_97%)] outline-none transition-colors placeholder:text-[hsl(220_7%_42%)] focus:border-[hsl(142_76%_36%)]"
            />
            <button
              type="submit"
              aria-label="Search listings"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[hsl(215_14%_80%)] transition-colors hover:bg-white/[0.06]"
            >
              <Search className="h-4 w-4" />
            </button>
          </form>
        </div>

        {listings.length === 0 ? (
          <div className="race-panel p-12 text-center">
            <p className="text-[14px] text-[hsl(215_14%_65%)]">
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
                {listing.media[0] && (
                  <div className="p-2 pb-0">
                    <ListingMediaPreview media={listing.media[0].media} />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="program-label">Marketplace</p>
                      <span className="mt-2 inline-flex rounded-md bg-[hsl(142_76%_36%/0.12)] px-2.5 py-1 text-[11px] font-semibold text-[hsl(142_60%_48%)]">
                        {TYPE_LABEL[listing.type] ?? listing.type}
                      </span>
                    </div>
                    <span
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                        listing.status === "active"
                          ? "bg-[hsl(142_76%_36%/0.12)] text-[hsl(142_60%_48%)]"
                          : "bg-white/[0.05] text-[hsl(220_7%_58%)]"
                      }`}
                    >
                      {listing.status}
                    </span>
                  </div>

                  <h3 className="text-[18px] font-semibold leading-snug text-[hsl(210_13%_97%)]">
                    <Link
                      href={`/listings/${listing.id}`}
                      className="transition-colors hover:text-[hsl(142_60%_48%)]"
                    >
                      {listing.title}
                    </Link>
                  </h3>
                  <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-[hsl(215_14%_68%)]">
                    {listing.description}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3 text-[12px] text-[hsl(215_14%_65%)]">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[hsl(210_13%_97%)]">
                      <DollarSign className="h-3.5 w-3.5 text-[hsl(25_95%_58%)]" />
                      {formatPrice(listing.price)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-[hsl(142_60%_48%)]" />
                      {listing.state ?? "Australia"}
                    </span>
                    <span className="col-span-2 inline-flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5 text-[hsl(215_14%_65%)]" />
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
                      <p className="text-[12px] font-semibold text-[hsl(210_13%_97%)]">
                        {listing.dog.name}
                      </p>
                      <p className="mt-1 text-[11px] text-[hsl(220_7%_58%)]">
                        {listing.dog.sire?.name ?? "Unknown sire"} x{" "}
                        {listing.dog.dam?.name ?? "unknown dam"}
                      </p>
                    </Link>
                  )}

                  <div className="mt-auto border-t border-white/[0.05] pt-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-[hsl(215_14%_65%)]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(142_60%_48%)]" />
                        {listing.profile.verified ? "Verified seller" : "Community seller"}
                      </span>
                      <span className="text-[12px] text-[hsl(220_7%_58%)]">
                        {listing.profile.displayName}
                      </span>
                    </div>
                    <Link
                      href={`/listings/${listing.id}`}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-[hsl(210_13%_97%)] transition-colors hover:bg-white/[0.07]"
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
    </div>
  );
}

function ListingMediaPreview({
  media,
}: {
  media: {
    id: string;
    originalName: string | null;
    mimeType: string;
    widthPx: number | null;
    heightPx: number | null;
  };
}) {
  const url = `/api/media/${media.id}/blob`;
  if (!media.mimeType.startsWith("image/")) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex h-40 items-center justify-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] text-[12px] font-semibold text-[hsl(215_14%_80%)]"
      >
        <Paperclip className="h-4 w-4 text-[hsl(142_60%_48%)]" />
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
        unoptimized
        className="h-40 w-full object-cover"
      />
    </a>
  );
}
