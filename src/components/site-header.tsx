import Link from "next/link";
import {
  Activity,
  Bell,
  ChevronDown,
  Crown,
  Download,
  LifeBuoy,
  LogIn,
  LogOut,
  Search,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "lucide-react";
import Image, { getImageProps } from "next/image";
import { signOut } from "@workos-inc/authkit-nextjs";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { getCurrentUser, isModeratorRole } from "@/lib/auth";
import { HeaderNav } from "@/components/header-nav";
import { siteAssetUrl } from "@/lib/storage-paths";

const TIER_BADGE: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "var(--muted-foreground)" },
  pro: { label: "Pro", color: "var(--primary-bright)" },
  pro_plus: { label: "Pro+", color: "var(--secondary)" },
};

const NAV_LINKS = [
  { href: "/", label: "Home" },
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
const HEADER_BANNER_MOBILE = siteAssetUrl("/images/wentworth-track-banner-mobile.webp");
const LOGO_MAIN = "/images/logo-main-purple-gold.webp";
const LOGO_MOBILE = "/images/logo-wordmark-purple-gold.webp";
const ACCOUNT_MENU_ITEM_CLASS =
  "giq-button giq-button-carbon min-h-10 w-full justify-start px-3 text-[13px] font-semibold";

async function signOutAction() {
  "use server";
  await signOut();
}

function AccountMenuItems({ canAccessAdmin }: { canAccessAdmin: boolean }) {
  return (
    <>
      <Link href="/account" className={ACCOUNT_MENU_ITEM_CLASS}>
        <User className="h-3.5 w-3.5" aria-hidden="true" />
        Account
      </Link>
      <Link href="/account/security" className={ACCOUNT_MENU_ITEM_CLASS}>
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Security
      </Link>
      <Link href="/account/notifications" className={ACCOUNT_MENU_ITEM_CLASS}>
        <Bell className="h-3.5 w-3.5" aria-hidden="true" />
        Notifications
      </Link>
      <Link href="/account/billing" className={ACCOUNT_MENU_ITEM_CLASS}>
        <Crown className="h-3.5 w-3.5" aria-hidden="true" />
        Billing
      </Link>
      <Link href="/account/usage" className={ACCOUNT_MENU_ITEM_CLASS}>
        <Activity className="h-3.5 w-3.5" aria-hidden="true" />
        Usage
      </Link>
      <a href="/api/users/me/export" className={ACCOUNT_MENU_ITEM_CLASS}>
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        Data export
      </a>
      <Link href="/account/support" className={ACCOUNT_MENU_ITEM_CLASS}>
        <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
        Support
      </Link>
      {canAccessAdmin && (
        <Link href="/admin" className={ACCOUNT_MENU_ITEM_CLASS}>
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Admin
        </Link>
      )}
    </>
  );
}

function SignOutMenuButton() {
  return (
    <form action={signOutAction} className="mt-2">
      <button
        type="submit"
        className="giq-button giq-button-glass min-h-10 w-full justify-start px-3 text-[13px] font-semibold"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        Sign out
      </button>
    </form>
  );
}

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

export async function SiteHeader() {
  const user = await getCurrentUser();
  const badge = user ? TIER_BADGE[user.tier] ?? TIER_BADGE.free : null;
  const canAccessAdmin = user ? isModeratorRole(user.role) : false;

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

            <div className="giq-header-actions ml-auto flex shrink-0 items-center gap-2">
              <form action="/dogs" className="giq-search-shell hidden lg:flex">
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                <input
                  type="search"
                  name="q"
                  className="giq-search-input"
                  placeholder="Search dogs, tracks, trainers"
                  aria-label="Search dogs, tracks, trainers"
                />
              </form>
              <Link
                href="/messages"
                aria-label="Notifications"
                className="giq-button giq-button-carbon giq-icon-button giq-header-notification hidden min-h-10 w-10 px-0 lg:inline-flex"
              >
                <Bell className="h-4 w-4" />
              </Link>

              {user ? (
                <Sheet>
                  <SheetTrigger
                    aria-label={`Open account menu for ${user.name}`}
                    className="giq-button giq-button-glass giq-header-auth-action hidden min-h-10 px-3 text-[13px] font-semibold md:inline-flex md:px-4"
                  >
                    <User className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="max-w-[100px] truncate">{user.firstName || user.name}</span>
                    {badge && (
                      <span
                        className="hidden rounded-full px-2 py-0.5 text-[10px] font-semibold lg:inline-flex"
                        style={{ background: `hsl(${badge.color} / 0.14)`, color: `hsl(${badge.color})` }}
                      >
                        {badge.label}
                      </span>
                    )}
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </SheetTrigger>
                  <SheetContent side="right" showCloseButton={false} className="giq-mobile-menu-sheet">
                    <SheetTitle className="sr-only">Account menu</SheetTitle>
                    <SheetClose aria-label="Close account menu" className="giq-mobile-menu-close">
                      <X className="h-5 w-5" aria-hidden="true" />
                    </SheetClose>
                    <div className="giq-mobile-menu-brand">
                      <span>{user.firstName || user.name}</span>
                      <small>{user.email}</small>
                    </div>
                    <div className="race-box-strip mt-4" />
                    <nav aria-label="Account" className="mt-6 flex flex-col gap-2">
                      <AccountMenuItems canAccessAdmin={canAccessAdmin} />
                    </nav>
                    <SignOutMenuButton />
                  </SheetContent>
                </Sheet>
              ) : (
                <>
                  <a
                    href="/sign-in"
                    className="giq-button giq-button-glass giq-header-auth-action hidden px-4 text-[13px] font-semibold md:inline-flex"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    Log in
                  </a>
                  <Link
                    href="/pricing"
                    className="giq-button giq-button-gold giq-header-auth-action hidden px-3.5 text-[13px] font-bold md:inline-flex md:px-5"
                  >
                    <Crown className="h-3.5 w-3.5" />
                    <span className="sm:hidden">Pro</span>
                    <span className="hidden sm:inline">Go Pro</span>
                  </Link>
                </>
              )}

              <Sheet>
                <SheetTrigger
                  aria-label="Open navigation menu"
                  className="giq-mobile-menu-button md:hidden"
                >
                  <span className="giq-premium-hamburger" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                </SheetTrigger>
                <SheetContent side="right" showCloseButton={false} className="giq-mobile-menu-sheet">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <SheetClose aria-label="Close navigation menu" className="giq-mobile-menu-close">
                    <X className="h-5 w-5" aria-hidden="true" />
                  </SheetClose>
                  <div className="giq-mobile-menu-brand" aria-hidden="true">
                    <span>GREYHOUNDS <strong>IQ</strong></span>
                    <small>Premium racing intelligence</small>
                  </div>
                  <div className="race-box-strip mt-4" />
                  <nav className="mt-8 flex flex-col gap-3">
                    <HeaderNav links={NAV_LINKS} variant="mobile" />
                  </nav>
                  {user && (
                    <>
                      <div className="race-box-strip mt-6" />
                      <nav aria-label="Account" className="mt-6 flex flex-col gap-2">
                        <AccountMenuItems canAccessAdmin={canAccessAdmin} />
                      </nav>
                      <SignOutMenuButton />
                    </>
                  )}
                </SheetContent>
              </Sheet>
            </div>
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
