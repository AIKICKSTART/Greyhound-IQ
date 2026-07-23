import Link from "next/link";
import {
  BadgeCheck,
  CreditCard,
  Megaphone,
  ShieldCheck,
  Store,
} from "lucide-react";

import {
  ADVERTISING_CREATIVE_RULES,
  ADVERTISING_GLOBAL_DELIVERY_RULES,
  ADVERTISING_PLACEMENTS,
  ADVERTISING_RATE_CARD,
  MARKETPLACE_BOOST_PACKAGES,
  formatAud,
  quoteAdvertisingCampaign,
} from "@/components/advertising-product-contract";
import { PageTitle } from "@/components/page-title";

export const metadata = {
  title: "Advertise on GreyhoundIQ — Feed placements & Marketplace boosts",
  description:
    "Premium, clearly-labelled advertising for Australia's greyhound community. Viewable-impression Feed placements and affordable Marketplace boosts. AUD, GST included.",
  alternates: { canonical: "/advertise" },
  openGraph: {
    title: "Advertise on GreyhoundIQ",
    description:
      "Viewable-impression Feed placements and Marketplace boosts. AUD, GST included, no pay-to-win ranking.",
    url: "/advertise",
    type: "website",
  },
};

const PLACEMENTS = ADVERTISING_PLACEMENTS.map((placement) => ({
  ...placement,
  minimumSpendCents: quoteAdvertisingCampaign({
    placementId: placement.id,
    viewableImpressions: placement.minimumViewableImpressions,
  }).totalCentsIncludingGst,
}));

export default function AdvertisePage() {
  return (
    <div>
      <section className="giq-page-hero relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,hsl(var(--primary-bright)/0.12),transparent_36%),radial-gradient(circle_at_16%_92%,hsl(var(--secondary)/0.06),transparent_30%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(270_24%_3%)_100%)]"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="giq-badge giq-badge-purple mb-5">
            <Megaphone className="h-3 w-3 text-[hsl(var(--primary-bright))]" />
            <span>ADVERTISE</span>
          </div>
          <PageTitle>
            Reach Australia&apos;s greyhound community —{" "}
            <span className="gradient-text">without the ad clutter.</span>
          </PageTitle>
          <p className="mt-4 max-w-2xl text-base leading-[1.55] text-[hsl(var(--muted-foreground))] md:text-lg">
            Scarce, clearly-labelled placements billed on real viewable
            impressions. Prepaid, hard-capped spend, equal rotation for seller
            boosts, and no pay-to-win ranking. Prices are in AUD and include GST.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="giq-liquid-purple-button px-6 text-[14px] font-semibold"
            >
              Book a campaign
            </Link>
            <Link
              href="/advertise/policy"
              className="giq-button giq-button-carbon px-6 text-[14px] font-semibold"
            >
              Advertising policy
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[hsl(var(--primary-light))]">
              Feed placements · AUD · GST included
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
              Viewable-impression rate card
            </h2>
          </div>
          <span className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--muted-foreground))]">
            {ADVERTISING_RATE_CARD.version}
          </span>
        </div>
        <p className="mt-3 max-w-3xl text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
          A viewable impression means at least 50% of the placement was visible
          for one continuous second. Campaigns are contact-to-book in this first
          release — the server prices every campaign from an immutable quote, so
          amounts are never set in the browser.
        </p>

        <div className="mt-5 overflow-x-auto rounded-xl border border-white/[0.08]">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/[0.08] text-[11px] font-black uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
                <th className="p-3">Placement</th>
                <th className="p-3">Sizes</th>
                <th className="p-3">Viewable CPM</th>
                <th className="p-3">Minimum campaign</th>
                <th className="p-3">Frequency guardrails</th>
              </tr>
            </thead>
            <tbody>
              {PLACEMENTS.map((placement) => (
                <tr
                  key={placement.id}
                  className="border-b border-white/[0.05] align-top"
                  data-ad-placement={placement.id}
                >
                  <td className="p-3">
                    <span className="block text-[14px] font-semibold text-[hsl(var(--foreground))]">
                      {placement.name}
                    </span>
                    <span className="mt-1 block max-w-xs text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
                      {placement.inventory}
                    </span>
                  </td>
                  <td className="p-3 text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
                    <span className="block">Desktop {placement.desktop}</span>
                    <span className="block">Mobile {placement.mobile}</span>
                  </td>
                  <td className="p-3">
                    <span className="text-[16px] font-semibold text-[hsl(var(--secondary-light))]">
                      {formatAud(placement.baseViewableCpmCents)}
                    </span>
                    <span className="mt-1 block text-[11px] text-[hsl(var(--subtle-foreground))]">
                      per 1,000 viewable
                    </span>
                  </td>
                  <td className="p-3 text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
                    <span className="block">
                      {placement.minimumViewableImpressions.toLocaleString(
                        "en-AU",
                      )}{" "}
                      viewable
                    </span>
                    <span className="block font-semibold text-[hsl(var(--foreground))]">
                      from {formatAud(placement.minimumSpendCents)} incl GST
                    </span>
                  </td>
                  <td className="p-3 text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
                    <span className="block">
                      After {placement.minimumOrganicGap} organic entries
                    </span>
                    <span className="block">
                      Max {placement.maximumPerSession}/session ·{" "}
                      {placement.sameCampaignPerPersonPerDay}/person/day
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-[hsl(var(--secondary-light))]">
          <Store className="size-4" aria-hidden="true" />
          Marketplace boosts · self-serve
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
          Boost your own listing into the premium carousel
        </h2>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[hsl(var(--muted-foreground))]">
          Prepaid, hard-capped viewable impressions with equal rotation across
          eligible sellers — payment never buys a fixed card order. Boost an
          active, approved listing from your account. Pro membership required.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {MARKETPLACE_BOOST_PACKAGES.map((boost) => (
            <article
              key={boost.id}
              className="flex flex-col rounded-xl border border-white/[0.08] bg-white/[0.025] p-5"
              data-boost-package={boost.id}
            >
              <code className="text-[11px] text-[hsl(var(--primary-light))]">
                {boost.id}
              </code>
              <h3 className="mt-2 text-[15px] font-semibold">{boost.name}</h3>
              <p className="mt-3 text-2xl font-semibold text-[hsl(var(--secondary-light))]">
                {formatAud(boost.priceCentsIncludingGst)}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
                {boost.viewableImpressions.toLocaleString("en-AU")} viewable card
                impressions · up to {boost.maximumDays} days · incl GST
              </p>
              <Link
                href="/account/listings"
                className="giq-button giq-button-carbon mt-5 w-full text-center text-[13px] font-semibold"
              >
                Boost a listing
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-5">
            <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.1em] text-[hsl(var(--secondary-light))]">
              <BadgeCheck className="size-4" aria-hidden="true" />
              Creative rules
            </h2>
            <ul className="mt-3 grid gap-2">
              {ADVERTISING_CREATIVE_RULES.map((rule) => (
                <li
                  key={rule}
                  className="text-[12px] leading-5 text-[hsl(var(--muted-foreground))]"
                >
                  {rule}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-5">
            <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.1em] text-[hsl(var(--secondary-light))]">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Delivery protections
            </h2>
            <ul className="mt-3 grid gap-2">
              {ADVERTISING_GLOBAL_DELIVERY_RULES.map((rule) => (
                <li
                  key={rule}
                  className="text-[12px] leading-5 text-[hsl(var(--muted-foreground))]"
                >
                  {rule}
                </li>
              ))}
            </ul>
            <Link
              href="/advertise/policy"
              className="giq-outline-action mt-4 w-fit"
            >
              Read the full advertising policy
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-20 text-center">
        <div className="giq-final-cta p-10">
          <CreditCard
            className="mx-auto mb-3 size-6 text-[hsl(var(--primary-bright))]"
            aria-hidden="true"
          />
          <h2 className="mb-3 text-2xl font-semibold tracking-[-0.03em] text-[hsl(var(--foreground))]">
            Book a campaign
          </h2>
          <p className="mb-6 text-[15px] text-[hsl(var(--muted-foreground))]">
            CPM Feed campaigns are booked with our team in this first release.
            Tell us your goals and we&apos;ll return an itemised, GST-inclusive
            quote.
          </p>
          <Link
            href="/contact"
            className="giq-liquid-purple-button px-6 text-[14px] font-semibold"
          >
            Contact the advertising team
          </Link>
        </div>
      </section>
    </div>
  );
}
