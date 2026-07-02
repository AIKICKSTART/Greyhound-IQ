"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Crown,
  Dog,
  Flag,
  Trophy,
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
  { href: "/results", label: "Results", icon: Trophy },
  { href: "/dogs", label: "Dogs", icon: Dog },
  { href: "/pricing", label: "Pro", icon: Crown, tone: "pro" },
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
