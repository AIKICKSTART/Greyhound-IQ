import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireCurrentUserProfile } from "@/lib/auth";
import {
  getOwnedCustomPage,
  resolveCustomPageMedia,
  CUSTOM_PAGE_TYPE_LABELS,
} from "@/lib/custom-page-service";
import {
  BUSINESS_CATEGORIES,
  DOG_SALE_STATUSES,
} from "@/lib/custom-page-validation";
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

const INPUT = "giq-form-control w-full px-3 py-2 text-[13px]";
const LABEL = "block text-[12px] font-semibold text-[hsl(var(--muted-foreground))] mb-1";

export default async function EditCustomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const current = await requireCurrentUserProfile();
  const page = await getOwnedCustomPage(current, id);
  if (!page) notFound();
  const media = await resolveCustomPageMedia(page.contentJson);
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Link href="/account/pages" className="text-[12px] text-[hsl(var(--muted-foreground))]">
            ← My pages
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-[hsl(var(--foreground))]">
            {label} page{page.pageType === "dog" && page.dog ? ` — ${page.dog.name}` : ""}
          </h1>
          <div className="mt-1 text-[12px] text-[hsl(var(--subtle-foreground))]">/p/{page.handle}</div>
        </div>
        <div className="flex items-center gap-2">
          <form action={publishAction}>
            <input type="hidden" name="publish" value={page.published ? "false" : "true"} />
            <SubmitButton className="giq-button giq-button-glass min-h-9 px-4 text-[13px]">
              {page.published ? "Unpublish" : "Publish"}
            </SubmitButton>
          </form>
          {page.published && (
            <Link href={`/p/${page.handle}`} target="_blank" className="giq-outline-action text-[12px]">
              View
            </Link>
          )}
        </div>
      </div>

      <form action={updateAction} className="space-y-5">
        <div>
          <label className={LABEL}>Title</label>
          <input name="title" defaultValue={page.title} required minLength={2} maxLength={80} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Tagline</label>
          <input name="tagline" defaultValue={page.tagline ?? ""} maxLength={140} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>About</label>
          <textarea name="about" defaultValue={page.about ?? ""} maxLength={4000} rows={5} className={INPUT} />
        </div>

        {page.pageType === "business" && (
          <div>
            <label className={LABEL}>Business category</label>
            <select name="businessCategory" defaultValue={page.businessCategory ?? ""} className={INPUT}>
              <option value="">—</option>
              {BUSINESS_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        {page.pageType === "dog" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Sale status</label>
              <select name="saleStatus" defaultValue={page.saleStatus ?? ""} className={INPUT}>
                <option value="">Not listed</option>
                {DOG_SALE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Price / fee (AUD)</label>
              <input
                name="priceOrFee"
                type="number"
                min={0}
                defaultValue={page.priceOrFee ?? ""}
                className={INPUT}
              />
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={LABEL}>Contact email</label>
            <input name="contactEmail" type="email" defaultValue={page.contactEmail ?? ""} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Contact phone</label>
            <input name="contactPhone" defaultValue={page.contactPhone ?? ""} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Website</label>
            <input name="website" type="url" defaultValue={page.website ?? ""} className={INPUT} />
          </div>
        </div>

        <div>
          <label className={LABEL}>Accent colour</label>
          <input name="accentColor" type="text" placeholder="#A127CE" defaultValue={page.accentColor ?? ""} className={INPUT} />
        </div>

        {/* Media slots. Hidden inputs preserve existing; uploaders add *New. */}
        <fieldset className="rounded-lg border border-white/[0.07] p-4">
          <legend className="px-1 text-[12px] font-semibold text-[hsl(var(--muted-foreground))]">
            Images (dark / on-brand recommended — banner 16:5, avatar & logo square)
          </legend>
          <input type="hidden" name="avatarMediaId" value={content.avatarMediaId ?? ""} />
          <input type="hidden" name="bannerMediaId" value={content.bannerMediaId ?? ""} />
          <input type="hidden" name="logoMediaId" value={content.logoMediaId ?? ""} />
          {(content.galleryMediaIds ?? []).map((gid) => (
            <input key={gid} type="hidden" name="galleryMediaIds" value={gid} />
          ))}

          <div className="grid gap-4 sm:grid-cols-3">
            <MediaSlot label="Banner" current={media.bannerUrl} field="bannerMediaIdNew" />
            <MediaSlot label="Profile picture" current={media.avatarUrl} field="avatarMediaIdNew" />
            {page.pageType === "business" && (
              <MediaSlot label="Logo" current={media.logoUrl} field="logoMediaIdNew" />
            )}
          </div>
          <div className="mt-4">
            <label className={LABEL}>Gallery (add more)</label>
            <MediaAttachmentFields mediaContext="custom-page" maxFiles={12} fieldName="galleryMediaIdsNew" />
          </div>
        </fieldset>

        <div className="flex items-center justify-between pt-2">
          <SubmitButton className="giq-button giq-button-primary px-5 text-[13px] font-semibold">
            Save changes
          </SubmitButton>
        </div>
      </form>

      {cardGenEnabled && (
        <section className="mt-8 rounded-lg border border-white/[0.07] p-4">
          <h2 className="text-[13px] font-semibold text-[hsl(var(--foreground))]">
            Trading card
          </h2>
          <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
            System-generated from this dog&apos;s career stats and a front-facing photo
            (uses your banner or profile picture). GreyhoundsIQ branded.
          </p>
          {media.cardUrl && (
            <Image
              src={media.cardUrl}
              alt=""
              width={200}
              height={300}
              className="mt-3 w-40 rounded-lg border border-white/10 object-cover"
            />
          )}
          <form action={cardGenAction} className="mt-3">
            <SubmitButton className="giq-button giq-button-glass min-h-9 px-4 text-[12px]">
              {media.cardUrl ? "Regenerate card" : "Generate card"}
            </SubmitButton>
          </form>
        </section>
      )}

      <form action={deleteAction} className="mt-10 border-t border-white/[0.06] pt-6">
        <SubmitButton className="giq-button giq-button-glass min-h-9 px-4 text-[12px] text-[hsl(var(--destructive,0_70%_60%))]">
          Delete this page
        </SubmitButton>
      </form>
    </main>
  );
}

function MediaSlot({
  label,
  current,
  field,
}: {
  label: string;
  current: string | null;
  field: string;
}) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      {current && (
        <Image
          src={current}
          alt=""
          width={160}
          height={90}
          className="mb-2 h-20 w-full rounded-md object-cover"
        />
      )}
      <MediaAttachmentFields mediaContext="custom-page" maxFiles={1} fieldName={field} compact />
    </div>
  );
}
