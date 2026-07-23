import Link from "next/link";

import {
  ADVERTISING_CREATIVE_RULES,
  ADVERTISING_GLOBAL_DELIVERY_RULES,
  ADVERTISING_PLACEMENTS,
  ADVERTISING_PRIVACY_RULES,
  ADVERTISING_RATE_CARD,
  MARKETPLACE_BOOST_RULES,
} from "@/components/advertising-product-contract";
import { PageTitle } from "@/components/page-title";

export const metadata = {
  title: "Advertising Policy — GreyhoundIQ",
  description:
    "How advertising works on GreyhoundIQ: viewability, creative rules, frequency and organic-gap protections, privacy, and refund/cancellation basics.",
  alternates: { canonical: "/advertise/policy" },
};

export default function AdvertisingPolicyPage() {
  return (
    <div className="giq-legal-page mx-auto max-w-3xl px-6 py-16">
      <PageTitle className="mb-2">Advertising Policy</PageTitle>
      <p className="mb-8 text-[13px] tracking-[-0.013em] text-[hsl(var(--subtle-foreground))]">
        Rate card {ADVERTISING_RATE_CARD.version} · prices in AUD, GST included.
      </p>

      <div className="giq-legal-body space-y-8 text-[15px] leading-relaxed tracking-[-0.011em] text-[hsl(var(--muted-foreground))]">
        <p>
          This policy restates the advertising product contract that governs
          paid placements and Marketplace boosts on GreyhoundIQ. It is not a
          substitute for our{" "}
          <Link
            href="/terms"
            className="text-[hsl(var(--primary-bright))] hover:underline"
          >
            Terms of Service
          </Link>{" "}
          or{" "}
          <Link
            href="/privacy"
            className="text-[hsl(var(--primary-bright))] hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>

        <section>
          <PolicyHeading>Viewability &amp; billing</PolicyHeading>
          <p>
            Advertising is billed on viewable impressions. {" "}
            {ADVERTISING_RATE_CARD.viewabilityRule} Public prices are quoted in{" "}
            {ADVERTISING_RATE_CARD.currency} and include GST. The server prices
            every campaign from an immutable quote that locks for{" "}
            {ADVERTISING_RATE_CARD.quoteLockMinutes} minutes; amounts, currency
            and multipliers are never accepted from the browser.
          </p>
        </section>

        <section>
          <PolicyHeading>Placement frequency &amp; organic gap</PolicyHeading>
          <p>
            Paid placements are scarce and anchored to the organic Feed. Each
            placement carries its own minimum organic gap and caps:
          </p>
          <ul className="mt-3 space-y-2">
            {ADVERTISING_PLACEMENTS.map((placement) => (
              <li key={placement.id} className="text-[14px]">
                <span className="font-semibold text-[hsl(var(--foreground))]">
                  {placement.name}
                </span>{" "}
                — shown only after {placement.minimumOrganicGap} organic
                entries, at most {placement.maximumPerSession} per session and{" "}
                {placement.sameCampaignPerPersonPerDay} of the same campaign per
                person per day.
              </li>
            ))}
          </ul>
          <PolicyList items={ADVERTISING_GLOBAL_DELIVERY_RULES} />
        </section>

        <section>
          <PolicyHeading>Creative rules</PolicyHeading>
          <p>
            Every paid unit carries an immutable Sponsored label, advertiser
            identity and member controls. Creative must meet these rules:
          </p>
          <PolicyList items={ADVERTISING_CREATIVE_RULES} />
        </section>

        <section>
          <PolicyHeading>Marketplace boosts</PolicyHeading>
          <PolicyList items={MARKETPLACE_BOOST_RULES} />
        </section>

        <section>
          <PolicyHeading>Privacy &amp; member controls</PolicyHeading>
          <PolicyList items={ADVERTISING_PRIVACY_RULES} />
        </section>

        <section>
          <PolicyHeading>Refunds &amp; cancellation</PolicyHeading>
          <p>
            Spend is prepaid and hard-capped. Undelivered viewable impressions
            at expiry receive an automatic make-good credit or pro-rata refund
            under this policy, and every refund or credit retains the original
            rate-card and tax breakdown. Unpaid reservations expire
            automatically and reserve no inventory. A browser redirect never
            activates or refunds inventory — only a signed, idempotent payment
            webhook changes payment state. To cancel a scheduled or live
            campaign, or to request a refund, contact us; delivered spend is
            never rewritten and any bounded refund is recorded explicitly.
          </p>
          <p className="mt-3">
            For billing help, refund requests or disputes, {" "}
            <Link
              href="/contact"
              className="text-[hsl(var(--primary-bright))] hover:underline"
            >
              contact the team
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

function PolicyHeading({ children }: { children: string }) {
  return (
    <h2 className="mb-3 mt-2 text-[20px] tracking-[-0.02em] text-[hsl(var(--foreground))]">
      {children}
    </h2>
  );
}

function PolicyList({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li key={item} className="text-[14px] leading-relaxed">
          {item}
        </li>
      ))}
    </ul>
  );
}
