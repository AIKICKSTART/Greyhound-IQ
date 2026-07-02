"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Check, SlidersHorizontal, X } from "lucide-react";

type CookieConsent = "accepted" | "declined";

const STORAGE_KEY = "greyhoundiq.cookie-consent.v1";
const CONSENT_EVENT = "greyhoundiq:cookie-consent";

export function CookieConsentBanner() {
  const pathname = usePathname();
  const [consent, setConsent] = useCookieConsent();

  if (pathname === "/privacy") return null;
  if (consent !== null) return null;

  return (
    <div className="giq-cookie-banner race-panel fixed bottom-3 left-1/2 z-50 w-[calc(100vw-24px)] max-w-5xl -translate-x-1/2 px-4 py-4 shadow-2xl shadow-black/45 backdrop-blur-md">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
            Cookie preferences
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            GreyhoundIQ uses essential cookies for sign-in and security. Optional
            analytics cookies help improve the product and can be declined.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
          <button
            type="button"
            onClick={() => setConsent("declined")}
            className="giq-button giq-button-glass px-4 text-[13px] font-semibold"
          >
            <X className="h-3.5 w-3.5" />
            Decline
          </button>
          <button
            type="button"
            onClick={() => setConsent("accepted")}
            className="giq-button giq-button-primary px-4 text-[13px] font-semibold"
          >
            <Check className="h-3.5 w-3.5" />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

export function CookiePreferencePanel() {
  const [consent, setConsent] = useCookieConsent();
  const label =
    consent === "accepted"
      ? "Analytics accepted"
      : consent === "declined"
        ? "Analytics declined"
        : "No preference saved";

  return (
    <div className="race-panel mt-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[hsl(var(--primary-bright))]" />
            <h3 className="text-[15px] font-semibold text-[hsl(var(--foreground))]">
              Cookie preferences
            </h3>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            Current browser setting:{" "}
            <span className="font-semibold text-[hsl(var(--foreground))]">{label}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setConsent("declined")}
            className="giq-button giq-button-glass px-4 text-[13px] font-semibold"
          >
            <X className="h-3.5 w-3.5" />
            Decline
          </button>
          <button
            type="button"
            onClick={() => setConsent("accepted")}
            className="giq-button giq-button-primary px-4 text-[13px] font-semibold"
          >
            <Check className="h-3.5 w-3.5" />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

function useCookieConsent() {
  const consent = useSyncExternalStore(
    subscribeToConsent,
    readConsent,
    getServerConsent
  );

  function setConsent(next: CookieConsent) {
    writeConsent(next);
  }

  return [consent, setConsent] as const;
}

function subscribeToConsent(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(CONSENT_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CONSENT_EVENT, onChange);
  };
}

function getServerConsent(): CookieConsent | null | undefined {
  return undefined;
}

function readConsent(): CookieConsent | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

function writeConsent(value: CookieConsent) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
    window.dispatchEvent(new Event(CONSENT_EVENT));
  } catch {
    // If storage is unavailable, keep the in-memory state for this render.
  }
}
