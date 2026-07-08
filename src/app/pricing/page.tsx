import { Check, CreditCard, X, Zap, Crown, Sparkles } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { JsonLd } from "@/components/json-ld";

const PLANS = [
  {
    id: "free",
    name: "Free",
    icon: Zap,
    price: "$0",
    period: "forever",
    description: "Full racing data access for casual punters and form checkers.",
    features: [
      "All race data points",
      "Today's race cards (all AU tracks)",
      "Full form and results",
      "GPS tracking data",
      "Dog & track search",
      "Watchlists/basic research",
      "Browse public marketplace listings",
      "Save marketplace listings",
    ],
    notIncluded: [
      "No marketplace listing creation",
      "No messaging trainers/sellers",
      "No custom trainer, punter, business, or dog marketing pages",
      "No automated winner cards",
    ],
    cta: "Start Free",
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    icon: Sparkles,
    price: "$20",
    period: "/month or $204/year",
    description: "For marketplace sellers, trainers, and serious racing users.",
    features: [
      "Everything in Free",
      "Message trainers and sellers about listings",
      "Create marketplace listings",
      "Custom trainer page",
      "Custom punter page",
      "Custom business page",
      "Custom dog marketing pages",
      "Automatic greyhound winner cards when your dog wins",
      "Easy card-to-marketplace listing flow",
      "Community feed posting",
      "Community chat",
      "Professional profile tools",
    ],
    notIncluded: [],
    cta: "Go Pro",
    highlighted: true,
  },
  {
    id: "pro_plus",
    name: "Pro+",
    icon: Crown,
    price: "$39",
    period: "/month",
    description: "Coming soon. Not available for purchase yet.",
    features: [],
    notIncluded: [],
    cta: "Coming soon",
    highlighted: false,
  },
] as const;

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
  title: "GreyhoundIQ Plans & Pricing — Free + Pro from $20 AUD/mo",
  description:
    "Compare GreyhoundIQ Free vs Pro. Full AU greyhound racing form, marketplace tools, and breeding analytics. AUD pricing, no ads, cancel anytime.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "GreyhoundIQ Plans & Pricing — Free + Pro from $20 AUD/mo",
    description:
      "Compare GreyhoundIQ Free vs Pro. Full AU greyhound racing form, marketplace tools, and breeding analytics. AUD pricing, no ads, cancel anytime.",
    url: "/pricing",
    type: "website",
  },
};

const SITE_URL = "https://greyhoundsiq.com.au";

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#app`,
  name: "GreyhoundIQ",
  applicationCategory: "SportsApplication",
  operatingSystem: "Web, iOS, Android",
  url: SITE_URL,
  description:
    "Australian greyhound racing analytics. Real-time race cards, AI predictions, breeding analytics, marketplace tools, and community.",
  publisher: { "@id": `${SITE_URL}/#organization` },
  offers: [
    {
      "@type": "Offer",
      name: "GreyhoundIQ Free",
      price: "0",
      priceCurrency: "AUD",
      url: `${SITE_URL}/pricing`,
      availability: "https://schema.org/InStock",
    },
    {
      "@type": "Offer",
      name: "GreyhoundIQ Pro (Monthly)",
      price: "20",
      priceCurrency: "AUD",
      url: `${SITE_URL}/pricing`,
      availability: "https://schema.org/InStock",
    },
    {
      "@type": "Offer",
      name: "GreyhoundIQ Pro (Annual)",
      price: "204",
      priceCurrency: "AUD",
      url: `${SITE_URL}/pricing`,
      availability: "https://schema.org/InStock",
    },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function PricingPage() {
  return (
    <div>
      <JsonLd data={[softwareApplicationSchema, faqSchema]} />
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

                {plan.id === "free" ? (
                  <a
                    href="/sign-in?plan=free"
                    className="giq-button giq-button-carbon mb-5 w-full text-center text-[13px] font-semibold"
                  >
                    {plan.cta}
                  </a>
                ) : plan.id === "pro_plus" ? (
                  <button
                    className="giq-button giq-button-carbon mb-5 w-full cursor-not-allowed text-center text-[13px] font-semibold opacity-60"
                    disabled
                    type="button"
                  >
                    {plan.cta}
                  </button>
                ) : (
                  <div className="mb-5 grid gap-2">
                    <CheckoutButton
                      interval="monthly"
                      plan={plan.id}
                      primary={plan.highlighted}
                      tone="carbon"
                    >
                      {plan.cta}
                    </CheckoutButton>
                    <CheckoutButton
                      interval="yearly"
                      plan={plan.id}
                      primary={false}
                      tone="carbon"
                    >
                      Pay yearly
                    </CheckoutButton>
                  </div>
                )}

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
            GreyhoundIQ Pro yearly:{" "}
            <span className="font-semibold text-[hsl(var(--primary-bright))]">$204 AUD/year</span>. That&apos;s 15% off monthly pricing.
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
          <a
            href="/sign-in?plan=free"
            className="giq-liquid-purple-button px-6 text-[14px] font-semibold"
          >
            Create free account
          </a>
        </div>
      </section>
    </div>
  );
}

function CheckoutButton({
  children,
  interval,
  plan,
  primary,
  tone,
}: {
  children: string;
  interval: "monthly" | "yearly";
  plan: "pro";
  primary: boolean;
  tone: "carbon" | "gold";
}) {
  const className = primary
    ? "giq-liquid-purple-button w-full text-center text-[13px] font-semibold"
    : `giq-button ${tone === "gold" ? "giq-button-gold" : "giq-button-carbon"} w-full text-center text-[13px] font-semibold`;

  return (
    <form action="/api/billing/checkout" method="post">
      <input name="plan" type="hidden" value={plan} />
      <input name="interval" type="hidden" value={interval} />
      <button className={className} type="submit">
        {children}
      </button>
    </form>
  );
}
