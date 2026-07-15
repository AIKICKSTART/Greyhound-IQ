"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  Bookmark,
  Camera,
  ChevronLeft,
  ChevronRight,
  GalleryHorizontal,
  LayoutGrid,
  Heart,
  ImageIcon,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Pencil,
  ShoppingBag,
  Send,
  Search,
  Settings,
  Share2,
  Store,
  Truck,
  UserRound,
  Users,
  Video,
} from "lucide-react";

import { FeedHeaderPlannerPrototype } from "@/components/feed-header-planner-prototype";
import { ActorMediaImage } from "@/components/actor-media-image";
import {
  FeedAdvertiserConcept,
  FeedHousePromotion,
  getFeedAdvertiserConcepts,
} from "@/components/feed-house-promotion";
import type { DockSkinKey } from "@/components/dock-skin-catalogue";
import { InteractiveRacePlannerPrototype } from "@/components/interactive-race-planner-prototype";
import { InteractiveHelp } from "@/components/interactive-help";
import {
  DANIEL_DEMO_PROFILE_ALIGNMENT,
  DEMO_PROFILE_PORTRAITS,
} from "@/lib/demo-profile-media";
import {
  MarketplaceDogPlayerCard,
  type MarketplaceDogCardData,
} from "@/components/marketplace-dog-player-card";
import {
  PrototypeMemberDock,
  PrototypeMemberHeader,
} from "@/components/prototype-member-chrome";
import {
  PROTOTYPE_TEMPLATE_COMPOSITIONS,
  getPrototypePlannerDensity,
  getPrototypeSocialMode,
  type PrototypeVariant,
} from "@/components/prototype-variants";

const FRIENDS = [
  { name: "Sarah Thompson", detail: "Richmond · online", online: true, avatar: DEMO_PROFILE_PORTRAITS["Sarah Thompson"] },
  { name: "Mark Riley", detail: "Dapto · 4m", online: true, avatar: DEMO_PROFILE_PORTRAITS["Mark Riley"] },
  { name: "Lisa Grant", detail: "Wentworth Park · 18m", online: false, avatar: DEMO_PROFILE_PORTRAITS["Lisa Grant"] },
  { name: "James Cole", detail: "Trainer · 32m", online: false, avatar: DEMO_PROFILE_PORTRAITS["James Cole"] },
];

const SOCIAL_SIGNALS = [
  { label: "Friends trackside", value: "7", detail: "Richmond and Dapto", icon: Users },
  { label: "Active circles", value: "12", detail: "4 new discussions", icon: MessageCircle },
  { label: "Followed updates", value: "18", detail: "Since your last visit", icon: Bell },
] as const;

const ADDITIONAL_MEMBER_POSTS = [
  {
    postId: "trainer-recovery-update",
    avatar: DEMO_PROFILE_PORTRAITS["Ava Martinez"],
    name: "Ava Martinez",
    kind: "Trainer update",
    meta: "Trainer · The Gardens · 38 min",
    body: "Morning recovery checks are complete for Cedar Run. Hydration, weight and movement all stayed within his normal range, so today is an easy walk and stretch before the next trial.",
    image: "/images/feed/posts/trainer-recovery-update.webp",
    imageAlt: "A healthy greyhound standing with a trainer in a sunlit kennel recovery yard.",
    reactions: "29",
    comments: "6",
  },
  {
    postId: "owner-fiftieth-start",
    avatar: DEMO_PROFILE_PORTRAITS["Joel Nguyen"],
    name: "Joel Nguyen",
    kind: "Owner milestone",
    meta: "Owner · Dapto · 1 hr",
    body: "Luna Vale reached her 50th career start with the whole ownership group trackside. Whatever comes next, the best part has been sharing every early morning, road trip and race night with this team.",
    image: "/images/feed/posts/owner-fiftieth-start.webp",
    imageAlt: "A small ownership group sharing a quiet trackside milestone with their greyhound at twilight.",
    reactions: "46",
    comments: "12",
  },
  {
    postId: "evidence-sectional-review",
    avatar: DEMO_PROFILE_PORTRAITS["Priya Shah"],
    name: "Priya Shah",
    kind: "Form analysis",
    meta: "Form analyst · Albion Park · 2 hr",
    body: "I compared the first and final sectionals from the last five comparable-distance runs. The useful signal is consistency through the middle split; the sample is small, so I have kept the conclusion measured and linked the race notes in my workspace.",
    image: "/images/feed/posts/evidence-sectional-review.webp",
    imageAlt: "A racing analyst comparing abstract sectional charts, handwritten notes and race footage at a desk.",
    reactions: "21",
    comments: "9",
  },
  {
    postId: "trackside-weather-report",
    avatar: DEMO_PROFILE_PORTRAITS["Ben Callaghan"],
    name: "Ben Callaghan",
    kind: "Trackside report",
    meta: "Track correspondent · Sandown Park · 3 hr",
    body: "The breeze has eased and the surface crew has finished the final inspection. Gates are open, the kennel area is calm and tonight's trackside gallery is ready for members following from home.",
    image: "/images/feed/posts/trackside-weather-report.webp",
    imageAlt: "A freshly groomed Sandown-style greyhound track under clearing blue-hour clouds after inspection.",
    reactions: "34",
    comments: "7",
  },
  {
    postId: "breeding-family-discussion",
    avatar: DEMO_PROFILE_PORTRAITS["Mia Lawson"],
    name: "Mia Lawson",
    kind: "Breeding discussion",
    meta: "Breeder · Richmond · Yesterday",
    body: "Our breeding circle reviewed three generations of the maternal line today. The most valuable part was comparing temperament, soundness and recovery notes alongside the race record rather than treating one result as the whole story.",
    image: "/images/feed/posts/breeding-family-discussion.webp",
    imageAlt: "Breeders reviewing pedigree diagrams at a table while a retired greyhound rests nearby.",
    reactions: "38",
    comments: "16",
  },
  {
    postId: "marketplace-seller-handover",
    avatar: DEMO_PROFILE_PORTRAITS["Emma Reed"],
    name: "Emma Reed",
    kind: "Seller story",
    meta: "Verified seller · Newcastle · Yesterday",
    body: "A Marketplace enquiry turned into a thoughtful handover plan. The buyer reviewed the public profile, asked for the care history and met us in person before deciding. Clear records made the conversation easier for everyone.",
    image: "/images/feed/posts/marketplace-seller-handover.webp",
    imageAlt: "A buyer and seller reviewing care records with a calm greyhound in a shaded kennel yard.",
    reactions: "25",
    comments: "11",
  },
] as const;

const LEFT_NAV = [
  { href: "/feed", label: "Feed", icon: Bell },
  { href: "/pulse/friends", label: "Friends", icon: Users },
  { href: "/account/pages", label: "My pages", icon: UserRound },
  { href: "/pulse", label: "Chat", icon: MessageCircle },
  { href: "/account/saved-listings", label: "Saved", icon: Bookmark },
  { href: "/account", label: "Settings", icon: Settings },
];

const MARKET_DOGS = [
  {
    listingId: "row-beau-card",
    dogId: "cmr3q5n6l0049ju046o6e829f",
    name: "Row Beau",
    colourSex: "Black dog",
    starts: 10,
    wins: 3,
    seconds: 2,
    thirds: 2,
    strikeRate: 30,
    prizeMoney: "$15,565",
    pedigree: "Shima Shine × Kwong Magic",
    price: "POA",
    description: "Verified public racing card with Wentworth Park form and pedigree context.",
    listingLabel: "Marketplace",
    listingHref: "/marketplace?q=Row+Beau",
    profileHref: "/dogs/cmr3q5n6l0049ju046o6e829f",
    seller: {
      displayName: "Seller details on listing",
      verified: false,
      region: "Australia",
      responseTime: "Enquiries in Pulse",
    },
    artworkSrc: "/images/marketplace-cards/row-beau-obsidian-aurora.webp",
  },
  {
    listingId: "saanvi-card",
    dogId: "cmr0ktfrx01x1ep20p0y2j8nu",
    name: "Saanvi",
    colourSex: "Black bitch",
    starts: 74,
    wins: 22,
    seconds: 19,
    thirds: 3,
    strikeRate: 29.7,
    prizeMoney: "See profile",
    pedigree: "Superior Panama × Sherbini",
    price: "POA",
    description: "Golden Chase winner with public racing and pedigree context.",
    listingLabel: "Marketplace",
    listingHref: "/marketplace?category=dogs",
    profileHref: "/dogs/cmr0ktfrx01x1ep20p0y2j8nu",
    seller: {
      displayName: "Seller details on listing",
      verified: false,
      region: "Australia",
      responseTime: "Enquiries in Pulse",
    },
    artworkSrc: "/images/marketplace-cards/saanvi-golden-chase-crown.webp",
  },
  {
    listingId: "saahd-card",
    dogId: "cmr0m2myr05frepx490k4jzny",
    name: "Saahd",
    colourSex: "Black dog",
    starts: 70,
    wins: 16,
    seconds: null,
    thirds: null,
    strikeRate: 22.9,
    prizeMoney: "$45,000+",
    pedigree: "Public racing profile",
    price: "POA",
    description: "Experienced racer with 70 starts, 16 wins and public form context.",
    listingLabel: "Marketplace",
    listingHref: "/marketplace?category=dogs",
    profileHref: "/dogs/cmr0m2myr05frepx490k4jzny",
    seller: {
      displayName: "Seller details on listing",
      verified: false,
      region: "Australia",
      responseTime: "Enquiries in Pulse",
    },
    artworkSrc: "/images/marketplace-cards/saahd-heritage-chrome.webp",
  },
  {
    listingId: "aariellas-girl-card",
    dogId: "cmr0fqxt403c0epzs7bhmhr6m",
    name: "Aariella's Girl",
    colourSex: "Red fawn bitch",
    starts: 37,
    wins: 13,
    seconds: 3,
    thirds: 8,
    strikeRate: 35.1,
    prizeMoney: "$48,822",
    pedigree: "Feral Franky × Drink Moet",
    price: "POA",
    description: "Public racing record through 29 June 2026 with pedigree and connections.",
    listingLabel: "Marketplace",
    listingHref: "/marketplace?category=dogs",
    profileHref: "/dogs/cmr0fqxt403c0epzs7bhmhr6m",
    seller: {
      displayName: "Seller details on listing",
      verified: false,
      region: "Australia",
      responseTime: "Enquiries in Pulse",
    },
    artworkSrc: "/images/marketplace-cards/aariellas-girl-ruby-velocity.webp",
  },
  {
    listingId: "ohara-card",
    dogId: "cmr0lmivq02xaepmk8y7450p9",
    name: "O'hara",
    colourSex: "Racing bitch",
    starts: 75,
    wins: 12,
    seconds: 11,
    thirds: 14,
    strikeRate: 16,
    prizeMoney: "$25,990",
    pedigree: "Fabregas × Stunning Chloe",
    price: "POA",
    description: "Richmond Riches semi-finalist with public pedigree context.",
    listingLabel: "Marketplace",
    listingHref: "/marketplace?category=dogs",
    profileHref: "/dogs/cmr0lmivq02xaepmk8y7450p9",
    seller: {
      displayName: "Seller details on listing",
      verified: false,
      region: "Australia",
      responseTime: "Enquiries in Pulse",
    },
    artworkSrc: "/images/marketplace-cards/ohara-noir-art-deco.webp",
  },
  {
    listingId: "aaron-alpaca-card",
    dogId: "cmr0ltvp104coepykf9irul0r",
    name: "Aaron Alpaca",
    colourSex: "Black bitch",
    starts: 67,
    wins: 11,
    seconds: null,
    thirds: null,
    strikeRate: 16.4,
    prizeMoney: "$17,945",
    pedigree: "Dyna Villa × Cheekers",
    price: "POA",
    description: "Public career and pedigree profile with 67 starts and 11 wins.",
    listingLabel: "Marketplace",
    listingHref: "/marketplace?category=dogs",
    profileHref: "/dogs/cmr0ltvp104coepykf9irul0r",
    seller: {
      displayName: "Seller details on listing",
      verified: false,
      region: "Australia",
      responseTime: "Enquiries in Pulse",
    },
    artworkSrc: "/images/marketplace-cards/aaron-alpaca-copper-circuit.webp",
  },
] as const satisfies ReadonlyArray<MarketplaceDogCardData & { artworkSrc: string }>;

const EQUIPMENT_LISTINGS = [
  { title: "Two-dog race trailer", detail: "Braked · lockable · NSW", price: "$8,900", category: "Transport", icon: Truck },
  { title: "Four-bay kennel system", detail: "Insulated · modular", price: "$4,250", category: "Kennels", icon: Store },
  { title: "Performance nutrition pack", detail: "Feed · recovery · 30 days", price: "$189", category: "Nutrition", icon: ShoppingBag },
  { title: "Race-day jacket set", detail: "Six colours · fitted", price: "$149", category: "Gear", icon: ShoppingBag },
  { title: "Muzzle and lead bundle", detail: "Track-ready · padded", price: "$119", category: "Gear", icon: ShoppingBag },
  { title: "Portable recovery bath", detail: "Foldable · easy drain", price: "$595", category: "Kennels", icon: Store },
] as const;

const MARKETPLACE_CATEGORIES = [
  "All",
  "Dogs",
  "Transport",
  "Kennels",
  "Nutrition",
  "Gear",
] as const;

type MarketplaceCategory = (typeof MARKETPLACE_CATEGORIES)[number];

export function FeedSystemPrototype({
  dockSkin,
  firstName,
  showDemoAdvertiserConcepts = false,
  showMarketplacePreview = true,
  variant,
  standalone = false,
}: {
  dockSkin?: DockSkinKey;
  firstName: string;
  showDemoAdvertiserConcepts?: boolean;
  showMarketplacePreview?: boolean;
  variant: PrototypeVariant;
  standalone?: boolean;
}) {
  const family = variant[0];
  const socialMode = getPrototypeSocialMode(variant);
  const compactWorkspace = variant === "A2" || socialMode === "compact";
  const compactFeed = compactWorkspace;
  const expandedFeed = socialMode === "expanded";
  const composition = PROTOTYPE_TEMPLATE_COMPOSITIONS[variant];
  const advertiserConcepts = getFeedAdvertiserConcepts(variant);

  return (
    <div
      data-design-lab-feed
      data-standalone-member-preview={standalone ? "true" : "false"}
      data-app-template={variant}
      data-template-family={composition.family}
      data-feed-density={composition.feed}
      data-demo-advertiser-concepts={showDemoAdvertiserConcepts ? "visible" : "hidden"}
      data-sponsored-marketplace={showMarketplacePreview ? "visible" : "hidden"}
      data-social-hub-mode={socialMode ?? undefined}
      data-review-component="SHELL"
      className="giq-social-hub giq-template-root mx-auto w-full max-w-[1680px] px-2 py-4 sm:px-4 lg:px-5 2xl:px-6"
    >
      {standalone ? (
        <style>{`
          body:has([data-standalone-member-preview="true"]) div:has(> #main-content) > header,
          body:has([data-standalone-member-preview="true"]) .giq-mobile-dock,
          body:has([data-standalone-member-preview="true"]) .giq-hub-conversation-dock,
          body:has([data-standalone-member-preview="true"]) .giq-footer-shell,
          body:has([data-standalone-member-preview="true"]) .giq-alert-wrap {
            display: none !important;
          }
        `}</style>
      ) : null}
      {standalone ? <PrototypeMemberHeader firstName={firstName} /> : null}
      {standalone ? <InteractiveHelp firstName={firstName} /> : null}
      <div className={standalone ? "mt-4" : undefined}>
        <FeedHeaderPlannerPrototype variant={variant} firstName={firstName} />
      </div>
      {composition.planner === "below" ? (
        <InteractiveRacePlannerPrototype
          density={getPrototypePlannerDensity(variant)}
        />
      ) : null}

      <div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:hidden">
        <ProfileSummary compact={compactWorkspace} />
        <MessengerRail compact />
        <div className="min-w-0 sm:col-span-2">
          <QuickChat inline />
        </div>
      </div>

      <div
        data-layout-family={family}
        className={`mt-4 grid gap-4 ${
          family === "B"
            ? "lg:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]"
            : variant === "A2"
              ? "lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_280px] 2xl:grid-cols-[220px_minmax(0,1fr)_300px]"
            : socialMode === "compact"
              ? "lg:grid-cols-[176px_minmax(0,1fr)] xl:grid-cols-[176px_minmax(0,1fr)_270px] 2xl:grid-cols-[196px_minmax(0,1fr)_300px]"
            : family === "C"
              ? "lg:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_300px] 2xl:grid-cols-[210px_minmax(0,1fr)_340px]"
              : "lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_300px] 2xl:grid-cols-[260px_minmax(0,1fr)_340px]"
        }`}
      >
        <aside
          className="hidden lg:block"
          aria-label="Profile and hub navigation"
        >
          <div className="sticky top-[176px] space-y-4">
            <ProfileSummary compact={compactWorkspace} />
            <nav className="giq-panel p-3" aria-label="App navigation preview">
              <ul className="space-y-1">
                {LEFT_NAV.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={index === 0 ? "page" : undefined}
                        className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 text-[13px] font-semibold transition ${
                          index === 0
                            ? "border-[hsl(var(--primary-light)/0.42)] bg-[hsl(var(--primary)/0.18)] text-white"
                            : "border-transparent text-white/55 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                        }`}
                      >
                        <Icon className="size-4 text-[hsl(var(--primary-light))]" aria-hidden="true" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            {family === "B" ? <MessengerRail /> : null}
          </div>
        </aside>

        <main
          data-review-component="FEED"
          aria-label="Live community feed preview"
          className={`min-w-0 ${socialMode === "expanded" ? "space-y-5" : socialMode === "compact" ? "space-y-3" : "space-y-4"}`}
        >
          {variant === "B1" ? <CockpitTelemetry /> : null}
          {variant === "B2" ? <IntegratedWorkspaceControls /> : null}
          <IdentityBanner firstName={firstName} compact={compactWorkspace} />
          {socialMode === "compact" ? <CompactSocialDigest /> : null}
          <FeedComposer firstName={firstName} compact={compactWorkspace} />
          {socialMode === "expanded" ? <SocialMomentum /> : null}
          <FeedPost
            postId="sarah-trackside-note"
            avatar={DEMO_PROFILE_PORTRAITS["Sarah Thompson"]}
            name="Sarah Thompson"
            kind="Trackside update"
            meta="Breeder · Richmond · 4 min"
            body="Trackside at Richmond tonight. Black Comet has settled beautifully and looks sharp ahead of Race 7. I’ve added the latest kennel note to his profile."
            image="/images/feed/posts/sarah-trackside-note.webp"
            imageAlt="A black greyhound standing calmly with a handler beside illuminated starting boxes at an Australian track."
            reactions="24"
            comments="8"
            compact={compactFeed}
            expanded={expandedFeed}
          />
          <FeedPost
            postId="mark-sectional-comparison"
            avatar={DEMO_PROFILE_PORTRAITS["Mark Riley"]}
            name="Mark Riley"
            kind="Race analysis"
            meta="Owner · Dapto · 12 min"
            body="The R6 sectional comparison is live. Box speed is tight across the inside three, but the final split gives Silver Echo a genuine chance tonight."
            image="/images/feed/posts/mark-sectional-comparison.webp"
            imageAlt="High-oblique night view of a greyhound field sweeping through a floodlit regional track bend."
            reactions="17"
            comments="5"
            compact={compactFeed}
            expanded={expandedFeed}
          />
          {ADDITIONAL_MEMBER_POSTS.slice(0, 2).map((post) => (
            <FeedPost
              key={post.postId}
              {...post}
              compact={compactFeed}
              expanded={expandedFeed}
            />
          ))}
          <FeedHousePromotion variant="compact" />
          {showDemoAdvertiserConcepts ? (
            <FeedAdvertiserConcept
              brand={advertiserConcepts.compact}
              placement="compact"
            />
          ) : null}
          {ADDITIONAL_MEMBER_POSTS.slice(2, 4).map((post) => (
            <FeedPost
              key={post.postId}
              {...post}
              compact={compactFeed}
              expanded={expandedFeed}
            />
          ))}
          {expandedFeed ? (
            <FeedPost
              postId="lisa-community-night"
              avatar={DEMO_PROFILE_PORTRAITS["Lisa Grant"]}
              name="Lisa Grant"
              kind="Community update"
              meta="Owner · Wentworth Park · 26 min"
              body="A brilliant community night at Wentworth Park. The breeding group compared three family lines before the first race, and the shared notes are now available to members following those dogs."
              image="/images/feed/posts/lisa-community-night.webp"
              imageAlt="Community members comparing notes beside a floodlit inner-Sydney greyhound track at night."
              reactions="31"
              comments="14"
              expanded
            />
          ) : null}
          {showMarketplacePreview ? (
            <MarketplacePreview compact={compactFeed} />
          ) : null}
          {ADDITIONAL_MEMBER_POSTS.slice(4).map((post) => (
            <FeedPost
              key={post.postId}
              {...post}
              compact={compactFeed}
              expanded={expandedFeed}
            />
          ))}
          {showDemoAdvertiserConcepts ? (
            <FeedAdvertiserConcept
              brand={advertiserConcepts.billboard}
              placement="billboard"
            />
          ) : null}
          <FeedHousePromotion variant="billboard" />
        </main>

        <aside className={`hidden space-y-4 xl:block ${family === "B" ? "xl:hidden" : ""}`} aria-label="Friends and messenger preview">
          {socialMode === "expanded" ? <RelationshipRail /> : null}
          <MessengerRail />
        </aside>
      </div>

      <QuickChat />
      {standalone ? <PrototypeMemberDock skinKey={dockSkin} /> : null}
    </div>
  );
}

function ProfileSummary({ compact = false }: { compact?: boolean }) {
  return (
    <section
      data-review-component="PROFILE"
      className="giq-panel min-w-0 overflow-hidden"
      aria-label="Your profile preview"
    >
      <div className={`relative overflow-hidden ${compact ? "h-20" : "h-24"}`}>
        <Image
          src="/images/feed/founder-race-night-cover.webp"
          alt=""
          fill
          className="object-cover"
          sizes="260px"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
      </div>
      <div className={`relative ${compact ? "px-3 pb-3" : "px-4 pb-4"}`}>
        <div className={`${compact ? "-mt-7 size-14" : "-mt-8 size-16"} relative overflow-hidden rounded-full border-4 border-[hsl(var(--surface-1))] bg-black shadow-xl`}>
          <ActorMediaImage
            src="/images/feed/daniel-fleuren-founder-portrait.png"
            alt="Daniel Fleuren"
            fill
            className="object-cover"
            sizes={compact ? "112px" : "128px"}
            {...DANIEL_DEMO_PROFILE_ALIGNMENT}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold text-white">Daniel Fleuren</h2>
          <span className="rounded-full border border-[hsl(var(--secondary)/0.35)] bg-[hsl(var(--secondary)/0.12)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[hsl(var(--secondary-light))]">
            Founder
          </span>
        </div>
        <p className="mt-1 text-[11px] text-white/45">New South Wales, Australia</p>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/8 pt-3 text-center">
          <ProfileMetric value="128" label="Following" />
          <ProfileMetric value="842" label="Followers" />
          <ProfileMetric value="36" label="Posts" />
        </div>
      </div>
    </section>
  );
}

function ProfileMetric({ value, label }: { value: string; label: string }) {
  return (
    <span>
      <strong className="block text-[13px] text-white">{value}</strong>
      <small className="text-[9px] uppercase tracking-wide text-white/35">{label}</small>
    </span>
  );
}

function DemoProfileAvatar({
  name,
  src,
  size = "size-11",
  online,
}: {
  name: string;
  src: string;
  size?: string;
  online?: boolean;
}) {
  const isDaniel = src === DEMO_PROFILE_PORTRAITS["Daniel Fleuren"];

  return (
    <span data-demo-profile={name} className={`relative block shrink-0 ${size}`}>
      <span className="absolute inset-0 overflow-hidden rounded-full border border-white/12 shadow-md">
        <ActorMediaImage
          src={src}
          alt=""
          fill
          className="object-cover"
          sizes={isDaniel ? "128px" : "64px"}
          {...(isDaniel ? DANIEL_DEMO_PROFILE_ALIGNMENT : {})}
        />
      </span>
      {online !== undefined ? (
        <span
          aria-hidden="true"
          className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-[hsl(var(--surface-1))] ${online ? "bg-emerald-400" : "bg-white/25"}`}
        />
      ) : null}
    </span>
  );
}

function CockpitTelemetry() {
  const metrics = [
    ["Live sync", "Healthy", "126 races indexed"],
    ["Planner locks", "2", "Next 75 minutes"],
    ["Tracked dogs", "18", "3 racing tonight"],
    ["Race alerts", "4", "1 priority signal"],
  ];

  return (
    <section
      data-template-telemetry
      className="giq-panel grid overflow-hidden sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Race telemetry preview"
    >
      {metrics.map(([label, value, detail]) => (
        <div key={label} className="border-b border-white/8 p-3 sm:border-r xl:border-b-0 last:border-r-0">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/34">{label}</span>
          <strong className="mt-1 block text-[16px] text-[hsl(var(--primary-light))]">{value}</strong>
          <small className="text-[10px] text-white/38">{detail}</small>
        </div>
      ))}
    </section>
  );
}

function IntegratedWorkspaceControls() {
  const [activeControl, setActiveControl] = useState("Planner");
  const controls = [
    { label: "Planner", detail: "4 races", icon: GalleryHorizontal },
    { label: "Race cards", detail: "14 meetings", icon: LayoutGrid },
    { label: "Watchlist", detail: "18 dogs", icon: Bookmark },
    { label: "Find", detail: "Search racing", icon: Search },
  ];

  return (
    <section
      data-template-workspace-controls
      className="giq-panel grid gap-2 p-2 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Integrated racing workspace controls"
    >
      {controls.map((control) => {
        const Icon = control.icon;
        const active = activeControl === control.label;
        return (
          <button
            key={control.label}
            type="button"
            onClick={() => setActiveControl(control.label)}
            aria-pressed={active}
            className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-light))] ${
              active
                ? "border-[hsl(var(--primary-light)/0.48)] bg-[hsl(var(--primary)/0.16)]"
                : "border-white/7 bg-black/14 hover:border-white/16 hover:bg-white/[0.04]"
            }`}
          >
            <span className={`grid size-9 place-items-center rounded-lg ${active ? "bg-[hsl(var(--primary)/0.28)] text-[hsl(var(--primary-light))]" : "bg-white/[0.05] text-white/42"}`}>
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span>
              <strong className="block text-[11px] text-white">{control.label}</strong>
              <small className="text-[9px] text-white/36">{control.detail}</small>
            </span>
          </button>
        );
      })}
      <p className="sr-only" aria-live="polite">{activeControl} workspace selected.</p>
    </section>
  );
}

function SocialMomentum() {
  const [activeSignal, setActiveSignal] = useState<string>(SOCIAL_SIGNALS[0].label);
  return (
    <section
      data-template-social-momentum
      className="giq-panel grid overflow-hidden sm:grid-cols-3"
      aria-label="Community momentum preview"
    >
      {SOCIAL_SIGNALS.map((signal) => {
        const Icon = signal.icon;
        return (
          <button
            key={signal.label}
            type="button"
            onClick={() => setActiveSignal(signal.label)}
            aria-pressed={activeSignal === signal.label}
            className="flex min-h-20 items-center gap-3 border-b border-white/8 p-3 text-left transition hover:bg-white/[0.04] sm:border-b-0 sm:border-r last:border-r-0"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--primary)/0.18)] text-[hsl(var(--primary-light))]">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span>
              <strong className="block text-[17px] text-white">{signal.value}</strong>
              <span className="block text-[10px] font-semibold text-white/62">{signal.label}</span>
              <small className="text-[9px] text-white/34">{signal.detail}</small>
            </span>
          </button>
        );
      })}
      <p className="sr-only" aria-live="polite">{activeSignal} selected.</p>
    </section>
  );
}

function CompactSocialDigest() {
  const [activeSignal, setActiveSignal] = useState<string>(SOCIAL_SIGNALS[0].label);
  return (
    <section
      data-template-social-digest
      className="giq-panel grid grid-cols-3 overflow-hidden"
      aria-label="Compact community signal preview"
    >
      {SOCIAL_SIGNALS.map((signal) => {
        const Icon = signal.icon;
        return (
          <button
            key={signal.label}
            type="button"
            onClick={() => setActiveSignal(signal.label)}
            aria-pressed={activeSignal === signal.label}
            className="min-w-0 border-r border-white/8 px-2 py-3 text-left transition last:border-r-0 hover:bg-white/[0.04] sm:px-3"
          >
            <span className="flex items-center gap-1.5 text-[hsl(var(--primary-light))]">
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              <strong className="text-[15px]">{signal.value}</strong>
            </span>
            <span className="mt-1 block truncate text-[9px] font-semibold text-white/58">
              {signal.label}
            </span>
            <small className="mt-0.5 hidden truncate text-[8px] text-white/32 sm:block">
              {signal.detail}
            </small>
          </button>
        );
      })}
      <p className="sr-only" aria-live="polite">{activeSignal} selected.</p>
    </section>
  );
}

function RelationshipRail() {
  const updates = [
    ["Richmond Breeders", "8 members discussing Race 7"],
    ["NSW Owners Circle", "3 new stable updates"],
    ["Trackside Photography", "12 new race-night photos"],
  ];

  return (
    <section
      data-template-relationship-rail
      className="giq-panel overflow-hidden"
      aria-label="Community relationships preview"
    >
      <header className="border-b border-white/8 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--secondary-light))]">
          Community pulse
        </p>
        <h2 className="mt-1 text-[16px] font-semibold text-white">Your racing circles</h2>
      </header>
      <div className="space-y-1 p-2">
        {updates.map(([title, detail], index) => (
          <Link
            key={title}
            href="/groups"
            className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left transition hover:bg-white/[0.045]"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[hsl(var(--primary)/0.16)] text-[11px] font-bold text-[hsl(var(--primary-light))]">
              {index + 1}
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-[11px] text-white">{title}</strong>
              <small className="block truncate text-[9px] text-white/36">{detail}</small>
            </span>
          </Link>
        ))}
      </div>
      <Link href="/groups" className="m-3 flex min-h-10 items-center justify-center rounded-lg border border-white/10 text-[11px] font-semibold text-[hsl(var(--primary-light))] hover:bg-white/[0.04]">
        Explore groups
      </Link>
    </section>
  );
}

function IdentityBanner({
  firstName,
  compact = false,
}: {
  firstName: string;
  compact?: boolean;
}) {
  const [activeSection, setActiveSection] = useState("Posts");

  return (
    <section className="giq-panel giq-template-identity-banner overflow-hidden" aria-label="Personal profile banner preview">
      <div className={`giq-template-identity-cover relative overflow-hidden ${compact ? "h-[118px] sm:h-[152px] lg:h-[170px]" : "h-[148px] sm:h-[210px] lg:h-[230px]"}`}>
        <Image
          src="/images/feed/founder-race-night-cover.webp"
          alt="Greyhound race night founder cover"
          fill
          className="object-cover object-center"
          sizes="(min-width: 1280px) 760px, 100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/68 via-black/8 to-transparent" />
        <Link
          href="/account/profile"
          aria-label="Edit cover photo"
          className="giq-button giq-button-carbon absolute bottom-3 right-3 min-h-11 px-3 text-[11px] font-semibold"
        >
          <Camera className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Edit cover</span>
        </Link>
      </div>

      <div className="px-4 pb-3 sm:px-6 sm:pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:gap-5">
          <div className={`relative w-fit shrink-0 ${compact ? "-mt-9 sm:-mt-11" : "-mt-11 sm:-mt-14"}`}>
            <div className={`relative overflow-hidden rounded-full border-[5px] border-[hsl(var(--surface-1))] bg-black shadow-2xl ${compact ? "size-[78px] sm:size-[92px]" : "size-[92px] sm:size-[116px]"}`}>
              <ActorMediaImage
                src="/images/feed/daniel-fleuren-founder-portrait.png"
                alt="Daniel Fleuren"
                fill
                className="object-cover"
                sizes={compact ? "(min-width: 640px) 184px, 156px" : "(min-width: 640px) 232px, 184px"}
                {...DANIEL_DEMO_PROFILE_ALIGNMENT}
              />
            </div>
            <Link
              href="/account/profile"
              aria-label="Edit profile picture"
              className="absolute bottom-0 right-0 grid size-11 place-items-center rounded-full border-4 border-[hsl(var(--surface-1))] bg-[hsl(var(--surface-3))] text-white shadow-lg transition hover:bg-[hsl(var(--primary))]"
            >
              <Camera className="size-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-3 min-w-0 flex-1 pb-1 sm:mt-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={`truncate font-semibold text-white ${compact ? "text-[19px] sm:text-[23px]" : "text-[22px] sm:text-[28px]"}`}>
                {firstName} Fleuren
              </h2>
              <span className="rounded-full border border-[hsl(var(--secondary)/0.35)] bg-[hsl(var(--secondary)/0.12)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[hsl(var(--secondary-light))]">
                Founder
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-white/55">Founder, GreyhoundIQ · Personal profile</p>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-white/38">
              <MapPin className="size-3" aria-hidden="true" />
              New South Wales, Australia · 842 followers
            </p>
          </div>

          <div className="mt-4 flex gap-2 pb-1 sm:mt-0">
            <Link
              href="/account/profile"
              className="giq-button giq-button-gold min-h-11 flex-1 px-4 text-[11px] font-bold sm:flex-none"
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit profile
            </Link>
            <Link
              href="/p/daniel-fleuren"
              className="giq-button giq-button-carbon min-h-11 flex-1 px-4 text-[11px] font-semibold sm:flex-none"
            >
              View profile
            </Link>
          </div>
        </div>

        <nav className="mt-4 flex items-center gap-1 overflow-x-auto border-t border-white/8 pt-2 [scrollbar-width:thin]" aria-label="Profile sections preview">
          {[
            ["Posts", "36"],
            ["About", ""],
            ["Friends", "128"],
            ["Media", "24"],
          ].map(([label, count]) => (
            <button
              key={label}
              type="button"
              onClick={() => setActiveSection(label)}
              aria-pressed={activeSection === label}
              className={`min-h-11 shrink-0 rounded-lg px-4 text-[11px] font-semibold transition ${activeSection === label ? "bg-[hsl(var(--primary)/0.18)] text-[hsl(var(--primary-light))]" : "text-white/45 hover:bg-white/[0.04] hover:text-white"}`}
            >
              {label}{count ? ` · ${count}` : ""}
            </button>
          ))}
        </nav>
        <p className="sr-only" aria-live="polite">{activeSection} profile section selected.</p>
      </div>
    </section>
  );
}

function FeedComposer({
  firstName,
  compact = false,
}: {
  firstName: string;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<"Photo" | "Video" | null>(null);
  const [status, setStatus] = useState("");

  return (
    <form
      data-review-component="FEED-COMPOSER"
      className={`giq-panel giq-template-feed-composer ${compact ? "p-3" : "p-4"}`}
      aria-label="Create a post preview"
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft.trim() && !attachment) return;
        setStatus(`Demo post published${attachment ? ` with ${attachment.toLowerCase()}` : ""}.`);
        setDraft("");
        setAttachment(null);
      }}
    >
      <div className="flex items-center gap-3">
        <DemoProfileAvatar
          name="Daniel Fleuren"
          src={DEMO_PROFILE_PORTRAITS["Daniel Fleuren"]}
          size="size-10"
        />
        <label htmlFor="demo-feed-composer" className="sr-only">Create a demo feed post</label>
        <textarea
          id="demo-feed-composer"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={1}
          placeholder={`What's happening trackside, ${firstName}?`}
          className="min-h-11 flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-[13px] text-white outline-none placeholder:text-white/40 focus:border-[hsl(var(--primary-light)/0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-light))]"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-3">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setAttachment((current) => current === "Photo" ? null : "Photo")}
            aria-pressed={attachment === "Photo"}
            className="giq-button giq-button-carbon min-h-9 px-3 text-[11px] font-semibold"
          >
            <ImageIcon className="size-4 text-[hsl(var(--primary-light))]" aria-hidden="true" /> Photo
          </button>
          <button
            type="button"
            onClick={() => setAttachment((current) => current === "Video" ? null : "Video")}
            aria-pressed={attachment === "Video"}
            className="giq-button giq-button-carbon min-h-9 px-3 text-[11px] font-semibold"
          >
            <Video className="size-4 text-[hsl(var(--secondary-light))]" aria-hidden="true" /> Video
          </button>
        </div>
        <button
          type="submit"
          disabled={!draft.trim() && !attachment}
          className="giq-button giq-button-gold min-h-9 px-4 text-[11px] font-bold disabled:cursor-not-allowed disabled:opacity-45"
        >
          Post
        </button>
      </div>
      {attachment ? <p className="mt-2 text-[10px] text-[hsl(var(--secondary-light))]">{attachment} attached to this demo post.</p> : null}
      <p className={status ? "mt-2 text-[10px] text-emerald-300" : "sr-only"} aria-live="polite">{status}</p>
    </form>
  );
}

function FeedPost({
  postId,
  avatar,
  name,
  kind,
  meta,
  body,
  image,
  imageAlt = "Trackside post media",
  mediaKind = "photo",
  reactions,
  comments,
  compact = false,
  expanded = false,
}: {
  postId: string;
  avatar: string;
  name: string;
  kind: string;
  meta: string;
  body: string;
  image: string;
  imageAlt?: string;
  mediaKind?: "photo" | "portrait-card";
  reactions: string;
  comments: string;
  compact?: boolean;
  expanded?: boolean;
}) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentTotal, setCommentTotal] = useState(Number(comments));
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [status, setStatus] = useState("");
  const reactionTotal = Number(reactions) + (liked ? 1 : 0);

  return (
    <article
      data-feed-post
      data-feed-content="member"
      className="giq-panel giq-template-feed-post overflow-hidden"
      aria-labelledby={`${postId}-author`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <DemoProfileAvatar name={name} src={avatar} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 id={`${postId}-author`} className="truncate text-[14px] font-semibold text-white">{name}</h2>
              <span className="text-[11px] text-[hsl(var(--primary-light))]">●</span>
            </div>
            <p className="text-[11px] text-white/40">{meta}</p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--secondary-light))]">Member · {kind}</p>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setOptionsOpen((open) => !open)}
              aria-label={`More options for ${name}'s post`}
              aria-expanded={optionsOpen}
              aria-controls={`${postId}-options`}
              className="grid size-9 place-items-center rounded-full text-white/35 hover:bg-white/[0.05] hover:text-white"
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </button>
            {optionsOpen ? (
              <div
                id={`${postId}-options`}
                role="note"
                className="absolute right-0 top-10 z-20 w-52 rounded-xl border border-white/12 bg-[hsl(var(--surface-2))] p-3 text-[10px] leading-4 text-white/62 shadow-2xl"
              >
                Demo controls are local. No live account or post data is changed.
              </div>
            ) : null}
          </div>
        </div>
        <p className={`mt-4 leading-6 text-white/72 ${expanded ? "text-[14px] sm:text-[15px]" : "text-[13px] sm:text-[14px]"}`}>{body}</p>
      </div>
      <div
        data-feed-media-kind={mediaKind}
        className={`giq-template-feed-media relative w-full min-w-0 overflow-hidden border-y border-white/8 bg-black/30 ${
          mediaKind === "portrait-card"
            ? "aspect-[5/7] max-h-[680px] sm:aspect-[16/10] sm:max-h-[520px]"
            : expanded
              ? "aspect-[4/3] sm:aspect-[16/8]"
              : compact
                ? "aspect-[4/3] sm:aspect-[16/9]"
                : "aspect-[4/3] sm:aspect-[16/9]"
        }`}
      >
        <Image
          src={image}
          alt={imageAlt}
          fill
          className={mediaKind === "portrait-card" ? "object-contain object-center p-3 sm:p-5" : "object-cover object-center"}
          sizes="(min-width: 1280px) 760px, (min-width: 640px) 90vw, 100vw"
        />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-[11px] text-white/42">
        <span>{reactionTotal} reactions</span>
        <span>{commentTotal} comments</span>
      </div>
      <div className="grid grid-cols-2 border-t border-white/8 p-1.5 sm:grid-cols-4">
        <PostAction
          icon={Heart}
          label={liked ? "Liked" : "Like"}
          pressed={liked}
          onClick={() => {
            setLiked((current) => !current);
            setStatus(liked ? "Like removed." : "Post liked in this demo.");
          }}
        />
        <PostAction
          icon={MessageCircle}
          label="Comment"
          pressed={commentOpen}
          onClick={() => {
            setCommentOpen((open) => !open);
            setStatus(commentOpen ? "Comment editor closed." : "Comment editor opened.");
          }}
        />
        <PostAction
          icon={Bookmark}
          label={saved ? "Saved" : "Save"}
          pressed={saved}
          onClick={() => {
            setSaved((current) => !current);
            setStatus(saved ? "Post removed from demo saves." : "Post saved in this demo.");
          }}
        />
        <PostAction
          icon={Share2}
          label={shared ? "Shared" : "Share"}
          pressed={shared}
          onClick={() => {
            setShared((current) => !current);
            setStatus(shared ? "Demo share cleared." : "Share preview prepared locally.");
          }}
        />
      </div>
      {commentOpen ? (
        <form
          className="flex flex-col gap-2 border-t border-white/8 p-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (!commentDraft.trim()) return;
            setCommentTotal((total) => total + 1);
            setCommentDraft("");
            setCommentOpen(false);
            setStatus("Comment added to this demo post.");
          }}
        >
          <label htmlFor={`${postId}-comment`} className="sr-only">Comment on {name}&apos;s post</label>
          <input
            id={`${postId}-comment`}
            value={commentDraft}
            onChange={(event) => setCommentDraft(event.target.value)}
            placeholder="Write a demo comment"
            className="min-h-10 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.035] px-4 text-[12px] text-white outline-none placeholder:text-white/34 focus:border-[hsl(var(--primary-light)/0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-light))]"
          />
          <button
            type="submit"
            disabled={!commentDraft.trim()}
            className="giq-button giq-button-primary min-h-10 px-4 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
          >
            Add comment
          </button>
        </form>
      ) : null}
      <p className={status ? "border-t border-white/8 px-4 py-2 text-[10px] text-emerald-300" : "sr-only"} aria-live="polite">{status}</p>
    </article>
  );
}

function MarketplacePreview({ compact }: { compact: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeCategory, setActiveCategory] =
    useState<MarketplaceCategory>("Dogs");
  const [dismissedDogIds, setDismissedDogIds] = useState<string[]>([]);
  const [savedDogIds, setSavedDogIds] = useState<Set<string>>(() => new Set());
  const [marketplaceStatus, setMarketplaceStatus] = useState("");
  const visibleDogs = MARKET_DOGS.filter(
    (candidate) => !dismissedDogIds.includes(candidate.dogId)
  );
  const dog = visibleDogs[activeIndex % Math.max(visibleDogs.length, 1)];
  const previousDog =
    visibleDogs[
      (activeIndex - 1 + Math.max(visibleDogs.length, 1)) %
        Math.max(visibleDogs.length, 1)
    ];
  const nextDog = visibleDogs[(activeIndex + 1) % Math.max(visibleDogs.length, 1)];
  const showDogs = activeCategory === "All" || activeCategory === "Dogs";
  const equipmentListings = EQUIPMENT_LISTINGS.filter(
    (listing) => activeCategory === "All" || listing.category === activeCategory
  );

  function move(direction: -1 | 1) {
    if (visibleDogs.length <= 1) return;
    setActiveIndex(
      (index) =>
        (index + direction + visibleDogs.length) % visibleDogs.length
    );
  }

  function dismissDog(dismissedDog: (typeof MARKET_DOGS)[number]) {
    setDismissedDogIds((current) => [...current, dismissedDog.dogId]);
    setActiveIndex(0);
    setMarketplaceStatus(`${dismissedDog.name} dismissed. Undo is available.`);
  }

  function updateSavedDog(dogId: string, saved: boolean) {
    setSavedDogIds((current) => {
      const next = new Set(current);
      if (saved) next.add(dogId);
      else next.delete(dogId);
      return next;
    });
  }

  return (
    <section
      data-review-component="MARKETPLACE"
      role="region"
      className="giq-panel giq-template-marketplace overflow-hidden"
      aria-labelledby="marketplace-preview-title"
      aria-roledescription="carousel"
    >
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/8 p-4 sm:p-5">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--secondary-light))]">
            <Store className="size-4" aria-hidden="true" />
            Marketplace
          </p>
          <h2 id="marketplace-preview-title" className="mt-1 text-[19px] font-semibold text-white">
            Racing stock and kennel essentials
          </h2>
          <p className="mt-1 text-[11px] text-white/42">
            Public profile statistics and seller listing details
          </p>
        </div>
        <Link href="/marketplace" className="giq-button giq-button-carbon min-h-10 px-3 text-[11px] font-semibold">
          View marketplace
        </Link>
      </header>

      <div className="flex gap-2 overflow-x-auto border-b border-white/8 px-4 py-3 sm:px-5" aria-label="Marketplace categories">
        {MARKETPLACE_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            aria-pressed={activeCategory === category}
            className={`min-h-9 shrink-0 rounded-full border px-3 text-[10px] font-bold transition ${activeCategory === category ? "border-[hsl(var(--secondary)/0.5)] bg-[hsl(var(--secondary)/0.14)] text-[hsl(var(--secondary-light))]" : "border-white/10 bg-white/[0.025] text-white/46 hover:bg-white/[0.06] hover:text-white"}`}
          >
            {category}
          </button>
        ))}
      </div>

      {showDogs ? (
        visibleDogs.length > 0 && dog && previousDog && nextDog ? (
          <div className="grid gap-7 p-4 sm:p-5 md:grid-cols-[minmax(250px,360px)_minmax(0,1fr)] md:items-center">
            <div
              className={`relative mx-auto w-full outline-none ${compact ? "max-w-[300px]" : "max-w-[340px]"}`}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "ArrowLeft") move(-1);
                if (event.key === "ArrowRight") move(1);
              }}
              aria-label="Featured dog listing. Use left and right arrow keys to browse. Tap the card to flip it, swipe right to save, or swipe left to dismiss."
            >
              {[previousDog, nextDog].map((queuedDog, index) => (
                <div
                  key={`${queuedDog.dogId}-${index}`}
                  aria-hidden="true"
                  className={`absolute inset-x-0 top-0 aspect-[5/7] rounded-[clamp(18px,5%,28px)] border border-[hsl(var(--secondary)/0.22)] bg-no-repeat shadow-xl transition ${index === 0 ? "hidden -translate-x-4 translate-y-2 -rotate-[2.5deg] opacity-32 sm:block" : "translate-x-4 translate-y-2 rotate-[2.5deg] opacity-52"}`}
                  style={{
                    backgroundImage: `url(${JSON.stringify(queuedDog.artworkSrc)})`,
                    backgroundPosition: "center",
                    backgroundSize: "contain",
                    backgroundColor: "#050508",
                  }}
                />
              ))}

              <MarketplaceDogPlayerCard
                key={dog.dogId}
                dog={dog}
                artwork={{ kind: "image", src: dog.artworkSrc }}
                initiallySaved={savedDogIds.has(dog.dogId)}
                onSavedChange={(saved) => updateSavedDog(dog.dogId, saved)}
                onDismiss={() => dismissDog(dog)}
                className="relative z-10"
              />

              <button
                type="button"
                onClick={() => move(-1)}
                aria-label="Previous dog"
                className="absolute left-2 top-[42%] z-20 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-white/18 bg-black/76 text-white shadow-xl backdrop-blur transition hover:border-[hsl(var(--secondary)/0.5)] hover:bg-[hsl(var(--secondary)/0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--secondary-light))]"
              >
                <ChevronLeft className="size-6" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                aria-label="Next dog"
                className="absolute right-2 top-[42%] z-20 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-white/18 bg-black/76 text-white shadow-xl backdrop-blur transition hover:border-[hsl(var(--secondary)/0.5)] hover:bg-[hsl(var(--secondary)/0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--secondary-light))]"
              >
                <ChevronRight className="size-6" aria-hidden="true" />
              </button>
            </div>

            <div className="min-w-0" aria-live="polite">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--primary-light))]">
                Featured {activeIndex + 1} of {visibleDogs.length}
              </p>
              <h3 className="font-display mt-2 text-[clamp(1.8rem,5vw,3rem)] uppercase leading-none text-white">
                {dog.name}
              </h3>
              <p className="mt-3 max-w-md text-[13px] leading-6 text-white/58">
                Tap to flip. Swipe right to save or left to dismiss. Vertical movement keeps the Feed scrolling normally.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <CarouselMetric value={dog.starts == null ? "—" : String(dog.starts)} label="Starts" />
                <CarouselMetric value={dog.wins == null ? "—" : String(dog.wins)} label="Wins" />
                <CarouselMetric value={dog.prizeMoney} label="Prize money" />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/22 p-3">
                <span>
                  <small className="block text-[9px] uppercase tracking-wide text-white/38">Asking price</small>
                  <strong className="text-[22px] text-[hsl(var(--secondary-light))]">{dog.price}</strong>
                </span>
                <Link href={dog.profileHref} className="giq-button giq-button-primary min-h-11 px-4 text-[11px] font-semibold">
                  View public profile
                </Link>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2" aria-label="Choose featured dog">
                {visibleDogs.map((option, index) => (
                  <button
                    key={option.dogId}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Show ${option.name}`}
                    aria-current={index === activeIndex ? "true" : undefined}
                    className={`h-2.5 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--secondary-light))] ${index === activeIndex ? "w-8 bg-[hsl(var(--secondary))]" : "w-2.5 bg-white/18 hover:bg-white/35"}`}
                  />
                ))}
              </div>
              {dismissedDogIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setDismissedDogIds((current) => current.slice(0, -1));
                    setActiveIndex(0);
                    setMarketplaceStatus("Last dismissed dog card restored.");
                  }}
                  className="mx-auto mt-4 flex min-h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-[10px] font-semibold text-white/58 hover:bg-white/[0.05] hover:text-white"
                >
                  Undo last dismissal
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="p-6 text-center">
            <h3 className="text-[16px] font-semibold text-white">All dog cards dismissed</h3>
            <p className="mt-2 text-[12px] text-white/45">Restore the most recent card or reset the full stack.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => {
                setDismissedDogIds((current) => current.slice(0, -1));
                setMarketplaceStatus("Last dismissed dog card restored.");
              }} className="giq-button giq-button-glass min-h-10 px-4 text-[11px] font-semibold">
                Undo last
              </button>
              <button type="button" onClick={() => {
                setDismissedDogIds([]);
                setMarketplaceStatus("All dog cards restored.");
              }} className="giq-button giq-button-primary min-h-10 px-4 text-[11px] font-semibold">
                Restore all cards
              </button>
            </div>
          </div>
        )
      ) : null}

      <p className="sr-only" aria-live="polite">
        {marketplaceStatus}
      </p>

      {equipmentListings.length > 0 ? (
        <div className="grid gap-2 border-t border-white/8 p-4 sm:grid-cols-3 sm:p-5">
          {equipmentListings.map((listing) => {
          const Icon = listing.icon;
          return (
            <article key={listing.title} className="flex min-h-20 items-center gap-3 rounded-xl border border-white/8 bg-white/[0.028] p-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[hsl(var(--primary)/0.16)] text-[hsl(var(--primary-light))]">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-[12px] text-white">{listing.title}</strong>
                <small className="block truncate text-[10px] text-white/40">{listing.detail}</small>
              </span>
              <strong className="text-[12px] text-[hsl(var(--secondary-light))]">{listing.price}</strong>
            </article>
          );
          })}
        </div>
      ) : null}
    </section>
  );
}

function CarouselMetric({ value, label }: { value: string; label: string }) {
  return (
    <span className="rounded-xl border border-white/8 bg-white/[0.028] px-2 py-3 text-center">
      <strong className="block truncate text-[14px] text-white">{value}</strong>
      <small className="mt-1 block text-[8px] uppercase tracking-wide text-white/35">{label}</small>
    </span>
  );
}

function PostAction({
  icon: Icon,
  label,
  pressed,
  onClick,
}: {
  icon: typeof Heart;
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-[12px] font-semibold transition hover:bg-white/[0.04] hover:text-white ${pressed ? "text-[hsl(var(--primary-light))]" : "text-white/48"}`}
    >
      <Icon className="size-4" aria-hidden="true" /> {label}
    </button>
  );
}

function MessengerRail({ compact = false }: { compact?: boolean }) {
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);

  return (
    <section
      data-review-component="CHAT"
      className={`giq-panel min-w-0 overflow-hidden ${compact ? "h-full" : "sticky top-[176px]"}`}
      aria-label="Messenger preview"
    >
      <div className="flex items-center justify-between border-b border-white/8 p-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--secondary-light))]">Messenger</p>
          <h2 className="mt-1 text-[16px] font-semibold text-white">Friends online</h2>
        </div>
        <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-bold text-emerald-300">2 online</span>
      </div>
      <div className="p-2">
        {FRIENDS.slice(0, compact ? 2 : FRIENDS.length).map((friend) => (
          <button
            key={friend.name}
            type="button"
            onClick={() => setSelectedFriend(friend.name)}
            aria-pressed={selectedFriend === friend.name}
            className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left transition hover:bg-white/[0.045] aria-pressed:bg-white/[0.06]"
          >
            <DemoProfileAvatar
              name={friend.name}
              src={friend.avatar}
              size="size-10"
              online={friend.online}
            />
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-[12px] text-white">{friend.name}</strong>
              <small className="block truncate text-[10px] text-white/38">{friend.detail}</small>
            </span>
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">{selectedFriend ? `Demo conversation with ${selectedFriend} selected.` : ""}</p>
      <Link href="/pulse/friends" className="m-3 flex min-h-10 items-center justify-center rounded-lg border border-white/10 text-[11px] font-semibold text-[hsl(var(--primary-light))] hover:bg-white/[0.04]">
        View all friends
      </Link>
    </section>
  );
}

function QuickChat({ inline = false }: { inline?: boolean }) {
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<"file" | "photo" | null>(null);
  const [sentMessage, setSentMessage] = useState("");
  const [status, setStatus] = useState("");

  return (
    <section
      data-review-component="CHAT"
      className={`min-w-0 overflow-hidden rounded-2xl border border-[hsl(var(--primary-light)/0.28)] bg-[hsl(var(--surface-1)/0.97)] shadow-[0_24px_80px_rgba(0,0,0,0.56),0_0_34px_hsl(var(--primary)/0.16)] backdrop-blur-xl ${
        inline
          ? "w-full"
          : "fixed bottom-[96px] right-5 z-[60] hidden w-[350px] 2xl:block"
      }`}
      aria-label="Open chat preview"
    >
      <header className="flex items-center gap-3 border-b border-white/8 bg-[linear-gradient(90deg,hsl(var(--primary)/0.20),transparent)] p-3">
        <DemoProfileAvatar
          name="Sarah Thompson"
          src={DEMO_PROFILE_PORTRAITS["Sarah Thompson"]}
          size="size-10"
          online
        />
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-[13px] text-white">Sarah Thompson</strong>
          <small className="text-[10px] text-emerald-300">Active now</small>
        </span>
        <button
          type="button"
          onClick={() => setStatus("Video-call preview opened for Sarah Thompson.")}
          aria-label="Start video call"
          className="grid size-9 place-items-center rounded-lg text-white/55 hover:bg-white/[0.06] hover:text-white"
        >
          <Video className="size-4" aria-hidden="true" />
        </button>
      </header>
      <div className="space-y-3 p-4 text-[12px]">
        <div className="max-w-[82%] rounded-2xl rounded-bl-md bg-white/[0.06] px-3 py-2.5 leading-5 text-white/68">
          Are you watching Richmond R7 tonight?
        </div>
        <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-[hsl(var(--primary)/0.26)] px-3 py-2.5 leading-5 text-white/82">
          Yes — I’ve added it to the planner. Black Comet looks sharp.
        </div>
        {sentMessage ? (
          <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-[hsl(var(--primary)/0.26)] px-3 py-2.5 leading-5 text-white/82">
            {sentMessage}
          </div>
        ) : null}
      </div>
      <form
        className="flex items-center gap-2 border-t border-white/8 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim() && !attachment) return;
          setSentMessage(draft.trim() || `${attachment === "photo" ? "Photo" : "File"} shared in this demo.`);
          setDraft("");
          setAttachment(null);
          setStatus("Demo message sent locally.");
        }}
      >
        <button
          type="button"
          onClick={() => setAttachment((current) => current === "file" ? null : "file")}
          aria-pressed={attachment === "file"}
          aria-label="Attach a file"
          className="grid size-10 place-items-center rounded-lg text-white/45 hover:bg-white/[0.05] hover:text-white aria-pressed:text-[hsl(var(--primary-light))]"
        >
          <Paperclip className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setAttachment((current) => current === "photo" ? null : "photo")}
          aria-pressed={attachment === "photo"}
          aria-label="Add a photo"
          className="grid size-10 place-items-center rounded-lg text-white/45 hover:bg-white/[0.05] hover:text-white aria-pressed:text-[hsl(var(--primary-light))]"
        >
          <Camera className="size-4" aria-hidden="true" />
        </button>
        <label htmlFor={inline ? "quick-chat-inline" : "quick-chat-floating"} className="sr-only">Write a demo message</label>
        <input
          id={inline ? "quick-chat-inline" : "quick-chat-floating"}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={attachment ? `${attachment === "photo" ? "Photo" : "File"} ready` : "Write a message…"}
          className="min-h-10 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.035] px-3 text-[11px] text-white outline-none placeholder:text-white/35 focus:border-[hsl(var(--primary-light)/0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--primary-light))]"
        />
        <button
          type="submit"
          disabled={!draft.trim() && !attachment}
          aria-label="Send message"
          className="grid size-10 place-items-center rounded-full bg-[hsl(var(--primary))] text-white shadow-[0_0_20px_hsl(var(--primary)/0.35)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Send className="size-4" aria-hidden="true" />
        </button>
      </form>
      <p className="sr-only" aria-live="polite">{status}</p>
    </section>
  );
}
