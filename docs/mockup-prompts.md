# GreyhoundIQ — UX Mockup Prompt Pack v3 Ultimate (21 screens)

> For OpenAI **GPT Image 2** (Ideogram 4 / DALL·E 3 fallbacks).
> Target: 1400×788 WebP for desktop cards, 1024×1820 WebP for mobile.
> Paste the **Global Style Stack** once, then paste each numbered prompt.
> All prompts are written so the outputs look like one product line.

---

## What changed in v3 (vs v1)

- Upgraded per-screen prompts to match the v3-ultimate structure: explicit hierarchy, exact-title discipline, brand-logo lock, four-panel composition, workflow strip, full negative prompt.
- Updated brand palette from the **live CSS at `src/app/globals.css`** (June 28 2026 snapshot) — primary `hsl(142 76% 36%)`, accent orange `hsl(25 95% 53%)`, plus full neutral ramp.
- Added GreyhoundIQ logo lock specification: small chrome-green hex mark, top-left only.
- Added a **Track & Dog Logo Lock Table** for the Australian tracks and stud dogs that appear in mockup data.
- Hardened negative prompts against fake bookmaker logos, AI-brain cliches, and realistic greyhound photography.

---

## Global V3 Style Stack

```text
GreyhoundIQ premium dark-data visual system.

Background: charcoal black #08090A as default, brushed graphite,
subtle green-grid lines fading to centre, particle dots, bokeh,
lens flare, volumetric lighting, deep shadows, chrome bevels,
black-glass HUD panels, holographic interface elements.

For LIGHT surfaces (homepage pricing, marketing, content pages):
warm off-white #F7F8F8 with a faint green-tinted ambient.

Typography: huge bold Inter for hero text, weight 700-800,
tight letter-spacing -0.5 to -1px, white/chrome face on dark
backgrounds, dark grey-900 on light backgrounds, soft brand-colour
inner glow on dark hero text, crisp edges, premium news-card
typography. Body 14-16px weight 400. Numbers in tables in
tabular-nums with monospace-feel. Section labels 11-12px
uppercase tracking +0.5px gray-500.

Composition rules:
- Centre-weighted. The hero title or main UI is the first read.
- Top-left: small GreyhoundIQ chrome-green hex mark + wordmark,
  secondary to title, never competing with it.
- Top-right: small flat-badge track logos if relevant (see
  Track & Dog Logo Lock Table), secondary, undistorted.
- Four surrounding panels (where applicable): charts, checklists,
  terminal snippets, gauges, sparklines, comparison tables,
  status chips. Each panel MUST contain article-specific content,
  no empty grids, no decorative fake UI.
- Bottom workflow strip (where applicable): four labelled stages
  with icons and arrows.

Brand colours (use exactly these hex values, no substitutes):
  --green-900:  #145A2D   (primary text on light, dark accent)
  --green-700:  #1B7A3D   (primary brand, buttons, hero glow)
  --green-500:  #2BAE5A   (active states, success, wins)
  --orange-500: #F97316   (Pro badge, AI markers, secondary)
  --orange-300: #FB923C   (hover state)
  --navy:       #0A0E1A   (dark hero, code blocks)
  --navy-2:     #0F1011   (dark surface 2)
  --gray-50:    #F9FAFB   (page background light)
  --gray-100:   #F3F4F6   (card alt light)
  --gray-200:   #E5E7EB   (borders light)
  --gray-400:   #9CA3AF   (placeholder, axis labels)
  --gray-600:   #4B5563   (secondary text)
  --gray-900:   #111827   (primary text on light)
  --red-500:    #EF4444   (losses, negative deltas, errors)
  --blue-500:   #3B82F6   (informational, Pro feature highlight)
  --purple-500: #8B5CF6   (AI prediction glow, secondary accent)
  --white:      #FFFFFF

Components:
- Card-based layout. 1px border gray-200 on light, white/10% on
  dark. 12-16px border-radius.
- Soft shadows only when needed: 0 1px 3px rgba(0,0,0,0.04) on
  light, 0 8px 32px rgba(0,0,0,0.4) on dark.
- Icons: thin 1.5px stroke, rounded line caps, 20-24px, Linear /
  Lucide style. Never filled. Never emoji. The four feature
  icons are Trophy (career form), Brain (AI predictions),
  Dna double-helix (breeding), BarChart3 (advanced stats).
- Buttons: solid green-500 for primary, white with gray-200
  border for secondary. 8-10px radius. 14-16px text weight 600.
- Status badges: pill shape, 11-12px text, 4px vertical padding,
  10px horizontal padding, gray-100 bg for neutral, green-100-
  equivalent tint for success, orange tint for Pro/AI, red tint
  for losses.
- Tables: header row gray-50, body rows white, 1px gray-100
  dividers, 14px cell text, 12-16px cell padding, tabular nums.
- Charts: 2D only, subtle 1.5px lines, soft area fills at
  8-12% opacity, no 3D, no grid lines except horizontal at
  0/25/50/75/100. Axis labels 11px gray-500. No chartjunk.
- No drop shadows on text. No glow except a single subtle
  purple glow on AI prediction elements.
- Whitespace is premium. 24-32px between major sections.

Chrome / framing (desktop mockups):
- macOS-style browser window: rounded 12px corners, light gray
  title bar #E5E7EB, three traffic lights (red, yellow, green
  circles) on the left, centred URL pill "greyhoundiq.com.au/..."
  in 11px SF Pro. Drop shadow 30% opacity, 40px blur, 0 24px
  offset. Solid #F3F4F6 background outside the browser.

Chrome / framing (mobile mockups):
- iPhone 15-style device: thin black bezel, 48px corner radius,
  notch at top. Screen content fills bezel. Solid #F3F4F6
  background. Drop shadow 30% opacity, 40px blur.

Aspect ratio:
- Desktop: 1400×788 (16:9 horizontal).
- Mobile: 1024×1820 (9:16 portrait).
- Logos / wordmarks: 1:1 (1024×1024).

Composition rules:
- Browser/device frame centred, 80px breathing room all sides.
- Frame is chrome, not art. All text is part of the simulated UI.
- Hero is dark navy with green accents. Light mode everywhere
  else except dashboard sidebar, pricing, and Pro marketing.
- All Australian context: tracks "Wentworth Park", "The Meadows",
  "Angle Park", "Sandown", "Albany", "Wentworth Park",
  "Cannington". Dogs "Zipping Megatron", "She's A Pearl",
  "Fernando Bale", "Blue Blend". States NSW/VIC/QLD/SA/WA/TAS.
  Currency AUD ($). Dates DD/MM/YYYY or "Sun 28 Jun" format.

Do NOT include:
- Real human faces (use silhouettes or no avatars).
- Real bookmaker logos (Ladbrokes, Bet365, Sportsbet — show
  generic "Sportsbook" placeholders only).
- Real betting odds shown as truth.
- Emoji in the UI. No 🚀 🏆 📊 in the product chrome.
- Lorem ipsum. Use realistic Australian greyhound racing vocab.
- Fake AI brain / generic "neural network" iconography.
```

---

## Track & Dog Logo Lock Table

| Brand / asset | Correct prompt treatment | Guardrail |
|---|---|---|
| GreyhoundIQ | Small chrome-green hexagonal mark + "GreyhoundIQ" wordmark. Top-left only. Secondary to title. | Never central hero. Never enlarged. |
| Wentworth Park | Circular navy badge with "WP" monogram in white + thin "Wentworth Park" wordmark. | Top-right safe area. |
| The Meadows | Circular green badge with "TM" monogram. | Top-right. |
| Angle Park | Circular orange badge with "AP" monogram. | Top-right. |
| Sandown | Circular blue badge with "SD" monogram. | Top-right. |
| Cannington | Circular purple badge with "CT" monogram. | Top-right. |
| Zipping Megatron | Small silhouette icon + wordmark in green. | Used in pedigree / dog profile contexts only. |
| Sportsbook (placeholder) | Generic rounded-rect badge with "Sportsbook" wordmark in gray-600. | Stand-in for real bookmaker logos. |

---

## Universal Negative Prompt

```text
full article body, white leather card, author row, date row,
paragraph excerpt, blog page layout, browser chrome outside
the frame, phone mockup in desktop, logo-only poster,
oversized logo, wrong logo, fake logo text, empty grid,
blank panels, random filler UI, illegible microtext,
distorted words, misspelled main title, misspelled brand name,
gibberish headings, duplicate title, watermark, stock photo,
realistic human faces, smiling business people, cute mascot,
pastel palette, generic corporate gradient, overexposed glow,
low contrast, blur, compression artifacts, noisy text,
emoji in product chrome, fake AI brain icon, generic neural
network web, generic globe, generic lightning bolt alone,
realistic photo of a dog, cartoon dog, anime dog.
```

---

## PART A — Desktop Mockup Prompts (16 prompts)

### 1. Home — Hero + Today's Races

```text
GreyhoundIQ premium editorial NEWS-LEVEL HOMEPAGE thumbnail,
1400×788 WebP, 16:9 horizontal.

V3 enhancement layer:
- Dark charcoal grid, dramatic volumetric glow, bokeh particles,
  lens flare, high-contrast typography. Energy: "premium
  technology thumbnail meets data terminal".
- Hierarchy: 60% title readability, 25% central metaphor,
  15% supporting panels. GreyhoundIQ mark must never compete
  with the title.
- Fill every panel with real article-specific material: short
  labels, gauges, tiny charts, icons, checklists, race-card
  snippets, comparison rows. No blank panels.
- AI Kick Start operator lens: DECISION / RISK / PROOF chips
  where useful. Editorial control console, not generic poster.
- Z-pattern: logo and brand badges top, title first-read centre,
  article evidence panels around it, workflow bar bottom.

Brand-logo lock for this screen:
- Brand context: GreyhoundIQ homepage, no specific partner.
- Required: GreyhoundIQ chrome-green hex mark + wordmark,
  top-left only.
- No external brand badges for this screen.

Luxury dark tech art direction: charcoal #08090A base, brushed
graphite, bevelled glass, chrome rim highlights, fine green-
grid perspective, deep shadows, particles, volumetric light
shafts, ultra-sharp cinematic render. High-contrast but not
overexposed.

Composition rule: hero title is the focal point, not the logo.
Dense finished dashboard, not an empty template. Four surrounding
information panels filled with article-specific UI.

Text discipline: all large text readable and exact. Short
intentional UI labels only.

Above the fold, dark navy #0A0E1A hero with subtle radial-
gradient green glow on the right. Top-left: GreyhoundIQ
chrome-green hex mark + wordmark. Top nav: Home (active),
Races, Dogs, Breeding, Stats, Pricing. Sign-in (white outline)
right.

Centre hero title, exact text: "Australian greyhound racing,
data done right." with "data done right" in green-to-orange
gradient (#2BAE5A to #FB923C) via background-clip text.
Subhead, exact text: "Real-time race cards, full career form,
breeding analytics, and AI predictions — all in one place.
No ads. No clutter."

Two buttons: solid green "View today's races" with right-arrow
icon, outline white "See pricing".

Below the fold, light gray page background, two columns:
- Left (8/12): "Today's Race Cards" H2 + date pill "Sun 28 Jun".
  Three meeting cards in vertical list. Each: track name 18px
  bold, location, race count, 3 "next to go" rows (Race 4 —
  5:47pm, 520m Maiden), 8-runner tag, green dot.
- Right (4/12): "Why GreyhoundIQ" comparison table condensed.
  Headers: Feature | greyhound-data.com | State Bodies |
  GreyhoundIQ. Rows: National data all states, AI predictions,
  Mobile-first, Ad-free, API access, AUD pricing. Pro price
  (£65/yr ~$125 AUD | Free | $99/yr AUD — 21% below competitor).

Bottom-right: small "Backed by AI Kick Start" lockup.
```

---

### 2. Races / Today's Meetings — list view

```text
GreyhoundIQ premium editorial RACES LIST PAGE thumbnail,
1400×788 WebP, 16:9.

V3 enhancement layer: dark editorial control console energy,
centre hierarchy, four filled panels.

Brand-logo lock: GreyhoundIQ top-left only.

Background: charcoal #08090A base with subtle green-grid
perspective.

Top: standard nav, breadcrumbs "Home / Races" small gray-400.
H1: "Today's meetings" 32px bold white. Subhead: "14 meetings
• 187 races across Australia" gray-400.

Filter bar: horizontal pill row — "All states" (active green),
"NSW" (5), "VIC" (4), "QLD" (3), "SA" (1), "WA" (1).
Date pill right "Sun 28 Jun 2026" + Refresh icon button.

Main content, list of 5 meeting cards, full-width, each card:
- Track name 18px bold + "Wentworth Park, NSW" gray-400,
  12 races, going "Good", weather icon + 18°C.
- "Next to go" callout — "Race 4 • 5:47pm • 520m Maiden"
  with 4 highlighted runners in mini-rows: Box, dog name,
  trainer, fixed odds ($3.40 — $2.10 green/red).
- Right: big green "Open race card" button.
- Bottom strip of card: tiny horizontal sparkline showing
  win probability per box (purple bars), top pick labelled
  "IQ Top Pick: Box 4 — Zipping Ruger (28%)".

Footer: "Last updated 4 min ago" line.

Negative prompts: see universal.
```

---

### 3. Race detail — full runners (desktop)

```text
GreyhoundIQ premium editorial RACE DETAIL thumbnail,
1400×788 WebP, 16:9.

V3 enhancement layer: speed-map + sectional strip,
central race-card table, AI insights panel.

Brand-logo lock: GreyhoundIQ top-left, Wentworth Park "WP"
circular navy badge top-right (small).

Background: charcoal #08090A with fine green-grid fade.

Top: breadcrumbs "Home / Races / Wentworth Park / R5"
gray-400. H1: "Race 5 — 520m Grade 5" 28px bold white.
Meta row with icons: clock "7:23pm", map-pin "Wentworth Park,
NSW", dollar "$9,800", trophy "Group listed".

Big card with table (the main panel — central):
- Columns: Box (coloured chip 1-8), Runner (name 16px bold,
  sub-row "F. Bale — I. Miss" 12px gray-500), Trainer, Weight
  (28-34kg), Form (last 5 coloured circles: green=win,
  orange=place, gray=other, red=last), Best Time (29.42s),
  "IQ Win %" (right-aligned 18px bold purple), Sparkline
  (tiny 8-point area chart), Action "View dog" link.

Highlighted row: soft purple-tinted background + small
"Top IQ Pick" badge with Brain icon. Box 4 row.

Right floating panel (filled, not blank): "AI Race Insights"
card with purple glow border. Bullets:
- "Box 4 has 28% win probability (vs 14% market)"
- "Box 1 is over-baked: $2.10 is short"
- "Track bias favors inside boxes today (3 of last 4 winners)"
- "Trainer J. Magri is 4/5 at this grade/distance"

Bottom-left filled panel: "Speed map" card with horizontal
track graphic (8 lanes), curved line showing first-bend
positions per dog.

Bottom-right filled panel: "Sectional projections" bar chart,
8 bars showing predicted split times per box.

Negative prompts: see universal. No fake bookmaker logos.
```

---

### 4. Dog search / browse

```text
GreyhoundIQ premium editorial DOG SEARCH thumbnail,
1400×788 WebP, 16:9.

V3 enhancement layer: split-pane search/filter/results,
result density.

Brand-logo lock: GreyhoundIQ top-left only.

Background: charcoal #08090A.

Top: H1 "Dog search" 32px bold white. Big search bar
full-width (60px tall) placeholder "Search 41,000+
greyhounds by name, trainer, sire, or ear brand". Search
icon left, filter icon right.

Left sidebar (260px wide), filter chips:
- State (multi-select: NSW, VIC, QLD, SA, WA, TAS) with counts.
- Sex: Dog / Bitch toggle.
- Colour: Black, Brindle, Blue, Fawn, Red, White, Other.
- Career status: Active, Retired, All.

Right side, results panel:
- Top: "Showing 247 dogs" + sort dropdown "Sort: Win % ↓".
- Compact table: Name, Sex, Colour, Sire/Dam, Trainer, Starts,
  Wins, Win %, Best Time, Last Start. 12 rows visible.
- Pagination: "1 2 3 ... 21", prev/next arrows.

Right rail: "Recently viewed dogs" — 4 dog cards with gray
avatar placeholder, name, win %.

Negative prompts: see universal.
```

---

### 5. Dog profile

```text
GreyhoundIQ premium editorial DOG PROFILE thumbnail,
1400×788 WebP, 16:9.

V3 enhancement layer: stat-row + career form + speed profile.

Brand-logo lock: GreyhoundIQ top-left, small Zipping Megatron
silhouette+wordmark badge top-right.

Background: charcoal #08090A.

Top: breadcrumb "Home / Dogs / Zipping Megatron".

Hero strip, light gray-50 background:
- Left: large dog photo placeholder (gray rounded rect with
  subtle paw icon — NOT a real dog photo).
- Right: "Zipping Megatron" 40px bold dark navy. Subhead:
  "Dog • Black • Whelped 12/03/2022 • Trained by Jason Magri".
  Ear brand "ZM-217" monospace tag.
- Action buttons: "Follow" outline, "Add to tracker" green solid.

Stat row, 4 cards equal columns:
- 64 Starts • 41 Wins (64.1%) green • 52 Placings •
  29.42s Best Time (520m).

Tabs: Overview (active) | Career Form | Pedigree | Breeding
| Relatives.

Two columns:
- Left (8/12): Career form table, 8 visible rows. Date, track,
  grade, distance, box, finish (1-8 colour-coded), time, weight,
  SP, comments snippet.
- Right (4/12): Speed profile radar chart with 6 axes (Early
  Pace, Mid-race, Finishing, Box 1-2, Box 3-4, Box 5-8).
  Filled green at 70-90% on most axes.

Below: recent races sparkline strip (last 12 starts, wins
highlighted green).

Bottom: Pedigree preview — 3-generation family tree, parents
top, grandparents below, each box clickable name.

Negative prompts: see universal. No realistic greyhound photo.
```

---

### 6. Dog profile — Pedigree

```text
GreyhoundIQ premium editorial PEDIGREE thumbnail,
1400×788 WebP, 16:9.

V3 enhancement layer: 5-generation family tree + Testmate
companion.

Brand-logo lock: GreyhoundIQ top-left only.

Background: charcoal #08090A.

Top: breadcrumb "Home / Dogs / Zipping Megatron / Pedigree".
Compact hero strip.

H2: "5-generation pedigree" 28px bold white.

Centre: large SVG-style family tree, 5 generations deep,
horizontal layout. Each node a small card (140×60) with:
dog name 14px bold, Sire x Dam 11px gray, Win % green pill.

Center column: the dog itself, larger card (180×80) with
purple-tinted background.

Above tree: legend — "M = Male (blue), F = Female (pink),
? = Unknown (gray)".

Below tree: "Testmate" tool — two side-by-side dog search
inputs (Sire + Dam placeholder) with green "Predict litter"
button.

Right rail: "Pro feature" callout card with orange border,
Brain icon, "Unlock inbreeding coefficient (COI) and
Mendelian trait predictions on Pro."

Negative prompts: see universal.
```

---

### 7. Breeding analytics — Sire leaderboard

```text
GreyhoundIQ premium editorial BREEDING / SIRE LEADERBOARD
thumbnail, 1400×788 WebP, 16:9.

V3 enhancement layer: sire table + comparison radar +
distance-band chart.

Brand-logo lock: GreyhoundIQ top-left only.

Background: charcoal #08090A.

Top: H1 "Breeding analytics" 32px bold white. Subhead:
"Sire strike rates, dam productivity, litter performance,
and progeny earnings" gray-400.

Tab row: Sires (active green underline) | Dams | Litters
| Testmate | Inbreeding.

Filter bar: State (NSW active), Distance (All), Period
(Last 12 months), Min litters (5+).

Big filled panel, table: "Top 50 sires by progeny win %"
- Columns: Rank, Sire, Progeny starts, Winners, Win %, Place %,
  Avg prize $ progeny, Best progeny, Trend (12-mo sparkline),
  Action.
- 12 visible rows.
- Row 1 highlighted with light orange background + "Elite"
  badge.

Right of table: "Sire comparison" panel — two sires side-
by-side as small radar charts (Early pace, Mid race, Finish,
Distance suitability, Track type, Wet/dry).

Bottom filled panel: stacked bar chart "Win % by distance
band" — distance on x-axis (300m / 400m / 500m / 600m / 700m+),
each bar split by top-5 sires colour-coded.

Negative prompts: see universal.
```

---

### 8. Breeding — Testmate tool

```text
GreyhoundIQ premium editorial TESTMATE thumbnail, 1400×788
WebP, 16:9.

V3 enhancement layer: split-pane sire/dam picker + prediction
result panels.

Brand-logo lock: GreyhoundIQ top-left, small stud-farm logo
badges top-right if mentioned.

Background: charcoal #08090A.

Top: H1 "Testmate — predict a litter" 32px bold white.
Subhead: "Combine any sire and dam in our database to model
expected offspring performance."

Center card, big, two halves split vertically:
- Left half (Sire picker): search input "Search 3,200+ sires".
  Selected sire card "Fernando Bale" with photo placeholder,
  breed, progeny stats (1,847 starts, 28% winners), "Remove".
- Right half (Dam picker): same, "Irapsag Miss".

Big green "Predict litter" button full-width below pickers.

Results panel below (filled, with mock prediction run):
- Top: "Predicted litter performance" + "1,000 simulated
  matings" subhead.
- 4 stat cards: Projected winners (24%), Projected placings
  (52%), Projected fast times (above benchmark %), Projected
  earnings index.
- Bar chart: distribution of projected finish positions (1st-8th).
- "Inbreeding coefficient" gauge: 4.2% — half-circle gauge,
  colour-coded green <5%, orange 5-10%, red >10%.
- "Genetic risks" callout: bullet list of flagged recessive
  traits.
- "Top 3 dams to pair with Fernando Bale" — 3 small card
  suggestions.

Negative prompts: see universal.
```

---

### 9. Statistics — Track bias dashboard

```text
GreyhoundIQ premium editorial TRACK BIAS DASHBOARD thumbnail,
1400×788 WebP, 16:9.

V3 enhancement layer: 12-col grid of 4 filled panels with AI
insights rail.

Brand-logo lock: GreyhoundIQ top-left, Wentworth Park "WP"
navy badge top-right.

Background: charcoal #08090A.

Top: H1 "Advanced statistics" 32px bold white. Subhead:
"Track bias, box stats, trainer leaderboards, speed maps,
and custom analytics dashboards."

Tab row: Track Bias (active) | Box Stats | Trainers | Speed
Maps | Custom.

Filter bar: Track "Wentworth Park", Period "Last 100 races",
Distance "All".

12-col grid, 4 filled panels:
- Top-left (8/12): "Win % by box" big bar chart, 8 bars,
  clear bias toward boxes 1-3 (40%+). Each bar with horizontal
  "expected" gray dashed line overlay.
- Top-right (4/12): "Track conditions" card — going "Good",
  weather, rail position, "Track is currently Fast" highlight
  in green.
- Middle-left (6/12): "Sectional times by box" small multiples,
  8 mini line charts.
- Middle-right (6/12): "First-bend leaders" pie chart, 8 slices,
  dominant slice in green.
- Bottom: "Last 20 winners" stacked bar — box of winner per
  race chronological. Most bars green (inside), some orange
  (mid), some red (outside).

Right rail: "Insights" panel with 3 AI-generated observations
in purple-tinted cards, each with Brain icon:
- "Box 1 is winning 18% more than 12-month average"
- "Rails-in setup is favoring inside boxes by 7%"
- "Sectional data quality is high (98% complete)"

Negative prompts: see universal.
```

---

### 10. Statistics — Trainer leaderboard

```text
GreyhoundIQ premium editorial TRAINER LEADERBOARD thumbnail,
1400×788 WebP, 16:9.

V3 enhancement layer: top-100 table + hero card + compare.

Brand-logo lock: GreyhoundIQ top-left only.

Background: charcoal #08090A.

Top: H1 "Trainer leaderboards" 32px bold white. Subhead:
"Australia's top trainers by win rate, prize money, and
strike rate. Last 90 days."

Filter bar: State (NSW + VIC active), Grade (All), Distance
band (All).

Main content:
- Left: "Top 100 trainers" table. Rank, Trainer, State, Starts,
  Wins, Win % (highlight green if >25%), Prize $ (formatted
  $K/$M), Strike rate, Best dog, Trend (12-mo sparkline).
  15 rows. Pagination bottom.
- Right: "Trainer of the month" hero card, big, photo placeholder,
  "J. Magri", 4 stats 2x2 grid (Starts 142, Wins 48, Win % 33.8%,
  Prize $187K), bar chart of last 12 months win %.

Below: "Compare two trainers" panel — two columns, each a card
with key stats + radar chart of "Specialty" (Early pace, Mid
race, Stayers, Sprinters, Wet track, Provincial).

Bottom: "Up-and-coming trainers" — 4 small card suggestions
with green "rising" trend indicator.

Negative prompts: see universal.
```

---

### 11. Results archive

```text
GreyhoundIQ premium editorial RESULTS ARCHIVE thumbnail,
1400×788 WebP, 16:9.

V3 enhancement layer: search + dense results table + export.

Brand-logo lock: GreyhoundIQ top-left only.

Background: charcoal #08090A.

Top: H1 "Results" 32px bold white. Subhead: "Searchable
archive of every Australian greyhound race since 2018.
1.2M+ results."

Big search bar with date range, state, track, grade, distance
filters inline.

Body: results table with columns: Date, Track, Race #,
Distance, Grade, Winner, Trainer, Time, SP, Margin,
Sectionals. 15 rows. Winner cell with small "View" link.
Sectionals column shows first split + race time in monospace.

Right rail: "Performance chart" — small line chart of
selected race's sectional time vs track record (highlighted
purple).

Bottom: "Export" buttons row — CSV, JSON, API (with small
"Pro+" lock icon on the last two).

Negative prompts: see universal.
```

---

### 12. Tracks directory

```text
GreyhoundIQ premium editorial TRACKS DIRECTORY thumbnail,
1400×788 WebP, 16:9.

V3 enhancement layer: card grid + AU map heatmap.

Brand-logo lock: GreyhoundIQ top-left, individual track badges
on each card.

Background: charcoal #08090A.

Top: H1 "Australian tracks" 32px bold white. Subhead:
"96 tracks across NSW, VIC, QLD, SA, WA, TAS, NT."

Filter bar: State pills with counts. "All" selected.

Main content, card grid 3 columns, 9 track cards visible.
Each card:
- Hero photo placeholder (gray rounded rect with subtle "track
  aerial" SVG line drawing).
- Track name 20px bold white.
- Location "Wentworth Park, NSW".
- Stats row: 8 races today, 520m / 720m, Going "Good".
- Big green "Open" button.

Bottom: "Track bias heat map" — Australia map outline (gray
stroke, no fill detail) with state-level colour overlay
showing average box bias (green=inside, red=outside,
gray=neutral).

Negative prompts: see universal.
```

---

### 13. Track detail

```text
GreyhoundIQ premium editorial TRACK DETAIL thumbnail,
1400×788 WebP, 16:9.

V3 enhancement layer: hero + records table + bias chart +
conditions card.

Brand-logo lock: GreyhoundIQ top-left, Wentworth Park "WP"
badge top-right (slightly larger than usual, this screen's
about the track).

Background: charcoal #08090A.

Top: breadcrumb "Home / Tracks / Wentworth Park".

Hero strip: large track photo placeholder (gray rounded rect
with track aerial line drawing). Overlay: "Wentworth Park"
48px bold white, "Sydney, NSW • 520m / 720m • Group 1 venue".

Stats row, 4 cards:
- 187 Races this year • 28 Racing days • 4.2% Avg winning
  margin • 29.42s Track record (520m).

Tabs: Overview (active) | Records | Bias | Form | Conditions.

Main content:
- Left (8/12): Track records table — distance, dog, time,
  date, weight, trainer. 6 rows.
- Right (4/12): Track map SVG (oval outline) with distances
  labelled (285m start, 520m, 720m).

Below: Box bias over last 100 races — horizontal bar chart,
8 bars, one per box, clear skew (boxes 1-3 favourited).

Bottom: "Race day weather" card — current conditions, 7-day
forecast row of small icons, "Going prediction" callout
"Going is expected to be Good all day".

Negative prompts: see universal.
```

---

### 14. Pricing

```text
GreyhoundIQ premium editorial PRICING thumbnail, 1400×788
WebP, 16:9.

V3 enhancement layer: 3-tier pricing cards + comparison
table + guarantee.

Brand-logo lock: GreyhoundIQ top-left only.

Background: charcoal #08090A.

Top: H1 "Simple, fair pricing" 32px bold white. Subhead:
"No ads ever. Cancel anytime. Pro pays for itself in 3
winning tips."

3 pricing cards equal width:
- Free (left, gray border): $0, "Forever free", features
  with check, features NOT with gray X, "Current plan"
  disabled button.
- Pro (centre, popular — green border, scale 1.02, green
  "Most popular" pill top): $99, "per year", "$8.25/month
  billed annually", "Pro" orange badge corner, all Free +
  AI predictions, Speed maps, Breeding analytics, Inbreeding,
  Testmate, unlimited saved, email alerts, ad-free,
  "Upgrade to Pro" green solid button.
- Pro+ API (right, gray border): $299, "per year", Pro + API
  10K req/day, bulk CSV, webhooks, priority support, custom
  dashboards, "Upgrade to Pro+" green solid button.

Below cards: "Money-back guarantee" callout, 14-day,
gray-tinted.

Bottom: "Compare all features" full table — 12 rows × 3 cols
(Free/Pro/Pro+), green check / gray X icons.

Negative prompts: see universal.
```

---

### 15. Sign in

```text
GreyhoundIQ premium editorial SIGN IN thumbnail, 1400×788
WebP, 16:9.

V3 enhancement layer: split-pane dark-light auth card.

Brand-logo lock: GreyhoundIQ top-left on dark pane.

Background: charcoal #08090A outer frame.

Two-column:
- Left (5/12): dark navy #0A0E1A panel with green radial-
  gradient glow. Centred: large GreyhoundIQ chrome-green hex
  mark + wordmark, "Welcome back" 32px white bold,
  "Sign in to access your saved dogs, predictions, and
  analytics" 16px gray-400.
- Right (7/12): light gray-50 background, centred card
  440px wide. "Sign in" H2. Email input, password input
  with show/hide eye, Remember me + Forgot password link,
  "Sign in" green solid button full-width. Divider "or".
  "Continue with Google" outline full-width. "Continue with
  Apple" outline full-width. Footer: "Don't have an account?
  Sign up" with "Sign up" green link.

Negative prompts: see universal.
```

---

### 16. Sign up

```text
GreyhoundIQ premium editorial SIGN UP thumbnail, 1400×788
WebP, 16:9.

V3 enhancement layer: same split-pane as sign-in, fuller
form.

Brand-logo lock: GreyhoundIQ top-left on dark pane.

Two-column layout as sign-in.

Right column card 480px wide:
- "Create your free account" H2.
- "Start tracking dogs in 30 seconds. No card required."
- Full name input.
- Email input.
- Password input with strength meter (4 segments, third
  filled green "Strong").
- State dropdown (NSW/VIC/QLD/SA/WA/TAS/NT).
- "I'm interested in" — 3 checkbox pills (Betting, Breeding,
  Industry).
- "Create account" green solid button.
- Divider "or".
- Continue with Google + Apple.
- Footer: "Already have an account? Sign in".
- Fine print: "By signing up, you agree to our Terms and
  Privacy Policy. We support responsible gambling — 18+."

Negative prompts: see universal.
```

---

### 17. Dashboard / personal analytics (Pro, desktop)

```text
GreyhoundIQ premium editorial PRO DASHBOARD thumbnail,
1400×788 WebP, 16:9.

V3 enhancement layer: stat-row + 4 filled panels (recent
tips, accuracy trend, P/L, top dogs) + today's picks rail.

Brand-logo lock: GreyhoundIQ top-left, Pro orange badge
top-right on avatar.

Background: charcoal #08090A.

Top: standard nav, "Welcome back, Daniel" greeting small,
"Last 30 days" date range pill, "Today is Sun 28 Jun 2026".

Stat row, 4 cards (from plan KPI framework):
- Monthly organic traffic (Y1 target: 15K).
- Free sign-ups/month (Y1 target: 1,200).
- Free→Pro conversion (Y1 target: 15%).
- Monthly recurring revenue (Y1 target: $4K).

12-col grid:
  Dog, Pick (1/2/3), Confidence (purple bar), Result
  (Win/Place/Miss colour-coded), P/L ($).
- Top-right (4/12): "Tip accuracy over time" line chart,
  30-day rolling, trending upward 50% → 64%.
- Middle-left (6/12): "Profit & loss" stacked bar chart,
  daily P/L last 30 days, green/red.
- Middle-right (6/12): "Top profitable dogs" small table —
  5 rows: dog name, tips, wins, P/L, View.

Right rail: "Today's picks for you" — 3 compact race cards,
each: track, race, time, top pick with purple highlight +
confidence %, "Set reminder" link.

Negative prompts: see universal.
```

---

## PART B — Mobile Mockup Prompts (3 prompts)

### 18. Mobile — Home (Hero only)

```text
GreyhoundIQ premium editorial MOBILE HOMEPAGE thumbnail,
1024×1820 WebP, 9:16 portrait.

V3 enhancement layer: dark hero + light-mode scroll preview.

Brand-logo lock: GreyhoundIQ top-left on hero.

Above the fold, dark navy #0A0E1A hero:
- Status bar top (9:41, signal, battery).
- Hamburger top-left, "GreyhoundIQ" logotype centre, small
  avatar top-right.
- H1: "Australian greyhound racing," then "data done right."
  second line with green-to-orange gradient text.
- Subhead: "Real-time race cards, full career form, breeding
  analytics, and AI predictions."
- Two stacked buttons full-width: "View today's races" green
  solid, "See pricing" white outline.
- Three small trust badges row: AU flag SVG icon (not emoji),
  "No ads", "Pro from $99/yr".

Below the fold (light mode, scroll preview):
- 4 feature cards 2×2 grid, each with thin-line icon
  (Trophy, Brain, Dna, BarChart3), title, 2-line description.
- First card subtle purple glow (AI).
- "Today's meetings" section title + 2 collapsed meeting cards.

Negative prompts: see universal.
```

---

### 19. Mobile — Race detail

```text
GreyhoundIQ premium editorial MOBILE RACE DETAIL thumbnail,
1024×1820 WebP, 9:16 portrait.

V3 enhancement layer: AI insights top, runner list stacked,
sticky CTA bottom.

Brand-logo lock: GreyhoundIQ top-left on app bar.

Top: collapsed app bar, back arrow, "Race 5" title, share
icon. Below: meta strip "Wentworth Park • 520m • 7:23pm".

Big card "AI Race Insights" with purple left-border: 3-4
short bullets about the race.

"Top IQ Pick" highlight card with Brain icon, name, big
"28%" win probability, small confidence interval "(±4%)".

Stacked runner list, each row:
- Box number circle (1-8, colour-coded).
- Dog name 16px bold.
- Pedigree "Sire x Dam" 12px gray.
- Form dots row (last 5).
- IQ Win % 16px bold purple.
- Chevron right.
Top row (Box 4) soft purple tint + "Top Pick" badge.

Bottom-anchored sticky CTA bar with green "Place a bet"
button (DISABLED state, gray, small "via partner" 10px).

Negative prompts: see universal.
```

---

### 20. Mobile — Today's Races expanded

```text
GreyhoundIQ premium editorial MOBILE RACE LIST thumbnail,
1024×1820 WebP, 9:16 portrait.

V3 enhancement layer: scrollable meeting cards + bottom tab
bar.

Brand-logo lock: GreyhoundIQ top-left on app bar.

Top: hamburger, "Today's Races" title, calendar icon.

Sticky filter chip row: "All" (green active), "NSW", "VIC",
"QLD", "SA", "WA".

List of 3 expanded meeting cards (most recent top):
- Track name 20px bold.
- Location row with map-pin icon.
- "Next to go" callout (purple-tinted card): race number,
  time, distance, "Box 4 Zipping Ruger — IQ Top Pick (28%)".
- Big green "Open race card" full-width button.
- 4 mini runner preview rows (Box, dog, IQ %).
- "12 races" tag.

Bottom safe area: tab bar with 5 icons (Home, Races, Search,
Tracker, Profile), Races active green.

Negative prompts: see universal.
```

---

### 21. Mobile — Empty / Loading / Error states

```text
GreyhoundIQ premium editorial MOBILE STATES thumbnail,
1024×1820 WebP, 9:16 portrait — three iPhones side by side
on a single canvas.

V3 enhancement layer: state-machine illustration across
three devices.

Brand-logo lock: GreyhoundIQ on app bar of each phone.

Background: charcoal #08090A.

Phone 1 (left) — Empty state ("No meetings today"):
- Light gray background, centred.
- Small calendar icon (gray 1.5px stroke) top.
- "No meetings scheduled" 20px bold.
- "We don't have any race data for this day. Try yesterday
  or pick another date." 14px gray-600.
- Outline button "View yesterday's results".

Phone 2 (centre) — Loading state ("Fetching today's races"):
- Light gray background.
- 3 skeleton meeting cards stacked. Each: gray rounded rect
  80% width for track name, 60% for location, 40% for race
  count. Subtle shimmer gradient left-to-right.
- Small "Loading..." text bottom with spinning green circle.

Phone 3 (right) — Error state ("Connection lost"):
- Light red-tinted background #FEF2F2.
- Wifi-off icon top in red.
- "Couldn't reach our servers" 20px bold.
- "Check your connection and try again. Your saved dogs are
  still available offline." 14px gray-600.
- Solid red "Retry" button full-width.
- "View saved dogs (offline)" outline button below.

Each phone: iPhone 15 frame, thin black bezel, 48px corner
radius, notch at top, drop shadow.

Negative prompts: see universal.
```

---

## Notes for usage

- Paste the Global Style Stack once per session. Re-paste per
  prompt — the model loses the design system after 1 generation.
- Aspect ratio: GPT Image 2 supports 1024×1024, 1024×1536,
  1536×1024. For 1400×788 use 1536×1024 (closest 16:9
  landscape). For 1024×1820 use 1024×1536 (closest 9:16) and
  accept the slight crop, or generate at 1024×1024 and resize.
- If mockup returns broken type, rerun — GPT Image 2 is
  non-deterministic and ~80% of generations are clean. The
  ~20% with broken text need a regeneration, not a prompt fix.
- Save all 21 in a single folder `~/greyhoundiq/docs/mockups/`.
- After generating, overlay real Australian greyhound names
  from the Prisma database. Separate post-production step.
- Companion deliverables: `logo-ultra-prompt.md` (logo) and
  `plan-and-infographic-prompts.md` (business plan + infographics)
  follow the same V3 structure.