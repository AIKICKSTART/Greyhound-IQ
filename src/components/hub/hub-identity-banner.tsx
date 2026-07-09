import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, ExternalLink, Pencil } from "lucide-react";
import type { ActiveIdentity } from "@/lib/identity";
import { CUSTOM_PAGE_TYPE_LABELS } from "@/lib/custom-page-service";
import type { CustomPageType } from "@/lib/custom-page-validation";

const BRAND_PURPLE = "#7c3aed";

export type PersonalIdentitySummary = {
  displayName: string;
  avatarUrl: string | null;
  verified: boolean;
  kennelName: string | null;
  state: string | null;
  tierLabel: string;
};

// Banner + avatar header for the hub, mirroring the /p/[handle] public page
// header so switching identities feels native, not bolted on.
export function HubIdentityBanner({
  identity,
  personal,
}: {
  identity: ActiveIdentity;
  personal: PersonalIdentitySummary;
}) {
  const isPage = identity.kind === "page";
  const page = isPage ? identity.page : null;
  const accent = page?.accentColor || BRAND_PURPLE;
  const title = page ? page.title : personal.displayName;
  const avatarUrl = page ? page.media.avatarUrl : personal.avatarUrl;
  const bannerUrl = page ? page.media.bannerUrl : null;
  const subtitle = page
    ? page.tagline ??
      `${CUSTOM_PAGE_TYPE_LABELS[page.pageType as CustomPageType] ?? page.pageType} page`
    : [personal.kennelName, personal.state].filter(Boolean).join(" - ") ||
      "Member profile";

  return (
    <header className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[hsl(var(--surface-1))]">
      <div className="relative aspect-[16/4] w-full bg-gradient-to-br from-[hsl(var(--primary)/0.35)] via-[hsl(var(--surface-2))] to-black sm:aspect-[16/3]">
        {bannerUrl && (
          <Image
            src={bannerUrl}
            alt=""
            fill
            sizes="(max-width:768px) 100vw, 900px"
            className="object-cover"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
      </div>
      <div className="flex flex-wrap items-end gap-4 px-5 pb-4 sm:px-6">
        <div
          className="-mt-9 h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border-2 bg-black"
          style={{ borderColor: accent }}
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={title}
              width={72}
              height={72}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-xl font-bold text-white/70">
              {title.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))] sm:text-2xl">
              {title}
            </h1>
            {page ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black"
                style={{ background: accent }}
              >
                {CUSTOM_PAGE_TYPE_LABELS[page.pageType as CustomPageType] ??
                  page.pageType}
              </span>
            ) : (
              <>
                {personal.verified && (
                  <BadgeCheck
                    aria-label="Verified profile"
                    className="h-4 w-4 text-[hsl(var(--primary-bright))]"
                  />
                )}
                <span className="giq-badge giq-badge-neutral text-[10px] uppercase tracking-wide">
                  {personal.tierLabel}
                </span>
              </>
            )}
            {page && !page.published && (
              <span className="giq-badge giq-badge-neutral text-[10px] uppercase tracking-wide">
                Draft
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[13px] text-[hsl(var(--muted-foreground))]">
            {subtitle}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 pb-1">
          {page ? (
            <>
              <Link
                href={`/account/pages/${page.id}`}
                className="giq-button giq-button-glass min-h-9 px-3 text-[12px] font-semibold"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Edit page
              </Link>
              {page.published && (
                <Link
                  href={`/p/${page.handle}`}
                  className="giq-outline-action min-h-9 px-3 text-[12px]"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  View public
                </Link>
              )}
            </>
          ) : (
            <Link
              href="/account"
              className="giq-button giq-button-glass min-h-9 px-3 text-[12px] font-semibold"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit profile
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
