import {
  BadgeDollarSign,
  CircleDashed,
  CreditCard,
  Fingerprint,
  Gauge,
  Layers3,
  Megaphone,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  ADVERTISING_ADMIN_CONTROLS,
  ADVERTISING_CAMPAIGN_STATES,
  ADVERTISING_CREATIVE_RULES,
  ADVERTISING_GLOBAL_DELIVERY_RULES,
  ADVERTISING_PAYMENT_CONTRACT,
  ADVERTISING_PLACEMENTS,
  ADVERTISING_PRIVACY_RULES,
  ADVERTISING_PRODUCT_SUMMARY,
  ADVERTISING_RATE_CARD,
  ADVERTISING_USER_STORIES,
  MARKETPLACE_BOOST_PACKAGES,
  MARKETPLACE_BOOST_RULES,
  formatAud,
  quoteAdvertisingCampaign,
} from "./advertising-product-contract";

const PLACEMENT_PRICE_EXAMPLES = ADVERTISING_PLACEMENTS.map((placement) => ({
  ...placement,
  minimumPriceCents: quoteAdvertisingCampaign({
    placementId: placement.id,
    viewableImpressions: placement.minimumViewableImpressions,
  }).totalCentsIncludingGst,
}));

export function DesignLabAdvertisingConsole() {
  return (
    <section
      className="giq-panel mt-5 min-w-0 max-w-full overflow-hidden"
      aria-labelledby="design-lab-advertising-heading"
      data-design-lab-advertising-console
    >
      <div className="border-b border-white/[0.08] p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-4xl">
            <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[hsl(var(--secondary-light))]">
              <Megaphone className="size-4" aria-hidden="true" />
              Advertising and seller growth control plane
            </p>
            <h2
              id="design-lab-advertising-heading"
              className="mt-2 text-2xl font-semibold tracking-[-0.025em]"
            >
              Premium Feed inventory, self-service campaigns and Marketplace
              boosts
            </h2>
            <p className="mt-2 max-w-3xl text-[12px] leading-6 text-[hsl(var(--muted-foreground))]">
              This is the production contract and provisional launch rate
              card—not a live sales promise. Prices, rules and inventory remain
              disabled until schema, authorization, payment, delivery,
              compliance and staging gates pass.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric
              label="Ad placements"
              value={ADVERTISING_PRODUCT_SUMMARY.placements}
            />
            <Metric
              label="Boost packages"
              value={ADVERTISING_PRODUCT_SUMMARY.boostPackages}
            />
            <Metric
              label="User stories"
              value={ADVERTISING_PRODUCT_SUMMARY.userStories}
            />
            <Metric
              label="Scenarios"
              value={ADVERTISING_PRODUCT_SUMMARY.acceptanceScenarios}
            />
          </dl>
        </div>
      </div>

      <div className="grid min-w-0 max-w-full gap-5 p-4 sm:p-6">
        <section aria-labelledby="advertising-pricing-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[hsl(var(--primary-light))]">
                Provisional public pricing · AUD · GST included
              </p>
              <h3
                id="advertising-pricing-heading"
                className="mt-1 text-lg font-semibold"
              >
                Prepaid viewable delivery with a hard spend cap
              </h3>
            </div>
            <span className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-amber-100">
              {ADVERTISING_RATE_CARD.status.replaceAll("-", " ")} ·{" "}
              {ADVERTISING_RATE_CARD.version}
            </span>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {PLACEMENT_PRICE_EXAMPLES.map((placement) => (
              <article
                key={placement.id}
                className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"
                data-ad-placement={placement.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--primary)/0.16)] text-[hsl(var(--primary-light))]">
                    <BadgeDollarSign className="size-5" aria-hidden="true" />
                  </span>
                  <code className="text-[11px] text-[hsl(var(--subtle-foreground))]">
                    {placement.id}
                  </code>
                </div>
                <h4 className="mt-3 text-[14px] font-semibold">
                  {placement.name}
                </h4>
                <p className="mt-1 text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
                  {placement.inventory}
                </p>
                <p className="mt-3 text-2xl font-semibold text-[hsl(var(--secondary-light))]">
                  {formatAud(placement.baseViewableCpmCents)}
                  <small className="ml-1 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
                    viewable CPM
                  </small>
                </p>
                <p className="mt-1 text-[11px] text-[hsl(var(--subtle-foreground))]">
                  Minimum{" "}
                  {placement.minimumViewableImpressions.toLocaleString("en-AU")}{" "}
                  views · {formatAud(placement.minimumPriceCents)} incl GST
                </p>
              </article>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-[hsl(var(--primary-light)/0.2)] bg-[hsl(var(--primary)/0.07)] p-4">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[hsl(var(--primary-light))]">
              <Gauge className="size-4" aria-hidden="true" />
              Server-side quote formula
            </p>
            <code className="mt-2 block overflow-x-auto text-[11px] leading-5 text-[hsl(var(--foreground))]">
              max(minimum inventory, booked viewable impressions) × placement
              vCPM × targeting factor × peak factor − bounded volume discount
            </code>
            <p className="mt-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">
              Integer cents and basis points only. Every factor is stored in the
              immutable order snapshot; the browser cannot supply price,
              currency, multiplier or payment state.
            </p>
          </div>
        </section>

        <section
          className="min-w-0 max-w-full"
          aria-labelledby="advertising-spec-heading"
        >
          <h3 id="advertising-spec-heading" className="text-lg font-semibold">
            Placement, creative and frequency contract
          </h3>
          <div
            className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3"
            aria-label="Advertising placement specifications"
            data-ad-placement-specifications
          >
            {ADVERTISING_PLACEMENTS.map((placement) => (
              <article
                key={placement.id}
                className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"
                data-ad-placement-spec={placement.id}
              >
                <h4 className="text-[13px] font-semibold text-[hsl(var(--foreground))]">
                  {placement.name}
                </h4>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <PlacementFact label="Desktop" value={placement.desktop} />
                  <PlacementFact label="Mobile" value={placement.mobile} />
                  <PlacementFact
                    label="Organic gap"
                    value={`${placement.minimumOrganicGap} entries`}
                  />
                  <PlacementFact
                    label="Session cap"
                    value={String(placement.maximumPerSession)}
                  />
                  <PlacementFact
                    label="Campaign / day"
                    value={String(placement.sameCampaignPerPersonPerDay)}
                  />
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="marketplace-boost-heading">
          <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-[hsl(var(--secondary-light))]">
            <Store className="size-4" aria-hidden="true" />
            Five-card premium Marketplace carousel
          </p>
          <h3
            id="marketplace-boost-heading"
            className="mt-1 text-lg font-semibold"
          >
            Affordable seller boosts with equal rotation—not auction ranking
          </h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {MARKETPLACE_BOOST_PACKAGES.map((boost) => (
              <article
                key={boost.id}
                className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"
              >
                <code className="text-[11px] text-[hsl(var(--primary-light))]">
                  {boost.id}
                </code>
                <h4 className="mt-2 text-[14px] font-semibold">{boost.name}</h4>
                <p className="mt-2 text-2xl font-semibold text-[hsl(var(--secondary-light))]">
                  {formatAud(boost.priceCentsIncludingGst)}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">
                  {boost.viewableImpressions.toLocaleString("en-AU")} viewable
                  card impressions · up to {boost.maximumDays} days · incl GST
                </p>
              </article>
            ))}
          </div>
          <ChecklistGrid items={MARKETPLACE_BOOST_RULES} columns={2} />
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <ContractList
            icon={<Layers3 className="size-4" aria-hidden="true" />}
            title="Global delivery and load rules"
            items={ADVERTISING_GLOBAL_DELIVERY_RULES}
          />
          <ContractList
            icon={<Fingerprint className="size-4" aria-hidden="true" />}
            title="Privacy and data controls"
            items={ADVERTISING_PRIVACY_RULES}
          />
          <ContractList
            icon={<ShieldCheck className="size-4" aria-hidden="true" />}
            title="Advertiser and creative rules"
            items={ADVERTISING_CREATIVE_RULES}
          />
          <ContractList
            icon={<CreditCard className="size-4" aria-hidden="true" />}
            title="Approval and payment boundary"
            items={ADVERTISING_PAYMENT_CONTRACT}
          />
          <ContractList
            icon={<Users className="size-4" aria-hidden="true" />}
            title="Administrator control plane"
            items={ADVERTISING_ADMIN_CONTROLS}
          />
          <ContractList
            icon={<Gauge className="size-4" aria-hidden="true" />}
            title="Campaign lifecycle"
            items={ADVERTISING_CAMPAIGN_STATES.map((state) =>
              state.replaceAll("-", " "),
            )}
          />
        </div>

        <section aria-labelledby="advertising-stories-heading">
          <h3
            id="advertising-stories-heading"
            className="text-lg font-semibold"
          >
            Advertising and boost user stories
          </h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {ADVERTISING_USER_STORIES.map((story) => (
              <details
                key={story.id}
                className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"
              >
                <summary className="cursor-pointer">
                  <code className="text-[11px] text-[hsl(var(--primary-light))]">
                    {story.id}
                  </code>
                  <span className="mt-2 block text-[13px] font-semibold">
                    {story.actor}
                  </span>
                  <span className="mt-1 block text-[12px] leading-5 text-[hsl(var(--muted-foreground))]">
                    {story.outcome}
                  </span>
                </summary>
                <ol className="mt-3 grid gap-3">
                  {story.acceptance.map((scenario, index) => (
                    <li
                      key={scenario.given}
                      className="rounded-lg border border-white/[0.07] bg-black/10 p-3 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]"
                    >
                      <b className="text-[hsl(var(--foreground))]">
                        Scenario {index + 1}
                      </b>
                      <span className="mt-1 block">Given {scenario.given}</span>
                      <span className="block">When {scenario.when}</span>
                      <span className="block">Then {scenario.then}</span>
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-24 rounded-xl border border-white/[0.09] bg-white/[0.035] p-3 text-center">
      <dt className="text-[11px] font-black uppercase tracking-[0.11em] text-[hsl(var(--muted-foreground))]">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold">{value}</dd>
    </div>
  );
}

function PlacementFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-black uppercase tracking-[0.08em] text-[hsl(var(--subtle-foreground))]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-[11px] leading-5 text-[hsl(var(--muted-foreground))]">
        {value}
      </dd>
    </div>
  );
}

function ChecklistGrid({
  items,
  columns = 1,
}: {
  items: readonly string[];
  columns?: 1 | 2;
}) {
  return (
    <ul className={`mt-3 grid gap-2 ${columns === 2 ? "md:grid-cols-2" : ""}`}>
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-2 text-[11px] leading-5 text-[hsl(var(--muted-foreground))]"
          data-contract-status="proposed"
        >
          <CircleDashed
            className="mt-0.5 size-3.5 shrink-0 text-amber-200/70"
            aria-hidden="true"
          />
          <span>
            <span className="sr-only">Proposed rule: </span>
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ContractList({
  icon,
  title,
  items,
}: {
  icon: ReactNode;
  title: string;
  items: readonly string[];
}) {
  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
      <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.1em] text-[hsl(var(--secondary-light))]">
        {icon}
        {title}
      </h3>
      <ChecklistGrid items={items} />
    </section>
  );
}
