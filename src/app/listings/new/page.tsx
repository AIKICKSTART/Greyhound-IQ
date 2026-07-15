import Link from "next/link";
import {
  ArrowLeft,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Images,
  Lock,
  MapPin,
  PlusCircle,
  Save,
  Store,
} from "lucide-react";
import { createListing } from "@/app/actions";
import { MediaAttachmentFields } from "@/components/media-attachment-fields";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser, hasTier } from "@/lib/auth";
import {
  getDogsForListingSelect,
  getMarketplaceCategories,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create Marketplace Item - GreyhoundIQ",
  description:
    "Create a GreyhoundIQ marketplace item for pups, dogs, stud services, wanted ads, or ownership shares.",
};

const LISTING_TYPES = [
  ["pup_for_sale", "Pup for sale"],
  ["dog_for_sale", "Dog for sale"],
  ["stud_service", "Stud service"],
  ["share", "Share"],
  ["wanted", "Wanted"],
  ["equipment", "Equipment"],
  ["float_trailer", "Float / trailer"],
  ["caravan", "Caravan"],
  ["supplies", "Supplies / pet food"],
  ["other", "Other"],
] as const;

const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"];

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ dogId?: string; title?: string; price?: string }>;
}) {
  const {
    dogId: prefillDogId,
    title: prefillTitle,
    price: prefillPrice,
  } = await searchParams;
  const [user, dogs, categories] = await Promise.all([
    getCurrentUser(),
    getDogsForListingSelect(120),
    getMarketplaceCategories(),
  ]);
  const canCreateListing = Boolean(user && hasTier(user.tier, "pro"));

  return (
    <div className="giq-form-page mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href="/marketplace"
        className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-[13px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light))] sm:mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Marketplace
      </Link>

      <div className="giq-form-page-intro mb-6 sm:mb-8">
        <div className="race-box-strip mb-4 w-40" />
        <h1 className="text-3xl font-semibold tracking-tight text-[hsl(var(--foreground))] sm:text-4xl">
          Create a marketplace item
        </h1>
        <p className="giq-form-page-subtitle mt-3 max-w-2xl text-[15px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Submit a listing connected to your GreyhoundIQ profile with clean,
          scanned media attached. It appears publicly after moderator approval.
        </p>
      </div>

      {canCreateListing ? (
        <form
          action={createListing}
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
        >
          <div className="grid min-w-0 gap-6">
            <section
              className="giq-panel p-4 sm:p-6"
              aria-labelledby="listing-item-heading"
            >
              <div className="mb-5 flex items-center gap-3 border-b border-white/[0.08] pb-4">
                <div className="giq-icon-plate grid h-11 w-11 shrink-0 place-items-center rounded-xl">
                  <Store className="h-[18px] w-[18px] text-[hsl(var(--primary-bright))]" />
                </div>
                <div>
                  <h2
                    id="listing-item-heading"
                    className="text-[17px] font-semibold text-[hsl(var(--foreground))]"
                  >
                    Item
                  </h2>
                  <p className="mt-0.5 text-[12px] text-[hsl(var(--muted-foreground))]">
                    Choose what you are listing and give it a clear title.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                    Marketplace type
                  </span>
                  <select
                    name="type"
                    required
                    className="giq-form-control min-h-11 px-3 py-2"
                    defaultValue="pup_for_sale"
                  >
                    {LISTING_TYPES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                    Category
                  </span>
                  <select
                    name="categoryId"
                    className="giq-form-control min-h-11 px-3 py-2"
                    defaultValue=""
                  >
                    <option value="">Auto-select from type</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="mt-4 grid gap-2">
                <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  Title
                </span>
                <input
                  name="title"
                  required
                  minLength={5}
                  maxLength={100}
                  defaultValue={prefillTitle ?? ""}
                  className="giq-form-control min-h-11 px-3 py-2"
                  placeholder="Fernando Bale pup for sale"
                />
              </label>

              <label className="mt-4 grid gap-2">
                <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  Linked dog
                </span>
                <select
                  name="dogId"
                  className="giq-form-control min-h-11 px-3 py-2"
                  defaultValue={prefillDogId ?? ""}
                >
                  <option value="">No dog linked</option>
                  {dogs.map((dog) => (
                    <option key={dog.id} value={dog.id}>
                      {dog.name}
                      {dog.sire?.name ? ` - ${dog.sire.name}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <section
              className="giq-panel p-4 sm:p-6"
              aria-labelledby="listing-location-heading"
            >
              <div className="mb-5 flex items-center gap-3 border-b border-white/[0.08] pb-4">
                <div className="giq-icon-plate grid h-11 w-11 shrink-0 place-items-center rounded-xl">
                  <MapPin className="h-[18px] w-[18px] text-[hsl(var(--primary-bright))]" />
                </div>
                <div>
                  <h2
                    id="listing-location-heading"
                    className="text-[17px] font-semibold text-[hsl(var(--foreground))]"
                  >
                    Location &amp; contact
                  </h2>
                  <p className="mt-0.5 text-[12px] text-[hsl(var(--muted-foreground))]">
                    Help members understand where the item is and how to
                    enquire.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                    Region
                  </span>
                  <input
                    name="region"
                    maxLength={120}
                    className="giq-form-control min-h-11 px-3 py-2"
                    placeholder="Illawarra"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                    Suburb
                  </span>
                  <input
                    name="suburb"
                    maxLength={120}
                    className="giq-form-control min-h-11 px-3 py-2"
                    placeholder="Dapto"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                    State
                  </span>
                  <select
                    name="state"
                    className="giq-form-control min-h-11 px-3 py-2"
                    defaultValue=""
                  >
                    <option value="">Australia-wide</option>
                    {STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="mt-4 grid gap-2">
                <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  Contact preference
                </span>
                <select
                  name="contactPreference"
                  className="giq-form-control min-h-11 px-3 py-2"
                  defaultValue="message"
                >
                  <option value="message">GreyhoundIQ message</option>
                  <option value="email">Email after enquiry</option>
                  <option value="phone">Phone after enquiry</option>
                </select>
              </label>
            </section>

            <section
              className="giq-panel p-4 sm:p-6"
              aria-labelledby="listing-pricing-heading"
            >
              <div className="mb-5 flex items-center gap-3 border-b border-white/[0.08] pb-4">
                <div className="giq-icon-plate grid h-11 w-11 shrink-0 place-items-center rounded-xl">
                  <CircleDollarSign className="h-[18px] w-[18px] text-[hsl(var(--secondary-light))]" />
                </div>
                <div>
                  <h2
                    id="listing-pricing-heading"
                    className="text-[17px] font-semibold text-[hsl(var(--foreground))]"
                  >
                    Pricing
                  </h2>
                  <p className="mt-0.5 text-[12px] text-[hsl(var(--muted-foreground))]">
                    Set the asking price and condition when they apply.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                    Price AUD
                  </span>
                  <input
                    name="price"
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={prefillPrice ?? ""}
                    className="giq-form-control min-h-11 px-3 py-2"
                    placeholder="5000"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                    Condition
                  </span>
                  <select
                    name="condition"
                    className="giq-form-control min-h-11 px-3 py-2"
                    defaultValue=""
                  >
                    <option value="">Not specified</option>
                    <option value="new">New</option>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                  </select>
                </label>
              </div>

              <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))] transition-colors hover:border-white/[0.14] hover:bg-white/[0.05]">
                <input
                  type="checkbox"
                  name="negotiable"
                  value="true"
                  className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                />
                <span>Price is negotiable.</span>
              </label>
            </section>

            <section
              className="giq-panel p-4 sm:p-6"
              aria-labelledby="listing-details-heading"
            >
              <div className="mb-5 flex items-center gap-3 border-b border-white/[0.08] pb-4">
                <div className="giq-icon-plate grid h-11 w-11 shrink-0 place-items-center rounded-xl">
                  <FileText className="h-[18px] w-[18px] text-[hsl(var(--primary-bright))]" />
                </div>
                <div>
                  <h2
                    id="listing-details-heading"
                    className="text-[17px] font-semibold text-[hsl(var(--foreground))]"
                  >
                    Details
                  </h2>
                  <p className="mt-0.5 text-[12px] text-[hsl(var(--muted-foreground))]">
                    Add the context buyers need before they make contact.
                  </p>
                </div>
              </div>

              <label className="grid gap-2">
                <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  Description
                </span>
                <textarea
                  name="description"
                  required
                  minLength={20}
                  maxLength={5000}
                  rows={8}
                  className="giq-form-control giq-textarea min-h-44 px-3 py-2"
                  placeholder="Include breeding, age, location, contact expectations, and any relevant racing context."
                />
              </label>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                    Brand (goods)
                  </span>
                  <input
                    name="itemBrand"
                    maxLength={80}
                    className="giq-form-control min-h-11 px-3 py-2"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                    Model (goods)
                  </span>
                  <input
                    name="itemModel"
                    maxLength={80}
                    className="giq-form-control min-h-11 px-3 py-2"
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div>
                  <p className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                    Marketplace details
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                    Add up to three searchable details, such as microchip,
                    whelping date, brand, size, or inclusions.
                  </p>
                </div>
                {[0, 1, 2].map((index) => (
                  <div key={index} className="grid gap-3 sm:grid-cols-2">
                    <input
                      name="attributeKey"
                      maxLength={40}
                      className="giq-form-control min-h-11 px-3 py-2"
                      placeholder="Detail"
                      aria-label={`Detail ${index + 1}`}
                    />
                    <input
                      name="attributeValue"
                      maxLength={120}
                      className="giq-form-control min-h-11 px-3 py-2"
                      placeholder="Value"
                      aria-label={`Value ${index + 1}`}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section
              className="giq-panel giq-panel-popovers p-4 sm:p-6"
              aria-labelledby="listing-media-heading"
            >
              <div className="mb-5 flex items-center gap-3 border-b border-white/[0.08] pb-4">
                <div className="giq-icon-plate grid h-11 w-11 shrink-0 place-items-center rounded-xl">
                  <Images className="h-[18px] w-[18px] text-[hsl(var(--primary-bright))]" />
                </div>
                <div>
                  <h2
                    id="listing-media-heading"
                    className="text-[17px] font-semibold text-[hsl(var(--foreground))]"
                  >
                    Media
                  </h2>
                  <p className="mt-0.5 text-[12px] text-[hsl(var(--muted-foreground))]">
                    Add up to ten clear photos and one video.
                  </p>
                </div>
              </div>
              <MediaAttachmentFields mediaContext="listings" maxFiles={11} />
            </section>
          </div>

          <aside
            className="giq-panel p-4 sm:p-6 lg:sticky lg:top-24"
            aria-labelledby="listing-review-heading"
          >
            <div className="mb-5 flex items-center gap-3 border-b border-white/[0.08] pb-4">
              <div className="giq-icon-plate grid h-11 w-11 shrink-0 place-items-center rounded-xl">
                <ClipboardCheck className="h-[18px] w-[18px] text-[hsl(var(--secondary-light))]" />
              </div>
              <div>
                <h2
                  id="listing-review-heading"
                  className="text-[17px] font-semibold text-[hsl(var(--foreground))]"
                >
                  Review
                </h2>
                <p className="mt-0.5 text-[12px] text-[hsl(var(--muted-foreground))]">
                  Confirm the listing before submission.
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))] transition-colors hover:border-white/[0.14] hover:bg-white/[0.05]">
                <input
                  type="checkbox"
                  name="welfareAcknowledged"
                  value="true"
                  required
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                />
                <span>
                  I acknowledge greyhound welfare, transfer, identity, and
                  disclosure obligations may apply before this listing can go
                  live.
                </span>
              </label>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))] transition-colors hover:border-white/[0.14] hover:bg-white/[0.05]">
                <input
                  type="checkbox"
                  name="legalAcknowledged"
                  value="true"
                  required
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                />
                <span>
                  I acknowledge this listing is subject to moderator review,
                  marketplace rules, and Australian state or territory
                  requirements.
                </span>
              </label>
            </div>

            <div className="my-5 border-t border-white/[0.08]" />

            <p className="mb-4 text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              Your item is submitted privately and appears publicly after
              moderator approval.
            </p>

            <div className="grid gap-3">
              <SubmitButton
                name="submissionIntent"
                value="review"
                pendingLabel="Submitting..."
                className="giq-button giq-button-primary min-h-11 w-full px-4 text-[13px] font-semibold disabled:cursor-not-allowed"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Submit for review
              </SubmitButton>
              <SubmitButton
                name="submissionIntent"
                value="draft"
                pendingLabel="Saving draft..."
                className="giq-button giq-button-glass min-h-11 w-full px-4 text-[13px] font-semibold disabled:cursor-not-allowed"
              >
                <Save className="h-3.5 w-3.5" />
                Save as draft
              </SubmitButton>
            </div>
          </aside>
        </form>
      ) : (
        <section className="giq-panel p-5 sm:p-6">
          {user ? (
            <div className="grid gap-5 md:grid-cols-[56px_1fr_auto] md:items-center">
              <div className="giq-icon-plate flex h-12 w-12 items-center justify-center rounded-lg">
                <Lock className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
              </div>
              <div>
                <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
                  Upgrade to create marketplace items
                </h2>
                <p className="mt-1 text-[14px] text-[hsl(var(--muted-foreground))]">
                  Free accounts can browse and save marketplace items. Listing
                  creation is included with Pro.
                </p>
              </div>
              <Link
                href="/pricing"
                className="giq-button giq-button-primary px-4 text-[13px] font-semibold"
              >
                View Pro
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-[56px_1fr_auto] md:items-center">
              <div className="giq-icon-plate flex h-12 w-12 items-center justify-center rounded-lg">
                <Lock className="h-5 w-5 text-[hsl(var(--primary-bright))]" />
              </div>
              <div>
                <h2 className="text-[18px] font-semibold text-[hsl(var(--foreground))]">
                  Sign in to create marketplace items
                </h2>
                <p className="mt-1 text-[14px] text-[hsl(var(--muted-foreground))]">
                  Marketplace ownership is tied to your GreyhoundIQ profile.
                </p>
              </div>
              <a
                href="/sign-in"
                className="giq-button giq-button-primary px-4 text-[13px] font-semibold"
              >
                Sign in
              </a>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
