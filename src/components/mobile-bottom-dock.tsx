"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Bookmark,
  Bot,
  Dna,
  Dog,
  Flag,
  Home,
  Info,
  LayoutGrid,
  Mail,
  Map,
  Menu,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Stethoscope,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { MobileMenuLink } from "@/components/mobile-menu-close-link";
import { ADMIN_NAV } from "@/app/admin/admin-nav-data";
import { TOGGLE_CHAT_DOCK_EVENT } from "@/components/hub/hub-conversation-dock";

type DockLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  tone?: "pro" | "create";
};

const DOCK_LINKS: DockLink[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/feed", label: "Feed", icon: Activity },
  { href: "/feed#feed-composer", label: "Post", icon: Plus, tone: "create" },
  { href: "/pulse", label: "Chat", icon: MessageCircle },
];

type MenuEntry = { href: string; label: string; icon: LucideIcon };

const MENU_SECTIONS: Array<{ title: string; entries: MenuEntry[] }> = [
  {
    title: "Racing",
    entries: [
      { href: "/races", label: "Races", icon: Flag },
      { href: "/results", label: "Results", icon: Trophy },
      { href: "/tracks", label: "Tracks", icon: Map },
      { href: "/dogs", label: "Dogs", icon: Dog },
      { href: "/breeding", label: "Breeding", icon: Dna },
      { href: "/vets", label: "Vets", icon: Stethoscope },
    ],
  },
  {
    title: "Community & tools",
    entries: [
      { href: "/discover", label: "Discover", icon: Search },
      { href: "/groups", label: "Groups", icon: Users },
      { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
      { href: "/agents", label: "Agents", icon: Bot },
    ],
  },
  {
    title: "My GreyhoundIQ",
    entries: [
      { href: "/account/profile", label: "Profile Studio", icon: User },
      { href: "/account/pages", label: "My pages", icon: LayoutGrid },
      { href: "/account/saved-listings", label: "Saved", icon: Bookmark },
      { href: "/account", label: "Account", icon: User },
    ],
  },
  {
    title: "Company",
    entries: [
      { href: "/about", label: "About", icon: Info },
      { href: "/contact", label: "Contact", icon: Mail },
    ],
  },
];

const MENU_ENTRIES = MENU_SECTIONS.flatMap((section) => section.entries);

export function isDockLinkActive(
  pathname: string,
  hash: string,
  item: Pick<DockLink, "href" | "tone">
) {
  if (item.tone === "create") {
    return pathname === "/feed" && hash === "#feed-composer";
  }
  if (
    item.href === "/feed" &&
    pathname === "/feed" &&
    hash === "#feed-composer"
  ) {
    return false;
  }
  return (
    pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(`${item.href}/`))
  );
}

export function MobileBottomDock({
  unreadMessages = 0,
  canAccessAdmin = false,
}: {
  unreadMessages?: number;
  canAccessAdmin?: boolean;
}) {
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, [pathname]);

  const menuActive =
    MENU_ENTRIES.some(
      (entry) => entry.href !== "/" && pathname.startsWith(entry.href)
    ) || (canAccessAdmin && pathname.startsWith("/admin"));

  return (
    <nav
      aria-label="Quick actions"
      className="giq-mobile-dock is-visible"
      data-onboarding-priority="high"
      data-onboarding-target="account-navigation agents-navigation community-navigation marketplace-navigation public-navigation racing-navigation"
    >
      {DOCK_LINKS.map((item) => {
        const Icon = item.icon;
        const active = isDockLinkActive(pathname, hash, item);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={(event) => {
              if (item.tone === "create") {
                setHash("#feed-composer");
                window.dispatchEvent(new Event("giq:open-feed-composer"));
              } else if (item.href === "/feed") {
                setHash("");
              }
              if (item.href === "/pulse") {
                // Pop the floating Messenger dock on every width instead of
                // routing to the full inbox; the dock header links to /pulse.
                event.preventDefault();
                window.dispatchEvent(new Event(TOGGLE_CHAT_DOCK_EVENT));
              }
            }}
            aria-current={active ? "page" : undefined}
            data-tone={item.tone}
            className={`giq-mobile-dock-link ${active ? "is-active" : ""}`}
          >
            <span className="relative inline-flex" aria-hidden="true">
              <Icon />
              {item.href === "/pulse" && unreadMessages > 0 && (
                <span className="absolute -right-2 -top-1.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-[hsl(var(--primary-bright))] px-1 text-[9px] font-bold leading-[16px] tabular-nums text-[hsl(var(--primary-foreground))]">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
            </span>
            <span>
              {item.label}
              {item.href === "/pulse" && unreadMessages > 0 && (
                <span className="sr-only">
                  , {unreadMessages} unread message{unreadMessages === 1 ? "" : "s"}
                </span>
              )}
            </span>
          </Link>
        );
      })}

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger
          aria-label="More navigation"
          aria-current={menuActive ? "page" : undefined}
          data-popup-open={menuOpen ? "" : undefined}
          className={`giq-mobile-dock-link ${menuActive ? "is-active" : ""}`}
        >
          <Menu aria-hidden="true" />
          <span>Menu</span>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className={`giq-mobile-dock-sheet rounded-t-2xl border-t border-white/[0.12] bg-[hsl(var(--surface-1)/0.97)] pb-[max(16px,env(safe-area-inset-bottom))] backdrop-blur-xl ${canAccessAdmin ? "is-admin" : ""}`}
        >
          <SheetTitle className="sr-only">More navigation</SheetTitle>
          {/* Hidden close target so MobileMenuLink's close-on-tap finds one. */}
          <SheetClose className="sr-only" tabIndex={-1}>
            Close menu
          </SheetClose>
          <div
            aria-hidden="true"
            className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-white/20"
          />
          <div className="giq-mobile-dock-menu-grid space-y-4 p-4">
            {MENU_SECTIONS.map((section) => (
              <section key={section.title}>
                <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--subtle-foreground))]">
                  {section.title}
                </h2>
                <div className="giq-mobile-dock-menu-section-grid grid grid-cols-3 gap-2">
                  {section.entries.map((entry) => (
                    <DockMenuEntry key={entry.href} entry={entry} />
                  ))}
                </div>
              </section>
            ))}
            {canAccessAdmin && (
              <section className="rounded-xl border border-[hsl(var(--secondary)/0.24)] bg-[hsl(var(--secondary)/0.04)] p-3">
                <h2 className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--secondary-light))]">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Administration
                </h2>
                {ADMIN_NAV.map((group) => (
                  <div key={group.title} className="mb-3 last:mb-0">
                    <h3 className="mb-1.5 text-[10px] font-semibold text-[hsl(var(--subtle-foreground))]">
                      {group.title}
                    </h3>
                    <div className="giq-mobile-dock-menu-section-grid grid grid-cols-3 gap-2">
                      {group.items.map((entry) => (
                        <DockMenuEntry
                          key={entry.href}
                          entry={{ ...entry, icon: ShieldCheck }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}

function DockMenuEntry({ entry }: { entry: MenuEntry }) {
  const Icon = entry.icon;
  return (
    <MobileMenuLink
      href={entry.href}
      className="flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-1 text-[11px] font-semibold text-[hsl(var(--muted-foreground))] transition-colors active:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-light))]"
      activeClassName="border-[hsl(var(--primary)/0.5)] bg-[hsl(var(--primary)/0.14)] text-[hsl(var(--foreground))]"
    >
      <Icon
        className="h-5 w-5 text-[hsl(var(--primary-bright))]"
        aria-hidden="true"
      />
      <span className="text-center leading-tight">{entry.label}</span>
    </MobileMenuLink>
  );
}
