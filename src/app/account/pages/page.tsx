import Link from "next/link";
import { Lock, Plus, ExternalLink } from "lucide-react";
import { requireCurrentUserProfile } from "@/lib/auth";
import { hasTier } from "@/lib/tier-access";
import {
  listCustomPagesForCurrentUser,
  listApprovedOwnedDogs,
  CUSTOM_PAGE_TYPE_LABELS,
} from "@/lib/custom-page-service";
import { listBespokeRequestsForCurrentUser } from "@/lib/bespoke-service";
import { createCustomPageAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "My pages - GreyhoundsIQ" };

const MAIN_TYPES = ["trainer", "punter", "business"] as const;

export default async function MyPagesPage() {
  const current = await requireCurrentUserProfile();
  const isPro = hasTier(current.tier, "pro");

  if (!isPro) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">My pages</h1>
        <div className="mt-6 rounded-lg border border-[hsl(var(--primary)/0.24)] bg-[hsl(var(--primary)/0.08)] p-5">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[hsl(var(--foreground))]">
            <Lock className="h-4 w-4 text-[hsl(var(--primary-bright))]" />
            Custom pages are a Pro feature
          </div>
          <p className="mt-2 text-[13px] text-[hsl(var(--muted-foreground))]">
            Create branded trainer, punter, business, and per-dog pages. Included with Pro.
          </p>
          <Link href="/pricing" className="giq-outline-action mt-4 w-fit text-[13px]">
            View Pro
          </Link>
        </div>
      </main>
    );
  }

  const [pages, ownedDogs, bespokeRequests] = await Promise.all([
    listCustomPagesForCurrentUser(current),
    listApprovedOwnedDogs(current),
    listBespokeRequestsForCurrentUser(current),
  ]);
  const existingTypes = new Set(pages.filter((p) => p.pageType !== "dog").map((p) => p.pageType));
  const dogPageDogIds = new Set(pages.filter((p) => p.pageType === "dog").map((p) => p.dogId));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">My pages</h1>
      <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
        Branded public pages at greyhoundsiq.com.au/p/…
      </p>

      {/* Existing pages */}
      <section className="mt-6 space-y-3">
        {pages.length === 0 && (
          <p className="text-[13px] text-[hsl(var(--muted-foreground))]">No pages yet.</p>
        )}
        {pages.map((page) => (
          <div
            key={page.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-[hsl(var(--surface-1))] p-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[hsl(var(--foreground))]">{page.title}</span>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
                  {CUSTOM_PAGE_TYPE_LABELS[page.pageType as keyof typeof CUSTOM_PAGE_TYPE_LABELS]}
                </span>
                <span
                  className={`text-[11px] ${page.published ? "text-[hsl(var(--secondary))]" : "text-[hsl(var(--subtle-foreground))]"}`}
                >
                  {page.published ? "Published" : "Draft"}
                </span>
              </div>
              <div className="mt-1 text-[12px] text-[hsl(var(--subtle-foreground))]">/p/{page.handle}</div>
            </div>
            <div className="flex items-center gap-2">
              {page.published && (
                <Link
                  href={`/p/${page.handle}`}
                  className="giq-outline-action text-[12px]"
                  target="_blank"
                >
                  View <ExternalLink className="h-3 w-3" />
                </Link>
              )}
              <Link href={`/account/pages/${page.id}`} className="giq-button giq-button-glass min-h-8 px-3 text-[12px]">
                Edit
              </Link>
            </div>
          </div>
        ))}
      </section>

      {/* Create main-type pages */}
      <section className="mt-8">
        <h2 className="mb-3 text-[14px] font-semibold text-[hsl(var(--foreground))]">Create a page</h2>
        <div className="flex flex-wrap gap-2">
          {MAIN_TYPES.filter((t) => !existingTypes.has(t)).map((t) => (
            <form key={t} action={createCustomPageAction}>
              <input type="hidden" name="pageType" value={t} />
              <input type="hidden" name="title" value={current.displayName ?? CUSTOM_PAGE_TYPE_LABELS[t]} />
              <SubmitButton className="giq-button giq-button-glass min-h-9 px-4 text-[13px]">
                <Plus className="h-3.5 w-3.5" /> {CUSTOM_PAGE_TYPE_LABELS[t]} page
              </SubmitButton>
            </form>
          ))}
          {existingTypes.size === MAIN_TYPES.length && (
            <p className="text-[12px] text-[hsl(var(--subtle-foreground))]">
              You have all main page types. Edit them above.
            </p>
          )}
        </div>
      </section>

      {/* Create dog pages from approved-owned dogs */}
      <section className="mt-8">
        <h2 className="mb-1 text-[14px] font-semibold text-[hsl(var(--foreground))]">Dog pages</h2>
        <p className="mb-3 text-[12px] text-[hsl(var(--subtle-foreground))]">
          One page per dog you own (verified). 3 included with Pro; more with Pro+.
        </p>
        {ownedDogs.length === 0 ? (
          <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
            No verified dog ownerships yet. Claim a dog from its profile to unlock a dog page.
          </p>
        ) : (
          <div className="space-y-2">
            {ownedDogs.map((dog) => (
              <div
                key={dog.id}
                className="flex items-center justify-between rounded-lg border border-white/[0.06] px-4 py-2"
              >
                <span className="text-[13px] text-[hsl(var(--foreground))]">{dog.name}</span>
                {dogPageDogIds.has(dog.id) ? (
                  <span className="text-[12px] text-[hsl(var(--subtle-foreground))]">Page created</span>
                ) : (
                  <form action={createCustomPageAction}>
                    <input type="hidden" name="pageType" value="dog" />
                    <input type="hidden" name="dogId" value={dog.id} />
                    <input type="hidden" name="title" value={dog.name} />
                    <SubmitButton className="giq-button giq-button-glass min-h-8 px-3 text-[12px]">
                      <Plus className="h-3 w-3" /> Create page
                    </SubmitButton>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bespoke concierge design */}
      <section className="mt-10 rounded-lg border border-[hsl(var(--primary)/0.24)] bg-[hsl(var(--primary)/0.06)] p-5">
        <h2 className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
          Designed by our team — $500
        </h2>
        <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
          One-off concierge package: our team hand-designs a business, trainer and punter
          page plus up to 5 dog pages for a professional look. One payment, no subscription.
        </p>
        {bespokeRequests.length > 0 && (
          <ul className="mt-3 space-y-1 text-[12px] text-[hsl(var(--subtle-foreground))]">
            {bespokeRequests.map((r) => (
              <li key={r.id}>
                Request {r.createdAt.toISOString().slice(0, 10)} — <b>{r.status}</b>
              </li>
            ))}
          </ul>
        )}
        <form action="/api/billing/bespoke/checkout" method="post" className="mt-4">
          <SubmitButton className="giq-button giq-button-primary px-5 text-[13px] font-semibold">
            Request bespoke design ($500)
          </SubmitButton>
        </form>
      </section>
    </main>
  );
}
