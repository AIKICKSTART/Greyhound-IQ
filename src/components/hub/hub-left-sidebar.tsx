import Link from "next/link";
import Image from "next/image";
import {
  Activity,
  Bookmark,
  Bot,
  Crown,
  Dna,
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

const SHORTCUTS: Shortcut[] = [
  { href: "/races", label: "Races", icon: Activity },
  { href: "/results", label: "Results", icon: Trophy },
  { href: "/dogs", label: "Dogs", icon: Search },
  { href: "/breeding", label: "Breeding", icon: Dna },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/tracks", label: "Tracks", icon: Map },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/account/saved-listings", label: "Saved", icon: Bookmark },
];

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
        <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
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
            className="giq-outline-action mt-3 min-h-9 w-full px-3 text-[12px]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Create or manage pages
          </Link>
        ) : (
          <Link
            href="/pricing"
            className="giq-outline-action mt-3 min-h-9 w-full px-3 text-[12px]"
          >
            <Crown
              className="h-3.5 w-3.5 text-[hsl(var(--secondary-light))]"
              aria-hidden="true"
            />
            Pro unlocks pages
          </Link>
        )}
      </section>

      <nav className="giq-panel p-4" aria-label="App shortcuts">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
          Shortcuts
        </h2>
        <ul className="space-y-0.5">
          {SHORTCUTS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-[13px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-white/[0.04] hover:text-[hsl(var(--foreground))]"
                >
                  <Icon
                    className="h-4 w-4 text-[hsl(var(--primary-bright))]"
                    aria-hidden="true"
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <section className="giq-panel p-4" aria-label="Settings and management">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
          Manage
        </h2>
        <ul className="space-y-0.5">
          <li>
            <Link
              href="/pulse"
              className="flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-[13px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-white/[0.04] hover:text-[hsl(var(--foreground))]"
            >
              <MessageSquare
                className="h-4 w-4 text-[hsl(var(--primary-bright))]"
                aria-hidden="true"
              />
              Pulse inbox
            </Link>
          </li>
          <li>
            <Link
              href="/account"
              className="flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-[13px] font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-white/[0.04] hover:text-[hsl(var(--foreground))]"
            >
              <Settings
                className="h-4 w-4 text-[hsl(var(--primary-bright))]"
                aria-hidden="true"
              />
              Account settings
            </Link>
          </li>
        </ul>
      </section>
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
        className={`flex min-h-12 w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors ${
          active
            ? "border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.12)]"
            : "border-transparent hover:bg-white/[0.04]"
        }`}
      >
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/[0.1] bg-[hsl(var(--surface-2))] text-[12px] font-bold text-white/70"
          style={accentColor ? { borderColor: accentColor } : undefined}
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={32}
              height={32}
              className="h-full w-full object-cover"
            />
          ) : (
            label.slice(0, 1).toUpperCase()
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-[hsl(var(--foreground))]">
            {label}
          </span>
          <span className="block truncate text-[11px] text-[hsl(var(--subtle-foreground))]">
            {sublabel}
          </span>
        </span>
      </button>
    </form>
  );
}
