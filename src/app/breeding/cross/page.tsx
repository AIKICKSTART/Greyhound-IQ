import { ArrowLeft, GitCompareArrows } from "lucide-react";
import Link from "next/link";

import { CrossAnalysis } from "@/components/cross-analysis";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Test Mating — GreyhoundIQ",
  description:
    "Look up the historical record of any sire and dam pairing in Australian greyhound racing — the progeny they have actually produced and each parent's overall progeny record. Not a prediction.",
};

export default function CrossAnalysisPage() {
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

      <CrossAnalysis />
    </div>
  );
}
