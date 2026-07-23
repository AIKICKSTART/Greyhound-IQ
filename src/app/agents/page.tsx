import Link from "next/link";
import { Crown, LockKeyhole, PawPrint } from "lucide-react";

import { PageTitle } from "@/components/page-title";
import { TipsPreview } from "@/components/tips-preview";
import { getCurrentUser } from "@/lib/auth";
import { getTipsPreview } from "@/lib/tips-preview";
import { hasTier } from "@/lib/tier-access";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Tips preview - GreyhoundIQ",
  description: "A Pro+ preview of the GreyhoundIQ Prediction Engine interface.",
};

export default async function TipsPage() {
  const current = await getCurrentUser();
  const canAccess = Boolean(current && hasTier(current.tier, "pro_plus"));

  if (!current || !canAccess) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <PageTitle size="compact">Tips</PageTitle>
        <section className="mt-6 overflow-hidden rounded-2xl border border-[hsl(var(--secondary)/0.28)] bg-[hsl(var(--surface-1))] shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
          <div className="h-1.5 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--secondary))]" />
          <div className="p-6 sm:p-8">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[hsl(var(--secondary)/0.3)] bg-[hsl(var(--secondary)/0.1)]">
              <LockKeyhole className="h-5 w-5 text-[hsl(var(--secondary-light))]" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-xl font-semibold text-[hsl(var(--foreground))]">
              Tips is a Pro+ feature
            </h2>
            <p className="mt-2 max-w-xl text-[14px] leading-6 text-[hsl(var(--muted-foreground))]">
              {current
                ? "Your Pro plan includes Pages. Pro+ access is required for the Prediction Engine tips preview."
                : "Sign in with a Pro+ account to open the Prediction Engine tips preview."}
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <span className="giq-button giq-button-gold min-h-11 justify-center px-5 text-[13px] font-semibold">
                <Crown className="h-4 w-4" aria-hidden="true" />
                Pro+ sign-up coming soon
              </span>
              {!current ? (
                <Link
                  href="/sign-in"
                  className="giq-outline-action min-h-11 justify-center px-5 text-[13px]"
                >
                  Sign in
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    );
  }

  const preview = getTipsPreview(current);
  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
      <header className="mb-6">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[hsl(var(--secondary-light))]">
          <PawPrint className="h-4 w-4" aria-hidden="true" />
          Pro+ preview
        </p>
        <PageTitle className="mt-2">Tips are coming soon 🐾</PageTitle>
        <p className="mt-3 max-w-3xl text-[14px] leading-6 text-[hsl(var(--muted-foreground))]">
          Our prediction engine is still in training—studying every race,
          sharpening its form analysis and getting ready for the starting boxes.
          Stay tuned.
        </p>
      </header>
      <TipsPreview preview={preview} />
    </main>
  );
}
