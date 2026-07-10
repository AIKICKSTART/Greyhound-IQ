import Link from "next/link";
import Image from "next/image";
import {
  Activity,
  Bookmark,
  Bot,
  Check,
  Crown,
  Dna,
  Home,
  LayoutGrid,
  Map,
  MessageSquare,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { setActiveIdentityAction } from "@/app/actions";
import { CUSTOM_PAGE_TYPE_LABELS } from "@/lib/custom-page-service";
import type { CustomPageType } from "@/lib/custom-page-validation";
import {
  PERSONAL_IDENTITY,
  type ActiveIdentity,
  type OwnedPageIdentity,
} from "@/lib/identity";

type Shortcut = { href: string; label: string; icon: LucideIcon };

type NavigationItem = Shortcut & { current?: boolean };

const NAVIGATION_SECTIONS: Array<{
  title: string;
  items: NavigationItem[];
}> = [
  {
    title: "Community",
    items: [
      // HubLeftSidebar currently renders only on /feed, so no client-side
      // pathname subscription is needed for the active state.
      { href: "/feed", label: "Feed", icon: Home, current: true },
      { href: "/pulse/friends", label: "Friends", icon: Users },
      { href: "/account/pages", label: "Pages", icon: LayoutGrid },
      { href: "/pulse", label: "Pulse", icon: MessageSquare },
      { href: "/account/saved-listings", label: "Saved", icon: Bookmark },
      { href: "/account", label: "Settings", icon: Settings },
    ],
  },
  {
    title: "Racing & tools",
    items: [
      { href: "/races", label: "Races", icon: Activity },
      { href: "/results", label: "Results", icon: Trophy },
      { href: "/dogs", label: "Dogs", icon: Search },
      { href: "/breeding", label: "Breeding", icon: Dna },
      { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
      { href: "/groups", label: "Groups", icon: Users },
      { href: "/tracks", label: "Tracks", icon: Map },
      { href: "/agents", label: "Agents", icon: Bot },
    ],
  },
];

const NAV_LINK_CLASS =
  "group relative flex min-h-11 items-center gap-3 overflow-hidden rounded-lg border px-3 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--surface-1))]";
const PAGE_ACTION_CLASS =
  "giq-outline-action mt-3 min-h-11 w-full px-3 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]";

export function HubLeftSidebar({
  identity,
  pages,
  personalName,
  personalAvatarUrl,
  isPro,
}: {
  identity: ActiveIdentity;
  pages: OwnedPageIdentity[];
  personalName: string;
  personalAvatarUrl: string | null;
  isPro: boolean;
}) {
  const activePageId = identity.kind === "page" ? identity.page.id : null;

  return (
    <div className="space-y-4">
      <section className="giq-panel p-4" aria-label="Switch identity">
        <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.09em] text-[hsl(var(--secondary-light)/0.82)]">
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
          Act as
        </h2>
        <div className="space-y-1.5">
          <IdentityButton
            value={PERSONAL_IDENTITY}
            label={personalName}
            sublabel="Personal profile"
            avatarUrl={personalAvatarUrl}
            active={identity.kind === "personal"}
          />
          {pages.map((page) => (
            <IdentityButton
              key={page.id}
              value={page.id}
              label={page.title}
              sublabel={`${
                CUSTOM_PAGE_TYPE_LABELS[page.pageType as CustomPageType] ??
                page.pageType
              } page${page.published ? "" : " - draft"}`}
              avatarUrl={page.media.avatarUrl}
              accentColor={page.accentColor}
              active={activePageId === page.id}
            />
          ))}
        </div>
        {isPro ? (
          <Link
            href="/account/pages"
            className={PAGE_ACTION_CLASS}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Create or manage pages
          </Link>
        ) : (
          <Link
            href="/pricing"
            className={PAGE_ACTION_CLASS}
          >
            <Crown
              className="h-3.5 w-3.5 text-[hsl(var(--secondary-light))]"
              aria-hidden="true"
            />
            Pro unlocks pages
          </Link>
        )}
      </section>

      <nav className="giq-panel p-4" aria-label="App navigation">
        {NAVIGATION_SECTIONS.map((section, sectionIndex) => (
          <div
            key={section.title}
            className={
              sectionIndex === 0
                ? undefined
                : "mt-4 border-t border-white/[0.06] pt-4"
            }
          >
            <h2 className="mb-2 px-2 text-[11px] font-bold uppercase tracking-[0.09em] text-[hsl(var(--subtle-foreground))]">
              {section.title}
            </h2>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={item.current ? "page" : undefined}
                      className={`${NAV_LINK_CLASS} ${
                        item.current
                          ? "border-[hsl(var(--primary-light)/0.46)] bg-[linear-gradient(90deg,hsl(var(--primary)/0.3),hsl(var(--primary)/0.08))] text-[hsl(var(--metal-silver-bright))] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.12),0_10px_24px_hsl(var(--primary)/0.14)]"
                          : "border-transparent text-[hsl(var(--muted-foreground))] hover:border-white/[0.09] hover:bg-white/[0.045] hover:text-[hsl(var(--foreground))]"
                      }`}
                    >
                      {item.current ? (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[hsl(var(--primary-bright))] shadow-[0_0_14px_hsl(var(--primary-bright)/0.88)]"
                        />
                      ) : null}
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          item.current
                            ? "text-[hsl(var(--primary-light))]"
                            : "text-[hsl(var(--primary-bright)/0.78)] transition-colors group-hover:text-[hsl(var(--primary-light))]"
                        }`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}

function IdentityButton({
  value,
  label,
  sublabel,
  avatarUrl,
  accentColor,
  active,
}: {
  value: string;
  label: string;
  sublabel: string;
  avatarUrl: string | null;
  accentColor?: string | null;
  active: boolean;
}) {
  return (
    <form action={setActiveIdentityAction}>
      <input type="hidden" name="identity" value={value} />
      <button
        type="submit"
        aria-pressed={active}
        className={`group relative flex min-h-12 w-full items-center gap-3 overflow-hidden rounded-xl border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--surface-1))] ${
          active
            ? "border-[hsl(var(--primary-light)/0.48)] bg-[linear-gradient(90deg,hsl(var(--primary)/0.3),hsl(var(--primary)/0.08))] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.12),0_10px_24px_hsl(var(--primary)/0.14)]"
            : "border-transparent hover:border-white/[0.09] hover:bg-white/[0.04]"
        }`}
      >
        {active ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[hsl(var(--primary-bright))] shadow-[0_0_14px_hsl(var(--primary-bright)/0.88)]"
          />
        ) : null}
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-white/[0.12] bg-[hsl(var(--surface-2))] text-[12px] font-bold text-white/70 shadow-[0_6px_16px_rgba(0,0,0,0.24)]"
          style={accentColor ? { borderColor: accentColor } : undefined}
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={36}
              height={36}
              unoptimized={avatarUrl.startsWith("/api/media/")}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            label.slice(0, 1).toUpperCase()
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-[hsl(var(--foreground))]">
            {label}
          </span>
          <span className="block truncate text-[11px] text-[hsl(var(--subtle-foreground))]">
            {sublabel}
          </span>
        </span>
        {active ? (
          <span
            aria-hidden="true"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[hsl(var(--primary-light)/0.42)] bg-[hsl(var(--primary)/0.18)] text-[hsl(var(--primary-light))]"
          >
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </button>
    </form>
  );
}
