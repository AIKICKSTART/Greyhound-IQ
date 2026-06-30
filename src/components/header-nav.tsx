"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type HeaderNavLink = {
  href: string;
  label: string;
};

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
        const active = isActivePath(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              variant === "desktop"
                ? cn("giq-header-nav-link shrink-0", active && "is-active")
                : cn(
                    "giq-button justify-start px-4 text-base font-semibold",
                    active ? "giq-button-green" : "giq-button-glass",
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
