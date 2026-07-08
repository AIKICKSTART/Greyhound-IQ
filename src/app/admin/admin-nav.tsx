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
      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="giq-outline-action fixed left-4 top-4 z-40 lg:hidden"
        aria-label="Open admin navigation"
      >
        <Menu className="h-4 w-4" />
        Admin menu
      </button>

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
          "giq-panel z-50 flex w-72 shrink-0 flex-col gap-6 overflow-y-auto p-5",
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
                      "rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors",
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
