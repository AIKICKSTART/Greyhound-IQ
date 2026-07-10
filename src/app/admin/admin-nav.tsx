"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Menu, ShieldCheck, X } from "lucide-react";

import { ADMIN_NAV } from "@/app/admin/admin-nav-data";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  // /admin (dashboard) must match exactly; section routes prefix-match.
  return href === "/admin"
    ? pathname === "/admin"
    : pathname === href || pathname.startsWith(`${href}/`);
}

function AdminNavigationContent({
  pathname,
  mobile = false,
  onNavigate,
}: {
  pathname: string;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <Link href="/admin" className="flex items-center gap-2.5" onClick={onNavigate}>
          <span className="giq-icon-plate flex h-9 w-9 items-center justify-center rounded-lg">
            <ShieldCheck className="h-5 w-5 text-[hsl(var(--secondary-light))]" />
          </span>
          <span>
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
              GreyhoundIQ
            </span>
            <span className="block text-[15px] font-semibold text-[hsl(var(--foreground))]">
              Admin
            </span>
          </span>
        </Link>
        {mobile ? (
          <SheetClose
            type="button"
            className="giq-outline-action min-h-11 min-w-11 px-0"
            aria-label="Close admin navigation"
          >
            <X className="h-4 w-4" />
          </SheetClose>
        ) : null}
      </div>

      <div className="race-box-strip opacity-80" aria-hidden="true" />

      <nav className="flex flex-col gap-4" aria-label="Admin sections">
        {ADMIN_NAV.map((group) => (
          <div
            key={group.title}
            className="flex flex-col gap-1.5 border-t border-white/[0.06] pt-4 first:border-t-0 first:pt-0"
          >
            <p className="px-3 text-[11px] font-bold uppercase tracking-[0.09em] text-[hsl(var(--secondary-light)/0.82)]">
              {group.title}
            </p>
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  className={cn(
                    "group relative flex min-h-11 items-center gap-2 overflow-hidden rounded-lg border px-3 py-2 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--surface-1))]",
                    active
                      ? "border-[hsl(var(--primary-light)/0.48)] bg-[linear-gradient(90deg,hsl(var(--primary)/0.28),hsl(var(--primary)/0.09))] text-[hsl(var(--metal-silver-bright))] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.12),0_10px_24px_hsl(var(--primary)/0.14)]"
                      : "border-transparent text-[hsl(var(--muted-foreground))] hover:border-white/[0.1] hover:bg-white/[0.045] hover:text-[hsl(var(--foreground))]",
                  )}
                >
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[hsl(var(--primary-bright))] shadow-[0_0_14px_hsl(var(--primary-bright)/0.9)]"
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform",
                      active
                        ? "translate-x-0 text-[hsl(var(--primary-light))]"
                        : "-translate-x-1 text-[hsl(var(--subtle-foreground))] opacity-0 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
                    )}
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <Link
        href="/account"
        onClick={onNavigate}
        className="giq-outline-action mt-auto min-h-11 w-full justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to account
      </Link>
    </>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <>
      {/* Mobile top bar: in-flow (admin layout stacks on mobile), so it never
          floats over page headers. Safe-area padding for notched phones. */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-white/[0.08] bg-[linear-gradient(180deg,hsl(var(--surface-2)/0.96),hsl(var(--surface-1)/0.94))] px-4 py-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] shadow-[0_12px_32px_rgba(0,0,0,0.28)] backdrop-blur-xl lg:hidden">
        <Link
          href="/admin"
          className="flex min-h-11 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary-light)/0.72)]"
        >
          <span className="giq-icon-plate flex h-8 w-8 items-center justify-center rounded-lg">
            <ShieldCheck className="h-4 w-4 text-[hsl(var(--secondary-light))]" />
          </span>
          <span className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
            Admin
          </span>
        </Link>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className="giq-outline-action min-h-11"
            aria-label="Open admin navigation"
          >
            <Menu className="h-4 w-4" />
            Menu
          </SheetTrigger>
          <SheetContent
            side="left"
            showCloseButton={false}
            className="giq-panel max-w-[calc(100vw-2rem)] gap-5 overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] data-[side=left]:w-72 lg:hidden"
          >
            <SheetTitle className="sr-only">Admin navigation</SheetTitle>
            <AdminNavigationContent
              pathname={pathname}
              mobile
              onNavigate={() => setOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </header>

      <aside
        style={{ overflowY: "auto" }}
        className="giq-panel z-50 hidden w-72 shrink-0 flex-col gap-5 overflow-y-auto p-5 lg:sticky lg:top-0 lg:flex lg:h-screen lg:rounded-none lg:border-y-0 lg:border-l-0"
      >
        <AdminNavigationContent pathname={pathname} />
      </aside>
    </>
  );
}
