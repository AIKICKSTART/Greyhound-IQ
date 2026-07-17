"use client";

import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

import {
  transitionNetworkRecoveryState,
  type NetworkRecoveryState,
} from "@/lib/network-recovery-state";

export function NetworkRecoveryBanner() {
  const [state, setState] = useState<NetworkRecoveryState>("online");

  useEffect(() => {
    const sync = () =>
      setState((current) =>
        transitionNetworkRecoveryState(current, navigator.onLine),
      );

    const initialSync = window.setTimeout(sync, 0);
    window.addEventListener("offline", sync);
    window.addEventListener("online", sync);
    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("online", sync);
    };
  }, []);

  useEffect(() => {
    if (state !== "restored") return;
    const timer = window.setTimeout(() => setState("online"), 8_000);
    return () => window.clearTimeout(timer);
  }, [state]);

  if (state === "online") return null;

  const restored = state === "restored";
  const Icon = restored ? Wifi : WifiOff;

  return (
    <aside
      role="status"
      aria-live="assertive"
      className={`fixed top-3 left-1/2 z-[100] flex w-[min(calc(100%-1.5rem),42rem)] -translate-x-1/2 flex-col gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center ${
        restored
          ? "border-emerald-300/35 bg-emerald-950/95"
          : "border-amber-300/35 bg-[hsl(var(--surface-1)/0.97)]"
      }`}
    >
      <Icon
        className={`h-5 w-5 shrink-0 ${restored ? "text-emerald-300" : "text-amber-300"}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[hsl(var(--foreground))]">
          {restored ? "Connection restored" : "You are offline"}
        </p>
        <p className="mt-0.5 text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
          {restored
            ? "Live data can be refreshed when you are ready."
            : "Previously loaded information may be stale. Wait for your connection before submitting changes."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          if (restored) {
            window.location.reload();
            return;
          }
          setState((current) =>
            transitionNetworkRecoveryState(current, navigator.onLine),
          );
        }}
        className="giq-outline-action min-h-11 shrink-0 px-3 text-[12px] font-semibold"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        {restored ? "Refresh live data" : "Check connection"}
      </button>
    </aside>
  );
}
