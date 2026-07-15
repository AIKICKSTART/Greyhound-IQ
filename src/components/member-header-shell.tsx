"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const TOP_REGION = 12;
const DIRECTION_THRESHOLD = 24;

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

  const distance = scrollY - state.anchorY;
  if (!state.compact && distance >= DIRECTION_THRESHOLD) {
    return { compact: true, anchorY: scrollY };
  }
  if (state.compact && distance <= -DIRECTION_THRESHOLD) {
    return { compact: false, anchorY: scrollY };
  }
  if ((!state.compact && distance < 0) || (state.compact && distance > 0)) {
    return { ...state, anchorY: scrollY };
  }
  return state;
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
  const scrollState = useRef<MemberHeaderState>({ compact: false, anchorY: 0 });
  const [renderedState, setRenderedState] = useState({
    pathname,
    compact: false,
  });
  const compact =
    renderedState.pathname === pathname && renderedState.compact;

  useEffect(() => {
    scrollState.current = { compact: false, anchorY: window.scrollY };
    const anchors = new WeakMap<EventTarget, number>();
    anchors.set(window, window.scrollY);

    const updateFrom = (source: EventTarget, scrollY: number) => {
      const next = nextMemberHeaderState(
        {
          compact: scrollState.current.compact,
          anchorY: anchors.get(source) ?? scrollY,
        },
        scrollY,
        headerRef.current?.contains(document.activeElement) ?? false
      );
      anchors.set(source, next.anchorY);
      if (next.compact !== scrollState.current.compact) {
        setRenderedState({ pathname, compact: next.compact });
      }
      scrollState.current = next;
    };

    const handleWindowScroll = () => updateFrom(window, window.scrollY);
    const containedScrollers = Array.from(
      document.querySelectorAll<HTMLElement>("[data-feed-scroll]")
    );
    const containedHandlers = containedScrollers.map((scroller) => {
      anchors.set(scroller, scroller.scrollTop);
      const handleScroll = () => updateFrom(scroller, scroller.scrollTop);
      scroller.addEventListener("scroll", handleScroll, { passive: true });
      return { scroller, handleScroll };
    });

    window.addEventListener("scroll", handleWindowScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleWindowScroll);
      for (const { scroller, handleScroll } of containedHandlers) {
        scroller.removeEventListener("scroll", handleScroll);
      }
    };
  }, [pathname]);

  return (
    <header
      ref={headerRef}
      data-header-state={compact ? "compact" : "expanded"}
      className="giq-member-header sticky top-2 z-50 w-full px-3 md:px-5"
      onFocusCapture={() => {
        if (!scrollState.current.compact) return;
        scrollState.current = { compact: false, anchorY: window.scrollY };
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
