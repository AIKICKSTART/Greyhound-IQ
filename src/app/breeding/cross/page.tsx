import { ArrowLeft, Check, GitCompareArrows, Lock } from "lucide-react";
import Link from "next/link";

import { CrossAnalysis } from "@/components/cross-analysis";
import { getCurrentUser } from "@/lib/auth";
import { hasTier } from "@/lib/tier-access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Test Mating — GreyhoundIQ",
  description:
    "Look up the historical record of any sire and dam pairing in Australian greyhound racing — the progeny they have actually produced and each parent's overall progeny record. Not a prediction.",
};

const PRO_POINTS = [
  "Search any sire and dam with bridged racing + studbook records",
  "Shared ancestors and five-generation family trees for the pairing",
  "Each parent's real progeny strike rate and earnings",
  "Every pup the exact pairing has already produced",
];

export default async function CrossAnalysisPage() {
  const user = await getCurrentUser();
  const isPro = Boolean(user && hasTier(user.tier, "pro"));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/breeding"
        className="mb-6 inline-flex items-center gap-2 text-[13px] text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
      >
        <ArrowLeft className="h-4 w-4" /> Breeding intelligence
      </Link>

      <header className="mb-8">
        <p className="giq-eyebrow mb-2 flex items-center gap-2 text-[hsl(var(--subtle-foreground))]">
          <GitCompareArrows className="h-3.5 w-3.5 text-[hsl(var(--primary-bright))]" />
          Test mating
          <span className="giq-badge giq-badge-gold px-2 py-0.5 text-[10px]">Pro</span>
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))] sm:text-4xl">
          Any sire × any dam
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed tracking-[-0.013em] text-[hsl(var(--muted-foreground))]">
          Pick a sire and a dam to see the historical record of that pairing — the
          progeny it has actually produced, plus each parent&apos;s overall progeny
          record. This is a record of what has happened, not a prediction.
        </p>
      </header>

      {isPro ? <CrossAnalysis /> : <CrossUpsell signedIn={Boolean(user)} />}
    </div>
  );
}

// Conversion panel for free and signed-out visitors: states what the tool does
// and routes to the $20 Pro plan. The cross APIs enforce the same gate.
function CrossUpsell({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="giq-comparison-board" aria-labelledby="cross-upsell-heading">
      <div className="relative z-[2] flex flex-col items-center gap-6 px-4 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[hsl(var(--primary-light)/0.3)] bg-[hsl(var(--primary)/0.16)] shadow-[0_0_26px_-12px_hsl(var(--primary-bright))]">
          <Lock className="h-6 w-6 text-[hsl(var(--primary-bright))]" />
        </span>
        <div className="max-w-md">
          <h2
            id="cross-upsell-heading"
            className="text-[18px] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]"
          >
            Test mating is a Pro feature
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
            Unlock the full sire × dam record — bridged pedigrees, shared
            ancestors and real progeny results — for $20/month.
          </p>
        </div>
        <ul className="grid max-w-md gap-2 text-left">
          {PRO_POINTS.map((point) => (
            <li
              key={point}
              className="flex items-start gap-2 text-[13px] text-[hsl(var(--muted-foreground))]"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--success))]" />
              {point}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/pricing"
            className="giq-button giq-button-primary min-h-11 px-6 text-[13px]"
          >
            Go Pro — $20/month
          </Link>
          {!signedIn && (
            <Link href="/sign-in" className="giq-outline-action min-h-11 px-6 text-[13px]">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
