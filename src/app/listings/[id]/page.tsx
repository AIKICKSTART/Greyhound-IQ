import Link from "next/link";
import NextImage from "next/image";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  Eye,
  Flag,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  Paperclip,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Tag,
} from "lucide-react";
import {
  markListingSold,
  reportListing,
  renewListing,
  withdrawListing,
} from "@/app/actions";
import { InstantListingEnquiryForm } from "@/components/instant-listing-enquiry-form";
import { InstantSaveListingButton } from "@/components/instant-save-listing-button";
import { ProcessedVideo } from "@/components/processed-video";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser, hasTier } from "@/lib/auth";
import {
  getListingForViewerById,
  getSavedListingIdsForProfile,
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
  pending_review: "giq-badge-gold",
  expired: "giq-badge-neutral",
  sold: "giq-badge-gold",
  rejected: "giq-badge-neutral",
  removed: "giq-badge-neutral",
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
    title: `Marketplace ${id.slice(0, 8)} - GreyhoundIQ`,
    description: "GreyhoundIQ marketplace item details.",
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, user] = await Promise.all([params, getOptionalCurrentUser()]);
  let listing: Awaited<ReturnType<typeof getListingForViewerById>>;

  try {
    listing = await getListingForViewerById(id, user);
  } catch {
    notFound();
  }

  const isOwner = user?.profileId === listing.profileId;
  const canMessageSeller = Boolean(user && hasTier(user.tier, "pro"));
  const expired = listingIsExpired(listing);
  const savedIds =
    user?.profileId && !isOwner
      ? await getSavedListingIdsForProfile(user.profileId, [listing.id])
      : new Set<string>();
  const isSaved = savedIds.has(listing.id);
  const renewAction = renewListing.bind(null, listing.id);
  const soldAction = markListingSold.bind(null, listing.id);
  const withdrawAction = withdrawListing.bind(null, listing.id);
  const reportAction = reportListing.bind(null, listing.id);
  const demoImages = getDemoListingImages(listing, 3);
  const canRenew =
    expired || ["expired", "sold", "withdrawn"].includes(listing.status);
  const canWithdraw = ["active", "pending_review"].includes(listing.status);
  const locationLabel =
    [
      listing.location?.suburb,
      listing.location?.region,
      listing.state,
    ]
      .filter(Boolean)
      .join(", ") || "Australia";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/marketplace"
        className="-ml-2 mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-bright))]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Marketplace
      </Link>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
        <header className="giq-panel min-w-0 p-5 sm:p-7 lg:col-start-1 lg:row-start-1">
          <p className="program-label">Marketplace listing</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="giq-badge giq-badge-purple">
              {listing.category?.name ?? TYPE_LABEL[listing.type] ?? listing.type}
            </span>
            <span
              className={`giq-badge ${
                STATUS_STYLE[listing.status] ?? STATUS_STYLE.archived
              }`}
            >
              {expired && listing.status === "active" ? "expired" : listing.status}
            </span>
          </div>
          <h1 className="mt-5 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.03em] text-[hsl(var(--foreground))] sm:text-4xl">
            {listing.title}
          </h1>
          <p className="mt-4 inline-flex items-center gap-2 text-[13px] text-[hsl(var(--muted-foreground))]">
            <MapPin className="h-4 w-4 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
            {locationLabel}
          </p>
        </header>

        <section
          aria-label="Listing media"
          className="giq-panel min-w-0 p-3 sm:p-4 lg:col-start-1 lg:row-start-2"
        >
          {listing.media.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {listing.media.map((attachment, index) => (
                <ListingAttachment
                  key={attachment.mediaId}
                  media={attachment.media}
                  featured={index === 0}
                />
              ))}
            </div>
          ) : demoImages.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {demoImages.map((image, index) => (
                <DemoListingAttachment
                  key={image.src}
                  image={image}
                  featured={index === 0}
                />
              ))}
            </div>
          ) : (
            <div className="giq-dashed-panel grid min-h-64 place-items-center p-6 text-center">
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
        </section>

        <aside
          aria-label="Listing purchase and seller details"
          className="space-y-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:self-start"
        >
          <section className="giq-panel p-5 sm:p-6">
            <p className="program-label">Asking price</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
              {formatPrice(listing.price, listing.currency)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[hsl(var(--muted-foreground))]">
              <span>{listing.negotiable ? "Open to offers" : "Fixed price"}</span>
              <span aria-hidden="true">·</span>
              <span>{locationLabel}</span>
            </div>

            <div className="mt-5 border-t border-white/[0.07] pt-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[hsl(var(--primary)/0.28)] bg-[hsl(var(--primary)/0.12)]">
                  <BadgeCheck className="h-5 w-5 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-[16px] font-semibold text-[hsl(var(--foreground))]">
                    {listing.profile.displayName}
                  </h2>
                  <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
                    {listing.profile.kennelName
                      ? `${listing.profile.kennelName} · `
                      : ""}
                    {listing.profile.state ?? "Australia"}
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-[hsl(var(--primary-bright))]">
                    {listing.profile.verified
                      ? "Verified seller"
                      : "Community seller"}
                  </p>
                </div>
              </div>

              {!isOwner && user && (
                <InstantSaveListingButton
                  listingId={listing.id}
                  initiallySaved={isSaved}
                />
              )}
              {!isOwner && canMessageSeller && (
                <InstantListingEnquiryForm listingId={listing.id} />
              )}
              {!isOwner && user && !canMessageSeller && (
                <div className="mt-5 rounded-lg border border-[hsl(var(--primary)/0.24)] bg-[hsl(var(--primary)/0.08)] p-4">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-[hsl(var(--foreground))]">
                    <Lock className="h-4 w-4 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
                    Upgrade to message seller
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                    Free accounts can browse and save listings. Seller enquiries
                    are included with Pro.
                  </p>
                  <Link
                    href="/pricing"
                    className="giq-outline-action mt-3 w-full text-[12px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-bright))]"
                  >
                    View Pro
                  </Link>
                </div>
              )}
              {!isOwner && !user && (
                <a
                  href="/sign-in"
                  className="giq-outline-action mt-5 w-full text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-bright))]"
                >
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  Sign in to message seller in Pulse
                </a>
              )}

              {isOwner && (
                <div className="mt-5 border-t border-white/[0.07] pt-5">
                  <h2 className="text-[16px] font-semibold text-[hsl(var(--foreground))]">
                    Owner controls
                  </h2>
                  {listing.status === "pending_review" && (
                    <p className="mt-2 text-[12px] text-[hsl(var(--muted-foreground))]">
                      Awaiting moderator review before this listing appears publicly.
                    </p>
                  )}
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {canRenew && (
                      <form action={renewAction}>
                        <SubmitButton
                          pendingLabel="Renewing..."
                          className="giq-button giq-button-primary min-h-11 w-full px-4 text-[13px] font-semibold disabled:cursor-not-allowed"
                        >
                          <RefreshCw className="h-4 w-4" aria-hidden="true" />
                          Renew
                        </SubmitButton>
                      </form>
                    )}
                    {listing.status === "active" && (
                      <form action={soldAction}>
                        <SubmitButton
                          pendingLabel="Marking..."
                          className="giq-button giq-button-gold min-h-11 w-full px-4 text-[13px] font-semibold disabled:cursor-not-allowed"
                        >
                          Mark sold
                        </SubmitButton>
                      </form>
                    )}
                    {canWithdraw && (
                      <form action={withdrawAction}>
                        <SubmitButton
                          pendingLabel="Withdrawing..."
                          className="giq-button giq-button-glass min-h-11 w-full px-4 text-[13px] font-semibold disabled:cursor-not-allowed"
                        >
                          Withdraw
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="giq-panel p-5">
            <div className="mb-5 flex items-center gap-3">
              <ShoppingBag className="h-5 w-5 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
              <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
                Listing details
              </h2>
            </div>
            <div className="space-y-3 text-[13px] text-[hsl(var(--muted-foreground))]">
              <DetailRow
                icon={<ShoppingBag className="h-4 w-4" />}
                label="Type"
                value={TYPE_LABEL[listing.type] ?? listing.type}
              />
              <DetailRow
                icon={<Tag className="h-4 w-4" />}
                label="Condition"
                value={listing.condition ?? listing.itemCondition ?? "Not set"}
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
            {listing.attributes.length > 0 && (
              <div className="mt-5 border-t border-white/[0.05] pt-4">
                <p className="mb-3 text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  Additional details
                </p>
                <div className="space-y-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                  {listing.attributes.map((attribute) => (
                    <DetailRow
                      key={attribute.id}
                      icon={<Tag className="h-4 w-4" />}
                      label={attribute.key}
                      value={attribute.value}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          {!isOwner && user && (
            <section className="giq-panel p-5">
              <div className="mb-4 flex items-center gap-3">
                <Flag className="h-5 w-5 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
                <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
                  Report marketplace item
                </h2>
              </div>
              <form action={reportAction} className="space-y-3">
                <select
                  name="reason"
                  required
                  aria-label="Reason for report"
                  className="giq-form-control min-h-11 px-3 py-2 text-[13px]"
                  defaultValue="spam"
                >
                  <option value="spam">Spam or scam</option>
                  <option value="illegal">Legal or welfare concern</option>
                  <option value="misinformation">Misleading information</option>
                  <option value="harassment">Harassment</option>
                  <option value="other">Other</option>
                </select>
                <textarea
                  name="description"
                  maxLength={500}
                  rows={3}
                  aria-label="Optional report context"
                  className="giq-form-control giq-textarea px-3 py-2 text-[13px]"
                  placeholder="Optional context for moderators."
                />
                <SubmitButton
                  pendingLabel="Reporting..."
                  className="giq-outline-action w-full"
                >
                  Submit report
                </SubmitButton>
              </form>
            </section>
          )}
        </aside>

        <main className="giq-panel min-w-0 p-5 sm:p-7 lg:col-start-1 lg:row-start-3">
          <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
            About this listing
          </h2>
          <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-[hsl(var(--muted-foreground))]">
            {listing.description}
          </p>

          {listing.dog && (
            <Link
              href={`/dogs/${listing.dog.id}`}
              className="giq-subpanel mt-6 block min-h-11 p-4 transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-bright))]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[hsl(var(--primary-bright))]">
                    Linked greyhound
                  </p>
                  <h3 className="mt-1 text-[18px] font-semibold text-[hsl(var(--foreground))]">
                    {listing.dog.name}
                  </h3>
                  <p className="mt-1 text-[12px] text-[hsl(var(--subtle-foreground))]">
                    {listing.dog.sire?.name ?? "Unknown sire"} x{" "}
                    {listing.dog.dam?.name ?? "unknown dam"}
                  </p>
                </div>
                <ShieldCheck className="h-5 w-5 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
              </div>
            </Link>
          )}
        </main>
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

function DemoListingAttachment({
  image,
  featured,
}: {
  image: DemoListingImage;
  featured: boolean;
}) {
  return (
    <div
      className={`giq-listing-media block overflow-hidden rounded-xl ${
        featured ? "sm:col-span-2" : ""
      }`}
    >
      <NextImage
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        sizes={featured ? "(min-width: 1024px) 820px, 100vw" : "(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"}
        className={
          featured
            ? "aspect-[16/10] max-h-[680px] w-full object-cover"
            : "h-64 w-full object-cover"
        }
      />
    </div>
  );
}

async function getOptionalCurrentUser() {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

function ListingAttachment({
  media,
  featured,
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
    scanStatus: string;
    processingStatus: string;
    playbackPath: string | null;
    posterPath: string | null;
    hlsPath: string | null;
    altText: string | null;
    captionPath: string | null;
  };
  featured: boolean;
}) {
  if (["pending", "scanning"].includes(media.scanStatus)) {
    return <AttachmentStatus label="Scanning listing media…" loading featured={featured} />;
  }
  if (media.scanStatus !== "clean") {
    return (
      <AttachmentStatus
        label={
          media.scanStatus === "infected"
            ? "Media removed by safety scan"
            : "Media safety scan failed"
        }
        failed
        featured={featured}
      />
    );
  }
  if (media.processingStatus !== "ready") {
    return (
      <AttachmentStatus
        label={
          media.processingStatus === "failed"
            ? "Media processing failed"
            : media.processingStatus === "processing"
              ? "Preparing listing media…"
              : media.processingStatus === "scanning"
                ? "Scanning listing media…"
                : "Listing media queued for processing…"
        }
        loading={media.processingStatus !== "failed"}
        failed={media.processingStatus === "failed"}
        featured={featured}
      />
    );
  }

  const url = mediaDeliveryUrl(media);
  const originalUrl = `/api/media/${media.id}/blob`;
  const label = media.altText ?? media.originalName ?? "Marketplace media";
  const isPortrait =
    media.widthPx != null &&
    media.heightPx != null &&
    media.heightPx > media.widthPx;
  if (media.mimeType.startsWith("image/")) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={`giq-listing-media block overflow-hidden rounded-xl ${
          featured ? "sm:col-span-2" : ""
        } ${
          isPortrait ? "bg-black/20" : ""
        }`}
      >
        <NextImage
          src={url}
          alt={label}
          width={media.widthPx ?? 640}
          height={media.heightPx ?? 420}
          sizes={featured ? "(min-width: 1024px) 820px, 100vw" : "(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"}
          unoptimized
          className={
            featured && isPortrait
              ? "max-h-[76vh] w-full object-contain"
              : featured
                ? "aspect-[16/10] max-h-[680px] w-full object-cover"
                : isPortrait
              ? "h-auto max-h-[78vh] w-full object-contain"
              : "h-64 w-full object-cover"
          }
        />
      </a>
    );
  }

  if (media.mimeType.startsWith("video/")) {
    return (
      <div className={featured ? "sm:col-span-2" : ""}>
        <ProcessedVideo
          playbackUrl={url}
          hlsUrl={media.hlsPath ? `${originalUrl}?variant=hls` : null}
          posterUrl={media.posterPath ? `${originalUrl}?variant=poster` : null}
          captionUrl={media.captionPath ? `${originalUrl}?variant=caption` : null}
          label={label}
          compact={!featured}
        />
      </div>
    );
  }

  if (media.mimeType.startsWith("audio/")) {
    return (
      <div
        className={`giq-subpanel flex min-h-24 items-center p-4 ${
          featured ? "sm:col-span-2" : ""
        }`}
      >
        <audio
          controls
          preload="metadata"
          src={url}
          className="min-h-11 w-full"
          aria-label={label}
        />
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`giq-outline-action min-h-24 max-w-full px-3 py-2 text-[12px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-bright))] ${
        featured ? "sm:col-span-2" : ""
      }`}
    >
      <Paperclip className="h-4 w-4 shrink-0 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
      <span className="truncate">{media.originalName ?? media.mimeType}</span>
    </a>
  );
}

function AttachmentStatus({
  label,
  loading = false,
  failed = false,
  featured,
}: {
  label: string;
  loading?: boolean;
  failed?: boolean;
  featured: boolean;
}) {
  return (
    <div
      role="status"
      className={`giq-dashed-panel grid place-items-center p-6 text-center ${
        featured ? "min-h-64 sm:col-span-2" : "min-h-40"
      }`}
    >
      <div>
        {loading ? (
          <Loader2
            className="mx-auto h-6 w-6 animate-spin text-[hsl(var(--primary-bright))]"
            aria-hidden="true"
          />
        ) : failed ? (
          <ShieldAlert
            className="mx-auto h-6 w-6 text-amber-200"
            aria-hidden="true"
          />
        ) : (
          <Paperclip
            className="mx-auto h-6 w-6 text-[hsl(var(--primary-bright))]"
            aria-hidden="true"
          />
        )}
        <p className="mt-3 text-[13px] font-semibold text-[hsl(var(--muted-foreground))]">
          {label}
        </p>
      </div>
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
