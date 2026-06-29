# GreyhoundIQ — Plan & Infographic Prompt Pack v3.1 Ultimate

> For OpenAI **GPT Image 2** (Ideogram 4 / DALL·E 3 fallbacks).
> Target: 1400×788 WebP for cards, 1080×1920 for vertical infographics.
> All prompts follow the V3 Ultimate structure: Style Stack → Brand
> Lock → Composition Rules → Exact Title → Scene → Filled Panels →
> Workflow Strip → Negative Prompt.
> Reuse the Global Style Stack from `mockup-prompts.md` §Global V3.

---

## v3.1 — What changed from v3.0

Every number, name, and claim now matches the actual 16-section business
plan at `~/greyhoundiq/public/business-plan.html`. Previous version
fabricated financial projections, persona names, and competitor details.
This version is a 1:1 visual translation of the real document.

**Key corrections:** revenue is $650K Y3 (not $1.32M), subscribers are
6,000 Y3 (not 14,000), 4-phase 14-week build plan (not Q1-Q4), personas
are Serious Punter / Breeder-Trainer / Casual Punter (not Dave/Priya/
Isabel), 7 competitors in the matrix (not 3), 6 specific risks R1-R6,
data sources are Betfair+TAB+FastTrack+Tasracing+GRNSW partnership.

---

## Plan Visual Style Stack (paste this once per prompt)

```text
GreyhoundIQ premium editorial BUSINESS-PLAN VISUAL system.

Reference: a McKinsey / BCG / Stripe Annual-Report-grade
business document, not a SaaS marketing flyer. Information
density is the brand. Every pixel earns its place.

Background: warm off-white #F7F8F8 base. Subtle green-tinted
ambient. Brushed graphite accents for charts. Light grid
fading to centre on hero cards.

Typography:
- Section labels: 11px uppercase Inter weight 700 tracking +1px,
  color green-700 #1B7A3D, often inside a 6px×12px pill with
  green-tinted background.
- H1/H2: Inter Display weight 800, sizes 32-48px, color gray-900
  #111827 on light, white on dark hero.
- Body: Inter 14-16px weight 400, color gray-600 #4B5563,
  line-height 1.6.
- Numbers: tabular-nums, weight 700 when used as headline
  stats. Dollar amounts with $ prefix, AUD, no decimals below
  $10M, otherwise 1 decimal place ($4.3B not $4,300M).
- Charts: 2D only, 1.5px lines, soft area fills at 6-10%
  opacity, no 3D, no chartjunk. Axis labels 11px gray-500.

Brand colours: same as the mockup pack —
  green-900 #145A2D, green-700 #1B7A3D, green-500 #2BAE5A,
  orange-500 #F97316, navy #0A0E1A, gray ramp.

Composition: dense, premium, single focal point per card.
Decision / Risk / Proof chips where useful. Footnotes in
10px gray-500 when sources are cited.

Do NOT include: stock photos of humans, hand-shake photos,
glowing-globe imagery, generic rocket-ship clip-art, generic
neural-network web, fake bookmaker logos, real AU bettor
photos, AI brain icons.
```

---

## Brand & Competitor Logo Lock Table

| Asset | Treatment | Guardrail |
|---|---|---|
| GreyhoundIQ | Chrome-green hex mark + "GreyhoundIQ" wordmark | Top-left, small, secondary to title |
| greyhound-data.com | Dark navy card with white "greyhound-data.com" wordmark, red "GBP" badge | Top-right on competitor cards |
| thedogs.com.au (GRNSW) | NSW blue badge with "thedogs" wordmark | Competitor cards only |
| FastTrack / GRV | VIC navy badge with "FastTrack" wordmark | Competitor cards only |
| Punters.com.au | Blue badge with "Punters" wordmark | Competitor cards only |
| Betfair Hub | Purple badge with "Betfair" wordmark + small "Iggy ML" tag | Competitor cards only |
| Tasracing FormPlus | TAS purple badge with "FormPlus" wordmark | Competitor cards only |
| OzChase | Gray badge with "OzChase" wordmark + small "ASP.NET" tag | Competitor cards only |
| AI Kick Start | Chrome AI monogram + wordmark | Bottom-right "Backed by AI Kick Start" lockup on cover only |

---

## Universal Negative Prompt (for plan visuals)

```text
real human faces, handshake, generic stock photo, generic
rocket, generic neural-network web, fake bookmaker logo,
oversized logo, watermark, empty grid, blank chart, missing
axis label, mismatched axis, distorted title, misspelled
brand, gibberish headings, AI brain icon, cartoon dog,
realistic dog photo, glowing orb, generic globe, dollar-sign
rain, money tree, fake AI sparkle, generic cyberpunk,
cyberpunk city, generic futuristic UI, pastel palette,
oversaturated neon, low contrast, blur, compression
artifacts, JPEG noise, emoji in chrome.
```

---

## 1. Cover

```text
GreyhoundIQ premium editorial BUSINESS PLAN COVER, 1400×788
WebP, 16:9.

V3 enhancement layer: dense control-console energy, single
focal hero, premium business-document feel.

Brand-logo lock: GreyhoundIQ chrome-green hex mark + wordmark
top-left. AI Kick Start lockup bottom-right.

Background: warm off-white #F7F8F8 with subtle green-tinted
ambient. A faint horizontal rule near the bottom (1px
gray-200).

Top: thin gray-400 metadata strip "Prepared for Daniel
Fleuren, AI Kick Start  •  Date 28 June 2026  •  Status
Confidential — Draft v1".

Main composition, two-column:
- Left (5/12): large GreyhoundIQ mark above H1 "Business &
  Marketing Plan" 56px bold weight 800 gray-900, tight
  letter-spacing -1.5px. Subhead "The smartest greyhound
  racing data platform in Australia. Built to outcompete
  greyhound-data.com and the fragmented state body sites on
  every level — features, branding, and price." in 16px
  gray-600.
- Right (7/12): a single big editorial figure. Title
  "$4.3B → $99/yr" in 72px bold gradient green-to-orange.
  Below: 3 micro-stats in a row ($4.3B annual AU wagering,
  500K active punters, 6 state bodies consolidated).

Bottom-right: small "Backed by AI Kick Start" lockup.

Negative prompts: see universal.
```

---

## 2. Part 1 Divider — Business Plan

```text
GreyhoundIQ premium editorial PART 1 DIVIDER card, 1400×788
WebP, 16:9.

Brand-logo lock: GreyhoundIQ top-left only.

Background: warm off-white.

Centered H1 "Part 1 — Business Plan" 64px bold weight 800
gray-900. Below: thin 1px gradient rule green→orange (24px
tall, 40% page width). Subhead "Sections 1–8" 14px gray-500
uppercase tracking.

Below rule: 4 small section pills in a row — "Executive
Summary", "Market", "Product", "Pricing" — each with a tiny
section-number badge (1, 2, 3, 4) in green-100 background.

Negative prompts: see universal.
```

---

## 3. Section 1 — Executive Summary hero

```text
GreyhoundIQ premium editorial SECTION 1 HERO, 1400×788 WebP,
16:9.

Title, exact text: "Executive Summary".

Composition, two-column:
- Left (6/12): section-label pill "📊 Business Plan", H2
  "Executive Summary" 36px bold gray-900, body paragraph
  (3-line excerpt): "GreyhoundIQ is a modern, mobile-first
  Australian greyhound racing data platform that aggregates
  national race data into a single, beautifully designed
  interface. It replaces the fragmented, outdated, and
  overpriced tools that currently serve this market."
- Right (6/12): 4 stat cards stacked 2×2 with exact values:
  "$4.3B" annual AU wagering, "500K" active punters, "$99/yr"
  Pro tier (21% below competitor), "~$14/mo" infrastructure
  cost. Each card with its label below.

Bottom strip: 3 "win on" cards — Win on Features (AI
predictions, GPS, unified national data, 5-gen pedigrees,
speed maps, API access), Win on Design (mobile-first,
ad-free, modern UI), Win on Price (AUD pricing, cheaper Pro
tier, generous free tier).

Negative prompts: see universal.
```

---

## 4. Section 2 — Market Analysis hero

```text
GreyhoundIQ premium editorial SECTION 2 HERO, 1400×788 WebP,
16:9.

Title: "Market Analysis — TAM $4.3B → SAM $15M/yr → SOM
$700K/yr (Y3)".

Composition:
- Top (full width): TAM/SAM/SOM nested chart. Three
  concentric rounded rectangles, outermost labeled "TAM
  $4.3B — 500K punters, all AU racing data users" in green-
  700. Middle labeled "SAM $15M/yr — ~120K serious punters &
  breeders who pay for racing data tools" in orange-500.
  Innermost labeled "SOM $700K/yr — 5% of SAM = 6,000 paying
  subscribers (Year 3)" in blue-500.

- Bottom-left: key stats table (7 rows). Annual wagering
  turnover $4.3B. Race meetings ~4,800/year. Active
  greyhounds ~10,000. Registered trainers ~3,500. Active
  punters ~500,000. Punters who pay for data tools ~120,000
  (24%). Active breeders ~1,200. Source column: "GRV + GRNSW
  combined", "All states", "National racing database", etc.

- Bottom-right: state-by-state horizontal bar chart. NSW
  $1.8B (1,650 meetings) green-700. VIC $1.5B (1,400) green-
  500. QLD $520M (800) orange-500. SA $180M (450) orange-300.
  WA $150M (350) blue-500. TAS $80M (150) purple-500.

Negative prompts: see universal. Numbers must match the
plan exactly.
```

---

## 5. Section 3 — Competitive Landscape hero

```text
GreyhoundIQ premium editorial SECTION 3 HERO, 1400×788 WebP,
16:9.

Title: "Competitive Landscape — 7 competitors, 1 winner".

Composition:
- Top: positioning map. Two axes — "Modern / Tech-Driven"
  (y) and "Greyhound-Only ↔ Multi-Code" (x). 5 competitor
  bubbles plotted:
  - "GreyhoundIQ" chrome-green hex mark, top-left quadrant
    (modern + specialist), largest bubble.
  - "greyhound-data.com" gray, bottom-left (legacy +
    specialist), medium bubble.
  - "Punters.com.au" gray, top-right (modern + general),
    medium bubble.
  - "State Body Sites" gray cluster, bottom-left.
  - "Betfair Hub" gray, right side (general + modern), small
    bubble.
  - "Tasracing FormPlus" gray, mid-left (slightly modern +
    specialist), small bubble.

- Bottom: 10-row feature comparison table. Columns:
  Feature | greyhound-data.com | State Body Sites |
  Punters.com.au | GreyhoundIQ. Rows: National data (all
  states), Official data (not user-contributed), AI race
  predictions, GPS / Isolynx tracking, 5-gen pedigree
  database, Testmating/breeding tools, Mobile-first
  responsive, Ad-free experience, API access, AUD pricing.
  GreyhoundIQ column highlighted green with ✓ on every row
  except where competitors have partial coverage.

Brand-logo lock: GreyhoundIQ top-left, gray competitor badges
top-right (small, faded).

Negative prompts: see universal. No real logos — use generic
stand-ins.
```

---

## 6. Section 4 — Product Strategy hero

```text
GreyhoundIQ premium editorial SECTION 4 HERO, 1400×788 WebP,
16:9.

Title: "Product Strategy — 4 phases, 14 weeks to launch".

Composition: vertical timeline with 4 phase cards. Each
phase card has a colored dot, phase label, title, body, and
feature tags:

Phase 1 (green dot) — Weeks 1-3: "MVP: Race Cards & Results"
Working website with today's race cards (all AU tracks),
basic form, results, dog search, track pages. Seeded with
5+ years of Betfair historical data. Mobile-first responsive
design.
Tags: Race cards, Dog search, Results, Free tier live.

Phase 2 (orange dot) — Weeks 4-6: "Data Depth: Form, Stats,
Breeding"
Full career form, advanced statistics (box bias, trainer
leaderboards), 5-generation pedigrees, testmating tool, sire
statistics, split times/sectionals, historical search.
Tags: Full form, Pedigrees, Breeding tools, Pro tier launches.

Phase 3 (blue dot) — Weeks 7-10: "Intelligence: AI
Predictions & GPS"
ML race predictions with probability models, AI speed maps,
performance forecasting, GPS tracking data (Isolynx-equipped
tracks), custom analytics dashboard, API access.
Tags: AI predictions, GPS tracking, API access, Pro+ tier
launches.

Phase 4 (purple dot) — Weeks 11-14: "Commercial: Billing,
Launch, Scale"
Stripe subscription billing, user authentication (email +
Google OAuth), pricing page, SEO optimisation, PWA
installable, performance audit, marketing site, public
launch.
Tags: Stripe billing, SEO, Public launch, Marketing push.

Negative prompts: see universal.
```

---

## 7. Section 5 — Pricing Strategy hero

```text
GreyhoundIQ premium editorial SECTION 5 HERO, 1400×788 WebP,
16:9.

Title: "Pricing — Free, $12/mo Pro, $29/mo Pro+ — 21% below
competitor".

Composition: 3-tier pricing card row:
- Free ($0/forever): Lead magnet for casual punters.
  Today's race cards (all AU), basic form (last 6 starts),
  results (today + yesterday), dog & track search, 5 detailed
  lookups/day. NO: full career history, AI predictions, API.
- Pro ($12/mo or $99/yr, MOST POPULAR green border, scale
  1.02, green pill): For serious punters who want every edge.
  Everything in Free + full career history, advanced stats &
  box bias, split times & sectionals, 5-gen pedigrees,
  breeding analytics, speed maps & watchlists, 5 years
  historical data, no ads. NO: AI predictions.
- Pro+ ($29/mo or $249/yr): Complete toolkit for
  professionals. Everything in Pro + GPS tracking data, AI
  race predictions, AI speed maps (ML), performance
  forecasting, custom analytics dashboard, API access
  (1,000 calls/day), data exports (CSV/JSON), email/SMS
  alerts, priority support.

Below cards: price comparison callout. "greyhound-data.com
Gold costs £65/year (~AUD $125). GreyhoundIQ Pro costs $99
AUD/year — that's 21% cheaper, in AUD (no conversion fees),
with more features."

Bottom-right: Y1 target subscriber mix donut chart. 2,500
total subscribers. Free 70% = 1,750 ($0). Pro 22% = 550
($54.5K/yr). Pro+ 8% = 200 ($49.8K/yr). Total Y1 revenue:
$104.3K.

Negative prompts: see universal.
```

---

## 8. Section 6 — Financial Projections hero

```text
GreyhoundIQ premium editorial SECTION 6 HERO, 1400×788 WebP,
16:9.

Title: "Financial Projections — $104K → $380K → $650K
3-year revenue".

Composition:
- Top (full width): 3-year bar chart. Y-axis $0 to $700K.
  Y1 bar green-700 70% opacity: $104K, 750 paid subs. Y2
  bar green-700 85% opacity: $380K, 2,800 paid subs. Y3 bar
  green-700 100% opacity: $650K, 6,000 paid subs. Orange
  dashed growth trajectory line arching across all three
  bars.

- Bottom: cost structure table, 6 rows × 5 cols.
  Headers: Cost Item | Y1 | Y2 | Y3 | Notes.
  Rows:
  - VPS/Hosting: $168/yr | $336/yr | $600/yr (Hetzner, scale
    up as needed).
  - Domain (.com.au): $15/yr | $15/yr | $15/yr.
  - Email (Resend): $0 | $240/yr | $600/yr (Free tier →
    paid at volume).
  - Payments (Stripe): ~$3K | ~$11K | ~$19K (1.75% + $0.30
    per transaction).
  - Residential proxies: $60/yr | $60/yr | $60/yr (Webshare
    for scraping).
  - Data licensing: $0 | ~$5K | ~$12K (Official feeds if/when
    needed).
  - TOTAL COSTS: ~$3.2K | ~$16.7K | ~$32.3K.
  - REVENUE: $104K | $380K | $650K.
  - NET PROFIT: $101K | $363K | $618K (97% gross margin).

Negative prompts: see universal. Numbers must match the
plan exactly.
```

---

## 9. Section 7 — Operational Plan hero

```text
GreyhoundIQ premium editorial SECTION 7 HERO, 1400×788 WebP,
16:9.

Title: "Operational Plan — solo dev, AI-assisted, ~$14/mo
infra".

Composition: 2×2 card grid.
- Top-left: "Data Pipeline" card. Automated Python workers
  on cron. Betfair CSVs seed 5 years of history. TAB API
  provides daily live race fields. FastTrack (VIC) and
  Tasracing scraped for stats/breeding. Community
  contributions fill gaps.
- Top-right: "Infrastructure" card. Single Hetzner VPS
  (4 vCPU, 8GB RAM, ~$8/mo). Next.js + PostgreSQL + Redis
  all on one box. Migrate to managed Postgres only when
  concurrent users exceed ~500. Cloudflare in front for
  CDN/DDoS protection.
- Bottom-left: "Team" card. Solo developer (Daniel) using
  Hermes Agent + AI-assisted development for 10x output. No
  hires needed until Year 2. Then: 1 part-time data engineer
  for pipeline maintenance, 1 part-time content writer for
  SEO.
- Bottom-right: "Monitoring & Quality" card. Automated health
  checks on ingestion pipeline. Data accuracy dashboard
  comparing our results against official sources. User
  feedback/report system for data discrepancies. Sentry for
  error tracking.

Below grid: data sources & reliability table (7 rows × 5
cols). Headers: Source | Data Type | Cost | Reliability |
Setup Time.
Rows:
- Betfair CSVs: 5yr history, BSP, Iggy model. Free. High.
  Immediate.
- TAB API: Live race fields, all states. Free. Medium.
  1 week.
- FastTrack (GRV): VIC stats, breeding, stewards. Free.
  High. 1 week.
- Tasracing FormPlus: TAS form, results, replays. Free.
  High. 3 days.
- Betfair Exchange API: Real-time odds, streaming. Free
  (acct). High. 1 week.
- GRNSW Partnership: NSW fields, results, form. $$ TBD.
  High. 4-8 weeks.
- GRV Partnership: Isolynx GPS data. $$ TBD. High. 4-8
  weeks.

Negative prompts: see universal.
```

---

## 10. Section 8 — Risk Analysis hero

```text
GreyhoundIQ premium editorial SECTION 8 HERO, 1400×788 WebP,
16:9.

Title: "Risk Analysis — 6 risks, 6 mitigations".

Composition:
- Left: "Key Strengths" card (green-bordered). Bullets:
  Near-zero infra cost (~$14/mo) = profitability from first
  paying customer. Multiple free data sources confirmed — no
  single-source dependency. Competitor entrenched in outdated
  tech and unlikely to modernise quickly. 97% gross margin —
  subscription with zero marginal cost per user. AI
  predictions + GPS data are moats competitors can't easily
  replicate. Australian-specific focus builds local trust.

- Right: "Key Risks" card (red-bordered). Bullets:
  Data partnerships could be expensive or denied — mitigated
  by free scraping fallbacks. TAB API or scraped sites could
  change structure — mitigated by multi-source strategy.
  Racing authorities may object to scraping — mitigated by
  only using publicly accessible data and pivoting to
  partnerships. greyhound-data.com could modernise in
  response — mitigated by AI features they can't replicate
  and AU-specific focus. Responsible gambling compliance
  requirements — must implement 18+ checks and Gamble
  Responsibly messaging. Seasonal user behaviour — racing is
  year-round but wagering peaks spring carnival.

- Bottom: risk heat map. 2×2 grid (likelihood × impact).
  Coloured quadrants: green "LOW RISK", orange "MONITOR",
  yellow "MANAGE", red "CRITICAL". 6 risk dots plotted:
  - R1: Data licensing cost — orange/MONITOR.
  - R2: API structure change — yellow/MANAGE.
  - R3: Sites block scraping — orange/MONITOR.
  - R4: Competitor upgrades — green/LOW RISK.
  - R5: Responsible gambling — yellow/MANAGE.
  - R6: Slow user adoption — green/LOW RISK.

Negative prompts: see universal.
```

---

## 11. Part 2 Divider — Marketing Plan

```text
GreyhoundIQ premium editorial PART 2 DIVIDER card, 1400×788
WebP, 16:9.

Brand-logo lock: GreyhoundIQ top-left only.

Centered H1 "Part 2 — Marketing Plan" 64px bold weight 800.
Thin gradient rule. Subhead "Sections 9–16" 14px gray-500
uppercase tracking.

Below rule: 4 small section pills in a row — "Audience",
"Positioning", "Channels", "Launch" (9, 10, 11, 13).

Negative prompts: see universal.
```

---

## 12. Section 9 — Target Audience hero

```text
GreyhoundIQ premium editorial SECTION 9 HERO, 1400×788 WebP,
16:9.

Title: "Target Audience — 3 personas, 60/25/15 revenue split".

Composition: 3 persona cards stacked horizontally.

Persona 1 — "The Serious Punter" (primary, 60% of revenue):
- Male, 35-65. Bets $200-$2,000/week. Values data over tips.
- Bets on greyhounds 3-5 days/week. Currently uses a mix of
  free sites, Punters.com.au, and maybe a greyhound-data.com
  subscription. Frustrated by fragmented data, outdated UIs,
  and lack of predictions. Wants speed maps, sectional times,
  box bias stats, AI predictions to find an edge.
- Will pay $12-$29/mo for a genuine advantage.
- Badges: "Primary target" green, "Pro / Pro+ tier" green,
  "LTV: $300-$600/yr" gray.

Persona 2 — "The Breeder/Trainer" (secondary, 25% of
revenue):
- Mixed demographics. Industry participant. Values pedigree
  data.
- Needs pedigree databases, testmating tools, sire
  statistics, litter performance tracking. Currently relies
  on greyhound-data.com (unreliable, user-contributed) and
  FastTrack (VIC only).
- Will pay for accurate, national breeding data with modern
  tools. Values depth and accuracy over speed/predictions.
- Badges: "Secondary target" orange, "Pro tier" orange,
  "LTV: $99-$249/yr" gray.

Persona 3 — "The Casual Punter" (tertiary, 15% of revenue,
70% of users):
- Broad demographics. Bets occasionally. Values simplicity.
- Bets during big races or at the pub. Checks form on phone
  before a bet. Currently uses free sites or bets on vibes.
  Won't pay for data but will use the free tier and convert
  to Pro if they get serious.
- Top of the funnel — drives SEO traffic and free-to-paid
  conversion.
- Badges: "Funnel driver" blue, "Free → Pro conversion"
  blue, "LTV: $0 → $99/yr" gray.

Negative prompts: see universal. No real human faces — use
avatar silhouettes only.
```

---

## 13. Section 10 — Positioning hero

```text
GreyhoundIQ premium editorial SECTION 10 HERO, 1400×788 WebP,
16:9.

Title: "Brand Positioning — Authority, Intelligence,
Simplicity, Value".

Composition:
- Top: positioning statement callout (green-bordered). "For
  Australian greyhound racing enthusiasts who want a genuine
  edge, GreyhoundIQ is the data platform that combines
  official national race data, AI predictions, and breeding
  analytics in a modern, ad-free interface — unlike
  greyhound-data.com, which is outdated, unreliable, and
  charges in foreign currency."

- Middle: 3 card row.
  - "Brand Personality" card: Authoritative but accessible.
    Data-driven, not stuffy. The "smart friend" who knows
    greyhound racing inside out — not the old-school bookie
    type.
  - "Key Differentiators" card: 1) Only platform with AI
    predictions. 2) Only unified national data source. 3)
    AUD pricing. 4) Modern mobile-first design. 5) API access
    for developers.
  - "Tone of Voice" card: Direct, confident, data-backed. No
    hype, no false promises. "Here's what the numbers say."
    Australian, not corporate. Responsible gambling messaging
    woven throughout.

- Bottom: 4 brand-pillar cards in a row.
  - "Authority" — Official data, not user-contributed.
  - "Intelligence" — AI predictions nobody else offers.
  - "Simplicity" — Clean, fast, mobile-first UX.
  - "Value" — More features, less money, AUD.

Negative prompts: see universal.
```

---

## 14. Section 11 — Acquisition Strategy hero

```text
GreyhoundIQ premium editorial SECTION 11 HERO, 1400×788 WebP,
16:9.

Title: "Customer Acquisition — SEO-led, 880 Pro subs/mo at
steady state (Y2)".

Composition:
- Top (full width): acquisition funnel, 5 narrowing bands.
  - 100K/mo website visitors (gray-200, widest).
  - 8K free sign-ups (8%, orange-500).
  - 4K active free users weekly (50% of sign-ups, green-500).
  - 880 Pro conversions (22% of active, green-700).
  - 44 Pro+ conversions (5% of Pro, green-900, narrowest).
  Footer: "Year 2 steady-state targets".

- Bottom: channel priority matrix table (9 rows × 5 cols).
  Headers: Channel | Priority | Cost | Time to Results |
  Expected CAC.
  Rows:
  - SEO / Content Marketing: P1 Critical. Time only. 3-6
    months. $0-$5.
  - Community / Forums: P1 Critical. Time only. Immediate.
    $0-$3.
  - Greyhound Racing Subreddits: P1 Critical. Free.
    Immediate. $0.
  - Twitter/X (Racing Community): P2 High. Time only. 1-3
    months. $2-$8.
  - YouTube (Race Analysis Videos): P2 High. $50-$100/video.
    3-6 months. $5-$15.
  - Email Marketing (Newsletter): P2 High. $0-$50/mo. 1-2
    months. $1-$5.
  - Partnerships (Tipsters, Podcasts): P3 Medium. Revenue
    share. 2-4 months. $10-$25.
  - Google Ads (Search): P4 Later. $500-$2K/mo. Immediate.
    $15-$40.
  - Meta Ads (Facebook/IG): P4 Later. $500-$2K/mo.
    Immediate. $20-$50.

Negative prompts: see universal. No real ad creatives.
```

---

## 15. Section 12 — Content & SEO Strategy hero

```text
GreyhoundIQ premium editorial SECTION 12 HERO, 1400×788 WebP,
16:9.

Title: "Content & SEO — 10,000+ programmatic pages, 50K/mo
organic visits".

Composition:
- Left: 2-card stack.
  - "Programmatic SEO" card: Every dog in the database gets
    a SEO-optimised profile page (/dogs/aston-queen). Every
    track gets a stats page (/tracks/wentworth-park/box-stats).
    Every sire gets a progeny page. Creates 10,000+ indexable
    pages targeting long-tail keywords with high intent.
  - "Content Hub" card: Publish 2-3 articles/week targeting
    informational keywords: "best greyhound racing tips",
    "how to read greyhound form", "Wentworth Park box bias
    guide", "top sires in Australia 2026". Each article links
    back to relevant data pages, driving conversion to Pro.

- Right: target keywords table (8 rows × 5 cols). Headers:
  Keyword | Monthly Volume (AU) | Difficulty | Intent |
  Target Page.
  Rows:
  - greyhound form guide: 8,100. Medium. Transactional.
    /races.
  - greyhound racing results: 6,600. Low. Informational.
    /results.
  - greyhound racing tips: 5,400. Medium. Transactional.
    Content article.
  - wentworth park results: 1,900. Low. Informational.
    /tracks/wentworth-park.
  - greyhound breeding: 1,300. Low. Informational. /breeding.
  - barcia bale progeny: 320. Very Low. Informational.
    /sires/barcia-bale.
  - greyhound race cards today: 2,400. Low. Transactional.
    Homepage.
  - [dog name] form: 50-200 each. Very Low. Informational.
    /dogs/[name].

Bottom: SEO math callout. "With 10,000+ programmatic pages
averaging just 5 visits/month each = 50,000 monthly organic
visits. At 8% free signup rate = 4,000 new signups/month.
At 22% Pro conversion = 880 new Pro subscribers/month. This
is the growth engine."

Negative prompts: see universal.
```

---

## 16. Section 13 — Launch Plan hero

```text
GreyhoundIQ premium editorial SECTION 13 HERO, 1400×788 WebP,
16:9.

Title: "Go-to-Market — 4-stage launch, weeks 10-16+".

Composition: vertical timeline with 4 stage cards.

Stage 1 (green dot) — Pre-Launch (Weeks 10-12): "Community
Seeding"
Identify and engage with the greyhound racing community on
Reddit (r/AusGreyhounds, r/greyhoundracing), Twitter racing
community, and greyhound racing forums. Share useful data
insights. Build relationships before asking for anything. Get
early feedback from 20-30 community members.
Tags: Reddit, Twitter, Beta testers.

Stage 2 (orange dot) — Soft Launch (Week 13): "Free Tier
Public"
Launch the free tier publicly. Announce on Reddit, Twitter,
and racing forums. Focus message on "free, modern, national
greyhound racing data — no ads, no GBP pricing." Collect
email addresses for Pro tier waitlist. Publish first 5 SEO
content articles.
Tags: Free tier live, Email waitlist, SEO content starts.

Stage 3 (blue dot) — Pro Launch (Week 15): "Paid Tiers Go
Live"
Email the waitlist with a launch offer (e.g. 50% off first 3
months). Enable Stripe billing for Pro and Pro+ tiers.
Publish comparison content ("GreyhoundIQ vs
greyhound-data.com"). Start YouTube channel with race
analysis videos using the platform.
Tags: Pro billing live, Launch offer, YouTube channel.

Stage 4 (purple dot) — Scale (Week 16+): "Growth Engine"
Ramp content production to 3 articles/week. Launch weekly
email newsletter with race previews. Partner with 2-3
tipsters/podcasters for co-marketing. Begin testing Google
Ads on high-intent keywords. Start programmatic SEO page
generation at scale.
Tags: 3 articles/wk, Newsletter, Partnerships, Paid ads test.

Negative prompts: see universal.
```

---

## 17. Section 14 — Partnerships hero

```text
GreyhoundIQ premium editorial SECTION 14 HERO, 1400×788 WebP,
16:9.

Title: "Partnership Strategy — tipsters, podcasts, APIs,
industry bodies".

Composition: 2×2 card grid.
- Top-left: "Tipster Partnerships" card. Partner with
  greyhound racing tipsters on Twitter and YouTube. Offer
  them free Pro+ accounts in exchange for promoting
  GreyhoundIQ to their audience. Revenue share model: 20%
  recurring commission for any subscriber they refer.
- Top-right: "Podcast Sponsorships" card. Sponsor 2-3
  Australian racing podcasts. Negotiate promo code deals —
  listeners get 20% off, podcast gets revenue share. Target:
  ~5,000 downloads/episode podcasts.
- Bottom-left: "App/Tool Integrations" card. Offer API access
  to other racing tools, betting calculators, and tipster
  platforms. Pro+ API tier creates a B2B revenue stream and
  positions GreyhoundIQ as the data backbone for the
  ecosystem.
- Bottom-right: "Industry Body Relationships" card. Build
  relationships with GRV, GRNSW, and Racing Queensland.
  Position GreyhoundIQ as a partner that grows the sport by
  improving the punter experience. Explore co-marketing
  opportunities and official data licensing.

Negative prompts: see universal. No real stud-farm logos —
use generic stand-ins.
```

---

## 16. Section 15 — KPIs & Success Metrics hero

```text
GreyhoundIQ premium editorial SECTION 15 HERO, 1400×788 WebP,
16:9.

Title: "KPIs — 4 categories, weekly cadence, 30:1 LTV:CAC".

Composition:
- Top (full width): KPI table (11 rows × 5 cols). Headers:
  Category | KPI | Year 1 | Year 2 | Year 3.
  Rows:
  - Acquisition: Monthly organic traffic: 15K | 50K | 100K.
  - Acquisition: Free sign-ups/month: 1,200 | 4,000 | 8,000.
  - Acquisition: Email list size: 5,000 | 20,000 | 50,000.
  - Conversion: Free→Pro conversion rate: 15% | 22% | 25%.
  - Conversion: Pro→Pro+ upgrade rate: 5% | 8% | 10%.
  - Conversion: Visitor→Free signup rate: 5% | 8% | 10%.
  - Revenue: Monthly recurring revenue: $4K | $20K | $45K.
  - Revenue: ARPU: $110/yr | $135/yr | $150/yr.
  - Revenue: Blended CAC: <$15 | <$10 | <$8.
  - Retention: Monthly churn rate: <8% | <5% | <3%.
  - Retention: Annual subscriber retention: 60% | 75% | 85%.

- Bottom: unit economics stat row, 4 cards.
  - "$300" LTV (Pro, Year 2).
  - "$10" Blended CAC (Year 2).
  - "30:1" LTV:CAC ratio.
  - "3 mo" CAC payback period.

Negative prompts: see universal. Numbers must match exactly.
```

---

## 19. Section 16 — Marketing Budget hero

```text
GreyhoundIQ premium editorial SECTION 16 HERO, 1400×788 WebP,
16:9.

Title: "Marketing Budget — $15,000 Year 1, funded from
revenue".

Composition:
- Top (full width): horizontal bar chart showing Y1 budget
  allocation. 6 bars:
  - Content / SEO writing: $5,000 (33%) green-700.
  - YouTube production: $3,000 (20%) orange-500.
  - Partnerships / affiliates: $2,500 (17%) blue-500.
  - Email marketing tools: $1,500 (10%) purple-500.
  - Google Ads (test): $2,000 (13%) yellow-500.
  - Misc / contingency: $1,000 (7%) gray-500.

- Bottom: budget philosophy callout (green-bordered). "Year
  1 marketing budget is $15,000 — funded entirely from Year
  1 revenue (~$104K). The majority (53%) goes to content and
  YouTube, which compound over time. Paid ads are deliberately
  small until organic channels prove out. The budget scales
  proportionally with revenue: Year 2 targets $50K marketing
  spend, Year 3 $100K."

Negative prompts: see universal.
```

---

## 20. Back Cover / About

```text
GreyhoundIQ premium editorial BACK COVER, 1400×788 WebP, 16:9.

Brand-logo lock: GreyhoundIQ centre top.

Background: warm off-white with subtle green-tinted ambient.

Centered H2 "GreyhoundIQ — Australian greyhound racing,
data done right." 32px bold.

Below: 4 stat chips in a row — "$4.3B market", "500K
punters", "6 states", "1 platform".

Body paragraph (3 lines): "AI Kick Start is the technology
partner behind GreyhoundIQ. We build modern data products
for Australian industries that have been left behind by
2010-era tools."

Bottom: contact block. Email, website, "Backed by AI Kick
Start" lockup with chrome AI monogram.

Bottom-most line: "Confidential. Contains forward-looking
projections based on market research and competitive
analysis. Not financial advice. 18+ only. Bet responsibly."

Negative prompts: see universal.
```

---

## INFOGRAPHIC PROMPTS — 8 vertical infographics (1080×1920)

Vertical format for Instagram / LinkedIn / X. Same V3
structure but portrait.

### IG-01. Market sizing funnel

```text
GreyhoundIQ premium vertical INFOGRAPHIC, 1080×1920 WebP,
9:16 portrait.

Brand-logo lock: GreyhoundIQ top-centre.

Title (top): "The Australian Greyhound Wagering Market".

Funnel, top to bottom, narrowing:
- Top wide band: "ALL AU GAMBLING — $25.0B FY24" gray-700
  fill.
- Next band: "ALL RACING (horse + harness + greyhound) —
  $5.8B" gray-500 fill.
- Next: "GREYHOUND RACING ONLY — $4.3B" green-700 fill,
  bold.
- Next: "SAM — DATA-TOOL PAYERS — $15M/yr" orange-500 fill,
  bold.
- Bottom: "SOM Y3 TARGET — $650K ARR (6,000 SUBS)" green-500
  fill, bold, large.

Bottom: source footnote "Source: GRV + GRNSW combined,
Racing Australia Annual Report 2024, internal modelling.

Negative prompts: see universal.
```

---

### IG-02. Competitor positioning quadrant (vertical)

```text
GreyhoundIQ premium vertical INFOGRAPHIC, 1080×1920 WebP.

Title: "Where GreyhoundIQ sits".

2D quadrant chart, 600×600 centred.
- Y-axis "Modern / Tech-Driven" low → high.
- X-axis "Greyhound-Only ↔ Multi-Code".
- Bubbles:
  - "GreyhoundIQ" green bubble, top-LEFT (modern + greyhound-
    only), LARGEST bubble.
  - "greyhound-data.com" gray bubble, bottom-LEFT (legacy +
    greyhound-only), medium.
  - "Punters.com.au" gray bubble, top-RIGHT (modern +
    multi-code), medium.
  - "State Body Sites" gray cluster, bottom-LEFT.
  - "Betfair Hub" gray bubble, right side, small.
  - "Tasracing FormPlus" gray bubble, mid-left, small.

Right side: legend with bubble sizes.
Bottom: 4-line summary "GreyhoundIQ is the only platform
that is both modern AND greyhound-specialist. Every other
option is either outdated, generalist, or locked to one
state."

Negative prompts: see universal. No real logos.
```

---

### IG-03. Pricing comparison table (vertical)

```text
GreyhoundIQ premium vertical INFOGRAPHIC, 1080×1920 WebP.

Title: "Pricing — GreyhoundIQ vs greyhound-data.com".

Vertical comparison table, 10 rows × 3 columns:
Feature | greyhound-data.com | State Bodies | Punters.com.au
| GreyhoundIQ.
- National data (all states): ✕ | ✕ (state only) | ✓ | ✓
  Unified.
- Official data: ✕ | ✓ | ✓ | ✓.
- AI predictions: ✕ | ✕ | ✕ | ✓ ML-powered.
- GPS/Isolynx tracking: ✕ | VIC only | ✕ | ✓ (Pro+).
- 5-gen pedigree DB: ✓ (global) | ✕ | ✕ | ✓ AU-focused.
- Testmating tools: Basic | VIC only | ✕ | ✓ Advanced.
- Mobile-first: ✕ | ✕ | ✓ | ✓ PWA.
- Ad-free: ✕ (ad-heavy) | ✓ | ✕ | ✓.
- API access: ✕ | ✕ | ✕ | ✓ (Pro+).
- AUD pricing: ✕ (GBP) | Free | Free | ✓ AUD.

Bottom row: price comparison. "greyhound-data.com Gold:
£65/yr (~AUD $125). GreyhoundIQ Pro: $99 AUD/yr — 21%
cheaper, in AUD, with more features."

Negative prompts: see universal.
```

---

### IG-04. Acquisition funnel (vertical)

```text
GreyhoundIQ premium vertical INFOGRAPHIC, 1080×1920 WebP.

Title: "How a punter becomes a paying customer".

Funnel, top to bottom (Year 2 steady-state targets):
- Website Visitors: 100K/month (top wide band, gray-200).
- Free Sign-ups: 8K (8%, orange-500).
- Active Free Users Weekly: 4K (50% of sign-ups, green-500).
- Pro Conversions: 880 (22% of active, green-700).
- Pro+ Conversions: 44 (5% of Pro, green-900, narrowest).

Right side: 5 small channel labels pointing into the
funnel: SEO, Reddit, Twitter, YouTube, Email.
Bottom: footnote "Year 2 steady-state targets".

Negative prompts: see universal.
```

---

### IG-05. Build roadmap timeline (vertical)

```text
GreyhoundIQ premium vertical INFOGRAPHIC, 1080×1920 WebP.

Title: "Build roadmap — 4 phases, 14 weeks to launch".

Vertical timeline, 4 stops:
- Phase 1 (green) — Weeks 1-3: MVP Race Cards & Results.
  All AU tracks, basic form, dog search, free tier live.
- Phase 2 (orange) — Weeks 4-6: Data Depth. Full career
  form, box bias, pedigrees, breeding tools, Pro tier
  launches.
- Phase 3 (blue) — Weeks 7-10: Intelligence. AI predictions,
  GPS tracking (Isolynx), API access, Pro+ tier launches.
- Phase 4 (purple) — Weeks 11-14: Commercial. Stripe
  billing, Google OAuth, SEO, PWA, public launch.

Each stop: small icon, phase label, 3-line body, tiny
metric chip.

Bottom: small Y1 marketing timeline — "Wk 10-12 community
seeding → Wk 13 free tier public → Wk 15 Pro launch → Wk 16+
scale".

Negative prompts: see universal.
```

-3) | 6,000 paid subs".

Composition:
- Top (full width): 3-year bar chart. Y-axis $0 to $700K.
  Y1 bar: $104K, 750 paid subs. Y2 bar: $380K, 2,800 paid
  subs. Y3 bar: $650K, 6,000 paid subs.
- Middle: cost structure table. 6 cost items × 3 years.
  Total costs $3.2K → $16.7K → $32.3K. Revenue $104K →
  $380K → $650K. Net profit $101K → $363K → $618K (97% gross
  margin).
- Bottom: stat row — "97% gross margin", "~$14/mo infra",
  "3,500 trainers", "1,200 breeders".

Negative prompts: see universal.
```

---

### IG-06. Persona snapshot (3-up vertical)

```text
GreyhoundIQ premium vertical INFOGRAPHIC, 1080×1920 WebP.

Title: "Three punters, one product".

3 persona cards stacked top to bottom, each:
- Avatar placeholder (gray, no face).
- Name 24px bold, role + state 14px gray.
- WTP badge ($$ Recreational, $$$ Pro, $$$$ Industry).
- "What they want" 3 bullets.
- "What they pay for" 3 bullets.
- "How we reach them" 3 bullets.

Personas (exact from plan):
1. "The Serious Punter" — Male 35-65, bets $200-$2,000/week,
   values data over tips. Wants speed maps, sectional times,
   box bias, AI predictions. Pays $12-$29/mo. LTV $300-$600/yr.
2. "The Breeder/Trainer" — Industry participant, values
   pedigree data. Wants pedigree DB, testmating, sire stats,
   litter performance. Pays $99-$249/yr. LTV $99-$249/yr.
3. "The Casual Punter" — Bets occasionally at big races/pub,
   checks form on phone. Won't pay but drives free-tier
   traffic + conversion. LTV $0 → $99/yr.

Bottom: "Same product, three jobs-to-be-done, three pricing
tiers, three acquisition motions."

Negative prompts: see universal. No real human faces.
```

---

### IG-07. Risk heatmap (vertical)

```text
GreyhoundIQ premium vertical INFOGRAPHIC, 1080×1920 WebP.

Title: "Risk Analysis — 6 risks, severity vs likelihood".

3×3 grid, severity (rows) vs likelihood (cols). 6 risk
dots plotted, each coloured by quadrant:
- R1: Data licensing cost — orange/MONITOR (top-right area).
- R2: API structure change — yellow/MANAGE (mid-right).
- R3: Sites block scraping — orange/MONITOR (top-mid).
- R4: Competitor upgrades — green/LOW RISK (bottom-left).
- R5: Responsible gambling — yellow/MANAGE (mid-left).
- R6: Slow user adoption — green/LOW RISK (bottom-mid).

Right side: legend + mitigation 1-line per risk:
- R1: Free scraping fallbacks.
- R2: Multi-source strategy.
- R3: Public data only + pivot to partnerships.
- R4: AI features they can't replicate + AU focus.
- R5: 18+ checks + Gamble Responsibly messaging.
- R6: Multiple free data sources = product works from day
  one.

Bottom: footnote "Reviewed quarterly by founding team + AI
Kick Start."

Negative prompts: see universal.
```

---

### IG-08. Why-now moment (vertical)

```text
GreyhoundIQ premium vertical INFOGRAPHIC, 1080×1920 WebP.

Title: "Why now — 4 converging shifts".

4 stacked rows, each a small card:
1. "AI / ML is finally useful for tabular sports data" —
   model-based race predictions are now production-viable
   (2024-2026 inflection).
2. "Competitor is stuck" — greyhound-data.com uses PHP/
   JQuery, charges GBP, user-contributed = unreliable. No
   modernization in sight.
3. "Data sources confirmed free" — Betfair CSVs (5yr free
   history), TAB API (free live fields), FastTrack/GRV
   (free VIC), Tasracing (free TAS). No single-source
   dependency.
4. "Infra cost near zero" — ~$14/mo Hetzner VPS = full
   stack. Profitable from first paying customer. 97% gross
   margin.

Bottom: "The convergence is real. The window is 14 weeks
to MVP, 6 months to national launch."

Negative prompts: see universal.
```

---

## Notes for usage

- Paste the Plan Visual Style Stack once per session. Re-paste
  per prompt — GPT Image 2 loses design system after 1
  generation.
- Aspect ratios: GPT Image 2 supports 1024×1024, 1024×1536,
  1536×1024. For 1400×788 use 1536×1024. For 1080×1920 use
  1024×1536 (closest portrait) and accept the slight crop.
- Charts MUST contain specific numbers (not "varying
  revenue"). GPT Image 2 hallucinates wildly on financial
  charts; pin the data explicitly in the prompt.
- Every number in this pack now matches the 16-section
  business plan exactly. Do NOT substitute different figures.
- ~80% of generations are clean on first pass; ~20% need
  regeneration (broken type, distorted logos). Bad
  generations are not prompt bugs.
- Companion files: `logo-ultra-prompt.md`, `mockup-prompts.md`.
  All three follow the V3 Ultimate structure.
- Final deliverable: 20 plan visuals + 8 infographics = 28
  images.