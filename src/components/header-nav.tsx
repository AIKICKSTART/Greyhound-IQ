"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type HeaderNavLink =
  | { href: string; label: string }
  | { label: string; links: Array<{ href: string; label: string }> };

type HeaderNavProps = {
  links: HeaderNavLink[];
  variant: "desktop" | "mobile";
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderNav({ links, variant }: HeaderNavProps) {
  const pathname = usePathname();

  return (
    <>
      {links.map((link) => {
        if ("links" in link) {
          const active = link.links.some((item) =>
            isActivePath(pathname, item.href),
          );
          return (
            <details key={link.label} className="group relative shrink-0">
              <summary
                className={cn(
                  "giq-header-nav-link flex min-h-11 cursor-pointer list-none items-center gap-1",
                  active && "is-active",
                )}
              >
                {link.label}
                <span aria-hidden="true" className="text-[10px] transition group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <div className="absolute left-1/2 top-[calc(100%+0.4rem)] z-[70] min-w-36 -translate-x-1/2 rounded-xl border border-white/[0.12] bg-[hsl(var(--surface-1)/0.98)] p-1.5 shadow-2xl backdrop-blur-xl">
                {link.links.map((item) => {
                  const itemActive = isActivePath(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={itemActive ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center rounded-lg px-3 py-2 text-[13px] font-semibold text-[hsl(var(--muted-foreground))] transition hover:bg-white/[0.06] hover:text-[hsl(var(--foreground))]",
                        itemActive && "bg-white/[0.06] text-[hsl(var(--foreground))]",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </details>
          );
        }
        const active = isActivePath(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              variant === "desktop"
                ? cn("giq-header-nav-link inline-flex min-h-11 shrink-0 items-center", active && "is-active")
                : cn(
                    "giq-button min-h-11 justify-start px-4 text-base font-semibold",
                    active ? "giq-button-primary is-active" : "giq-button-carbon",
                  )
            }
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
