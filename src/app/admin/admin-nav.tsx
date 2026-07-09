"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, ShieldCheck, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { ADMIN_NAV } from "@/app/admin/admin-nav-data";

function isActive(pathname: string, href: string) {
  // /admin (dashboard) must match exactly; section routes prefix-match.
  return href === "/admin"
    ? pathname === "/admin"
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar: in-flow (admin layout stacks on mobile), so it never
          floats over page headers. Safe-area padding for notched phones. */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-white/[0.08] bg-[hsl(var(--surface-1)/0.92)] px-4 py-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] backdrop-blur-lg lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="giq-icon-plate flex h-8 w-8 items-center justify-center rounded-lg">
            <ShieldCheck className="h-4 w-4 text-[hsl(var(--secondary-light))]" />
          </span>
          <span className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
            Admin
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="giq-outline-action"
          aria-label="Open admin navigation"
        >
          <Menu className="h-4 w-4" />
          Menu
        </button>
      </header>

      {/* Backdrop (mobile) */}
      {open ? (
        <button
          type="button"
          aria-label="Close admin navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "giq-panel z-50 flex w-72 shrink-0 flex-col gap-6 overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] lg:pb-5 lg:pt-5",
          "fixed inset-y-0 left-0 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
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
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="giq-outline-action lg:hidden"
            aria-label="Close admin navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-col gap-5">
          {ADMIN_NAV.map((group) => (
            <div key={group.title} className="flex flex-col gap-1.5">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--subtle-foreground))]">
                {group.title}
              </p>
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors lg:min-h-0",
                      active
                        ? "border-[hsl(var(--secondary-light)/0.6)] bg-[hsl(var(--secondary-light)/0.14)] text-[hsl(var(--foreground))]"
                        : "border-transparent text-[hsl(var(--muted-foreground))] hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-[hsl(var(--foreground))]",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <Link href="/account" className="giq-outline-action mt-auto w-full justify-center">
          Back to account
        </Link>
      </aside>
    </>
  );
}
