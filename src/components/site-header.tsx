import Link from "next/link";
import { Activity, Crown, LogIn, LogOut, Menu, Search, Sparkles } from "lucide-react";
import Image, { getImageProps } from "next/image";
import { signOut } from "@workos-inc/authkit-nextjs";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { getCurrentUser } from "@/lib/auth";
import { HeaderNav } from "@/components/header-nav";
import { siteAssetUrl } from "@/lib/storage-paths";

const TIER_BADGE: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "var(--muted-foreground)" },
  pro: { label: "Pro", color: "var(--primary-bright)" },
  pro_plus: { label: "Pro+", color: "var(--secondary)" },
};

const NAV_LINKS = [
  { href: "/races", label: "Races" },
  { href: "/results", label: "Results" },
  { href: "/dogs", label: "Dogs" },
  { href: "/tracks", label: "Tracks" },
  { href: "/breeding", label: "Breeding" },
  { href: "/agents", label: "Agents" },
  { href: "/forum", label: "Forum" },
  { href: "/listings", label: "Listings" },
  { href: "/pricing", label: "Pricing" },
];

const HEADER_BANNER_LANDSCAPE = siteAssetUrl("/images/wentworth-track-banner-landscape.webp");
const HEADER_BANNER_PORTRAIT = siteAssetUrl("/images/wentworth-track-banner-portrait.webp");
const LOGO_MAIN = siteAssetUrl("/images/logo-main-purple-gold.webp");
const LOGO_MARK = siteAssetUrl("/images/logo-mark-purple-gold.webp");

function HeaderBannerImage() {
  const common = {
    alt: "",
    className:
      "pointer-events-none absolute inset-0 z-0 h-full w-full object-contain object-center opacity-[0.98] saturate-125",
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
    height: 550,
    quality: 82,
    src: HEADER_BANNER_PORTRAIT,
    width: 1200,
  });

  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={desktop} />
      <source srcSet={mobile} />
      <img {...rest} alt="" />
    </picture>
  );
}

export async function SiteHeader() {
  const user = await getCurrentUser();
  const badge = user ? TIER_BADGE[user.tier] ?? TIER_BADGE.free : null;

  return (
    <header className="sticky top-2 z-50 w-full px-3 md:px-5">
      <div className="relative isolate mx-auto min-h-[132px] max-w-7xl overflow-hidden rounded-2xl border border-white/25 bg-[hsl(var(--surface-3)/0.68)] shadow-[0_22px_55px_hsl(0_0%_0%/0.34)] backdrop-blur-xl md:min-h-[168px]">
        <HeaderBannerImage />
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 bg-[linear-gradient(90deg,hsl(var(--surface-1)/0.40)_0%,hsl(var(--surface-3)/0.16)_45%,hsl(var(--surface-3)/0.06)_100%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 bg-[linear-gradient(180deg,hsl(0_0%_100%/0.18)_0%,transparent_44%,hsl(var(--surface-1)/0.30)_100%)]"
        />
        <div aria-hidden="true" className="race-box-strip absolute inset-x-6 bottom-0 z-30 h-[3px] rounded-none opacity-95" />

        <div className="relative z-20 mx-auto flex min-h-[132px] max-w-7xl flex-col justify-between gap-4 px-4 py-4 md:min-h-[168px] md:px-6 md:py-5">
          <div className="flex items-start gap-3">
            <Sheet>
              <SheetTrigger
                aria-label="Open navigation menu"
                className="giq-logo-menu-button md:hidden"
              >
                <Image
                  src={LOGO_MARK}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="50px"
                />
                <span className="giq-logo-menu-glyph" aria-hidden="true">
                  <Menu className="h-3 w-3" />
                </span>
              </SheetTrigger>
              <SheetContent side="left" className="border-white/[0.06] bg-[hsl(var(--surface-1))]">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="race-box-strip mt-4" />
                <nav className="mt-8 flex flex-col gap-3">
                  <HeaderNav links={NAV_LINKS} variant="mobile" />
                </nav>
              </SheetContent>
            </Sheet>

            <Link
              href="/"
              aria-label="GreyhoundIQ home"
              className="group flex min-w-0 shrink items-center transition-transform hover:-translate-y-px"
            >
              <span className="relative hidden h-20 w-[300px] shrink overflow-hidden rounded-xl shadow-[0_14px_28px_hsl(0_0%_0%/0.24)] sm:block md:h-[104px] md:w-[360px] lg:w-[420px]">
                <Image
                  src={LOGO_MAIN}
                  alt=""
                  fill
                  className="object-contain object-left"
                  sizes="(min-width: 1024px) 420px, (min-width: 768px) 360px, 300px"
                />
              </span>
            </Link>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Link
                href="/dogs"
                className="giq-button giq-button-glass hidden px-3.5 text-[13px] font-semibold lg:inline-flex"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Search</span>
              </Link>

              {user ? (
                <>
                  <span className="hidden items-center gap-2 text-[13px] text-[hsl(var(--muted-foreground))] sm:flex">
                    <span className="max-w-[140px] truncate font-medium text-[hsl(var(--foreground))]">
                      <Link href="/account" className="hover:text-[hsl(var(--primary-bright))]">
                        {user.firstName || user.name}
                      </Link>
                    </span>
                    {badge && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: `hsl(${badge.color} / 0.14)`, color: `hsl(${badge.color})` }}
                      >
                        {badge.label}
                      </span>
                    )}
                  </span>
                  <form
                    action={async () => {
                      "use server";
                      await signOut();
                    }}
                  >
                    <button
                      type="submit"
                      className="giq-button giq-button-glass px-3 text-[13px] font-semibold md:px-4"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link
                    href="/sign-in"
                    prefetch={false}
                    className="giq-button giq-button-glass hidden px-4 text-[13px] font-semibold sm:inline-flex"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    Log in
                  </Link>
                  <Link
                    href="/pricing"
                    className="giq-button giq-button-gold px-3.5 text-[13px] font-bold sm:px-5"
                  >
                    <Crown className="h-3.5 w-3.5" />
                    <span className="sm:hidden">Pro</span>
                    <span className="hidden sm:inline">Go Pro</span>
                  </Link>
                </>
              )}
            </div>
          </div>

          <Link
            href="/"
            aria-hidden="true"
            tabIndex={-1}
            className="relative h-[92px] w-full max-w-[310px] overflow-hidden rounded-xl shadow-[0_14px_28px_hsl(0_0%_0%/0.24)] sm:hidden"
          >
            <Image
              src={LOGO_MAIN}
              alt=""
              fill
              className="object-contain object-left"
              sizes="310px"
            />
          </Link>

          <nav className="giq-header-nav hidden w-full items-center gap-2 overflow-x-auto rounded-xl p-2 md:flex 2xl:justify-center">
            <HeaderNav links={NAV_LINKS} variant="desktop" />
          </nav>

          <div className="hidden items-center justify-between gap-4 text-[11px] text-[hsl(var(--muted-foreground))] lg:flex">
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
