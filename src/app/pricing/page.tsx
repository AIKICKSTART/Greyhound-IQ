import { Check, CreditCard, X, Zap, Crown, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { JsonLd } from "@/components/json-ld";
import { RateLimitRecoveryCard } from "@/components/rate-limit-recovery-card";
import { BILLING_RATE_LIMIT_RECOVERY_SECONDS } from "@/lib/rate-limit-recovery";
import { getPricingContent, type PricingPlanId } from "@/lib/site-content";

export const dynamic = "force-dynamic";

// Icons are code (not editable content), mapped by plan id.
const PLAN_ICONS: Record<PricingPlanId, LucideIcon> = {
  free: Zap,
  pro: Sparkles,
  pro_plus: Crown,
};

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

type PricingPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const { plans, yearlyNote } = await getPricingContent();
  const query = await searchParams;
  return (
    <div>
      <JsonLd data={[softwareApplicationSchema, faqSchema]} />
      <PageHero
        image="/images/feature-pricing-product.webp"
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
        subtitle="Straightforward AUD pricing for full racing form, marketplace tools, and breeding analytics. No ads. Cancel anytime."
      />

      <section id="plans" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-10">
        <PricingOutcomeBanner query={query} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const Icon = PLAN_ICONS[plan.id];
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
                      plan="pro"
                      primary={plan.highlighted}
                      tone="carbon"
                    >
                      {plan.cta}
                    </CheckoutButton>
                    <CheckoutButton
                      interval="yearly"
                      plan="pro"
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
            {yearlyNote}
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

function PricingOutcomeBanner({
  query,
}: {
  query: { [key: string]: string | string[] | undefined };
}) {
  const checkout = singleQueryValue(query.checkout);
  const billing = singleQueryValue(query.billing);
  const interval =
    query.interval === "monthly" || query.interval === "yearly"
      ? query.interval
      : null;
  const canRetry = query.plan === "pro" && interval;

  if (checkout === "success") {
    return (
      <div
        aria-live="polite"
        className="mb-6 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.08] p-4"
      >
        <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
          Returned from Stripe Checkout
        </p>
        <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
          We are verifying the signed Stripe webhook. Your tier only changes
          after that trusted confirmation; review billing for the latest status.
        </p>
        <a href="/account/billing" className="giq-outline-action mt-3 w-fit">
          Review billing
        </a>
      </div>
    );
  }

  if (checkout === "failed") {
    return (
      <div
        role="alert"
        className="mb-6 rounded-xl border border-rose-400/30 bg-rose-400/[0.08] p-4"
      >
        <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
          Secure checkout could not be opened
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          No payment was taken and your current plan is unchanged. You can
          retry the same option now or choose another plan below.
        </p>
        {canRetry ? (
          <div className="mt-3 max-w-xs">
            <CheckoutButton
              interval={interval}
              plan="pro"
              primary={false}
              tone="carbon"
            >
              {`Retry Pro ${interval}`}
            </CheckoutButton>
          </div>
        ) : (
          <a href="#plans" className="giq-outline-action mt-3 w-fit">
            Choose a plan
          </a>
        )}
      </div>
    );
  }

  if (checkout === "rate-limited") {
    return (
      <div className="mb-6">
        <RateLimitRecoveryCard
          title="Checkout paused briefly"
          detail="We limited repeated checkout attempts to protect your account and payment flow. No payment was taken and your current plan is unchanged."
          retryAfterSeconds={BILLING_RATE_LIMIT_RECOVERY_SECONDS}
          action={
            canRetry ? (
              <div className="max-w-xs">
                <CheckoutButton
                  interval={interval}
                  plan="pro"
                  primary={false}
                  tone="carbon"
                >
                  {`Retry Pro ${interval}`}
                </CheckoutButton>
              </div>
            ) : (
              <a href="#plans" className="giq-outline-action w-fit">
                Choose a plan
              </a>
            )
          }
        />
      </div>
    );
  }

  if (checkout === "cancelled") {
    return (
      <div
        aria-live="polite"
        className="mb-6 rounded-xl border border-amber-300/30 bg-amber-300/[0.08] p-4"
      >
        <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
          Checkout cancelled — no plan change was made
        </p>
        <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
          Your current tier is unchanged. You can safely retry the same billing
          option or choose another plan below.
        </p>
        {canRetry ? (
          <div className="mt-3 max-w-xs">
            <CheckoutButton
              interval={interval}
              plan="pro"
              primary={false}
              tone="carbon"
            >
              {`Retry Pro ${interval}`}
            </CheckoutButton>
          </div>
        ) : (
          <a href="#plans" className="giq-outline-action mt-3 w-fit">
            Choose a plan
          </a>
        )}
      </div>
    );
  }

  if (billing === "not_started") {
    return (
      <div
        aria-live="polite"
        className="mb-6 rounded-xl border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.08)] p-4"
      >
        <p className="text-[14px] font-semibold text-[hsl(var(--foreground))]">
          No Stripe billing profile yet
        </p>
        <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
          Nothing needs managing until you start a paid plan. Choose monthly or
          yearly Pro below to open secure Stripe Checkout.
        </p>
      </div>
    );
  }

  return null;
}

function singleQueryValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
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
