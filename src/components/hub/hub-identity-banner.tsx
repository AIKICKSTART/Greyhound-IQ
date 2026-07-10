import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, Camera, ExternalLink, Pencil } from "lucide-react";
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
  actor,
  identity,
  personal,
}: {
  actor: {
    handle: string;
    avatarUrl: string | null;
    coverUrl: string | null;
    coverFocalX: number;
    coverFocalY: number;
  };
  identity: ActiveIdentity;
  personal: PersonalIdentitySummary;
}) {
  const isPage = identity.kind === "page";
  const page = isPage ? identity.page : null;
  const accent = page?.accentColor || BRAND_PURPLE;
  const title = page ? page.title : personal.displayName;
  const avatarUrl = actor.avatarUrl ?? (page ? page.media.avatarUrl : personal.avatarUrl);
  const bannerUrl = actor.coverUrl ?? page?.media.bannerUrl ?? null;
  const coverImageUrl =
    bannerUrl ?? "/images/wentworth-track-banner-landscape.webp";
  const mediaHref = page
    ? `/account/pages/${page.id}#page-media`
    : "/account#profile-media";
  const subtitle = page
    ? page.tagline ??
      `${CUSTOM_PAGE_TYPE_LABELS[page.pageType as CustomPageType] ?? page.pageType} page`
    : [personal.kennelName, personal.state].filter(Boolean).join(" - ") ||
      "Member profile";

  return (
    <header className="giq-hub-identity-banner overflow-hidden rounded-2xl border border-white/[0.09] bg-[hsl(var(--surface-1))] shadow-[0_18px_55px_rgba(0,0,0,0.32)]">
      <div className="giq-hub-identity-cover relative aspect-[16/5] min-h-36 w-full overflow-hidden bg-black sm:min-h-44">
        <Image
          src={coverImageUrl}
          alt=""
          fill
          unoptimized={coverImageUrl.startsWith("/api/media/")}
          sizes="(max-width:768px) 100vw, 980px"
          className="object-cover"
          style={{
            objectPosition: `${actor.coverFocalX * 100}% ${actor.coverFocalY * 100}%`,
          }}
          priority
        />
        <div className="giq-hub-identity-cover-shade absolute inset-0" />
        <Link
          href={mediaHref}
          aria-label={`Edit cover photo for ${title}`}
          className="giq-hub-cover-edit giq-button giq-button-glass min-h-11 border-black/20 bg-black/65 px-3 text-[12px] font-semibold backdrop-blur-md"
          style={{ position: "absolute", right: 12, top: 12, zIndex: 10 }}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit cover
        </Link>
        <div className="absolute inset-x-0 bottom-0 flex h-1" aria-hidden="true">
          {["#ef2d75", "#d79a1e", "#20b15a", "#f0c128", "#3478e5", "#e9e9e9", "#d83b3b", "#7c3aed"].map(
            (color) => (
              <span key={color} className="flex-1" style={{ backgroundColor: color }} />
            ),
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-4 px-5 pb-5 sm:px-6">
        <div className="giq-hub-avatar-wrap relative -mt-12 h-24 w-24 shrink-0 sm:h-28 sm:w-28">
          <div
            className="giq-hub-avatar h-full w-full overflow-hidden rounded-full border-4 border-[hsl(var(--surface-1))] bg-black shadow-xl"
            style={{ borderColor: accent }}
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={title}
                width={112}
                height={112}
                unoptimized={avatarUrl.startsWith("/api/media/")}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-xl font-bold text-white/70">
                {title.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <Link
            href={mediaHref}
            aria-label={`Edit profile picture for ${title}`}
            className="giq-hub-avatar-edit absolute -bottom-1 -right-1 grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-[hsl(var(--surface-2)/0.96)] text-[hsl(var(--foreground))] shadow-xl backdrop-blur-md"
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
          </Link>
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
            <>
              <Link
                href="/account"
                className="giq-button giq-button-glass min-h-9 px-3 text-[12px] font-semibold"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Edit profile
              </Link>
              <Link
                href={`/p/${actor.handle}`}
                className="giq-outline-action min-h-9 px-3 text-[12px]"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                View public
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
