import Link from "next/link";
import {
  Activity,
  Bell,
  Bookmark,
  Bot,
  ChevronDown,
  Crown,
  CreditCard,
  Dna,
  Download,
  Home,
  LifeBuoy,
  LogIn,
  LogOut,
  Map,
  MessageSquare,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trophy,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Image, { getImageProps } from "next/image";
import "@/lib/workos-env";
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
import {
  MobileMenuAnchor,
  MobileMenuLink,
  MobileMenuSearchForm,
} from "@/components/mobile-menu-close-link";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { countUnreadMessagesTotal } from "@/lib/conversation-service";
import { countUnreadNotificationsForUser } from "@/lib/notification-service";
import { profileRealtimeChannel } from "@/lib/realtime-service";
import { siteAssetUrl } from "@/lib/storage-paths";

const TIER_BADGE: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "var(--muted-foreground)" },
  pro: { label: "Pro", color: "var(--primary-bright)" },
  pro_plus: { label: "Pro+", color: "var(--secondary)" },
};

type HeaderUser = Awaited<ReturnType<typeof getCurrentUser>>;

type NavLink = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const NAV_SECTIONS: { title: string; links: NavLink[] }[] = [
  {
    title: "Race control",
    links: [
      { href: "/", label: "Home", description: "Today, shortcuts, and platform overview", icon: Home },
      { href: "/races", label: "Races", description: "Live cards, search, filters, and replays", icon: Activity },
      { href: "/results", label: "Results", description: "Recent winners, times, and margins", icon: Trophy },
      { href: "/tracks", label: "Tracks", description: "Australian tracks and meeting history", icon: Map },
    ],
  },
  {
    title: "Intelligence",
    links: [
      { href: "/dogs", label: "Dogs", description: "Profiles, form, trainers, and records", icon: Search },
      { href: "/breeding", label: "Breeding", description: "Pedigree and breeding analysis", icon: Dna },
      { href: "/agents", label: "Agents", description: "AI workflows and racing analysis", icon: Bot },
    ],
  },
  {
    title: "Community",
    links: [
      { href: "/marketplace", label: "Marketplace", description: "Verified greyhound marketplace and saved dogs", icon: ShoppingBag },
      { href: "/groups", label: "Groups", description: "Community groups, topics, and threads", icon: Users },
      { href: "/feed", label: "Feed", description: "Personalised racing community updates", icon: MessageSquare },
      { href: "/pulse", label: "Pulse", description: "Private conversations, enquiries, and calls", icon: Bell },
      { href: "/pricing", label: "Pricing", description: "Plans, limits, and Pro access", icon: CreditCard },
    ],
  },
];
const NAV_LINKS = NAV_SECTIONS.flatMap((section) =>
  section.links.map(({ href, label }) => ({ href, label }))
);

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

function AccountMenuItems({
  canAccessAdmin,
  closeOnSelect = false,
}: {
  canAccessAdmin: boolean;
  closeOnSelect?: boolean;
}) {
  const AccountLink = closeOnSelect ? MobileMenuLink : Link;
  const AccountAnchor = closeOnSelect ? MobileMenuAnchor : "a";

  return (
    <>
      <AccountLink href="/account" className={ACCOUNT_MENU_ITEM_CLASS}>
        <User className="h-3.5 w-3.5" aria-hidden="true" />
        Account
      </AccountLink>
      <AccountLink href="/account/security" className={ACCOUNT_MENU_ITEM_CLASS}>
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Security
      </AccountLink>
      <AccountLink href="/account/notifications" className={ACCOUNT_MENU_ITEM_CLASS}>
        <Bell className="h-3.5 w-3.5" aria-hidden="true" />
        Notifications
      </AccountLink>
      <AccountLink href="/account/saved-listings" className={ACCOUNT_MENU_ITEM_CLASS}>
        <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
        Saved marketplace
      </AccountLink>
      <AccountLink href="/account/billing" className={ACCOUNT_MENU_ITEM_CLASS}>
        <Crown className="h-3.5 w-3.5" aria-hidden="true" />
        Billing
      </AccountLink>
      <AccountLink href="/account/usage" className={ACCOUNT_MENU_ITEM_CLASS}>
        <Activity className="h-3.5 w-3.5" aria-hidden="true" />
        Usage
      </AccountLink>
      <AccountAnchor href="/api/users/me/export" className={ACCOUNT_MENU_ITEM_CLASS}>
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        Data export
      </AccountAnchor>
      <AccountLink href="/account/support" className={ACCOUNT_MENU_ITEM_CLASS}>
        <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
        Support
      </AccountLink>
      {canAccessAdmin && (
        <AccountLink href="/admin" className={ACCOUNT_MENU_ITEM_CLASS}>
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Admin
        </AccountLink>
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

function MobileNavigationMenu({
  user,
  badge,
  canAccessAdmin,
}: {
  user: HeaderUser;
  badge: { label: string; color: string } | null;
  canAccessAdmin: boolean;
}) {
  return (
    <SheetContent side="right" showCloseButton={false} className="giq-mobile-menu-sheet">
      <SheetTitle className="sr-only">Navigation</SheetTitle>
      <div className="giq-mobile-menu-scroll">
        <div className="giq-mobile-menu-head">
          <div className="giq-mobile-menu-brand" aria-hidden="true">
            <span>
              GREYHOUNDS <strong>IQ</strong>
            </span>
            <small>Premium racing intelligence</small>
          </div>
          <SheetClose aria-label="Close navigation menu" className="giq-mobile-menu-close">
            <X className="h-5 w-5" aria-hidden="true" />
          </SheetClose>
        </div>

        <MobileMenuSearchForm
          action="/races"
          role="search"
          aria-label="Search races"
          className="giq-mobile-menu-search"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <input
            type="search"
            name="q"
            placeholder="Search races, tracks, runners"
            aria-label="Search races, tracks, runners"
          />
          <input type="hidden" name="sort" value="relevance" />
          <button type="submit" aria-label="Search races">
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>
        </MobileMenuSearchForm>

        <div className="giq-mobile-menu-cta">
          {user ? (
            <MobileMenuLink href="/account" className="giq-mobile-account-card">
              <span className="giq-mobile-account-avatar" aria-hidden="true">
                <User className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <strong>{user.firstName || user.name}</strong>
                <small>{user.email}</small>
              </span>
              {badge && <em>{badge.label}</em>}
            </MobileMenuLink>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <MobileMenuAnchor
                href="/sign-in"
                className="giq-button giq-button-glass min-h-12 px-3 text-[13px] font-semibold"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Log in
              </MobileMenuAnchor>
              <MobileMenuLink
                href="/pricing"
                className="giq-button giq-button-gold min-h-12 px-3 text-[13px] font-bold"
              >
                <Crown className="h-4 w-4" aria-hidden="true" />
                Go Pro
              </MobileMenuLink>
            </div>
          )}
        </div>

        <nav aria-label="Primary navigation" className="giq-mobile-menu-nav">
          {NAV_SECTIONS.map((section) => (
            <section key={section.title} className="giq-mobile-menu-section">
              <h2>{section.title}</h2>
              <div className="grid gap-2">
                {section.links.map((link) => {
                  const Icon = link.icon;
                  return (
                    <MobileMenuLink key={link.href} href={link.href} className="giq-mobile-menu-link">
                      <span className="giq-mobile-menu-link-icon" aria-hidden="true">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <strong>{link.label}</strong>
                        <small>{link.description}</small>
                      </span>
                    </MobileMenuLink>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        {user && (
          <section className="giq-mobile-menu-section">
            <h2>Account</h2>
            <div className="grid gap-2">
              <AccountMenuItems canAccessAdmin={canAccessAdmin} closeOnSelect />
              <SignOutMenuButton />
            </div>
          </section>
        )}
      </div>
    </SheetContent>
  );
}

function AccountNavigationMenu({
  user,
  canAccessAdmin,
}: {
  user: NonNullable<HeaderUser>;
  canAccessAdmin: boolean;
}) {
  return (
    <SheetContent side="right" showCloseButton={false} className="giq-mobile-menu-sheet">
      <SheetTitle className="sr-only">Account menu</SheetTitle>
      <div className="giq-mobile-menu-scroll">
        <div className="giq-mobile-menu-head">
          <div className="giq-mobile-menu-brand">
            <span>{user.firstName || user.name}</span>
            <small>{user.email}</small>
          </div>
          <SheetClose aria-label="Close account menu" className="giq-mobile-menu-close">
            <X className="h-5 w-5" aria-hidden="true" />
          </SheetClose>
        </div>

        <section className="giq-mobile-menu-section">
          <h2>Account</h2>
          <div className="grid gap-2">
            <AccountMenuItems canAccessAdmin={canAccessAdmin} closeOnSelect />
            <SignOutMenuButton />
          </div>
        </section>
      </div>
    </SheetContent>
  );
}

function CountBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={label}
      className="pointer-events-none absolute -right-1.5 -top-1.5 z-10 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[hsl(var(--primary-bright))] px-1 text-[10px] font-bold leading-[18px] tabular-nums text-[hsl(var(--primary-foreground))] shadow-[0_2px_10px_hsl(var(--primary-bright)/0.55)]"
    >
      {count > 99 ? "99+" : count}
    </span>
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
  const [unreadMessages, unreadNotifications] =
    user?.profileId && user.dbUserId
      ? await Promise.all([
          countUnreadMessagesTotal(user.profileId),
          countUnreadNotificationsForUser(user.dbUserId),
        ])
      : [0, 0];
  const profileChannel = user?.profileId
    ? profileRealtimeChannel(user.profileId)
    : null;

  return (
    <header className="giq-site-header sticky top-2 z-50 w-full px-3 md:px-5">
      {profileChannel && (
        <RealtimeRefresh
          channels={[
            {
              name: profileChannel,
              events: [
                "message_created",
                "conversation_updated",
                "call_invite_created",
              ],
            },
          ]}
        />
      )}
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
              <form
                action="/races"
                role="search"
                aria-label="Search races"
                className="giq-search-shell hidden lg:flex"
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                <input
                  type="search"
                  name="q"
                  className="giq-search-input"
                  placeholder="Search races, tracks, runners"
                  aria-label="Search races, tracks, runners"
                />
                <input type="hidden" name="sort" value="relevance" />
              </form>
              <span className="giq-header-notification relative hidden lg:inline-flex">
                <Link
                  href="/pulse"
                  aria-label="Pulse"
                  className="giq-button giq-button-carbon giq-icon-button min-h-10 w-10 px-0"
                >
                  <Bell className="h-4 w-4" />
                </Link>
                <CountBadge
                  count={unreadMessages}
                  label={`${unreadMessages} unread Pulse messages`}
                />
              </span>

              {user ? (
                <Sheet>
                  <span className="giq-header-auth-action relative hidden md:inline-flex">
                    <SheetTrigger
                      aria-label={`Open account menu for ${user.name}`}
                      className="giq-button giq-button-glass min-h-10 px-3 text-[13px] font-semibold md:px-4"
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
                    <CountBadge
                      count={unreadNotifications}
                      label={`${unreadNotifications} unread notifications`}
                    />
                  </span>
                  <AccountNavigationMenu user={user} canAccessAdmin={canAccessAdmin} />
                </Sheet>
              ) : (
                <>
                  <a
                    href="/sign-in"
                    className="giq-button giq-button-glass giq-header-auth-action giq-header-login-action hidden px-4 text-[13px] font-semibold md:inline-flex"
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
                <MobileNavigationMenu
                  user={user}
                  badge={badge}
                  canAccessAdmin={canAccessAdmin}
                />
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
