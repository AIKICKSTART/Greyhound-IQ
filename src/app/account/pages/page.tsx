import Image from "next/image";
import Link from "next/link";
import {
  CircleUserRound,
  Crown,
  ExternalLink,
  Lock,
  PanelsTopLeft,
  Pencil,
  Plus,
  Sparkles,
} from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { requireCurrentUserProfile } from "@/lib/auth";
import { hasTier } from "@/lib/tier-access";
import {
  listCustomPagesForCurrentUser,
  listApprovedOwnedDogs,
  resolvePageAvatarUrls,
  CUSTOM_PAGE_TYPE_LABELS,
} from "@/lib/custom-page-service";
import { listBespokeRequestsForCurrentUser } from "@/lib/bespoke-service";
import { createCustomPageAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { RateLimitRecoveryCard } from "@/components/rate-limit-recovery-card";
import { BILLING_RATE_LIMIT_RECOVERY_SECONDS } from "@/lib/rate-limit-recovery";

export const dynamic = "force-dynamic";
export const metadata = { title: "My pages - GreyhoundsIQ" };

const MAIN_TYPES = ["trainer", "owner", "breeder", "kennel", "business"] as const;
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-bright))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]";

type MyPagesPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function MyPagesPage({ searchParams }: MyPagesPageProps) {
  const current = await requireCurrentUserProfile();
  const isPro = hasTier(current.tier, "pro");
  const bespokeOutcome = (await searchParams).bespoke;

  if (!isPro) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <header>
          <PageTitle size="compact">
            My pages
          </PageTitle>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            Build a polished public identity for your training, ownership, breeding, kennel, business, or dogs.
          </p>
        </header>
        <section className="mt-6 overflow-hidden rounded-2xl border border-[hsl(var(--primary)/0.28)] bg-[hsl(var(--surface-1))] shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
          <div className="h-1.5 bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--primary-bright))] to-[hsl(var(--secondary))]" />
          <div className="p-6 sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.12)]">
              <Lock className="h-5 w-5 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-[hsl(var(--foreground))]">
              Custom pages are a Pro feature
            </h2>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              Create branded trainer, owner, breeder, kennel, business, and per-dog pages. Included with Pro.
            </p>
            <Link
              href="/pricing"
              className={`giq-outline-action mt-5 min-h-11 w-fit px-4 text-[13px] ${FOCUS_RING}`}
            >
              <Crown className="h-4 w-4" aria-hidden="true" />
              View Pro
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const [pages, ownedDogs, bespokeRequests] = await Promise.all([
    listCustomPagesForCurrentUser(current),
    listApprovedOwnedDogs(current),
    listBespokeRequestsForCurrentUser(current),
  ]);
  const avatarUrls = await resolvePageAvatarUrls(pages);
  const existingTypes = new Set(pages.filter((page) => page.pageType !== "dog").map((page) => page.pageType));
  const dogPageDogIds = new Set(pages.filter((page) => page.pageType === "dog").map((page) => page.dogId));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--primary-bright))]">
            <PanelsTopLeft className="h-4 w-4" aria-hidden="true" />
            Managed identities
          </div>
          <PageTitle className="mt-2">
            My pages
          </PageTitle>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            Manage the public pages you can post, comment, and connect as across GreyhoundIQ.
          </p>
        </div>
        <div className="flex min-h-11 items-center gap-2 self-start rounded-full border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.1)] px-4 text-[12px] font-semibold text-[hsl(var(--foreground))] sm:self-auto">
          <Crown className="h-4 w-4 text-[hsl(var(--secondary))]" aria-hidden="true" />
          Pro · {pages.length} {pages.length === 1 ? "page" : "pages"}
        </div>
      </header>

      {bespokeOutcome === "success" ? (
        <div
          aria-live="polite"
          className="mt-6 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.08] p-4"
        >
          <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
            Bespoke checkout return received
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            We are verifying the signed Stripe webhook. Your design request will
            appear below as soon as payment is confirmed; the URL alone never
            changes payment or request status.
          </p>
        </div>
      ) : bespokeOutcome === "failed" ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-rose-400/30 bg-rose-400/[0.08] p-4"
        >
          <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
            Bespoke checkout could not be opened
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            No payment was taken and no design request was changed. Review the
            package and retry secure checkout below.
          </p>
          <Link
            href="#bespoke-design"
            className={`giq-outline-action mt-3 w-fit ${FOCUS_RING}`}
          >
            Review and retry
          </Link>
        </div>
      ) : bespokeOutcome === "rate-limited" ? (
        <div className="mt-6">
          <RateLimitRecoveryCard
            title="Bespoke checkout paused briefly"
            detail="We limited repeated checkout attempts to protect your account and payment flow. No payment was taken and no design request was changed."
            retryAfterSeconds={BILLING_RATE_LIMIT_RECOVERY_SECONDS}
            action={
              <Link
                href="#bespoke-design"
                className={`giq-outline-action w-fit ${FOCUS_RING}`}
              >
                Review and retry
              </Link>
            }
          />
        </div>
      ) : bespokeOutcome === "cancelled" ? (
        <div
          aria-live="polite"
          className="mt-6 rounded-xl border border-amber-300/30 bg-amber-300/[0.08] p-4"
        >
          <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
            Bespoke checkout cancelled
          </p>
          <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
            No request was changed from this return. You can review the package
            and retry secure checkout below.
          </p>
          <Link
            href="#bespoke-design"
            className={`giq-outline-action mt-3 w-fit ${FOCUS_RING}`}
          >
            Review and retry
          </Link>
        </div>
      ) : null}

      <section className="mt-7" aria-labelledby="managed-pages-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="managed-pages-heading" className="text-[15px] font-semibold text-[hsl(var(--foreground))]">
            Your managed pages
          </h2>
          <span className="text-[12px] text-[hsl(var(--subtle-foreground))]">
            greyhoundsiq.com.au/p/…
          </span>
        </div>

        {pages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.12] bg-[hsl(var(--surface-1))] px-6 py-10 text-center">
            <CircleUserRound className="mx-auto h-8 w-8 text-[hsl(var(--primary-bright))]" aria-hidden="true" />
            <h3 className="mt-3 text-[15px] font-semibold text-[hsl(var(--foreground))]">Create your first page</h3>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              Choose a page type below, then add a cover, profile picture, contact details, and gallery.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pages.map((page) => {
              const avatarUrl =
                avatarUrls.get(page.id) ?? page.socialActor?.avatarUrl ?? null;
              const typeLabel = CUSTOM_PAGE_TYPE_LABELS[page.pageType as keyof typeof CUSTOM_PAGE_TYPE_LABELS];

              return (
                <article
                  key={page.id}
                  className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-[hsl(var(--surface-1))] shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition duration-200 hover:-translate-y-0.5 hover:border-[hsl(var(--primary)/0.28)]"
                >
                  <div className="relative h-24 overflow-hidden bg-gradient-to-br from-[hsl(var(--surface-2))] via-[hsl(var(--primary)/0.2)] to-black">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_20%,hsl(var(--secondary)/0.18),transparent_38%)]" />
                    <span className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/80 backdrop-blur-sm">
                      {typeLabel}
                    </span>
                  </div>
                  <div className="px-4 pb-4">
                    <div className="flex items-end justify-between gap-3">
                      <div className="relative -mt-8 h-16 w-16 shrink-0 overflow-hidden rounded-full border-4 border-[hsl(var(--surface-1))] bg-[hsl(var(--surface-2))] shadow-lg">
                        {avatarUrl ? (
                          <Image
                            src={avatarUrl}
                            alt={`${page.title} profile picture`}
                            fill
                            unoptimized={avatarUrl.startsWith("/api/media/")}
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="grid h-full place-items-center text-xl font-semibold text-white/80">
                            {page.title.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span
                        className={`mb-1 inline-flex min-h-7 items-center rounded-full border px-2.5 text-[11px] font-semibold ${
                          page.published
                            ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                            : "border-white/10 bg-white/[0.04] text-[hsl(var(--subtle-foreground))]"
                        }`}
                      >
                        {page.published ? "Published" : "Draft"}
                      </span>
                    </div>
                    <h3 className="mt-3 truncate text-lg font-semibold text-[hsl(var(--foreground))]">{page.title}</h3>
                    <p className="mt-1 truncate text-[12px] text-[hsl(var(--subtle-foreground))]">/p/{page.handle}</p>
                    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-4">
                      {page.published ? (
                        <Link
                          href={`/p/${page.handle}`}
                          className={`giq-outline-action min-h-11 justify-center text-[12px] ${FOCUS_RING}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View page <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      ) : (
                        <span className="flex min-h-11 items-center justify-center rounded-lg border border-white/[0.06] text-[12px] text-[hsl(var(--subtle-foreground))]">
                          Preview after publish
                        </span>
                      )}
                      <Link
                        href={`/account/pages/${page.id}`}
                        className={`giq-button giq-button-glass min-h-11 justify-center px-3 text-[12px] ${FOCUS_RING}`}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Manage
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-white/[0.08] bg-[hsl(var(--surface-1))] p-5 sm:p-6" aria-labelledby="create-page-heading">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary-bright))]">
            <Plus className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="create-page-heading" className="text-lg font-semibold text-[hsl(var(--foreground))]">Create a page</h2>
            <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">Add one managed identity for each main page type.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {MAIN_TYPES.filter((type) => !existingTypes.has(type)).map((type) => (
            <form key={type} action={createCustomPageAction}>
              <input type="hidden" name="pageType" value={type} />
              <input type="hidden" name="title" value={current.displayName ?? CUSTOM_PAGE_TYPE_LABELS[type]} />
              <SubmitButton className={`giq-button giq-button-glass min-h-11 w-full justify-center px-4 text-[13px] ${FOCUS_RING}`}>
                <Plus className="h-4 w-4" aria-hidden="true" /> {CUSTOM_PAGE_TYPE_LABELS[type]} page
              </SubmitButton>
            </form>
          ))}
          {existingTypes.size === MAIN_TYPES.length ? (
            <p className="sm:col-span-3 text-[12px] text-[hsl(var(--subtle-foreground))]">
              You have all main page types. Manage them above.
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-white/[0.08] bg-[hsl(var(--surface-1))] p-5 sm:p-6" aria-labelledby="dog-pages-heading">
        <h2 id="dog-pages-heading" className="text-lg font-semibold text-[hsl(var(--foreground))]">Dog pages</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          One page per verified dog you own. 3 included with Pro; more with Pro+.
        </p>
        {ownedDogs.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-white/[0.1] px-4 py-6 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            No verified dog ownerships yet. Claim a dog from its profile to unlock a dog page.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.07]">
            {ownedDogs.map((dog) => (
              <div key={dog.id} className="flex flex-col gap-3 bg-black/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[14px] font-medium text-[hsl(var(--foreground))]">{dog.name}</span>
                {dogPageDogIds.has(dog.id) ? (
                  <span className="flex min-h-11 items-center text-[12px] font-medium text-emerald-300">Page created</span>
                ) : (
                  <form action={createCustomPageAction}>
                    <input type="hidden" name="pageType" value="dog" />
                    <input type="hidden" name="dogId" value={dog.id} />
                    <input type="hidden" name="title" value={dog.name} />
                    <SubmitButton className={`giq-button giq-button-glass min-h-11 w-full justify-center px-4 text-[12px] sm:w-auto ${FOCUS_RING}`}>
                      <Plus className="h-4 w-4" aria-hidden="true" /> Create page
                    </SubmitButton>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        id="bespoke-design"
        className="mt-6 scroll-mt-24 overflow-hidden rounded-2xl border border-[hsl(var(--primary)/0.26)] bg-[hsl(var(--primary)/0.07)]"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-2 text-[hsl(var(--secondary))]">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Designed by our team — $500</h2>
          </div>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            One-off concierge package: our team hand-designs a business, trainer and punter page plus up to 5 dog pages for a professional look. One payment, no subscription.
          </p>
          {bespokeRequests.length > 0 ? (
            <ul className="mt-4 space-y-2 text-[12px] text-[hsl(var(--subtle-foreground))]">
              {bespokeRequests.map((request) => (
                <li key={request.id} className="rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2">
                  Request {request.createdAt.toISOString().slice(0, 10)} — <b>{request.status}</b>
                </li>
              ))}
            </ul>
          ) : null}
          <form action="/api/billing/bespoke/checkout" method="post" className="mt-5">
            <SubmitButton className={`giq-button giq-button-primary min-h-11 w-full justify-center px-5 text-[13px] font-semibold sm:w-auto ${FOCUS_RING}`}>
              Request bespoke design ($500)
            </SubmitButton>
          </form>
        </div>
      </section>
    </main>
  );
}
