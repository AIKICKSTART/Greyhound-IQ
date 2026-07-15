import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { PageHero } from "@/components/page-hero";

export function HomeHero({
  compact = false,
  primaryHref = "#races",
}: {
  compact?: boolean;
  primaryHref?: string;
}) {
  return (
    <PageHero
      image="/images/wentworth-gate-hero.webp"
      size={compact ? "default" : "tall"}
      title={
        <>
          Australian greyhound racing,
          <br />
          <span className="giq-text-gold-glass">done</span>{" "}
          <span className="giq-text-purple-glass">right.</span>
        </>
      }
      subtitle="Real-time race cards, full career form, breeding analytics, AI predictions, and a community for breeders and owners — all in one place. No ads. No clutter. No GBP pricing."
    >
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={primaryHref}
          className="giq-liquid-purple-button group text-[14px] font-semibold tracking-[-0.013em]"
        >
          View Today&apos;s Races
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/pricing"
          className="giq-button giq-button-carbon px-6 text-[14px] font-semibold"
        >
          See Pricing
        </Link>
      </div>
    </PageHero>
  );
}
