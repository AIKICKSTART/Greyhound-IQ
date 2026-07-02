import Link from "next/link";
import { Check, X, Zap, Crown, Sparkles } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { CreditCard } from "lucide-react";

const PLANS = [
  {
    name: "Free",
    icon: Zap,
    price: "$0",
    period: "forever",
    description: "Perfect for casual punters and form checkers.",
    features: [
      "Today's race cards (all AU tracks)",
      "Basic form (last 6 starts)",
      "Results (today + yesterday)",
      "Dog & track search",
      "5 detailed lookups per day",
    ],
    notIncluded: ["Full career history", "AI predictions", "API access"],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Pro",
    icon: Sparkles,
    price: "$12",
    period: "/month or $99/year",
    description: "For serious punters who want every edge.",
    features: [
      "Everything in Free",
      "Full career history (every start)",
      "Advanced statistics & box bias",
      "Split times & sectionals",
      "5-generation pedigrees",
      "Breeding analytics",
      "Speed maps & watchlists",
      "5 years historical data",
      "No ads",
    ],
    notIncluded: ["AI predictions", "API access"],
    cta: "Go Pro",
    highlighted: true,
  },
  {
    name: "Pro+",
    icon: Crown,
    price: "$29",
    period: "/month or $249/year",
    description: "The complete toolkit for professionals.",
    features: [
      "Everything in Pro",
      "GPS tracking data",
      "AI race predictions",
      "AI speed maps (ML)",
      "Performance forecasting",
      "Custom analytics dashboard",
      "API access (1,000 calls/day)",
      "Data exports (CSV/JSON)",
      "Priority support",
    ],
    notIncluded: [],
    cta: "Go Pro+",
    highlighted: false,
  },
];

const FAQ = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your account settings — you'll keep access until the end of your billing period. No questions asked.",
  },
  {
    q: "Do you offer refunds?",
    a: "14-day money-back guarantee on all paid plans. Email support@greyhoundiq.com.au if you're not happy.",
  },
  {
    q: "What payment methods do you accept?",
    a: "Credit/debit card via Stripe. We also support Apple Pay and Google Pay where available.",
  },
  {
    q: "Is my payment information secure?",
    a: "Yes. All payments are processed by Stripe — we never see or store your card details. PCI-DSS compliant.",
  },
];

export const metadata = {
  title: "Pricing — GreyhoundIQ",
  description: "Simple honest pricing for Australian greyhound racing data. AUD pricing, no ads, no surprises.",
};

export default function PricingPage() {
  return (
    <div className="fade-in">
      <PageHero
        image="/images/wentworth-gate-hero.webp"
        badge="PRICING"
        badgeIcon={<CreditCard className="h-3 w-3 text-[hsl(var(--primary-bright))]" />}
        badgeColor="primary"
        title={
          <>
            Simple, honest
            <br />
            <span className="gradient-text">pricing.</span>
          </>
        }
        subtitle="AUD pricing — not GBP. Cheaper than greyhound-data.com's top tier with more features. No ads. No conversion fees."
      />

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.name}
                className={`giq-pricing-card ${plan.highlighted ? "giq-pricing-card-featured lg:scale-[1.02]" : ""}`}
              >
                {plan.highlighted && (
                  <div className="giq-badge giq-badge-purple giq-plan-popular">
                    MOST POPULAR
                  </div>
                )}
                <div className="flex items-center gap-2 mb-4">
                  <Icon className={`h-5 w-5 ${plan.highlighted ? "text-[hsl(var(--primary-bright))]" : "text-[hsl(var(--muted-foreground))]"}`} />
                  <span className="text-[16px] font-semibold text-[hsl(var(--foreground))] tracking-[-0.02em]">{plan.name}</span>
                </div>
                <div className="mb-1">
                  <span className="giq-plan-price">{plan.price}</span>
                  <span className="text-[13px] text-[hsl(var(--muted-foreground))] ml-1 tracking-[-0.013em]">{plan.period}</span>
                </div>
                <p className="text-[13px] text-[hsl(var(--muted-foreground))] mb-5 mt-2 tracking-[-0.013em]">{plan.description}</p>

                <Link
                  href={`/contact?plan=${plan.name.toLowerCase().replace("+", "plus")}`}
                  className={`mb-5 w-full text-center text-[13px] font-semibold ${
                    plan.highlighted
                      ? "giq-liquid-purple-button"
                      : plan.name === "Pro+"
                        ? "giq-button giq-button-gold"
                        : "giq-button giq-button-carbon"
                  }`}
                >
                  {plan.cta}
                </Link>

                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="giq-plan-feature">
                      <Check className="h-3.5 w-3.5 text-[hsl(var(--primary-bright))] flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                  {plan.notIncluded.map((f) => (
                    <li key={f} className="giq-plan-feature giq-plan-feature-muted">
                      <X className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <p className="text-[13px] text-[hsl(var(--subtle-foreground))] tracking-[-0.013em]">
            greyhound-data.com Gold: ~$125 AUD/year. GreyhoundIQ Pro:{" "}
            <span className="font-semibold text-[hsl(var(--primary-bright))]">$99 AUD/year</span>. That&apos;s 21% cheaper.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))] mb-8 text-center tracking-[-0.03em]">
          Common questions
        </h2>
        <div className="space-y-3">
          {FAQ.map((item, i) => (
            <details
              key={i}
              className="giq-faq-item group"
            >
              <summary className="flex items-center justify-between p-5 cursor-pointer list-none">
                <span className="text-[15px] font-medium text-[hsl(var(--foreground))] tracking-[-0.013em]">
                  {item.q}
                </span>
                <span className="text-[hsl(var(--muted-foreground))] text-xl transition-transform group-open:rotate-45 select-none">
                  +
                </span>
              </summary>
              <div className="px-5 pb-5 text-[14px] text-[hsl(var(--muted-foreground))] leading-relaxed tracking-[-0.011em]">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-3xl px-6 pb-20 text-center">
        <div className="giq-final-cta p-10">
          <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))] mb-3 tracking-[-0.03em]">
            Ready to start?
          </h2>
          <p className="text-[15px] text-[hsl(var(--muted-foreground))] mb-6 tracking-[-0.013em]">
            Free forever. Upgrade when you&apos;re ready. Cancel anytime.
          </p>
          <Link
            href="/contact?plan=free"
            className="giq-liquid-purple-button px-6 text-[14px] font-semibold"
          >
            Create free account
          </Link>
        </div>
      </section>
    </div>
  );
}
