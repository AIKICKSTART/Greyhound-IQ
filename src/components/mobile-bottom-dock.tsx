"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Bookmark,
  Bot,
  Dna,
  Dog,
  Flag,
  Home,
  LayoutGrid,
  Map,
  Menu,
  Plus,
  Search,
  ShoppingBag,
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

type DockLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  tone?: "pro" | "create";
};

const DOCK_LINKS: DockLink[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/feed", label: "Feed", icon: Activity },
  { href: "/feed#feed-composer", label: "Create", icon: Plus, tone: "create" },
  { href: "/pulse", label: "Chat", icon: Bell },
];

type MenuEntry = { href: string; label: string; icon: LucideIcon };

const MENU_ENTRIES: MenuEntry[] = [
  { href: "/races", label: "Races", icon: Flag },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/discover", label: "Discover", icon: Search },
  { href: "/dogs", label: "Dogs", icon: Dog },
  { href: "/results", label: "Results", icon: Trophy },
  { href: "/tracks", label: "Tracks", icon: Map },
  { href: "/breeding", label: "Breeding", icon: Dna },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/account/pages", label: "My pages", icon: LayoutGrid },
  { href: "/account/saved-listings", label: "Saved", icon: Bookmark },
  { href: "/account", label: "Account", icon: User },
];

export function MobileBottomDock({
  unreadMessages = 0,
}: {
  unreadMessages?: number;
}) {
  const pathname = usePathname();
  const menuActive = MENU_ENTRIES.some(
    (entry) => entry.href !== "/" && pathname.startsWith(entry.href)
  );

  return (
    <nav aria-label="Quick actions" className="giq-mobile-dock is-visible">
      {DOCK_LINKS.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(`${item.href}/`));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={
              item.tone === "create"
                ? () =>
                    window.dispatchEvent(
                      new Event("giq:open-feed-composer"),
                    )
                : undefined
            }
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

      <Sheet>
        <SheetTrigger
          aria-label="More navigation"
          className={`giq-mobile-dock-link ${menuActive ? "is-active" : ""}`}
        >
          <Menu aria-hidden="true" />
          <span>Menu</span>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="giq-mobile-dock-sheet rounded-t-2xl border-t border-white/[0.12] bg-[hsl(var(--surface-1)/0.97)] pb-[max(16px,env(safe-area-inset-bottom))] backdrop-blur-xl"
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
          <div className="giq-mobile-dock-menu-grid grid grid-cols-3 gap-2 p-4">
            {MENU_ENTRIES.map((entry) => {
              const Icon = entry.icon;
              return (
                <MobileMenuLink
                  key={entry.href}
                  href={entry.href}
                  className="flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] text-[11px] font-semibold text-[hsl(var(--muted-foreground))] transition-colors active:bg-white/[0.08]"
                  activeClassName="border-[hsl(var(--primary)/0.5)] bg-[hsl(var(--primary)/0.14)] text-[hsl(var(--foreground))]"
                >
                  <Icon
                    className="h-5 w-5 text-[hsl(var(--primary-bright))]"
                    aria-hidden="true"
                  />
                  <span className="text-center leading-tight">{entry.label}</span>
                </MobileMenuLink>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
