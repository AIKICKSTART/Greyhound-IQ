import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { ListingEditForm } from "@/components/listing-edit-form";
import { hasTier, requireCurrentUserProfile } from "@/lib/auth";
import { getOwnedListingForCurrentUser } from "@/lib/listing-service";
import { getMarketplaceCategories } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit marketplace listing - GreyhoundIQ",
  description: "Edit a marketplace listing owned by your GreyhoundIQ account.",
  robots: { index: false, follow: false },
};

export default async function ListingEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const current = await requireListingEditorProfile(id);
  if (!hasTier(current.tier, "pro")) {
    redirect("/pricing?reason=marketplace-edit");
  }

  let listing: Awaited<ReturnType<typeof getOwnedListingForCurrentUser>>;
  try {
    listing = await getOwnedListingForCurrentUser(current, id);
  } catch (error) {
    if (error instanceof Error && error.message === "listing.not_found") {
      notFound();
    }
    throw error;
  }

  const loadedCategories = await getMarketplaceCategories();
  const categories = listing.category &&
    !loadedCategories.some((category) => category.id === listing.category?.id)
    ? [listing.category, ...loadedCategories]
    : loadedCategories;

  return (
    <div>
      <header className="relative overflow-hidden border-b border-white/[0.07] bg-[linear-gradient(135deg,hsl(var(--card)/0.92),hsl(var(--background))_72%)]">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[hsl(var(--primary-bright)/0.12)] blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-8">
          <Link
            href={`/marketplace/${encodeURIComponent(listing.id)}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-[13px] font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to listing
          </Link>
          <div className="mt-4 flex items-start gap-3">
            <span className="giq-icon-plate grid size-11 shrink-0 place-items-center rounded-xl">
              <Pencil className="size-5 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="program-label">Seller workspace</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[hsl(var(--foreground))] sm:text-4xl">
                Edit marketplace listing
              </h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[hsl(var(--muted-foreground))]">
                Update the listing you own. Active listing changes return to
                moderation before becoming public again.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <ListingEditForm
          initial={{
            id: listing.id,
            type: listing.type,
            title: listing.title,
            description: listing.description,
            status: listing.status,
            categoryId: listing.categoryId,
            state: listing.state,
            region: listing.location?.region ?? null,
            suburb: listing.location?.suburb ?? null,
            postcode: listing.location?.postcode ?? null,
            condition: listing.condition,
            itemBrand: listing.itemBrand,
            itemModel: listing.itemModel,
            negotiable: listing.negotiable,
            contactPreference: listing.contactPreference,
            price: listing.price,
            attributes: listing.attributes.map(({ key, value }) => ({
              key,
              value,
            })),
          }}
          categories={categories.map(({ id: categoryId, name }) => ({
            id: categoryId,
            name,
          }))}
        />
      </main>
    </div>
  );
}

async function requireListingEditorProfile(listingId: string) {
  try {
    return await requireCurrentUserProfile();
  } catch (error) {
    if (error instanceof Error && error.message === "auth.unauthorized") {
      const returnTo = `/marketplace/${encodeURIComponent(listingId)}/edit`;
      redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
    }
    throw error;
  }
}
