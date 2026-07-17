"use client";

import Image from "next/image";
import Link from "next/link";
import { Activity, Bell, Search, Sparkles, User, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { DockSkinPreview } from "@/components/dock-skin-catalogue-preview";
import type {
  DockActionKey,
  DockSkinKey,
} from "@/components/dock-skin-catalogue";
import { HeaderNav } from "@/components/header-nav";
import {
  buildPrototypeDemoHref,
  prototypeDockDestination,
} from "@/components/prototype-dock-navigation";
import {
  MobileMenuLink,
  MobileMenuSearchForm,
} from "@/components/mobile-menu-close-link";
import {
  MemberHeaderSection,
  MemberHeaderShell,
} from "@/components/member-header-shell";
import { MobileBottomDock } from "@/components/mobile-bottom-dock";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const RACE_NAV_LINKS = [
  { href: "/races", label: "Races" },
  { href: "/results", label: "Results" },
  { href: "/tracks", label: "Tracks" },
  { href: "/dogs", label: "Dogs" },
  { href: "/breeding", label: "Breeding" },
  { href: "/statistics", label: "Statistics" },
];

const PROTOTYPE_MENU_SECTIONS = [
  { title: "Racing", links: RACE_NAV_LINKS },
  {
    title: "Community & tools",
    links: [
      { href: "/feed", label: "Feed" },
      { href: "/discover", label: "Discover" },
      { href: "/groups", label: "Groups" },
      { href: "/marketplace", label: "Marketplace" },
      { href: "/agents", label: "Agents" },
      { href: "/pulse", label: "Chat" },
    ],
  },
  {
    title: "My GreyhoundIQ",
    links: [
      { href: "/account", label: "Account" },
      { href: "/account/profile", label: "Profile Studio" },
      { href: "/account/pages", label: "My pages" },
      { href: "/account/billing", label: "Billing" },
      { href: "/account/support", label: "Support" },
      { href: "/admin", label: "Admin Control Centre" },
      { href: "/design-lab/demo-experience", label: "All demo screens" },
    ],
  },
] as const;

const subscribeToClient = () => () => {};
const DANIEL_PROFILE_PORTRAIT = "/images/feed/daniel-fleuren-founder-portrait.png";
const PROTOTYPE_FEED_VARIANTS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const PROTOTYPE_DOCK_VARIANTS = ["D1", "D2", "D3", "D4", "D5", "D6"] as const;

export function PrototypeMemberHeader({ firstName }: { firstName: string }) {
  const currentSearch = useSyncExternalStore(
    subscribeToClient,
    () => window.location.search,
    () => ""
  );
  const feedHref = buildPrototypeDemoHref(currentSearch);

  return (
    <MemberHeaderShell>
      <div
        data-review-component="HEADER"
        className="giq-member-header-frame relative isolate mx-auto min-h-[68px] max-w-[1680px] overflow-hidden rounded-xl border border-white/25 bg-[hsl(var(--surface-3)/0.72)] shadow-[0_22px_55px_hsl(0_0%_0%/0.34)] backdrop-blur-xl md:min-h-[150px] md:rounded-2xl"
      >
        <Image
          src="/images/wentworth-track-banner-landscape.webp"
          alt=""
          fill
          priority
          className="-z-20 object-cover object-center opacity-80"
          sizes="100vw"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,hsl(var(--surface-1)/0.86)_0%,hsl(var(--surface-3)/0.42)_58%,hsl(var(--surface-1)/0.34)_100%)]"
        />
        <div
          aria-hidden="true"
          className="race-box-strip absolute inset-x-5 bottom-0 z-30 h-[3px] rounded-none opacity-95"
        />

        <div className="giq-member-header-inner relative z-20 flex min-h-[68px] flex-col justify-between gap-3 px-3 py-3 md:min-h-[150px] md:px-6 md:py-4">
          <div data-mobile-command-row className="giq-member-header-top-row flex items-center gap-2 md:items-start md:gap-3">
            <Link
              href={feedHref}
              aria-label="GreyhoundIQ feed"
              className="group flex min-w-0 shrink items-center transition-transform hover:-translate-y-px"
            >
              <span className="giq-member-header-logo-desktop relative hidden h-[64px] w-[300px] shrink-0 overflow-hidden drop-shadow-[0_10px_20px_rgba(0,0,0,0.40)] md:block lg:w-[360px]">
                <Image
                  src="/images/logo-main-purple-gold.webp"
                  alt=""
                  fill
                  priority
                  className="object-contain object-left"
                  sizes="(min-width: 1024px) 360px, 300px"
                />
              </span>
              <span className="giq-member-header-logo-mobile relative block h-9 w-[132px] max-w-[42vw] shrink-0 overflow-hidden md:hidden">
                <Image
                  src="/images/logo-wordmark-purple-gold.webp"
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
              <Sheet>
                <SheetTrigger
                  aria-label={`Open account menu for ${firstName} Fleuren`}
                  className="giq-mobile-profile-button md:hidden"
                  data-tier="pro"
                >
                  <Image
                    src={DANIEL_PROFILE_PORTRAIT}
                    alt=""
                    width={72}
                    height={72}
                    className="giq-mobile-profile-photo"
                  />
                  <span className="giq-mobile-profile-status" aria-hidden="true" />
                </SheetTrigger>
                <PrototypeAccountNavigationMenu firstName={firstName} />
              </Sheet>

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
                  <span className="giq-mobile-menu-label" aria-hidden="true">Menu</span>
                </SheetTrigger>
                <PrototypeMobileNavigationMenu
                  currentSearch={currentSearch}
                  firstName={firstName}
                  feedHref={feedHref}
                />
              </Sheet>
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
              <Link
                href="/account/notifications"
                aria-label="Notifications"
                className="giq-button giq-button-carbon giq-icon-button hidden min-h-11 w-11 px-0 md:inline-flex"
              >
                <Bell className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/account"
                aria-label={`Open account for ${firstName}`}
                className="giq-button giq-button-glass hidden min-h-11 px-3 text-[13px] font-semibold md:inline-flex"
              >
                <span className="relative inline-flex" aria-hidden="true">
                  <User className="size-4" />
                  <span className="absolute -bottom-1 -right-1 size-2 rounded-full border border-[hsl(var(--surface-1))] bg-emerald-300" />
                </span>
                <span className="hidden max-w-[100px] truncate sm:inline">
                  {firstName}
                </span>
              </Link>
            </div>
          </div>

          <nav
            data-review-component="RACE-NAV"
            aria-label="Race navigation"
            className="giq-header-nav giq-member-race-nav hidden w-full gap-2 md:flex md:w-fit md:self-center md:items-center md:justify-center [scrollbar-width:thin]"
          >
            <HeaderNav links={RACE_NAV_LINKS} variant="desktop" />
          </nav>
        </div>
      </div>
    </MemberHeaderShell>
  );
}

function PrototypeMobileNavigationMenu({
  currentSearch = "",
  firstName,
  feedHref,
}: {
  currentSearch?: string;
  firstName: string;
  feedHref: string;
}) {
  const demoParams = new URLSearchParams(currentSearch);
  const currentVariant = demoParams.get("variant") ?? "A1";
  const currentDock = demoParams.get("dock") ?? "D1";

  return (
    <SheetContent side="right" showCloseButton={false} className="giq-mobile-menu-sheet">
      <SheetTitle className="sr-only">Demo navigation</SheetTitle>
      <div className="giq-mobile-menu-scroll">
        <div className="giq-mobile-menu-head">
          <div className="giq-mobile-menu-brand" aria-hidden="true">
            <span>
              GREYHOUNDS <strong>IQ</strong>
            </span>
            <small>Complete demo experience</small>
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

        <MobileMenuLink href="/account" className="giq-mobile-account-card">
          <span className="giq-mobile-account-avatar" data-tier="pro">
            <Image
              src={DANIEL_PROFILE_PORTRAIT}
              alt="Daniel Fleuren profile portrait"
              width={72}
              height={72}
              className="giq-mobile-profile-photo"
            />
            <span className="giq-mobile-account-status" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <strong>{firstName}</strong>
            <small>Signed in · Pro demo account</small>
          </span>
          <em>Pro</em>
        </MobileMenuLink>

        <nav aria-label="Quick actions" className="giq-mobile-menu-quick-actions">
          <MobileMenuLink href="/races" className="giq-mobile-menu-quick-action">
            <Activity aria-hidden="true" />
            <span>Live races</span>
          </MobileMenuLink>
          <MobileMenuLink href={feedHref} className="giq-mobile-menu-quick-action">
            <Sparkles aria-hidden="true" />
            <span>Feed</span>
          </MobileMenuLink>
          <MobileMenuLink href="/pulse" className="giq-mobile-menu-quick-action">
            <Bell aria-hidden="true" />
            <span>Chat</span>
          </MobileMenuLink>
        </nav>

        {demoParams.get("demo") === "1" ? (
          <section className="giq-mobile-menu-section" aria-labelledby="prototype-version-menu-heading">
            <h2 id="prototype-version-menu-heading">Demo versions</h2>
            <p className="mb-3 text-[11px] leading-5 text-[hsl(var(--subtle-foreground))]">
              Switch the complete Feed system or dock skin without leaving the live demo.
            </p>
            <div className="grid grid-cols-3 gap-2" aria-label="Feed system versions">
              {PROTOTYPE_FEED_VARIANTS.map((variant) => (
                <MobileMenuLink
                  key={variant}
                  href={buildPrototypeDemoHref(currentSearch, { variant })}
                  aria-current={currentVariant === variant ? "page" : undefined}
                  className={`giq-button min-h-11 justify-center px-2 text-[12px] font-bold ${
                    currentVariant === variant ? "giq-button-primary" : "giq-button-carbon"
                  }`}
                >
                  Feed {variant}
                </MobileMenuLink>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Dock style versions">
              {PROTOTYPE_DOCK_VARIANTS.map((dock) => (
                <MobileMenuLink
                  key={dock}
                  href={buildPrototypeDemoHref(currentSearch, { dock })}
                  aria-current={currentDock === dock ? "page" : undefined}
                  className={`giq-button min-h-11 justify-center px-2 text-[12px] font-bold ${
                    currentDock === dock ? "giq-button-primary" : "giq-button-carbon"
                  }`}
                >
                  Dock {dock}
                </MobileMenuLink>
              ))}
            </div>
          </section>
        ) : null}

        <nav aria-label="Demo navigation" className="giq-mobile-menu-nav">
          {PROTOTYPE_MENU_SECTIONS.map((section) => (
            <section key={section.title} className="giq-mobile-menu-section">
              <h2>{section.title}</h2>
              <div className="grid gap-2">
                {section.links.map((link) => (
                  <MobileMenuLink
                    key={link.href}
                    href={link.href === "/feed" ? feedHref : link.href}
                    className="giq-mobile-menu-link"
                  >
                    <span className="giq-mobile-menu-link-icon" aria-hidden="true">
                      <span className="text-[12px] font-black">›</span>
                    </span>
                    <span className="min-w-0">
                      <strong>{link.label}</strong>
                      <small>Open {link.label.toLowerCase()}</small>
                    </span>
                  </MobileMenuLink>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </div>
    </SheetContent>
  );
}

function PrototypeAccountNavigationMenu({ firstName }: { firstName: string }) {
  const accountLinks = PROTOTYPE_MENU_SECTIONS[2].links;

  return (
    <SheetContent side="right" showCloseButton={false} className="giq-mobile-menu-sheet">
      <SheetTitle className="sr-only">Demo account menu</SheetTitle>
      <div className="giq-mobile-menu-scroll">
        <div className="giq-mobile-menu-head">
          <div className="giq-mobile-menu-brand">
            <span>{firstName} Fleuren</span>
            <small>Signed in · Pro demo account</small>
          </div>
          <SheetClose aria-label="Close account menu" className="giq-mobile-menu-close">
            <X className="h-5 w-5" aria-hidden="true" />
          </SheetClose>
        </div>

        <div className="giq-account-sheet-profile">
          <span className="giq-mobile-account-avatar" data-tier="pro">
            <Image
              src={DANIEL_PROFILE_PORTRAIT}
              alt="Daniel Fleuren profile portrait"
              width={72}
              height={72}
              className="giq-mobile-profile-photo"
            />
            <span className="giq-mobile-account-status" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <strong>{firstName} Fleuren</strong>
            <small>Daniel&apos;s signed-in demo</small>
          </span>
          <em>Pro</em>
        </div>

        <section className="giq-mobile-menu-section">
          <h2>Account</h2>
          <div className="grid gap-2">
            {accountLinks.map((link) => (
              <MobileMenuLink key={link.href} href={link.href} className="giq-mobile-menu-link">
                <span className="giq-mobile-menu-link-icon" aria-hidden="true">
                  <User className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <strong>{link.label}</strong>
                  <small>Open {link.label.toLowerCase()}</small>
                </span>
              </MobileMenuLink>
            ))}
          </div>
        </section>

      </div>
    </SheetContent>
  );
}

export function PrototypeMemberDock({ skinKey }: { skinKey?: DockSkinKey }) {
  const mounted = useSyncExternalStore(
    subscribeToClient,
    () => true,
    () => false
  );
  const currentSearch = useSyncExternalStore(
    subscribeToClient,
    () => window.location.search,
    () => ""
  );
  const [activeAction, setActiveAction] = useState<DockActionKey>("feed");
  const [menuOpen, setMenuOpen] = useState(false);

  function handleAction(action: DockActionKey) {
    setActiveAction(action);

    if (action === "menu") {
      setMenuOpen(true);
      return;
    }

    if (action === "post") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#feed-composer`);
      window.dispatchEvent(new Event("hashchange"));
      window.dispatchEvent(new Event("giq:open-feed-composer"));
      const composer = document.getElementById("demo-feed-composer");
      composer?.scrollIntoView({ behavior: "smooth", block: "center" });
      composer?.focus({ preventScroll: true });
      return;
    }

    const destination = prototypeDockDestination(action, currentSearch);
    if (!destination) return;
    if (action === "feed" && window.location.pathname === "/feed") {
      window.history.replaceState(null, "", destination);
      window.scrollTo({ behavior: "smooth", top: 0 });
      return;
    }
    window.location.assign(destination);
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="giq-prototype-member-dock"
      data-review-component="DOCK"
      data-dock-skin={skinKey}
    >
      {skinKey ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] mx-auto h-[106px] w-[min(600px,calc(100%-0.5rem))] pb-[max(4px,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto relative h-full w-full">
            <DockSkinPreview
              activeAction={activeAction}
              onActionChange={handleAction}
              skinKey={skinKey}
            />
          </div>
        </div>
      ) : (
        <MobileBottomDock unreadMessages={2} />
      )}
      {skinKey ? (
        <Sheet
          open={menuOpen}
          onOpenChange={(nextOpen) => {
            setMenuOpen(nextOpen);
            if (!nextOpen && activeAction === "menu") setActiveAction("feed");
          }}
        >
          <PrototypeMobileNavigationMenu
            currentSearch={currentSearch}
            firstName="Daniel"
            feedHref={buildPrototypeDemoHref(currentSearch)}
          />
        </Sheet>
      ) : null}
    </div>,
    document.body
  );
}
