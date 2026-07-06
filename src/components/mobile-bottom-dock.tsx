"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Dog,
  Flag,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

type DockLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  tone?: "pro";
};

const DOCK_LINKS: DockLink[] = [
  { href: "/", label: "Home", icon: Activity },
  { href: "/races", label: "Races", icon: Flag },
  { href: "/dogs", label: "Dogs", icon: Dog },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/pulse", label: "Pulse", icon: Bell },
];

export function MobileBottomDock() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Quick actions"
      className="giq-mobile-dock is-visible"
    >
      {DOCK_LINKS.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            data-tone={item.tone}
            className={`giq-mobile-dock-link ${active ? "is-active" : ""}`}
          >
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
