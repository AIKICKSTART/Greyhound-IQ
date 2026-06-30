"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Crown,
  Dog,
  MessageCircle,
  Search,
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
  { href: "/races", label: "Races", icon: Trophy },
  { href: "/dogs", label: "Dogs", icon: Search },
  { href: "/listings", label: "Market", icon: Dog },
  { href: "/forum", label: "Forum", icon: MessageCircle },
  { href: "/pricing", label: "Pro", icon: Crown, tone: "pro" },
];

export function MobileBottomDock() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;

    function syncNow() {
      setVisible(window.scrollY > 160);
    }

    function syncVisibility() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        syncNow();
      });
    }

    syncNow();
    const intervalId = window.setInterval(syncNow, 300);
    window.addEventListener("scroll", syncVisibility, { passive: true });
    window.addEventListener("resize", syncVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("scroll", syncVisibility);
      window.removeEventListener("resize", syncVisibility);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return (
    <nav
      aria-label="Mobile quick navigation"
      className={`giq-mobile-dock md:hidden ${visible ? "is-visible" : ""}`}
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
