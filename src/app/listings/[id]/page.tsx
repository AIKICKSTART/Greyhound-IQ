import Link from "next/link";
import NextImage from "next/image";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  DollarSign,
  Eye,
  MapPin,
  MessageSquare,
  Paperclip,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Tag,
} from "lucide-react";
import {
  markListingSold,
  renewListing,
  withdrawListing,
} from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import {
  getPublicListingById,
  listingIsExpired,
} from "@/lib/listing-service";
import {
  getDemoListingImages,
  type DemoListingImage,
} from "@/lib/demo-listing-media";
import { mediaDeliveryUrl } from "@/lib/media-service";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  pup_for_sale: "Pup for sale",
  dog_for_sale: "Dog for sale",
  stud_service: "Stud service",
  wanted: "Wanted",
  share: "Share",
};

const STATUS_STYLE: Record<string, string> = {
  active: "giq-badge-purple",
  expired: "giq-badge-neutral",
  sold: "giq-badge-gold",
  withdrawn: "giq-badge-neutral",
  archived: "giq-badge-neutral",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return {
    title: `Listing ${id.slice(0, 8)} - GreyhoundIQ`,
    description: "GreyhoundIQ marketplace listing details.",
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  let listing: Awaited<ReturnType<typeof getPublicListingById>>;

  try {
    listing = await getPublicListingById(id);
  } catch {
    notFound();
  }

  const isOwner = user?.profileId === listing.profileId;
  const expired = listingIsExpired(listing);
  const renewAction = renewListing.bind(null, listing.id);
  const soldAction = markListingSold.bind(null, listing.id);
  const withdrawAction = withdrawListing.bind(null, listing.id);
  const demoImages = getDemoListingImages(listing, 3);

  return (
    <div className="fade-in mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/listings"
        className="mb-6 inline-flex items-center gap-2 text-[13px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Listings
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <main className="min-w-0">
          <div className="giq-panel p-6">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="program-label">Marketplace listing</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="giq-badge giq-badge-purple">
                    {TYPE_LABEL[listing.type] ?? listing.type}
                  </span>
                  <span
                    className={`giq-badge ${
                      STATUS_STYLE[listing.status] ?? STATUS_STYLE.archived
                    }`}
                  >
                    {expired && listing.status === "active" ? "expired" : listing.status}
                  </span>
                </div>
              </div>
              <div className="min-w-[140px] text-right">
                <p className="program-label">Asking price</p>
                <p className="mt-2 text-2xl font-semibold text-[hsl(var(--foreground))]">
                  {formatPrice(listing.price, listing.currency)}
                </p>
              </div>
            </div>

            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-[hsl(var(--foreground))]">
              {listing.title}
            </h1>
            <p className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              {listing.description}
            </p>

            {listing.media.length > 0 ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {listing.media.map((attachment) => (
                  <ListingAttachment
                    key={attachment.mediaId}
                    media={attachment.media}
                  />
                ))}
              </div>
            ) : demoImages.length > 0 ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {demoImages.map((image) => (
                  <DemoListingAttachment key={image.src} image={image} />
                ))}
              </div>
            ) : (
              <div className="giq-dashed-panel mt-6 grid min-h-36 place-items-center p-6 text-center">
                <div>
                  <div className="race-box-strip mx-auto mb-4 w-40" />
                  <p className="text-[13px] font-semibold text-[hsl(var(--foreground))]">
                    No media attached
                  </p>
                  <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
                    Seller details and linked dog context are still available.
                  </p>
                </div>
              </div>
            )}

            {listing.dog && (
              <Link
                href={`/dogs/${listing.dog.id}`}
                className="giq-subpanel mt-6 block p-4 transition-colors hover:bg-white/[0.04]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[hsl(var(--primary-bright))]">
                      Linked greyhound
                    </p>
                    <h2 className="mt-1 text-[18px] font-semibold text-[hsl(var(--foreground))]">
                      {listing.dog.name}
                    </h2>
                    <p className="mt-1 text-[12px] text-[hsl(var(--subtle-foreground))]">
                      {listing.dog.sire?.name ?? "Unknown sire"} x{" "}
                      {listing.dog.dam?.name ?? "unknown dam"}
                    </p>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
                </div>
              </Link>
            )}
          </div>
        </main>

        <aside className="space-y-4">
          <section className="giq-panel p-5">
            <div className="mb-5 flex items-center gap-3">
              <ShoppingBag className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
              <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
                Listing details
              </h2>
            </div>
            <div className="space-y-3 text-[13px] text-[hsl(var(--muted-foreground))]">
              <DetailRow
                icon={<DollarSign className="h-4 w-4" />}
                label="Price"
                value={formatPrice(listing.price, listing.currency)}
              />
              <DetailRow
                icon={<MapPin className="h-4 w-4" />}
                label="Location"
                value={listing.state ?? "Australia"}
              />
              <DetailRow
                icon={<Clock3 className="h-4 w-4" />}
                label={listing.status === "sold" ? "Sold" : "Expires"}
                value={
                  listing.status === "sold"
                    ? formatDate(listing.soldAt)
                    : formatDate(listing.expiresAt)
                }
              />
              <DetailRow
                icon={<Eye className="h-4 w-4" />}
                label="Views"
                value={listing.views.toString()}
              />
              <DetailRow
                icon={<Tag className="h-4 w-4" />}
                label="Listed"
                value={formatDate(listing.createdAt)}
              />
            </div>
          </section>

          <section className="giq-panel p-5">
            <div className="mb-4 flex items-center gap-3">
              <BadgeCheck className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
              <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
                Seller
              </h2>
            </div>
            <p className="text-[15px] font-semibold text-[hsl(var(--foreground))]">
              {listing.profile.displayName}
            </p>
            <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
              {listing.profile.kennelName ? `${listing.profile.kennelName} · ` : ""}
              {listing.profile.state ?? "Australia"}
            </p>
            <p className="mt-3 text-[12px] font-semibold text-[hsl(var(--primary-bright))]">
              {listing.profile.verified ? "Verified seller" : "Community seller"}
            </p>
            {!isOwner && (
              <Link
                href="/messages"
                className="giq-outline-action mt-5"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Message seller
              </Link>
            )}
          </section>

          {isOwner && (
            <section className="giq-panel p-5">
              <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
                Owner controls
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {(expired || listing.status !== "active") && (
                  <form action={renewAction}>
                    <SubmitButton
                      pendingLabel="Renewing..."
                      className="giq-button giq-button-primary px-4 text-[13px] font-semibold disabled:cursor-not-allowed"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Renew
                    </SubmitButton>
                  </form>
                )}
                {listing.status === "active" && (
                  <>
                    <form action={soldAction}>
                      <SubmitButton
                        pendingLabel="Marking..."
                        className="giq-button giq-button-gold px-4 text-[13px] font-semibold disabled:cursor-not-allowed"
                      >
                        Mark sold
                      </SubmitButton>
                    </form>
                    <form action={withdrawAction}>
                      <SubmitButton
                        pendingLabel="Withdrawing..."
                        className="giq-button giq-button-glass px-4 text-[13px] font-semibold disabled:cursor-not-allowed"
                      >
                        Withdraw
                      </SubmitButton>
                    </form>
                  </>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="inline-flex items-center gap-2 text-[hsl(var(--subtle-foreground))]">
        {icon}
        {label}
      </span>
      <span className="text-right font-semibold text-[hsl(var(--foreground))]">
        {value}
      </span>
    </div>
  );
}

function DemoListingAttachment({ image }: { image: DemoListingImage }) {
  return (
    <div className="giq-listing-media block rounded-md">
      <NextImage
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        sizes="(min-width: 1024px) 520px, (min-width: 640px) 50vw, 100vw"
        className="h-64 w-full object-cover"
      />
    </div>
  );
}

function ListingAttachment({
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
  if (media.mimeType.startsWith("image/")) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="giq-listing-media block rounded-md"
      >
        <NextImage
          src={url}
          alt={media.originalName ?? "Listing media"}
          width={media.widthPx ?? 640}
          height={media.heightPx ?? 420}
          sizes="(min-width: 1024px) 520px, (min-width: 640px) 50vw, 100vw"
          className="h-64 w-full object-cover"
        />
      </a>
    );
  }

  if (media.mimeType.startsWith("video/")) {
    return (
      <video
        controls
        className="giq-listing-media h-64 w-full rounded-md object-cover"
      >
        <source src={url} type={media.mimeType} />
      </video>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="giq-outline-action min-h-24 px-3 py-2 text-[12px]"
    >
      <Paperclip className="h-4 w-4 text-[hsl(var(--primary-bright))]" />
      <span className="truncate">{media.originalName ?? media.mimeType}</span>
    </a>
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
