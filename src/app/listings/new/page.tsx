import Link from "next/link";
import { ArrowLeft, Lock, PlusCircle } from "lucide-react";
import { createListing } from "@/app/actions";
import { MediaAttachmentFields } from "@/components/media-attachment-fields";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";
import { getDogsForListingSelect } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create Listing - GreyhoundIQ",
  description:
    "Create a GreyhoundIQ marketplace listing for pups, dogs, stud services, wanted ads, or ownership shares.",
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
  const [user, dogs] = await Promise.all([
    getCurrentUser(),
    getDogsForListingSelect(120),
  ]);

  return (
    <div className="fade-in mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/listings"
        className="mb-6 inline-flex items-center gap-2 text-[13px] font-medium text-[hsl(215_14%_65%)] transition-colors hover:text-[hsl(210_13%_97%)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Listings
      </Link>

      <div className="mb-8">
        <div className="race-box-strip mb-4 w-40" />
        <h1 className="text-4xl font-semibold text-[hsl(210_13%_97%)]">
          Create a marketplace listing
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[hsl(215_14%_65%)]">
          Publish a listing connected to your GreyhoundIQ profile with clean,
          scanned media attached to the record.
        </p>
      </div>

      <section className="race-panel p-6">
        {user ? (
          <form action={createListing} className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-[12px] font-semibold uppercase text-[hsl(220_7%_42%)]">
                  Listing type
                </span>
                <select
                  name="type"
                  required
                  className="mt-2 w-full rounded-md border border-white/[0.08] bg-[hsl(150_30%_3%)] px-3 py-2 text-[14px] text-[hsl(210_13%_97%)] outline-none transition-colors focus:border-[hsl(142_76%_36%)]"
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
                <span className="text-[12px] font-semibold uppercase text-[hsl(220_7%_42%)]">
                  State
                </span>
                <select
                  name="state"
                  className="mt-2 w-full rounded-md border border-white/[0.08] bg-[hsl(150_30%_3%)] px-3 py-2 text-[14px] text-[hsl(210_13%_97%)] outline-none transition-colors focus:border-[hsl(142_76%_36%)]"
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
              <span className="text-[12px] font-semibold uppercase text-[hsl(220_7%_42%)]">
                Title
              </span>
              <input
                name="title"
                required
                minLength={5}
                maxLength={100}
                className="mt-2 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[14px] text-[hsl(210_13%_97%)] outline-none transition-colors placeholder:text-[hsl(220_7%_42%)] focus:border-[hsl(142_76%_36%)]"
                placeholder="Fernando Bale pup for sale"
              />
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold uppercase text-[hsl(220_7%_42%)]">
                Description
              </span>
              <textarea
                name="description"
                required
                minLength={20}
                maxLength={5000}
                rows={8}
                className="mt-2 w-full resize-y rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[14px] leading-relaxed text-[hsl(210_13%_97%)] outline-none transition-colors placeholder:text-[hsl(220_7%_42%)] focus:border-[hsl(142_76%_36%)]"
                placeholder="Include breeding, age, location, contact expectations, and any relevant racing context."
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-[12px] font-semibold uppercase text-[hsl(220_7%_42%)]">
                  Price AUD
                </span>
                <input
                  name="price"
                  type="number"
                  min={0}
                  step={1}
                  className="mt-2 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[14px] text-[hsl(210_13%_97%)] outline-none transition-colors placeholder:text-[hsl(220_7%_42%)] focus:border-[hsl(142_76%_36%)]"
                  placeholder="5000"
                />
              </label>

              <label className="block">
                <span className="text-[12px] font-semibold uppercase text-[hsl(220_7%_42%)]">
                  Linked dog
                </span>
                <select
                  name="dogId"
                  className="mt-2 w-full rounded-md border border-white/[0.08] bg-[hsl(150_30%_3%)] px-3 py-2 text-[14px] text-[hsl(210_13%_97%)] outline-none transition-colors focus:border-[hsl(142_76%_36%)]"
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
            </div>

            <MediaAttachmentFields mediaContext="listings" maxFiles={11} />

            <SubmitButton pendingLabel="Publishing...">
              <PlusCircle className="h-3.5 w-3.5" />
              Publish listing
            </SubmitButton>
          </form>
        ) : (
          <div className="grid gap-5 md:grid-cols-[56px_1fr_auto] md:items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[hsl(142_76%_36%/0.12)]">
              <Lock className="h-5 w-5 text-[hsl(142_60%_48%)]" />
            </div>
            <div>
              <h2 className="text-[18px] font-semibold text-[hsl(210_13%_97%)]">
                Sign in to create listings
              </h2>
              <p className="mt-1 text-[14px] text-[hsl(215_14%_65%)]">
                Listing ownership is tied to your GreyhoundIQ profile.
              </p>
            </div>
            <Link
              href="/sign-in"
              className="giq-button giq-button-primary px-4 text-[13px] font-semibold"
            >
              Sign in
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
