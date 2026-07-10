import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  ExternalLink,
  GalleryHorizontal,
  ImageIcon,
  Pencil,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { requireCurrentUserProfile } from "@/lib/auth";
import {
  getOwnedCustomPage,
  resolveCustomPageMedia,
  CUSTOM_PAGE_TYPE_LABELS,
} from "@/lib/custom-page-service";
import { BUSINESS_CATEGORIES, DOG_SALE_STATUSES } from "@/lib/custom-page-validation";
import {
  updateCustomPageAction,
  publishCustomPageAction,
  deleteCustomPageAction,
  generateDogCardAction,
} from "@/app/actions";
import { getPlatformFlag, PLATFORM_FLAGS } from "@/lib/platform-settings";
import { MediaAttachmentFields } from "@/components/media-attachment-fields";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit page - GreyhoundsIQ" };

const INPUT =
  "giq-form-control min-h-11 w-full px-3 py-2 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-bright))]";
const LABEL =
  "mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]";
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-bright))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]";
const PANEL =
  "rounded-2xl border border-white/[0.08] bg-[hsl(var(--surface-1))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)] sm:p-6";

export default async function EditCustomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await requireCurrentUserProfile();
  const page = await getOwnedCustomPage(current, id);
  if (!page) notFound();

  const media = await resolveCustomPageMedia(page.contentJson, page.socialActor?.id ?? "");
  const content = JSON.parse(page.contentJson ?? "{}") as {
    avatarMediaId?: string | null;
    bannerMediaId?: string | null;
    logoMediaId?: string | null;
    galleryMediaIds?: string[];
  };
  const label = CUSTOM_PAGE_TYPE_LABELS[page.pageType as keyof typeof CUSTOM_PAGE_TYPE_LABELS];
  const updateAction = updateCustomPageAction.bind(null, page.id);
  const publishAction = publishCustomPageAction.bind(null, page.id);
  const deleteAction = deleteCustomPageAction.bind(null, page.id);
  const cardGenAction = generateDogCardAction.bind(null, page.id);
  const cardGenEnabled =
    page.pageType === "dog"
      ? await getPlatformFlag(PLATFORM_FLAGS.cardGenerationEnabled, false)
      : false;
  const focalX = page.socialActor?.coverFocalX ?? 0.5;
  const focalY = page.socialActor?.coverFocalY ?? 0.5;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/account/pages"
            className={`inline-flex min-h-11 items-center gap-2 text-[12px] font-semibold text-[hsl(var(--muted-foreground))] transition hover:text-[hsl(var(--foreground))] ${FOCUS_RING}`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            My pages
          </Link>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-[hsl(var(--foreground))] sm:text-3xl">
            Manage {label.toLowerCase()} page
          </h1>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <form action={publishAction}>
            <input type="hidden" name="publish" value={page.published ? "false" : "true"} />
            <SubmitButton className={`giq-button giq-button-glass min-h-11 w-full justify-center px-4 text-[13px] ${FOCUS_RING}`}>
              {page.published ? "Unpublish" : "Publish"}
            </SubmitButton>
          </form>
          {page.published ? (
            <Link
              href={`/p/${page.handle}`}
              target="_blank"
              rel="noreferrer"
              className={`giq-outline-action min-h-11 justify-center px-4 text-[12px] ${FOCUS_RING}`}
            >
              View page <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ) : (
            <span className="flex min-h-11 items-center justify-center rounded-lg border border-white/[0.07] px-4 text-[12px] text-[hsl(var(--subtle-foreground))]">
              Draft preview
            </span>
          )}
        </div>
      </header>

      <section
        aria-label="Managed page identity preview"
        className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[hsl(var(--surface-1))] shadow-[0_28px_80px_rgba(0,0,0,0.24)]"
      >
        <div className="relative aspect-[16/5] min-h-40 w-full overflow-hidden bg-gradient-to-br from-[hsl(var(--surface-2))] via-[hsl(var(--primary)/0.22)] to-black">
          {media.bannerUrl ? (
            <Image
              src={media.bannerUrl}
              alt={`${page.title} cover`}
              fill
              unoptimized={media.bannerUrl.startsWith("/api/media/")}
              sizes="(max-width: 768px) 100vw, 1024px"
              className="object-cover"
              style={{ objectPosition: `${focalX * 100}% ${focalY * 100}%` }}
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,hsl(var(--secondary)/0.22),transparent_38%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/15" />
          <a
            href="#page-banner-editor"
            aria-label="Edit cover image"
            className={`absolute right-3 top-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-black/55 px-4 text-[12px] font-semibold text-white shadow-lg backdrop-blur-md transition hover:bg-black/75 sm:right-4 sm:top-4 ${FOCUS_RING}`}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit cover
          </a>
        </div>
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:px-7 sm:pb-7">
          <div className="relative -mt-12 h-28 w-28 shrink-0 self-start rounded-full border-4 border-[hsl(var(--surface-1))] bg-[hsl(var(--surface-2))] shadow-2xl sm:-mt-14 sm:h-32 sm:w-32">
            <div className="relative h-full w-full overflow-hidden rounded-full border border-white/[0.12]">
              {media.avatarUrl ? (
                <Image
                  src={media.avatarUrl}
                  alt={`${page.title} profile picture`}
                  fill
                  unoptimized={media.avatarUrl.startsWith("/api/media/")}
                  sizes="128px"
                  className="object-cover"
                />
              ) : (
                <span className="grid h-full place-items-center text-3xl font-semibold text-white/80">
                  {page.title.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <a
              href="#page-avatar-editor"
              aria-label="Edit profile picture"
              className={`absolute -bottom-1 -right-1 grid h-11 w-11 place-items-center rounded-full border-2 border-[hsl(var(--surface-1))] bg-[hsl(var(--primary))] text-white shadow-lg transition hover:bg-[hsl(var(--primary-bright))] ${FOCUS_RING}`}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
          <div className="min-w-0 flex-1 sm:pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.1)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--primary-bright))]">
                {label}
              </span>
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  page.published
                    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                    : "border-white/10 bg-white/[0.04] text-[hsl(var(--subtle-foreground))]"
                }`}
              >
                {page.published ? "Published" : "Draft"}
              </span>
            </div>
            <h2 className="mt-2 truncate text-2xl font-semibold text-[hsl(var(--foreground))]">{page.title}</h2>
            <p className="mt-1 truncate text-[13px] text-[hsl(var(--subtle-foreground))]">greyhoundsiq.com.au/p/{page.handle}</p>
            {page.tagline ? (
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">{page.tagline}</p>
            ) : null}
          </div>
        </div>
      </section>

      <form action={updateAction} className="mt-6 space-y-6">
        <input type="hidden" name="avatarMediaId" value={content.avatarMediaId ?? ""} />
        <input type="hidden" name="bannerMediaId" value={content.bannerMediaId ?? ""} />
        <input type="hidden" name="logoMediaId" value={content.logoMediaId ?? ""} />
        {(content.galleryMediaIds ?? []).map((galleryId) => (
          <input key={galleryId} type="hidden" name="galleryMediaIds" value={galleryId} />
        ))}

        <section className={PANEL} aria-labelledby="page-identity-heading">
          <div className="mb-5 flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary-bright))]">
              <Pencil className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="page-identity-heading" className="text-lg font-semibold text-[hsl(var(--foreground))]">Page identity</h2>
              <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">Set the public name, introduction, and page details.</p>
            </div>
          </div>

          <div className="grid gap-4">
            <div>
              <label htmlFor="page-title" className={LABEL}>Title</label>
              <input id="page-title" name="title" defaultValue={page.title} required minLength={2} maxLength={80} className={INPUT} />
            </div>
            <div>
              <label htmlFor="page-tagline" className={LABEL}>Tagline</label>
              <input id="page-tagline" name="tagline" defaultValue={page.tagline ?? ""} maxLength={140} className={INPUT} />
            </div>
            <div>
              <label htmlFor="page-about" className={LABEL}>About</label>
              <textarea id="page-about" name="about" defaultValue={page.about ?? ""} maxLength={4000} rows={6} className={`${INPUT} resize-y`} />
            </div>

            {page.pageType === "business" ? (
              <div>
                <label htmlFor="business-category" className={LABEL}>Business category</label>
                <select id="business-category" name="businessCategory" defaultValue={page.businessCategory ?? ""} className={INPUT}>
                  <option value="">—</option>
                  {BUSINESS_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {page.pageType === "dog" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="sale-status" className={LABEL}>Sale status</label>
                  <select id="sale-status" name="saleStatus" defaultValue={page.saleStatus ?? ""} className={INPUT}>
                    <option value="">Not listed</option>
                    {DOG_SALE_STATUSES.map((status) => (
                      <option key={status} value={status}>{status.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="price-or-fee" className={LABEL}>Price / fee (AUD)</label>
                  <input id="price-or-fee" name="priceOrFee" type="number" min={0} defaultValue={page.priceOrFee ?? ""} className={INPUT} />
                </div>
              </div>
            ) : null}

            <div>
              <label htmlFor="accent-color" className={LABEL}>Accent colour</label>
              <input id="accent-color" name="accentColor" type="text" placeholder="#A127CE" defaultValue={page.accentColor ?? ""} className={INPUT} />
            </div>
          </div>
        </section>

        <section className={PANEL} aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="text-lg font-semibold text-[hsl(var(--foreground))]">Contact details</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">Contact fields stay private until you choose an audience.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="contact-email" className={LABEL}>Contact email</label>
              <input id="contact-email" name="contactEmail" type="email" defaultValue={page.contactEmail ?? ""} className={INPUT} />
            </div>
            <div>
              <label htmlFor="contact-phone" className={LABEL}>Contact phone</label>
              <input id="contact-phone" name="contactPhone" defaultValue={page.contactPhone ?? ""} className={INPUT} />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="page-website" className={LABEL}>Website</label>
              <input id="page-website" name="website" type="url" defaultValue={page.website ?? ""} className={INPUT} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label htmlFor="contact-visibility" className={LABEL}>Who can see contact details</label>
              <select id="contact-visibility" name="contactVisibility" defaultValue={page.socialActor?.contactVisibility ?? "only_me"} className={INPUT}>
                <option value="only_me">Only me</option>
                <option value="connections">Followers</option>
                <option value="members">Members</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>
        </section>

        <section id="page-media" className={`${PANEL} scroll-mt-24`} aria-labelledby="page-media-heading">
          <div className="mb-5 flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary-bright))]">
              <Camera className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="page-media-heading" className="text-lg font-semibold text-[hsl(var(--foreground))]">Page media</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">Use a wide 16:5 cover and a square profile image. Uploads remain protected by the page audience.</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <MediaSlot
              id="page-banner-editor"
              label="Cover image"
              current={media.bannerUrl}
              field="bannerMediaIdNew"
              removeField="removeBannerMediaId"
              variant="banner"
            />
            <MediaSlot
              id="page-avatar-editor"
              label="Profile picture"
              current={media.avatarUrl}
              field="avatarMediaIdNew"
              removeField="removeAvatarMediaId"
              variant="avatar"
            />
            {page.pageType === "business" ? (
              <MediaSlot
                id="page-logo-editor"
                label="Business logo"
                current={media.logoUrl}
                field="logoMediaIdNew"
                removeField="removeLogoMediaId"
                variant="logo"
              />
            ) : null}
          </div>

          <fieldset className="mt-5 rounded-xl border border-white/[0.07] bg-black/10 p-4">
            <legend className="px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">Cover focal point</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={LABEL}>
                Horizontal focus
                <input type="range" name="coverFocalX" min="0" max="1" step="0.01" defaultValue={focalX} className="mt-2 min-h-11 w-full cursor-pointer accent-[hsl(var(--primary))]" />
              </label>
              <label className={LABEL}>
                Vertical focus
                <input type="range" name="coverFocalY" min="0" max="1" step="0.01" defaultValue={focalY} className="mt-2 min-h-11 w-full cursor-pointer accent-[hsl(var(--primary))]" />
              </label>
            </div>
          </fieldset>

          <fieldset className="mt-5 rounded-xl border border-white/[0.07] bg-black/10 p-4">
            <legend className="flex items-center gap-2 px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
              <GalleryHorizontal className="h-4 w-4" aria-hidden="true" /> Gallery
            </legend>
            {media.galleryUrls.length > 0 ? (
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" aria-label="Current gallery images">
                {media.galleryUrls.map((url, index) => (
                  <div key={url} className="relative aspect-[4/3] overflow-hidden rounded-lg border border-white/[0.08] bg-[hsl(var(--surface-2))]">
                    <Image
                      src={url}
                      alt={`${page.title} gallery image ${index + 1}`}
                      fill
                      unoptimized={url.startsWith("/api/media/")}
                      sizes="(max-width: 640px) 50vw, 220px"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-4 flex min-h-24 items-center justify-center rounded-lg border border-dashed border-white/[0.1] text-[12px] text-[hsl(var(--subtle-foreground))]">
                No gallery images yet
              </div>
            )}
            <label className={LABEL}>Add gallery media</label>
            <MediaAttachmentFields mediaContext="custom-page" maxFiles={12} fieldName="galleryMediaIdsNew" />
          </fieldset>
        </section>

        <div className="sticky bottom-[calc(var(--giq-mobile-dock-clearance)_+_0.75rem)] z-20 flex flex-col gap-3 rounded-2xl border border-white/[0.1] bg-[hsl(var(--surface-1)/0.94)] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between lg:bottom-3">
          <p className="px-1 text-[12px] text-[hsl(var(--muted-foreground))]">Save identity, contact, and media changes together.</p>
          <SubmitButton className={`giq-button giq-button-primary min-h-11 w-full justify-center px-5 text-[13px] font-semibold sm:w-auto ${FOCUS_RING}`}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Save changes
          </SubmitButton>
        </div>
      </form>

      {cardGenEnabled ? (
        <section className={`${PANEL} mt-6`} aria-labelledby="trading-card-heading">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[hsl(var(--secondary)/0.12)] text-[hsl(var(--secondary))]">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="trading-card-heading" className="text-lg font-semibold text-[hsl(var(--foreground))]">Trading card</h2>
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">System-generated from this dog&apos;s career stats and a front-facing photo using your cover or profile picture.</p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
            {media.cardUrl ? (
              <Image
                src={media.cardUrl}
                alt={`${page.title} GreyhoundIQ trading card`}
                width={240}
                height={360}
                unoptimized={media.cardUrl.startsWith("/api/media/")}
                className="w-40 rounded-xl border border-white/10 object-cover shadow-lg"
              />
            ) : (
              <div className="grid aspect-[2/3] w-32 place-items-center rounded-xl border border-dashed border-white/[0.12] bg-black/10 text-[hsl(var(--subtle-foreground))]">
                <ImageIcon className="h-7 w-7" aria-hidden="true" />
              </div>
            )}
            <form action={cardGenAction}>
              <SubmitButton className={`giq-button giq-button-glass min-h-11 w-full justify-center px-4 text-[12px] sm:w-auto ${FOCUS_RING}`}>
                {media.cardUrl ? "Regenerate card" : "Generate card"}
              </SubmitButton>
            </form>
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/[0.05] p-5 sm:p-6" aria-labelledby="danger-zone-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="danger-zone-heading" className="text-[15px] font-semibold text-[hsl(var(--foreground))]">Delete managed page</h2>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">This permanently removes the managed page and can no longer be undone.</p>
          </div>
          <form action={deleteAction}>
            <SubmitButton className={`giq-button giq-button-glass min-h-11 w-full justify-center px-4 text-[12px] text-red-300 sm:w-auto ${FOCUS_RING}`}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete this page
            </SubmitButton>
          </form>
        </div>
      </section>
    </main>
  );
}

function MediaSlot({
  id,
  label,
  current,
  field,
  removeField,
  variant,
}: {
  id: string;
  label: string;
  current: string | null;
  field: string;
  removeField: string;
  variant: "banner" | "avatar" | "logo";
}) {
  return (
    <fieldset id={id} className="scroll-mt-24 rounded-xl border border-white/[0.07] bg-black/10 p-4">
      <legend className="flex items-center gap-2 px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </legend>
      <div
        className={`mb-3 overflow-hidden border border-white/[0.08] bg-[hsl(var(--surface-2))] ${
          variant === "banner"
            ? "aspect-[16/5] w-full rounded-lg"
            : variant === "avatar"
              ? "aspect-square w-28 rounded-full"
              : "aspect-square w-28 rounded-2xl"
        }`}
      >
        {current ? (
          <Image
            src={current}
            alt={`Current ${label.toLowerCase()}`}
            width={640}
            height={variant === "banner" ? 200 : 640}
            unoptimized={current.startsWith("/api/media/")}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="grid h-full place-items-center text-[11px] text-[hsl(var(--subtle-foreground))]">
            No image
          </span>
        )}
      </div>
      <MediaAttachmentFields mediaContext="custom-page" maxFiles={1} fieldName={field} compact />
      {current ? (
        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-[12px] text-[hsl(var(--muted-foreground))] transition hover:bg-white/[0.04]">
          <input type="checkbox" name={removeField} value="true" className="h-[18px] w-[18px] accent-[hsl(var(--primary))]" />
          Remove current {label.toLowerCase()}
        </label>
      ) : null}
    </fieldset>
  );
}
