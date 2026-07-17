# GreyhoundIQ Production Media Art Direction

## Purpose

Give every GreyhoundIQ template a distinct, premium visual character without
misrepresenting race venues, altering member-owned media, or duplicating every
asset six times.

## Media classes

| Class | Examples | Production rule |
| --- | --- | --- |
| Curated production | Track and race banners, site headers, page heroes, category art, editorial promotions, empty states | GreyhoundIQ owns the final generated raster. Record the source references and visually verify every output before wiring it into the app. |
| Member original | Profile images, post media, comments, messages, public Marketplace listings | Preserve the original media. Templates may change crop, frame, mask, overlay, and surrounding UI only. Never recolour or regenerate a member upload. |
| Partner supplied | Approved advertiser creative and official partner logos | Use only the approved file and placement terms. Never redraw a partner logo with image generation. |
| Prototype only | Marketplace demo cards, sample profiles, speculative sponsor boards, Design Lab feed content | Keep isolated from production data and label concepts where a real organisation is shown without an active agreement. |

## Six template image treatments

The same content remains recognisable in every template. The presentation layer
changes through crop, gradient, border, texture, typography placement, and safe
zone usage.

| Template | Image direction | Preferred composition |
| --- | --- | --- |
| A1 Command Centre / Full Hero | Cinematic, high contrast, carbon black with restrained gold and purple edge light | Wide full-bleed scene with a quiet left text zone and a strong subject on the right third |
| A2 Command Centre / Compact Hero | Editorial, controlled, reduced glow and cleaner silver detail | Tighter horizontal crop with a shallow text band and minimal texture |
| B1 Racing Cockpit / Split Planner | Technical night-racing atmosphere with crisp telemetry framing | Subject on the outer third; calm central seam for the split planner and race data |
| B2 Racing Cockpit / Integrated Planner | Gold-led broadcast energy with purple selected states | Lower visual horizon and a clear upper data zone for the integrated planner |
| C1 Social Data Hub / Expanded Feed | Lively venue atmosphere, richer crowd and community context | Human-scale or grandstand context with a protected lower interaction zone |
| C2 Social Data Hub / Compact Feed | Content-first, neutral chrome, low-noise background | Close, simple focal subject with enough negative space for compact cards |

Member media uses these treatments as CSS/UI framing. Curated production media
may use a template-specific crop when a single responsive crop cannot preserve
the focal subject and readable text zone.

## Production track library

### Current production inventory

The public `/tracks` page was checked on 11 July 2026 and rendered 49 active
database records. They map to 41 physical venues and 45 distinct course media
sets.

- `Meadows`, `The Meadows`, and `Meadows (MEP)` share The Meadows media set.
- `Sandown`, `Sandown Park`, and `Sandown (SAP)` share Sandown Park's media set.
- Richmond's loam circle and 324-metre grass straight require separate course
  images inside one physical-venue family.
- Murray Bridge's one-turn horseshoe and straight require separate course images
  inside one physical-venue family.
- The Q's Q1 Lakeside, Q2 Parklands, and Q Straight require three course images
  inside one Purga precinct family.

Sponsor prefixes such as Ladbrokes, BetDeluxe, Bet Nation, and TABtouch are
mutable display data. Canonical asset keys use the venue and course identity;
generated scenes do not bake mutable sponsor marks into the raster.

### Source of truth

- Include only venues confirmed as operating by the relevant state racing
  authority or current official calendar.
- Canonicalise aliases before generation. Program aliases such as `Meadows`,
  `The Meadows`, and `Meadows (MEP)` share one physical-venue media set.
- Preserve genuine course variants when the course geometry is visually
  distinct, including circular and straight courses at the same precinct.
- Prefer official club, state authority, or venue sources. Record the page URL,
  direct reference URL where available, owner/credit, capture date, and intended
  reference-only use.
- An online photograph is visual research, not a redistributable production
  asset. Generate a new original composition and do not copy a photographer's
  exact framing, people, signage, or protected artwork.

### Venue scene families

Assign each physical venue the scene family that best matches its real reference
material. Do not force every track into a metropolitan night-race look.

1. Metropolitan floodlit theatre
2. Modern multi-course precinct
3. Regional twilight atmosphere
4. Heritage grandstand and showground
5. Coastal or open-sky venue
6. Straight-track speed corridor

All families retain carbon, silver, gold, and purple GreyhoundIQ finishing, but
venue architecture, rail geometry, surface, horizon, lighting, and local setting
remain specific to the real track.

### Asset contract

Generate one high-resolution master per canonical course media set:

- `master`: 2400 x 1600 WebP in a 3:2 composition. It contains no baked text,
  GreyhoundIQ logo, mutable sponsor mark, or template-specific treatment.
- Keep the venue-defining subject inside the shared central 1280 x 600 identity
  intersection. This is the part retained by every required centre crop.

| Consumer crop | Centre-crop window from the 2400 x 1600 master | Purpose |
| --- | --- | --- |
| Full master | 2400 x 1600 (3:2) | Canonical production file and source for all presentation crops |
| Track/race hero | 2400 x 1350 (16:9) | Track detail, races, results, planner |
| Directory card | 2400 x 1440 (5:3) | Track directory cards |
| Desktop banner | 2400 x 800 (3:1) | Wide track banner |
| Compact race header | 2400 x 600 (4:1) | Dense race context |
| Mobile portrait | 1280 x 1600 (4:5) | Phone card/banner crop |

The 1280 x 600 intersection is an identity safe zone, not an instruction to
place every subject dead-centre. Record an explicit focal point after visual QA
when `object-center` is insufficient.

Reuse that single master through `object-fit`, per-context focal positioning,
gradients, masks, and HTML overlays for:

- Desktop banner: 3:1
- Race and track hero: 16:9
- Directory card: 5:3
- Compact race header: 4:1
- Mobile banner/card: 4:5 or 3:2 according to the component

Do not generate separate mobile, card, header, or template rasters during this
phase. Template framing, GreyhoundIQ identity, navigation, copy, and colour
treatment belong in the HTML/CSS presentation layer. Signed-in site headers use
their existing dedicated header assets and are not direct consumers of a track
master.
If a master cannot pass the responsive safe-zone checks, repair that one master
instead of adding another default variant.

### File and manifest shape

```text
public/images/tracks/<canonical-slug>/master.webp
output/image-generation-audit/track-production-20260711/
  source-parts/nsw-nt-sources.json
  source-parts/qld-sa-wa-sources.json
  source-parts/vic-tas-sources.json
  enhanced-imagegen-prompt-queue-20260711-track-pilots.md
  enhanced-imagegen-prompt-queue-20260711-track-pilots.json
  agent-queues/
  agent-manifests/
  verification/
  contact-sheets/
```

Pilot candidates are written first to
`output/image-generation-audit/track-production-20260711/pilots/<canonical-slug>-master-pilot-20260711.webp`.
After identity, quality, crop, uniqueness, dimension, and hash verification, the
same master may be promoted unchanged to
`public/images/tracks/<canonical-slug>/master.webp`. Contact-sheet and crop-preview
files are non-shipping audit evidence only.

The source manifest maps every live database label to a canonical venue slug and
contains source URLs, credits, rights notes, operating-status evidence, visual
cues, course variants, and generation status.

## Site-wide image inventory

| Surface | Production approach | Template variety |
| --- | --- | --- |
| Signed-in full header and compact return header | One curated GreyhoundIQ racing master with protected logo, race-nav, and status zones | Six CSS/HTML presentation treatments; no duplicate image generation |
| Signed-out landing hero | Existing public marketing narrative remains independent from the signed-in shell | Use a dedicated public campaign family; do not inherit member-template choices while signed out |
| Track directory, track detail, races, results, race planner | Canonical track library plus real race data overlays | Template frame, crop, and data-safe zone vary; venue identity does not |
| Feed editorial modules and GreyhoundIQ announcements | Curated editorial art with unique subjects and concise visible text | Template-specific card framing; alternate compositions only for major campaigns |
| Marketplace production listings | Seller media is member original | Never regenerate listing photos; templates alter carousel, grid, flip-card frame, and metadata hierarchy |
| Marketplace Design Lab demos | Generated prototype-only dog cards, kennel products, trailers, food, and accessories | Six Marketplace layouts may use varied mock scenes, clearly isolated from real listings |
| Personal, trainer, owner, business, and punter profiles | Member cover/avatar media plus optional curated default covers | Preserve member originals; offer a varied approved default-cover library |
| Groups and managed pages | Member/manager media | Frame only; generated defaults may vary by page category |
| Chat, calls, notifications, settings, admin, payments, safety | Functional UI first | Avoid decorative image noise; use small brand texture or empty-state art only where it improves comprehension |
| Advertising | Partner-supplied production creative after approval | Prototype concepts may demonstrate placement, but never ship as active partner creative |

## Quality gates

An image is not production-ready until it passes all of the following:

1. Current operating status and canonical venue mapping are confirmed.
2. Official references and source/credit metadata are recorded.
3. The prompt queue is reviewed before generation.
4. Venue geometry and recognisable physical cues match the references.
5. No invented sponsor logo, fake venue sign, watermark, incorrect rug colour,
   extra dog, unsafe scene, or misleading city backdrop appears.
6. Landscape and mobile compositions remain readable with real UI overlays at
   320, 375, 430, 768, 834, 1024, and 1440 pixel viewport widths.
7. Visual identity and uniqueness verification both pass.
8. Exact and near-duplicate audits pass, final WebP dimensions and file sizes are
   recorded, and the app build and browser checks pass after wiring.
