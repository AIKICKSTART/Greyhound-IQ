import Link from "next/link";
import { Activity, Sparkles } from "lucide-react";
import Image, { getImageProps } from "next/image";
import { HeaderActions } from "@/components/header-actions";
import { HeaderNav } from "@/components/header-nav";
import { NAV_LINKS } from "@/components/header-links";
import { siteAssetUrl } from "@/lib/storage-paths";

// Static, user-agnostic header shell. All per-user state (name, tier badge,
// unread counts, account menu) lives in the client <HeaderActions> island,
// which fetches /api/header after hydration. Keeping this component free of
// any cookie/session read is what lets pages under it be cached (see the CI
// guard in scripts/check-public-cacheable.ts).

const HEADER_BANNER_LANDSCAPE = siteAssetUrl("/images/wentworth-track-banner-landscape.webp");
const HEADER_BANNER_MOBILE = siteAssetUrl("/images/wentworth-track-banner-mobile.webp");
const LOGO_MAIN = "/images/logo-main-purple-gold.webp";
const LOGO_MOBILE = "/images/logo-wordmark-purple-gold.webp";

function HeaderBannerImage() {
  const common = {
    alt: "",
    className:
      "pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-center opacity-[0.52] saturate-125",
    loading: "eager" as const,
    sizes: "100vw",
  };
  const {
    props: { srcSet: desktop },
  } = getImageProps({
    ...common,
    height: 500,
    quality: 82,
    src: HEADER_BANNER_LANDSCAPE,
    width: 2400,
  });
  const {
    props: { srcSet: mobile, ...rest },
  } = getImageProps({
    ...common,
    height: 560,
    quality: 82,
    src: HEADER_BANNER_MOBILE,
    width: 1080,
  });

  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={desktop} />
      <source srcSet={mobile} />
      <img {...rest} alt="" />
    </picture>
  );
}

export function SiteHeader() {
  return (
    <header className="giq-site-header sticky top-2 z-50 w-full px-3 md:px-5">
      <div className="giq-site-header-frame relative isolate mx-auto min-h-[150px] max-w-[70rem] overflow-hidden rounded-2xl border border-white/25 bg-[hsl(var(--surface-3)/0.68)] shadow-[0_22px_55px_hsl(0_0%_0%/0.34)] backdrop-blur-xl">
        <HeaderBannerImage />
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 bg-[linear-gradient(90deg,hsl(var(--surface-1)/0.70)_0%,hsl(var(--surface-3)/0.25)_55%,transparent_100%)]"
        />
        <div aria-hidden="true" className="race-box-strip absolute inset-x-6 bottom-0 z-30 h-[3px] rounded-none opacity-95" />

        <div className="giq-site-header-inner relative z-20 mx-auto flex min-h-[150px] max-w-[70rem] flex-col justify-between gap-4 px-4 py-4 md:px-6 md:py-[18px]">
          <div className="giq-header-top-row flex items-start gap-3">
            <Link
              href="/"
              aria-label="GreyhoundIQ home"
              className="giq-header-brand-link group flex min-w-0 shrink items-center transition-transform hover:-translate-y-px"
            >
              <span className="giq-header-logo-main relative hidden h-[76px] w-[300px] shrink overflow-hidden drop-shadow-[0_10px_20px_rgba(0,0,0,0.40)] md:block md:w-[360px] lg:w-[420px]">
                <Image
                  src={LOGO_MAIN}
                  alt=""
                  fill
                  className="object-contain object-left"
                  sizes="(min-width: 1024px) 420px, (min-width: 768px) 360px, 300px"
                />
              </span>
              <span className="giq-header-logo-mobile relative md:hidden" aria-hidden="true">
                <Image
                  src={LOGO_MOBILE}
                  alt=""
                  fill
                  priority
                  className="object-contain object-left"
                  sizes="(max-width: 767px) 64vw"
                />
              </span>
            </Link>

            <HeaderActions />
          </div>

          <nav className="giq-header-nav hidden w-full items-center justify-center gap-2 overflow-x-auto rounded-xl p-2 md:flex">
            <HeaderNav links={NAV_LINKS} variant="desktop" />
          </nav>

          <div className="giq-header-meta-row hidden items-center justify-between gap-4 text-[11px] text-[hsl(var(--muted-foreground))] lg:flex">
            <div className="flex items-center gap-3">
              <span className="giq-header-status inline-flex items-center gap-2 rounded-lg px-3 py-1.5 font-semibold uppercase tracking-[0.12em] text-[hsl(var(--primary-light))]">
                <Activity className="h-3.5 w-3.5" />
                Live form desk
              </span>
              <span className="text-[hsl(var(--muted-foreground))] drop-shadow">
                Race cards, ownership, breeding, agents, and marketplace in one track-side view
              </span>
            </div>
            <Link
              href="/agents"
              className="giq-button giq-button-glass min-h-9 px-3 text-[11px] font-semibold"
            >
              <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--secondary-light))]" />
              Agent console
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
