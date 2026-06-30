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
  active: "bg-[hsl(142_76%_36%/0.12)] text-[hsl(142_60%_48%)]",
  expired: "bg-white/[0.05] text-[hsl(215_14%_72%)]",
  sold: "bg-[hsl(25_95%_53%/0.14)] text-[hsl(25_95%_70%)]",
  withdrawn: "bg-white/[0.05] text-[hsl(220_7%_60%)]",
  archived: "bg-white/[0.05] text-[hsl(220_7%_42%)]",
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
        className="mb-6 inline-flex items-center gap-2 text-[13px] font-medium text-[hsl(215_14%_65%)] transition-colors hover:text-[hsl(210_13%_97%)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Listings
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <main className="min-w-0">
          <div className="race-panel p-6">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="program-label">Marketplace listing</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-[hsl(142_76%_36%/0.12)] px-2.5 py-1 text-[11px] font-semibold text-[hsl(142_60%_48%)]">
                    {TYPE_LABEL[listing.type] ?? listing.type}
                  </span>
                  <span
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                      STATUS_STYLE[listing.status] ?? STATUS_STYLE.archived
                    }`}
                  >
                    {expired && listing.status === "active" ? "expired" : listing.status}
                  </span>
                </div>
              </div>
              <div className="min-w-[140px] text-right">
                <p className="program-label">Asking price</p>
                <p className="mt-2 text-2xl font-semibold text-[hsl(210_13%_97%)]">
                  {formatPrice(listing.price, listing.currency)}
                </p>
              </div>
            </div>

            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-[hsl(210_13%_97%)]">
              {listing.title}
            </h1>
            <p className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed text-[hsl(215_14%_72%)]">
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
              <div className="race-panel-muted mt-6 grid min-h-36 place-items-center p-6 text-center">
                <div>
                  <div className="race-box-strip mx-auto mb-4 w-40" />
                  <p className="text-[13px] font-semibold text-[hsl(210_13%_97%)]">
                    No media attached
                  </p>
                  <p className="mt-1 text-[12px] text-[hsl(215_14%_65%)]">
                    Seller details and linked dog context are still available.
                  </p>
                </div>
              </div>
            )}

            {listing.dog && (
              <Link
                href={`/dogs/${listing.dog.id}`}
                className="race-panel-muted mt-6 block p-4 transition-colors hover:bg-white/[0.05]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[hsl(142_60%_48%)]">
                      Linked greyhound
                    </p>
                    <h2 className="mt-1 text-[18px] font-semibold text-[hsl(210_13%_97%)]">
                      {listing.dog.name}
                    </h2>
                    <p className="mt-1 text-[12px] text-[hsl(220_7%_58%)]">
                      {listing.dog.sire?.name ?? "Unknown sire"} x{" "}
                      {listing.dog.dam?.name ?? "unknown dam"}
                    </p>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-[hsl(142_60%_48%)]" />
                </div>
              </Link>
            )}
          </div>
        </main>

        <aside className="space-y-4">
          <section className="race-panel p-5">
            <div className="mb-5 flex items-center gap-3">
              <ShoppingBag className="h-5 w-5 text-[hsl(142_60%_48%)]" />
              <h2 className="text-[18px] font-semibold text-[hsl(210_13%_97%)]">
                Listing details
              </h2>
            </div>
            <div className="space-y-3 text-[13px] text-[hsl(215_14%_72%)]">
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

          <section className="race-panel p-5">
            <div className="mb-4 flex items-center gap-3">
              <BadgeCheck className="h-5 w-5 text-[hsl(142_60%_48%)]" />
              <h2 className="text-[18px] font-semibold text-[hsl(210_13%_97%)]">
                Seller
              </h2>
            </div>
            <p className="text-[15px] font-semibold text-[hsl(210_13%_97%)]">
              {listing.profile.displayName}
            </p>
            <p className="mt-1 text-[13px] text-[hsl(215_14%_65%)]">
              {listing.profile.kennelName ? `${listing.profile.kennelName} · ` : ""}
              {listing.profile.state ?? "Australia"}
            </p>
            <p className="mt-3 text-[12px] font-semibold text-[hsl(142_60%_48%)]">
              {listing.profile.verified ? "Verified seller" : "Community seller"}
            </p>
            {!isOwner && (
              <Link
                href="/messages"
                className="mt-5 inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-[hsl(210_13%_97%)] transition-colors hover:bg-white/[0.07]"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Message seller
              </Link>
            )}
          </section>

          {isOwner && (
            <section className="race-panel p-5">
              <h2 className="text-[18px] font-semibold text-[hsl(210_13%_97%)]">
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
                        className="giq-button giq-button-copper px-4 text-[13px] font-semibold disabled:cursor-not-allowed"
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
      <span className="inline-flex items-center gap-2 text-[hsl(220_7%_58%)]">
        {icon}
        {label}
      </span>
      <span className="text-right font-semibold text-[hsl(210_13%_97%)]">
        {value}
      </span>
    </div>
  );
}

function DemoListingAttachment({ image }: { image: DemoListingImage }) {
  return (
    <div className="block overflow-hidden rounded-md border border-white/[0.08] bg-black/20">
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
        className="block overflow-hidden rounded-md border border-white/[0.08] bg-black/20"
      >
        <NextImage
          src={url}
          alt={media.originalName ?? "Listing media"}
          width={media.widthPx ?? 640}
          height={media.heightPx ?? 420}
          unoptimized
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
        className="h-64 w-full rounded-md border border-white/[0.08] bg-black/30 object-cover"
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
      className="flex min-h-24 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] font-semibold text-[hsl(215_14%_80%)] transition-colors hover:bg-white/[0.06]"
    >
      <Paperclip className="h-4 w-4 text-[hsl(142_60%_48%)]" />
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
