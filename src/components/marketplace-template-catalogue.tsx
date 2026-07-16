import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bookmark,
  CheckCircle2,
  Database,
  Eye,
  Gauge,
  MessageCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TableProperties,
  TrendingUp,
  Users,
} from "lucide-react";

import { MarketplaceDogPlayerCard } from "./marketplace-dog-player-card";
import {
  MARKETPLACE_TEMPLATE_LISTINGS,
  type MarketplaceTemplateListing,
} from "./marketplace-template-data";
import {
  MARKETPLACE_TEMPLATE_OPTIONS,
  type MarketplaceTemplateKey,
} from "./marketplace-template-variants";
import styles from "./marketplace-template-catalogue.module.css";

const totalStarts = MARKETPLACE_TEMPLATE_LISTINGS.reduce(
  (total, listing) => total + (listing.starts ?? 0),
  0
);
const totalWins = MARKETPLACE_TEMPLATE_LISTINGS.reduce(
  (total, listing) => total + (listing.wins ?? 0),
  0
);

export function MarketplaceTemplateCatalogue({
  selected,
}: {
  selected: MarketplaceTemplateKey;
}) {
  const activeOption =
    MARKETPLACE_TEMPLATE_OPTIONS.find((option) => option.key === selected) ??
    MARKETPLACE_TEMPLATE_OPTIONS[0];

  return (
    <div className={styles.catalogue}>
      <header className={styles.reviewHeader}>
        <div className={styles.reviewHeaderCopy}>
          <p className={styles.reviewLabel}>Marketplace Design Lab</p>
          <h1>M1–M6 page-template catalogue</h1>
          <p>
            Six structural directions using one public-profile dataset and the
            existing interactive Marketplace player-card contract.
          </p>
        </div>
        <div className={styles.reviewStatus} role="note">
          <ShieldCheck aria-hidden="true" />
          <span>
            Review-only surface<br />
            No persistence or seller billing
          </span>
        </div>
      </header>

      <nav className={styles.selector} aria-label="Marketplace page templates">
        {MARKETPLACE_TEMPLATE_OPTIONS.map((option) => {
          const active = option.key === selected;
          return (
            <Link
              key={option.key}
              href={`/marketplace/design-lab?template=${option.key}`}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={`${styles.selectorOption} ${
                active ? styles.selectorOptionActive : ""
              }`}
            >
              <strong>{option.key}</strong>
              <span>{option.label}</span>
              <small>{option.detail}</small>
            </Link>
          );
        })}
      </nav>

      <div className={styles.activeSummary} aria-live="polite">
        <span>{activeOption.key}</span>
        <strong>{activeOption.label}</strong>
        <small>{activeOption.detail}</small>
      </div>

      <TemplateRenderer selected={selected} />
    </div>
  );
}

function TemplateRenderer({ selected }: { selected: MarketplaceTemplateKey }) {
  switch (selected) {
    case "M2":
      return <M2CompactExchange />;
    case "M3":
      return <M3MarketControl />;
    case "M4":
      return <M4SellerCockpit />;
    case "M5":
      return <M5SocialBazaar />;
    case "M6":
      return <M6DataExchange />;
    case "M1":
    default:
      return <M1GrandstandMarket />;
  }
}

function M1GrandstandMarket() {
  const featured = MARKETPLACE_TEMPLATE_LISTINGS[0];
  const supporting = MARKETPLACE_TEMPLATE_LISTINGS.slice(1);

  return (
    <section
      data-marketplace-template="M1"
      data-layout-family="editorial-grandstand"
      className={`${styles.template} ${styles.grandstand}`}
      aria-labelledby="m1-title"
    >
      <div className={styles.grandstandHero}>
        <div className={styles.grandstandCopy}>
          <p className={styles.templateCode}>M1 / Grandstand Market</p>
          <h2 id="m1-title">The feature race, rebuilt for discovery.</h2>
          <p>
            Lead with one trusted public racing profile, then let the remaining
            collection read like a curated race-night programme.
          </p>
          <dl className={styles.inlineFacts}>
            <div>
              <dt>Collection</dt>
              <dd>{MARKETPLACE_TEMPLATE_LISTINGS.length} public profiles</dd>
            </div>
            <div>
              <dt>Featured record</dt>
              <dd>{featured.publicHighlight}</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>Private until enquiry</dd>
            </div>
          </dl>
          <Link href={featured.profileHref} className={styles.primaryAction}>
            Open public profile
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <DogCard listing={featured} className={styles.grandstandFeatureCard} />
      </div>

      <div className={styles.grandstandRail} aria-label="Supporting profiles">
        {supporting.map((listing, index) => (
          <ListingPortrait
            key={listing.listingId}
            listing={listing}
            priority={index < 2}
          />
        ))}
      </div>
    </section>
  );
}

function M2CompactExchange() {
  return (
    <section
      data-marketplace-template="M2"
      data-layout-family="dense-exchange"
      className={`${styles.template} ${styles.exchange}`}
      aria-labelledby="m2-title"
    >
      <TemplateHeading
        code="M2 / Compact Exchange"
        id="m2-title"
        title="Scan the field before opening a card."
        description="A dense list-first market for members who arrive ready to compare records, pedigree and price state."
      />

      <div className={styles.exchangeToolbar}>
        <span>
          <Search aria-hidden="true" /> Public-profile index
        </span>
        <span>
          <SlidersHorizontal aria-hidden="true" /> {totalStarts} recorded starts
        </span>
        <span>{MARKETPLACE_TEMPLATE_LISTINGS.length} profiles</span>
      </div>

      <div className={styles.exchangeGrid}>
        <div className={styles.exchangeTableWrap}>
          <table className={styles.exchangeTable}>
            <thead>
              <tr>
                <th>Greyhound</th>
                <th>Record</th>
                <th>Strike</th>
                <th>Pedigree</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {MARKETPLACE_TEMPLATE_LISTINGS.map((listing) => (
                <tr key={listing.listingId}>
                  <td>
                    <Link href={listing.profileHref}>{listing.name}</Link>
                    <small>{listing.colourSex}</small>
                  </td>
                  <td>
                    {listing.starts ?? "—"}:{listing.wins ?? "—"}
                  </td>
                  <td>{formatRate(listing)}</td>
                  <td>{listing.pedigree}</td>
                  <td>{listing.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className={styles.exchangeInspect} aria-label="Card inspection">
          <p className={styles.panelLabel}>Card inspection</p>
          <DogCard listing={MARKETPLACE_TEMPLATE_LISTINGS[1]} />
        </aside>
      </div>
    </section>
  );
}

function M3MarketControl() {
  const metrics = [
    {
      label: "Profiles",
      value: String(MARKETPLACE_TEMPLATE_LISTINGS.length),
      icon: Gauge,
    },
    { label: "Recorded starts", value: String(totalStarts), icon: Activity },
    { label: "Recorded wins", value: String(totalWins), icon: TrendingUp },
    { label: "Seller billing", value: "Not connected", icon: ShieldCheck },
  ] as const;

  return (
    <section
      data-marketplace-template="M3"
      data-layout-family="command-centre"
      className={`${styles.template} ${styles.control}`}
      aria-labelledby="m3-title"
    >
      <TemplateHeading
        code="M3 / Market Control"
        id="m3-title"
        title="A command view for catalogue health."
        description="Operations signals lead; player cards become the visual evidence behind the numbers."
      />

      <div className={styles.controlMetrics}>
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className={styles.controlGrid}>
        <div className={styles.controlCards}>
          {MARKETPLACE_TEMPLATE_LISTINGS.slice(2, 4).map((listing) => (
            <DogCard key={listing.listingId} listing={listing} />
          ))}
        </div>
        <aside className={styles.controlRail}>
          <p className={styles.panelLabel}>Public record monitor</p>
          {MARKETPLACE_TEMPLATE_LISTINGS.map((listing) => (
            <div key={listing.listingId} className={styles.monitorRow}>
              <span aria-hidden="true" />
              <div>
                <strong>{listing.name}</strong>
                <small>{listing.publicHighlight}</small>
              </div>
              <b>{formatRate(listing)}</b>
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}

function M4SellerCockpit() {
  const focus = MARKETPLACE_TEMPLATE_LISTINGS[3];

  return (
    <section
      data-marketplace-template="M4"
      data-layout-family="seller-workbench"
      className={`${styles.template} ${styles.seller}`}
      aria-labelledby="m4-title"
    >
      <TemplateHeading
        code="M4 / Seller Cockpit"
        id="m4-title"
        title="Prepare a listing without pretending it is live."
        description="A read-only workbench that frames public records, artwork and enquiry expectations before production persistence exists."
      />

      <div className={styles.sellerGrid}>
        <aside className={styles.sellerNav} aria-label="Seller preview stages">
          <p className={styles.panelLabel}>Preview stages</p>
          {[
            ["01", "Public profile linked", true],
            ["02", "Card artwork reviewed", true],
            ["03", "Listing copy preview", true],
            ["04", "Seller identity", false],
            ["05", "Billing and publish", false],
          ].map(([step, label, complete]) => (
            <div key={String(step)} data-complete={String(complete)}>
              <span>{step}</span>
              <strong>{label}</strong>
              {complete ? <CheckCircle2 aria-hidden="true" /> : null}
            </div>
          ))}
        </aside>

        <div className={styles.sellerWorkbench}>
          <div className={styles.sellerWorkbenchHeader}>
            <div>
              <p className={styles.panelLabel}>Artwork workbench</p>
              <h3>{focus.name}</h3>
            </div>
            <span>Local preview</span>
          </div>
          <div className={styles.sellerCards}>
            <DogCard listing={focus} />
            <DogCard listing={MARKETPLACE_TEMPLATE_LISTINGS[4]} />
          </div>
        </div>

        <aside className={styles.sellerInspector}>
          <p className={styles.panelLabel}>Listing inspector</p>
          <dl>
            <InspectorRow label="Profile" value={focus.name} />
            <InspectorRow label="Career" value={`${focus.starts}:${focus.wins}`} />
            <InspectorRow label="Pedigree" value={focus.pedigree} />
            <InspectorRow label="Price state" value={focus.price} />
            <InspectorRow label="Enquiry" value="Pulse only" />
          </dl>
          <div className={styles.sellerGuardrail}>
            <ShieldCheck aria-hidden="true" />
            <p>
              No publish action, payment rail or seller contact detail is wired
              into this Design Lab surface.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function M5SocialBazaar() {
  const featured = MARKETPLACE_TEMPLATE_LISTINGS[4];

  return (
    <section
      data-marketplace-template="M5"
      data-layout-family="community-stream"
      className={`${styles.template} ${styles.social}`}
      aria-labelledby="m5-title"
    >
      <TemplateHeading
        code="M5 / Social Bazaar"
        id="m5-title"
        title="Discover through context, not anonymous listings."
        description="A community-shaped market that keeps public form central while moving private conversation into Pulse."
      />

      <div className={styles.socialGrid}>
        <aside className={styles.socialRail}>
          <p className={styles.panelLabel}>Browse circles</p>
          {[
            { icon: Users, label: "Public profiles", detail: "6 available" },
            {
              icon: Bookmark,
              label: "Saved locally",
              detail: "Review state only",
            },
            {
              icon: MessageCircle,
              label: "Private enquiries",
              detail: "Continue in Pulse",
            },
            {
              icon: Eye,
              label: "Transparent context",
              detail: "Public form first",
            },
          ].map(({ icon: Icon, label, detail }) => (
            <div key={String(label)}>
              <Icon aria-hidden="true" />
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
            </div>
          ))}
        </aside>

        <div className={styles.socialFeature}>
          <div className={styles.socialFeatureHeader}>
            <span className={styles.avatar} aria-hidden="true">
              GIQ
            </span>
            <div>
              <strong>Public profile spotlight</strong>
              <small>{featured.publicHighlight}</small>
            </div>
          </div>
          <DogCard listing={featured} />
          <div className={styles.socialActions}>
            <span>
              <Eye aria-hidden="true" /> Inspect public form
            </span>
            <span>
              <MessageCircle aria-hidden="true" /> Enquire in Pulse
            </span>
          </div>
        </div>

        <aside className={styles.socialSuggestions}>
          <p className={styles.panelLabel}>More public profiles</p>
          {MARKETPLACE_TEMPLATE_LISTINGS.slice(0, 4).map((listing, index) => (
            <ListingPortrait
              key={listing.listingId}
              listing={listing}
              priority={index < 2}
              compact
            />
          ))}
        </aside>
      </div>
    </section>
  );
}

function M6DataExchange() {
  return (
    <section
      data-marketplace-template="M6"
      data-layout-family="comparison-matrix"
      className={`${styles.template} ${styles.data}`}
      aria-labelledby="m6-title"
    >
      <TemplateHeading
        code="M6 / Data Exchange"
        id="m6-title"
        title="Let the public record do the selling."
        description="A comparison matrix for research-led members, paired with the same rich card for visual recognition."
      />

      <div className={styles.dataGrid}>
        <div className={styles.dataTableWrap}>
          <div className={styles.dataTableHeader}>
            <span>
              <Database aria-hidden="true" /> Public racing records
            </span>
            <span>
              <TableProperties aria-hidden="true" /> Snapshot catalogue
            </span>
          </div>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Starts</th>
                <th>Wins</th>
                <th>2nd</th>
                <th>3rd</th>
                <th>Strike</th>
                <th>Prize</th>
              </tr>
            </thead>
            <tbody>
              {MARKETPLACE_TEMPLATE_LISTINGS.map((listing) => (
                <tr key={listing.listingId}>
                  <td>
                    <Link href={listing.profileHref}>{listing.name}</Link>
                    <small>{listing.pedigree}</small>
                  </td>
                  <td>{formatNumber(listing.starts)}</td>
                  <td>{formatNumber(listing.wins)}</td>
                  <td>{formatNumber(listing.seconds)}</td>
                  <td>{formatNumber(listing.thirds)}</td>
                  <td>{formatRate(listing)}</td>
                  <td>{listing.prizeMoney}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className={styles.dataInspect}>
          <p className={styles.panelLabel}>Visual record</p>
          <DogCard listing={MARKETPLACE_TEMPLATE_LISTINGS[5]} />
          <div className={styles.dataConfidence}>
            <BarChart3 aria-hidden="true" />
            <span>
              <strong>Public-data boundary</strong>
              <small>Seller contact remains outside the card.</small>
            </span>
          </div>
        </aside>
      </div>
    </section>
  );
}

function TemplateHeading({
  code,
  id,
  title,
  description,
}: {
  code: string;
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div className={styles.templateHeading}>
      <div>
        <p className={styles.templateCode}>{code}</p>
        <h2 id={id}>{title}</h2>
      </div>
      <p>{description}</p>
    </div>
  );
}

function DogCard({
  listing,
  className = "",
}: {
  listing: MarketplaceTemplateListing;
  className?: string;
}) {
  return (
    <div
      data-template-player-card={listing.listingId}
      className={`${styles.cardMount} ${className}`}
    >
      <MarketplaceDogPlayerCard
        dog={listing}
        artwork={{ kind: "image", src: listing.artworkSrc }}
        saveMode="local"
      />
    </div>
  );
}

function ListingPortrait({
  listing,
  priority = false,
  compact = false,
}: {
  listing: MarketplaceTemplateListing;
  priority?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={listing.profileHref}
      className={`${styles.portrait} ${compact ? styles.portraitCompact : ""}`}
    >
      <span className={styles.portraitImage}>
        <Image
          src={listing.artworkSrc}
          alt={`${listing.name} Marketplace player card`}
          fill
          priority={priority}
          sizes={compact ? "160px" : "(min-width: 1100px) 18vw, 42vw"}
        />
      </span>
      <span className={styles.portraitCopy}>
        <strong>{listing.name}</strong>
        <small>{listing.publicHighlight}</small>
      </span>
    </Link>
  );
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatRate(listing: MarketplaceTemplateListing) {
  if (listing.strikeRate != null) return `${listing.strikeRate.toFixed(1)}%`;
  if (listing.starts && listing.wins != null) {
    return `${((listing.wins / listing.starts) * 100).toFixed(1)}%`;
  }
  return "—";
}

function formatNumber(value: number | null | undefined) {
  return value == null ? "—" : String(value);
}
