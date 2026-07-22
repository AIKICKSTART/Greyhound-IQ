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
  Home,
  Info,
  LifeBuoy,
  LogIn,
  LogOut,
  Map,
  Mail,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Trophy,
  User,
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
import { ActorMediaImage } from "@/components/actor-media-image";
import {
  MemberHeaderSection,
  MemberHeaderShell,
} from "@/components/member-header-shell";
import {
  MobileMenuAnchor,
  MobileMenuLink,
  MobileMenuSearchForm,
  MobileMenuViewportClose,
} from "@/components/mobile-menu-close-link";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { UserDataExportForm } from "@/components/user-data-export-form";
import { countUnreadNotificationsForUser } from "@/lib/notification-service";
import { profileRealtimeChannel } from "@/lib/realtime-service";
import { siteAssetUrl } from "@/lib/storage-paths";
import { cached } from "@/lib/ttl-cache";
import {
  DANIEL_DEMO_PROFILE_ALIGNMENT,
  DANIEL_DEMO_PROFILE_PORTRAIT,
} from "@/lib/demo-profile-media";

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
      { href: "/vets", label: "Vets", description: "Greyhound-friendly vet clinics across Australia", icon: Stethoscope },
      { href: "/agents", label: "Agents", description: "AI workflows and racing analysis", icon: Bot },
    ],
  },
  {
    title: "Community",
    links: [
      { href: "/marketplace", label: "Marketplace", description: "Verified greyhound marketplace and saved dogs", icon: ShoppingBag },
      { href: "/pricing", label: "Pricing", description: "Plans, limits, and Pro access", icon: CreditCard },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About", description: "GreyhoundIQ purpose, product, and team", icon: Info },
      { href: "/contact", label: "Contact", description: "Questions, support, and partnership enquiries", icon: Mail },
    ],
  },
];
const NAV_LINKS = [
  { href: "/", label: "Home" },
  {
    label: "Racing",
    links: [
      { href: "/races", label: "Races" },
      { href: "/results", label: "Results" },
    ],
  },
  { href: "/tracks", label: "Tracks" },
  { href: "/dogs", label: "Dogs" },
  { href: "/breeding", label: "Breeding" },
  { href: "/vets", label: "Vets" },
  { href: "/agents", label: "Agents" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/pricing", label: "Pricing" },
  {
    label: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
    ],
  },
];
const MEMBER_RACE_NAV_LINKS = [
  { href: "/races", label: "Races" },
  { href: "/results", label: "Results" },
  { href: "/tracks", label: "Tracks" },
  { href: "/dogs", label: "Dogs" },
  { href: "/breeding", label: "Breeding" },
  { href: "/vets", label: "Vets" },
  { href: "/statistics", label: "Statistics" },
];
const HEADER_BANNER_LANDSCAPE = siteAssetUrl("/images/wentworth-track-banner-landscape.webp");
const HEADER_BANNER_MOBILE = siteAssetUrl("/images/wentworth-track-banner-mobile.webp");
const LOGO_MAIN = "/images/logo-main-purple-gold.webp";
const LOGO_MOBILE = "/images/logo-wordmark-purple-gold.webp";
const DANIEL_PROFILE_PORTRAIT = DANIEL_DEMO_PROFILE_PORTRAIT;
const ACCOUNT_MENU_ITEM_CLASS =
  "giq-button giq-button-carbon min-h-10 w-full justify-start px-3 text-[13px] font-semibold";

function profileInitials(user: NonNullable<HeaderUser>) {
  const names = [user.firstName, user.lastName].filter(
    (name): name is string => Boolean(name?.trim())
  );
  const parts = names.length > 0 ? names : user.name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((name) => name[0])
    .join("")
    .toUpperCase() || "GI";
}

function isDanielFleuren(user: NonNullable<HeaderUser>) {
  return (
    user.firstName?.trim().toLowerCase() === "daniel" &&
    user.lastName?.trim().toLowerCase() === "fleuren"
  );
}

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
      <UserDataExportForm className={ACCOUNT_MENU_ITEM_CLASS} />
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
  const initials = user ? profileInitials(user) : "";
  const showDanielPortrait = user ? isDanielFleuren(user) : false;

  return (
    <SheetContent side="right" showCloseButton={false} className="giq-mobile-menu-sheet">
      <SheetTitle className="sr-only">Navigation</SheetTitle>
      <MobileMenuViewportClose />
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
            <span>Search</span>
          </button>
        </MobileMenuSearchForm>

        <div className="giq-mobile-menu-cta">
          {user ? (
            <MobileMenuLink href="/account" className="giq-mobile-account-card">
              <span
                className="giq-mobile-account-avatar"
                data-tier={badge?.label.toLowerCase()}
                aria-hidden={showDanielPortrait ? undefined : true}
              >
                {showDanielPortrait ? (
                  <ActorMediaImage
                    src={DANIEL_PROFILE_PORTRAIT}
                    alt={`${user.firstName || user.name} profile portrait`}
                    width={144}
                    height={144}
                    className="giq-mobile-profile-photo"
                    {...DANIEL_DEMO_PROFILE_ALIGNMENT}
                  />
                ) : (
                  initials
                )}
                <span className="giq-mobile-account-status" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <strong>{user.firstName || user.name}</strong>
                <small>Signed in · {badge?.label ?? "Free"} account</small>
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

        {user && (
          <nav aria-label="Quick actions" className="giq-mobile-menu-quick-actions">
            <MobileMenuLink href="/races" className="giq-mobile-menu-quick-action">
              <Activity aria-hidden="true" />
              <span>Live races</span>
            </MobileMenuLink>
            <MobileMenuLink href="/feed" className="giq-mobile-menu-quick-action">
              <Sparkles aria-hidden="true" />
              <span>Feed</span>
            </MobileMenuLink>
            <MobileMenuLink href="/pulse" className="giq-mobile-menu-quick-action">
              <Bell aria-hidden="true" />
              <span>Chat</span>
            </MobileMenuLink>
          </nav>
        )}

        <nav aria-label="Primary navigation" className="giq-mobile-menu-nav">
          {NAV_SECTIONS.map((section) => (
            <section key={section.title} className="giq-mobile-menu-section">
              <h2>{section.title}</h2>
              <div className="grid gap-2">
                {section.links.map((link) => {
                  const Icon = link.icon;
                  return (
                    <MobileMenuLink
                      key={link.href}
                      href={link.href}
                      className="giq-mobile-menu-link"
                    >
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
  badge,
  canAccessAdmin,
}: {
  user: NonNullable<HeaderUser>;
  badge: { label: string; color: string } | null;
  canAccessAdmin: boolean;
}) {
  const initials = profileInitials(user);
  const showDanielPortrait = isDanielFleuren(user);

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

        <div className="giq-account-sheet-profile">
          <span
            className="giq-mobile-account-avatar"
            data-tier={badge?.label.toLowerCase()}
            aria-hidden={showDanielPortrait ? undefined : true}
          >
            {showDanielPortrait ? (
              <ActorMediaImage
                src={DANIEL_PROFILE_PORTRAIT}
                alt={`${user.firstName || user.name} profile portrait`}
                width={144}
                height={144}
                className="giq-mobile-profile-photo"
                {...DANIEL_DEMO_PROFILE_ALIGNMENT}
              />
            ) : (
              initials
            )}
            <span className="giq-mobile-account-status" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <strong>{user.firstName || user.name}</strong>
            <small>{user.email}</small>
          </span>
          {badge && <em>{badge.label}</em>}
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
    <picture className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
      <source media="(min-width: 768px)" srcSet={desktop} />
      <source srcSet={mobile} />
      <img {...rest} alt="" />
    </picture>
  );
}

export async function SiteHeader({
  user,
  unreadMessages,
}: {
  user: HeaderUser;
  unreadMessages: number;
}) {
  const badge = user ? TIER_BADGE[user.tier] ?? TIER_BADGE.free : null;
  const canAccessAdmin = user ? isModeratorRole(user.role) : false;
  const unreadNotifications = user?.dbUserId
    ? await cached(`notif:unread:${user.dbUserId}`, 30_000, () =>
        countUnreadNotificationsForUser(user.dbUserId!)
      )
    : 0;
  const profileChannel = user?.profileId
    ? profileRealtimeChannel(user.profileId)
    : null;
  const memberInitials = user ? profileInitials(user) : "";
  const showDanielPortrait = user ? isDanielFleuren(user) : false;

  const memberHeader = user ? (
      <>
        {profileChannel && (
          <RealtimeRefresh
            channels={[
              {
                name: profileChannel,
                events: [
                  "message_created",
                  "conversation_updated",
                  "call_invite_created",
                  "friend_updated",
                ],
              },
            ]}
          />
        )}
        <MemberHeaderShell>
          <div className="giq-member-header-frame relative isolate mx-auto min-h-[68px] max-w-[1680px] overflow-hidden rounded-xl border border-white/25 bg-[hsl(var(--surface-3)/0.72)] shadow-[0_22px_55px_hsl(0_0%_0%/0.34)] backdrop-blur-xl md:min-h-[150px] md:rounded-2xl">
            <HeaderBannerImage />
            <div
              aria-hidden="true"
              className="absolute inset-0 z-10 bg-[linear-gradient(90deg,hsl(var(--surface-1)/0.82)_0%,hsl(var(--surface-3)/0.38)_58%,hsl(var(--surface-1)/0.30)_100%)]"
            />
            <div aria-hidden="true" className="race-box-strip absolute inset-x-5 bottom-0 z-30 h-[3px] rounded-none opacity-95" />

            <div className="giq-member-header-inner relative z-20 flex min-h-[68px] flex-col justify-between gap-3 px-3 py-3 md:min-h-[150px] md:px-6 md:py-4">
              <div data-mobile-command-row className="giq-member-header-top-row flex items-center gap-2 md:items-start md:gap-3">
                <Link
                  href="/feed"
                  aria-label="GreyhoundIQ feed"
                  className="group flex min-w-0 shrink items-center transition-transform hover:-translate-y-px"
                >
                  <span className="giq-member-header-logo-desktop relative hidden h-[64px] w-[300px] shrink-0 overflow-hidden drop-shadow-[0_10px_20px_rgba(0,0,0,0.40)] md:block lg:w-[360px]">
                    <Image
                      src={LOGO_MAIN}
                      alt=""
                      fill
                      priority
                      className="object-contain object-left"
                      sizes="(min-width: 1024px) 360px, 300px"
                    />
                  </span>
                  <span className="giq-member-header-logo-mobile relative block h-9 w-[132px] max-w-[42vw] shrink-0 overflow-hidden md:hidden">
                    <Image
                      src={LOGO_MOBILE}
                      alt=""
                      fill
                      priority
                      className="object-contain object-left"
                      sizes="132px"
                    />
                  </span>
                </Link>

                <MemberHeaderSection />

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
                      placeholder="Search racing"
                      aria-label="Search races, tracks, runners"
                    />
                    <input type="hidden" name="sort" value="relevance" />
                  </form>

                  <Sheet>
                    <span className="relative inline-flex md:hidden">
                      <SheetTrigger
                        aria-label={`Open account menu for ${user.name}`}
                        data-onboarding-target="account-navigation"
                        className="giq-mobile-profile-button md:hidden"
                        data-tier={badge?.label.toLowerCase()}
                      >
                        {showDanielPortrait ? (
                          <ActorMediaImage
                            src={DANIEL_PROFILE_PORTRAIT}
                            alt=""
                            width={144}
                            height={144}
                            className="giq-mobile-profile-photo"
                            {...DANIEL_DEMO_PROFILE_ALIGNMENT}
                          />
                        ) : (
                          <span className="giq-mobile-profile-initials" aria-hidden="true">
                            {memberInitials}
                          </span>
                        )}
                        <span className="giq-mobile-profile-status" aria-hidden="true" />
                      </SheetTrigger>
                      <CountBadge
                        count={unreadNotifications}
                        label={`${unreadNotifications} unread notifications`}
                      />
                    </span>
                    <AccountNavigationMenu
                      user={user}
                      badge={badge}
                      canAccessAdmin={canAccessAdmin}
                    />
                  </Sheet>

                  <Sheet>
                    <SheetTrigger
                      aria-label="Open navigation menu"
                      data-onboarding-target="racing-navigation community-navigation public-navigation marketplace-navigation agents-navigation design-lab-navigation"
                      className="giq-mobile-menu-button md:hidden"
                    >
                      <span className="giq-premium-hamburger" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                      <span className="giq-mobile-menu-label" aria-hidden="true">Menu</span>
                    </SheetTrigger>
                    <MobileNavigationMenu
                      user={user}
                      badge={badge}
                      canAccessAdmin={canAccessAdmin}
                    />
                  </Sheet>

                  <Sheet>
                    <span className="relative hidden md:inline-flex">
                      <SheetTrigger
                        aria-label={`Open account menu for ${user.name}`}
                        data-onboarding-target="account-navigation"
                        className="giq-button giq-button-glass min-h-11 px-3 text-[13px] font-semibold"
                      >
                        <span className="relative inline-flex size-7 shrink-0" aria-hidden="true">
                          {showDanielPortrait ? (
                            <span className="absolute inset-0 overflow-hidden rounded-full">
                              <ActorMediaImage
                                src={DANIEL_PROFILE_PORTRAIT}
                                alt=""
                                fill
                                className="object-cover"
                                sizes="56px"
                                {...DANIEL_DEMO_PROFILE_ALIGNMENT}
                              />
                            </span>
                          ) : (
                            <span className="grid size-7 place-items-center rounded-full bg-white/[0.06]">
                              <User className="h-4 w-4" />
                            </span>
                          )}
                          <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-[hsl(var(--surface-1))] bg-emerald-300" />
                        </span>
                        <span className="hidden max-w-[100px] truncate sm:inline">
                          {user.firstName || user.name}
                        </span>
                        {badge && (
                          <span
                            className="hidden rounded-full px-2 py-0.5 text-[10px] font-semibold xl:inline-flex"
                            style={{
                              background: `hsl(${badge.color} / 0.14)`,
                              color: `hsl(${badge.color})`,
                            }}
                          >
                            {badge.label}
                          </span>
                        )}
                        <ChevronDown className="hidden h-3.5 w-3.5 sm:block" aria-hidden="true" />
                      </SheetTrigger>
                      <CountBadge
                        count={unreadNotifications}
                        label={`${unreadNotifications} unread notifications`}
                      />
                    </span>
                    <AccountNavigationMenu
                      user={user}
                      badge={badge}
                      canAccessAdmin={canAccessAdmin}
                    />
                  </Sheet>
                </div>
              </div>

              <nav
                aria-label="Race navigation"
                data-onboarding-target="racing-navigation community-navigation public-navigation marketplace-navigation agents-navigation design-lab-navigation"
                className="giq-header-nav giq-member-race-nav hidden w-full gap-2 md:flex md:w-fit md:self-center md:items-center md:justify-center [scrollbar-width:thin]"
              >
                <HeaderNav links={MEMBER_RACE_NAV_LINKS} variant="desktop" />
              </nav>
            </div>
          </div>
        </MemberHeaderShell>
      </>
    ) : null;

  const cinematicHeader = (
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
                "friend_updated",
              ],
            },
          ]}
        />
      )}
      <div className="giq-site-header-frame relative isolate mx-auto min-h-[150px] max-w-[70rem] overflow-visible rounded-2xl border border-white/25 bg-[hsl(var(--surface-3)/0.68)] shadow-[0_22px_55px_hsl(0_0%_0%/0.34)] backdrop-blur-xl">
        <HeaderBannerImage />
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 rounded-[inherit] bg-[linear-gradient(90deg,hsl(var(--surface-1)/0.70)_0%,hsl(var(--surface-3)/0.25)_55%,transparent_100%)]"
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
                  aria-label="Chat"
                  className="giq-button giq-button-carbon giq-icon-button min-h-10 w-10 px-0"
                >
                  <Bell className="h-4 w-4" />
                </Link>
                <CountBadge
                  count={unreadMessages}
                  label={`${unreadMessages} unread Chat messages`}
                />
              </span>

              {user ? (
                <Sheet>
                  <span className="giq-header-auth-action relative hidden md:inline-flex">
                    <SheetTrigger
                      aria-label={`Open account menu for ${user.name}`}
                      data-onboarding-target="account-navigation"
                      className="giq-button giq-button-glass min-h-10 px-3 text-[13px] font-semibold md:px-4"
                    >
                      <User className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="max-w-[100px] truncate">
                        {user.firstName || user.name}
                      </span>
                      {badge && (
                        <span
                          className="hidden rounded-full px-2 py-0.5 text-[10px] font-semibold lg:inline-flex"
                          style={{
                            background: `hsl(${badge.color} / 0.14)`,
                            color: `hsl(${badge.color})`,
                          }}
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
                  <AccountNavigationMenu
                    user={user}
                    badge={badge}
                    canAccessAdmin={canAccessAdmin}
                  />
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
                  data-onboarding-target="racing-navigation community-navigation public-navigation marketplace-navigation agents-navigation design-lab-navigation"
                  className="giq-mobile-menu-button md:hidden"
                >
                  <span className="giq-premium-hamburger" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="giq-mobile-menu-label" aria-hidden="true">Menu</span>
                </SheetTrigger>
                <MobileNavigationMenu
                  user={user}
                  badge={badge}
                  canAccessAdmin={canAccessAdmin}
                />
              </Sheet>
            </div>
          </div>

          <nav
            data-onboarding-target="racing-navigation community-navigation public-navigation marketplace-navigation agents-navigation design-lab-navigation"
            className="giq-header-nav hidden w-full items-center justify-center gap-2 overflow-visible rounded-xl p-2 md:flex"
          >
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

  if (!user) return cinematicHeader;

  return memberHeader;
}
