"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

export type SignInNavigationCandidate = {
  href: string;
  button: number;
  defaultPrevented: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  target: string;
  download: boolean;
};

export function isSameWindowSignInNavigation(
  candidate: SignInNavigationCandidate,
  currentUrl: string,
) {
  if (
    candidate.defaultPrevented ||
    candidate.button !== 0 ||
    candidate.altKey ||
    candidate.ctrlKey ||
    candidate.metaKey ||
    candidate.shiftKey ||
    candidate.download ||
    (candidate.target && candidate.target.toLowerCase() !== "_self")
  ) {
    return false;
  }

  try {
    const current = new URL(currentUrl);
    const destination = new URL(candidate.href, current);
    const pathname = destination.pathname.replace(/\/+$/, "") || "/";
    return (
      destination.origin === current.origin &&
      !destination.username &&
      !destination.password &&
      pathname === "/sign-in"
    );
  } catch {
    return false;
  }
}

export function AuthenticationNavigationFeedback() {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const source = event.target;
      if (!(source instanceof Element)) return;

      const anchor = source.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        !isSameWindowSignInNavigation(
          {
            href: anchor.href,
            button: event.button,
            defaultPrevented: event.defaultPrevented,
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey,
            target: anchor.target,
            download: anchor.hasAttribute("download"),
          },
          window.location.href,
        )
      ) {
        return;
      }

      flushSync(() => setPending(true));
    }

    function resetPending() {
      setPending(false);
    }

    document.addEventListener("click", handleClick, true);
    window.addEventListener("pageshow", resetPending);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("pageshow", resetPending);
    };
  }, []);

  if (!pending) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex justify-center px-4"
    >
      <div className="flex max-w-full items-center gap-2 rounded-full border border-[hsl(var(--primary)/0.35)] bg-[hsl(var(--surface-1)/0.96)] px-4 py-2.5 text-[13px] font-semibold text-[hsl(var(--foreground))] shadow-xl backdrop-blur-md">
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin text-[hsl(var(--primary-bright))]"
          aria-hidden="true"
        />
        Opening secure sign-in…
      </div>
    </div>
  );
}
