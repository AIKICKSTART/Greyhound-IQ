import Link from "next/link";

import { AdminPageHeader } from "@/app/admin/admin-page-header";
import { StatusPill } from "@/components/admin/status-pill";
import {
  approveListing,
  createMarketplaceCategory,
  rejectListing,
  removeListing,
  setMarketplaceCategoryActive,
} from "@/app/actions";
import { requireModeratorProfile } from "@/lib/auth";
import { safeQuery } from "@/lib/db";
import { withDbSystemContext } from "@/lib/db-context";
import { getMarketplaceCategoriesForModerator } from "@/lib/listing-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Marketplace - GreyhoundIQ",
  description: "GreyhoundIQ marketplace item moderation queue.",
};

export default async function AdminListingsPage() {
  await requireModeratorProfile();
  const [pending, recent, categories] = await Promise.all([
    getPendingListings(),
    getRecentListings(),
    getMarketplaceCategoriesForModerator(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <AdminPageHeader
        title="Marketplace review queue"
        description="New marketplace items stay private until a moderator approves them. Rejections and removals are written to admin actions and audit logs."
      />

      <section className="giq-panel p-6">
        <ListingTable listings={pending} mode="pending" />
      </section>

      <section className="giq-panel mt-6 p-6">
        <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
          Recent marketplace items
        </h2>
        <ListingTable listings={recent} mode="recent" />
      </section>

      <section className="giq-panel mt-6 p-6">
        <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">
          Marketplace categories
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <form action={createMarketplaceCategory} className="space-y-3">
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              placeholder="Category name"
              className="giq-form-control w-full px-3 py-2 text-[13px]"
            />
            <input
              name="slug"
              maxLength={80}
              placeholder="slug optional"
              className="giq-form-control w-full px-3 py-2 text-[13px]"
            />
            <textarea
              name="description"
              maxLength={500}
              rows={3}
              placeholder="Description optional"
              className="giq-form-control giq-textarea w-full px-3 py-2 text-[13px]"
            />
            <input
              name="sortOrder"
              type="number"
              min={0}
              max={9999}
              defaultValue={0}
              className="giq-form-control w-full px-3 py-2 text-[13px]"
            />
            <button className="giq-button giq-button-primary px-4 text-[13px]">
              Create category
            </button>
          </form>
          <div className="space-y-3">
            {categories.map((category) => (
              <div key={category.id} className="giq-subpanel p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
                      {category.name}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-[hsl(var(--subtle-foreground))]">
                      {category.slug} · {category._count.listings} items
                    </p>
                  </div>
                  <span className="giq-badge giq-badge-neutral">
                    {category.active ? "Active" : "Hidden"}
                  </span>
                </div>
                {category.description ? (
                  <p className="mt-2 text-[12px] text-[hsl(var(--muted-foreground))]">
                    {category.description}
                  </p>
                ) : null}
                <form
                  action={setMarketplaceCategoryActive.bind(
                    null,
                    category.id,
                    !category.active
                  )}
                  className="mt-3"
                >
                  <button className="giq-outline-action min-h-8 px-3 text-[12px]">
                    {category.active ? "Deactivate" : "Activate"}
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function ListingTable({
  listings,
  mode,
}: {
  listings: ListingRow[];
  mode: "pending" | "recent";
}) {
  return (
    <div className="giq-table-shell mt-6 overflow-x-auto">
      <table className="w-full min-w-[980px]">
        <thead>
          <tr className="giq-table-head">
            <th className="px-4 py-3 text-left">Marketplace item</th>
            <th className="px-4 py-3 text-left">Seller</th>
            <th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-left">Category</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Reports</th>
            <th className="px-4 py-3 text-left">Created</th>
            <th className="px-4 py-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {listings.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="px-4 py-6 text-center text-[13px] text-[hsl(var(--muted-foreground))]"
              >
                No {mode === "pending" ? "pending" : "recent"} marketplace items found.
              </td>
            </tr>
          ) : (
            listings.map((listing) => (
              <tr key={listing.id} className="border-t border-white/[0.06]">
                <td className="px-4 py-3">
                  <Link
                    href={`/marketplace/${listing.id}`}
                    className="text-[13px] font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary-bright))]"
                  >
                    {listing.title}
                  </Link>
                  <p className="mt-1 font-mono text-[11px] text-[hsl(var(--subtle-foreground))]">
                    {listing.id}
                  </p>
                </td>
                <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                  {listing.profile.displayName}
                  <p className="mt-1 text-[11px] text-[hsl(var(--subtle-foreground))]">
                    {listing.profile.user.email}
                  </p>
                </td>
                <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                  {listing.type}
                </td>
                <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                  {listing.category?.name ?? "Uncategorised"}
                </td>
                <td className="px-4 py-3">
                  <StatusPill value={listing.status} />
                </td>
                <td className="px-4 py-3 text-[13px] text-[hsl(var(--foreground))]">
                  {listing.reportCount}
                </td>
                <td className="px-4 py-3 text-[13px] text-[hsl(var(--muted-foreground))]">
                  {formatDateTime(listing.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <ListingActions listing={listing} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ListingActions({ listing }: { listing: ListingRow }) {
  const approveAction = approveListing.bind(null, listing.id);
  const rejectAction = rejectListing.bind(null, listing.id);
  const removeAction = removeListing.bind(null, listing.id);

  if (listing.status === "pending_review") {
    return (
      <div className="flex min-w-[280px] flex-wrap gap-2">
        <form action={approveAction}>
          <button className="giq-button giq-button-primary px-3 text-[12px]">
            Approve
          </button>
        </form>
        <form action={rejectAction} className="flex gap-2">
          <input
            name="reason"
            required
            minLength={3}
            maxLength={500}
            placeholder="Reason"
            className="giq-form-control w-36 px-2 py-1 text-[12px]"
          />
          <button className="giq-button giq-button-glass px-3 text-[12px]">
            Reject
          </button>
        </form>
      </div>
    );
  }

  if (listing.status === "active") {
    return (
      <form action={removeAction} className="flex min-w-[220px] gap-2">
        <input
          name="reason"
          required
          minLength={3}
          maxLength={500}
          placeholder="Reason"
          className="giq-form-control w-36 px-2 py-1 text-[12px]"
        />
        <button className="giq-button giq-button-glass px-3 text-[12px]">
          Remove
        </button>
      </form>
    );
  }

  return (
    <span className="text-[12px] text-[hsl(var(--muted-foreground))]">
      No action
    </span>
  );
}

type ListingRow = Awaited<ReturnType<typeof getPendingListings>>[number];

function getPendingListings() {
  return safeQuery(
    () =>
      withDbSystemContext((tx) =>
        tx.listing.findMany({
          where: { status: "pending_review" },
          orderBy: { createdAt: "asc" },
          take: 50,
          include: listingAdminInclude(),
        })
      ),
    []
  );
}

function getRecentListings() {
  return safeQuery(
    () =>
      withDbSystemContext((tx) =>
        tx.listing.findMany({
          where: {
            status: { in: ["active", "pending_review", "rejected", "removed"] },
          },
          orderBy: { updatedAt: "desc" },
          take: 30,
          include: listingAdminInclude(),
        })
      ),
    []
  );
}

function listingAdminInclude() {
  return {
    profile: {
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    },
    category: true,
  } as const;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}
