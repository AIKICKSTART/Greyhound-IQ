import Link from "next/link";
import { ArrowLeft, Lock, PlusCircle } from "lucide-react";
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
  ["wanted", "Wanted"],
  ["share", "Share"],
] as const;

const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"];

export default async function NewListingPage() {
  const [user, dogs, categories] = await Promise.all([
    getCurrentUser(),
    getDogsForListingSelect(120),
    getMarketplaceCategories(),
  ]);
  const canCreateListing = Boolean(user && hasTier(user.tier, "pro"));

  return (
    <div className="giq-form-page mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/marketplace"
        className="mb-6 inline-flex items-center gap-2 text-[13px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Marketplace
      </Link>

      <div className="giq-form-page-intro mb-8">
        <div className="race-box-strip mb-4 w-40" />
        <h1 className="text-4xl font-semibold text-[hsl(var(--foreground))]">
          Create a marketplace item
        </h1>
        <p className="giq-form-page-subtitle mt-3 max-w-2xl text-[15px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          Submit a listing connected to your GreyhoundIQ profile with clean,
          scanned media attached. It appears publicly after moderator approval.
        </p>
      </div>

      <section className="giq-panel p-6">
        {canCreateListing ? (
          <form action={createListing} className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  Marketplace type
                </span>
                <select
                  name="type"
                  required
                  className="giq-form-control mt-2 px-3 py-2"
                  defaultValue="pup_for_sale"
                >
                  {LISTING_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  Category
                </span>
                <select
                  name="categoryId"
                  className="giq-form-control mt-2 px-3 py-2"
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

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  Region
                </span>
                <input
                  name="region"
                  maxLength={120}
                  className="giq-form-control mt-2 px-3 py-2"
                  placeholder="Illawarra"
                />
              </label>

              <label className="block">
                <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  Suburb
                </span>
                <input
                  name="suburb"
                  maxLength={120}
                  className="giq-form-control mt-2 px-3 py-2"
                  placeholder="Dapto"
                />
              </label>

              <label className="block">
                <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  State
                </span>
                <select
                  name="state"
                  className="giq-form-control mt-2 px-3 py-2"
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

            <label className="block">
              <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                Title
              </span>
              <input
                name="title"
                required
                minLength={5}
                maxLength={100}
                className="giq-form-control mt-2 px-3 py-2"
                placeholder="Fernando Bale pup for sale"
              />
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                Description
              </span>
              <textarea
                name="description"
                required
                minLength={20}
                maxLength={5000}
                rows={8}
                className="giq-form-control giq-textarea mt-2 px-3 py-2"
                placeholder="Include breeding, age, location, contact expectations, and any relevant racing context."
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  Price AUD
                </span>
                <input
                  name="price"
                  type="number"
                  min={0}
                  step={1}
                  className="giq-form-control mt-2 px-3 py-2"
                  placeholder="5000"
                />
              </label>

              <label className="block">
                <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  Condition
                </span>
                <select
                  name="condition"
                  className="giq-form-control mt-2 px-3 py-2"
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

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  Linked dog
                </span>
                <select
                  name="dogId"
                  className="giq-form-control mt-2 px-3 py-2"
                  defaultValue=""
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

              <label className="block">
                <span className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  Contact preference
                </span>
                <select
                  name="contactPreference"
                  className="giq-form-control mt-2 px-3 py-2"
                  defaultValue="message"
                >
                  <option value="message">GreyhoundIQ message</option>
                  <option value="email">Email after enquiry</option>
                  <option value="phone">Phone after enquiry</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
              <div>
                <p className="text-[12px] font-semibold uppercase text-[hsl(var(--subtle-foreground))]">
                  Marketplace details
                </p>
                <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">
                  Add up to three searchable details, such as microchip, whelping
                  date, brand, size, or inclusions.
                </p>
              </div>
              {[0, 1, 2].map((index) => (
                <div key={index} className="grid gap-3 md:grid-cols-2">
                  <input
                    name="attributeKey"
                    maxLength={40}
                    className="giq-form-control px-3 py-2"
                    placeholder="Detail"
                  />
                  <input
                    name="attributeValue"
                    maxLength={120}
                    className="giq-form-control px-3 py-2"
                    placeholder="Value"
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-3">
              <label className="flex items-start gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                <input
                  type="checkbox"
                  name="negotiable"
                  value="true"
                  className="mt-1"
                />
                <span>Price is negotiable.</span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                <input
                  type="checkbox"
                  name="welfareAcknowledged"
                  value="true"
                  required
                  className="mt-1"
                />
                <span>
                  I acknowledge greyhound welfare, transfer, identity, and
                  disclosure obligations may apply before this listing can go
                  live.
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                <input
                  type="checkbox"
                  name="legalAcknowledged"
                  value="true"
                  required
                  className="mt-1"
                />
                <span>
                  I acknowledge this listing is subject to moderator review,
                  marketplace rules, and Australian state or territory
                  requirements.
                </span>
              </label>
            </div>

            <MediaAttachmentFields mediaContext="listings" maxFiles={11} />

            <SubmitButton pendingLabel="Submitting...">
              <PlusCircle className="h-3.5 w-3.5" />
              Submit for review
            </SubmitButton>
          </form>
        ) : user ? (
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
    </div>
  );
}
