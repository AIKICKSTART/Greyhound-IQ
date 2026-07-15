"use client";

import { useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";

export function DesignLabOnboardingDisclosureTargets() {
  const [selectedTab, setSelectedTab] = useState<"summary" | "details">(
    "summary",
  );

  return (
    <section
      className="min-w-0 rounded-xl border border-[hsl(var(--secondary-light)/0.22)] bg-[hsl(var(--secondary)/0.045)] p-3.5 lg:col-span-2"
      aria-labelledby="onboarding-target-lab-heading"
      data-design-lab-onboarding-disclosure-targets
    >
      <h3
        id="onboarding-target-lab-heading"
        className="text-[11px] font-black uppercase tracking-[0.11em] text-white"
      >
        Hidden-target safety lab
      </h3>
      <p className="mt-1 text-[10px] leading-5 text-[hsl(var(--subtle-foreground))]">
        These protected, local-only controls prove how a tour reveals a target
        inside a tab or dialog. Both actions change presentation only and never
        submit a form, grant access or write a record.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-3">
          <div
            aria-label="Onboarding tab-target example"
            className="flex flex-wrap gap-2"
            role="tablist"
          >
            <button
              aria-controls="design-lab-tab-summary"
              aria-selected={selectedTab === "summary"}
              className="giq-outline-action min-h-11 px-3 text-xs"
              id="design-lab-tab-summary-trigger"
              onClick={() => setSelectedTab("summary")}
              role="tab"
              tabIndex={selectedTab === "summary" ? 0 : -1}
              type="button"
            >
              Summary
            </button>
            <button
              aria-controls="design-lab-tab-target"
              aria-selected={selectedTab === "details"}
              className="giq-outline-action min-h-11 px-3 text-xs"
              data-onboarding-controls="design-lab-tab-target"
              data-onboarding-reveal="tab"
              id="design-lab-tab-target-trigger"
              onClick={() => setSelectedTab("details")}
              role="tab"
              tabIndex={selectedTab === "details" ? 0 : -1}
              type="button"
            >
              Target details
            </button>
          </div>
          <div
            aria-labelledby="design-lab-tab-summary-trigger"
            className="mt-3 rounded-md bg-white/[0.035] p-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]"
            id="design-lab-tab-summary"
            hidden={selectedTab !== "summary"}
            role="tabpanel"
          >
            The details target starts hidden. An allowlisted tour step may
            activate its non-mutating tab button once.
          </div>
          <div
            aria-labelledby="design-lab-tab-target-trigger"
            className="mt-3 rounded-md bg-white/[0.035] p-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]"
            data-onboarding-target="design-lab-tab-target"
            hidden={selectedTab !== "details"}
            id="design-lab-tab-target"
            role="tabpanel"
          >
            The semantic target is now visible; the tour can attach without a
            CSS selector or privileged action.
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-3">
          <p className="text-xs leading-5 text-[hsl(var(--muted-foreground))]">
            The dialog target is mounted only after its explicit, non-mutating
            trigger runs. Dialog focus and Escape handling remain owned by the
            shared accessible Sheet primitive.
          </p>
          <Sheet modal={false}>
            <SheetTrigger
              aria-controls="design-lab-modal-target"
              className="giq-outline-action mt-3 min-h-11 px-3 text-xs"
              data-onboarding-controls="design-lab-modal-target"
              data-onboarding-reveal="modal"
              type="button"
            >
              Open target dialog
            </SheetTrigger>
            <SheetContent
              className="z-[82] overflow-y-auto border-white/[0.12] bg-[hsl(var(--surface-1)/0.99)]"
              data-onboarding-target="design-lab-modal-target"
              id="design-lab-modal-target"
              side="right"
            >
              <SheetHeader>
                <SheetTitle>Dialog target safety contract</SheetTitle>
                <SheetDescription>
                  This target contains guidance only. Opening it changes no
                  identity, permission, evidence or production record.
                </SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </section>
  );
}
