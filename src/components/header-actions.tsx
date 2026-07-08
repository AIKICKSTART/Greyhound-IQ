"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bell,
  Bookmark,
  ChevronDown,
  Crown,
  Download,
  LifeBuoy,
  LogIn,
  LogOut,
  Search,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  MobileMenuAnchor,
  MobileMenuLink,
  MobileMenuSearchForm,
} from "@/components/mobile-menu-close-link";
import { NAV_SECTIONS, TIER_BADGE, type HeaderState } from "@/components/header-links";

const ACCOUNT_MENU_ITEM_CLASS =
  "giq-button giq-button-carbon min-h-10 w-full justify-start px-3 text-[13px] font-semibold";

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
  const { signOut } = useAuth();
  return (
    <button
      type="button"
      onClick={() => signOut()}
      className="giq-button giq-button-glass min-h-10 w-full justify-start px-3 text-[13px] font-semibold mt-2"
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
      Sign out
    </button>
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

type SignedIn = Extract<HeaderState, { signedIn: true }>;

function MobileNavigationMenu({ state }: { state: HeaderState | null }) {
  const user = state?.signedIn ? state : null;
  const badge = user ? TIER_BADGE[user.tier] ?? TIER_BADGE.free : null;
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
              <AccountMenuItems canAccessAdmin={user.canAccessAdmin} closeOnSelect />
              <SignOutMenuButton />
            </div>
          </section>
        )}
      </div>
    </SheetContent>
  );
}

function AccountNavigationMenu({ user }: { user: SignedIn }) {
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
            <AccountMenuItems canAccessAdmin={user.canAccessAdmin} closeOnSelect />
            <SignOutMenuButton />
          </div>
        </section>
      </div>
    </SheetContent>
  );
}

export function HeaderActions() {
  const [state, setState] = useState<HeaderState | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/header", { cache: "no-store" });
      if (!res.ok) {
        setState({ signedIn: false });
        return;
      }
      setState((await res.json()) as HeaderState);
    } catch {
      setState({ signedIn: false });
    }
  }, []);

  useEffect(() => {
    // Async fetch on mount: setState runs after `await`, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  const user = state?.signedIn ? state : null;
  const badge = user ? TIER_BADGE[user.tier] ?? TIER_BADGE.free : null;

  return (
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
        {user && (
          <CountBadge
            count={user.unreadMessages}
            label={`${user.unreadMessages} unread Pulse messages`}
          />
        )}
      </span>

      {state === null ? (
        // Auth state not yet resolved — render a neutral placeholder so we
        // never flash the wrong auth state (e.g. "Log in" at a signed-in user).
        <span
          aria-hidden="true"
          className="giq-header-auth-action hidden h-10 w-[132px] animate-pulse rounded-lg bg-[hsl(var(--surface-3)/0.5)] md:inline-flex"
        />
      ) : user ? (
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
              count={user.unreadNotifications}
              label={`${user.unreadNotifications} unread notifications`}
            />
          </span>
          <AccountNavigationMenu user={user} />
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
        <MobileNavigationMenu state={state} />
      </Sheet>
    </div>
  );
}
