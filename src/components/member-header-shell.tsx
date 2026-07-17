"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const TOP_REGION = 12;
const COMPACT_REGION = 48;

export type MemberHeaderState = {
  compact: boolean;
  anchorY: number;
};

export function nextMemberHeaderState(
  state: MemberHeaderState,
  scrollY: number,
  headerFocused = false
): MemberHeaderState {
  if (headerFocused || scrollY <= TOP_REGION) {
    return { compact: false, anchorY: scrollY };
  }

  if (!state.compact && scrollY >= COMPACT_REGION) {
    return { compact: true, anchorY: scrollY };
  }
  return { ...state, anchorY: scrollY };
}

export function getMemberSectionLabel(pathname: string) {
  const segment = pathname.split("/").filter(Boolean)[0] ?? "home";
  if (segment === "pulse" || segment === "messages") return "Chat";
  if (segment === "p") return "Profile";
  return segment
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function MemberHeaderShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const activeScrollY = useRef(0);
  const scrollState = useRef<MemberHeaderState>({ compact: false, anchorY: 0 });
  const [renderedState, setRenderedState] = useState({
    pathname,
    compact: false,
  });
  const compact =
    renderedState.pathname === pathname && renderedState.compact;

  useEffect(() => {
    const containedScroller = document.querySelector<HTMLElement>(
      "[data-feed-scroll]"
    );
    const readScrollY = () => containedScroller?.scrollTop ?? window.scrollY;
    const scrollTarget: EventTarget = containedScroller ?? window;

    const update = () => {
      const scrollY = readScrollY();
      activeScrollY.current = scrollY;
      const next = nextMemberHeaderState(
        scrollState.current,
        scrollY,
        headerRef.current?.contains(document.activeElement) ?? false
      );
      if (next.compact !== scrollState.current.compact) {
        setRenderedState({ pathname, compact: next.compact });
      }
      scrollState.current = next;
    };

    scrollState.current = { compact: false, anchorY: readScrollY() };
    update();
    scrollTarget.addEventListener("scroll", update, { passive: true });
    return () => {
      scrollTarget.removeEventListener("scroll", update);
    };
  }, [pathname]);

  return (
    <header
      ref={headerRef}
      data-header-state={compact ? "compact" : "expanded"}
      className="giq-member-header sticky top-2 z-50 w-full px-3 md:px-5"
      onFocusCapture={() => {
        if (!scrollState.current.compact) return;
        scrollState.current = {
          compact: false,
          anchorY: activeScrollY.current,
        };
        setRenderedState({ pathname, compact: false });
      }}
    >
      {children}
    </header>
  );
}

export function MemberHeaderSection() {
  const pathname = usePathname();
  return (
    <span className="giq-member-header-section" data-member-current-section>
      {getMemberSectionLabel(pathname)}
    </span>
  );
}
