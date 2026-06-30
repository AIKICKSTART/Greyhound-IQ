import Link from "next/link";
import { Target, Heart, Globe, Zap } from "lucide-react";
import { PageHero } from "@/components/page-hero";

export const metadata = {
  title: "About — GreyhoundIQ",
  description: "Why we built GreyhoundIQ — modern, mobile-first, AUD-priced greyhound racing data for Australia.",
};

const VALUES = [
  {
    icon: Target,
    title: "Built for the punter",
    desc: "Every feature is designed around the actual questions a serious greyhound punter asks. No clutter, no upsells, no noise.",
  },
  {
    icon: Heart,
    title: "Local-first",
    desc: "Australian tracks, Australian trainers, Australian pricing in AUD. Not a global product with a country flag duct-taped on.",
  },
  {
    icon: Globe,
    title: "Open data",
    desc: "We surface the official data first. Where state bodies offer it, we link to it. Where they don't, we use Betfair + FastTrack + Tasracing as transparent fallbacks.",
  },
  {
    icon: Zap,
    title: "Modern, fast, mobile",
    desc: "Built on Next.js 16 with React 19. Loads in under a second on a 4G connection. Looks as good on a phone as a desktop.",
  },
];

export default function AboutPage() {
  return (
    <div className="fade-in">
      <PageHero
        image="/images/hero-greyhoundiq-brand.png"
        badge="ABOUT"
        badgeColor="green"
        title={
          <>
            The smartest greyhound
            <br />
            <span className="gradient-text">racing data platform.</span>
          </>
        }
        subtitle="Built in Australia for Australian punters, breeders, and owners. One platform, real-time data, no ads."
      />

      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2
          className="text-2xl font-semibold text-[hsl(210_13%_97%)] mb-4 tracking-[-0.03em]"
        >
          Why we built it
        </h2>
        <div
          className="space-y-4 text-[15px] text-[hsl(215_14%_65%)] leading-relaxed tracking-[-0.011em]"
        >
          <p>
            The Australian greyhound racing market is a $4.3 billion industry. The two
            main tools punters use are <span className="text-[hsl(210_13%_97%)]">greyhound-data.com</span> —
            an old, ad-heavy UK site priced in GBP — and a patchwork of state body
            sites that don&apos;t talk to each other.
          </p>
          <p>
            We built <span className="text-[hsl(210_13%_97%)]">GreyhoundIQ</span> to
            consolidate national race data into one modern interface. AUD pricing,
            mobile-first, ad-free, with AI predictions and breeding analytics
            built in. 21% cheaper than the existing top tier, with more features.
          </p>
          <p>
            Solo-built by Daniel Fleuren in Sydney. AI-assisted development means
            the team is small but the output isn&apos;t. Backend runs on Supabase,
            the whole thing costs about $14/month to host.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2
          className="text-2xl font-semibold text-[hsl(210_13%_97%)] mb-8 tracking-[-0.03em]"
        >
          What we believe
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {VALUES.map((v) => {
            const Icon = v.icon;
            return (
              <div
                key={v.title}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(142_76%_36%/0.1)] mb-4">
                  <Icon className="h-5 w-5 text-[hsl(142_60%_48%)]" />
                </div>
                <h3
                  className="text-[16px] font-semibold text-[hsl(210_13%_97%)] mb-2 tracking-[-0.02em]"
                >
                  {v.title}
                </h3>
                <p
                  className="text-[13px] text-[hsl(215_14%_65%)] leading-relaxed tracking-[-0.013em]"
                >
                  {v.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12 text-center">
        <h2
          className="text-2xl font-semibold text-[hsl(210_13%_97%)] mb-4 tracking-[-0.03em]"
        >
          Get in touch
        </h2>
        <p
          className="text-[15px] text-[hsl(215_14%_65%)] mb-6 tracking-[-0.011em]"
        >
          Questions, feedback, or partnership ideas — we&apos;d love to hear from you.
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[hsl(142_76%_36%)] to-[hsl(142_60%_40%)] px-5 py-2.5 text-[13px] font-semibold text-white shadow-xl shadow-[hsl(142_76%_36%/0.25)] hover:brightness-110 transition-all tracking-[-0.013em]"
        >
          Contact us
        </Link>
      </section>
    </div>
  );
}
