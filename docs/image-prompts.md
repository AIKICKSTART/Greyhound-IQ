# GreyhoundIQ Production Image Prompt Pack

This file owns the durable prompt requirements for GreyhoundIQ curated
production imagery. The batch-specific source records and full prompts belong in
the dated Markdown and JSON queues under `output/image-generation-audit/`.

Use the native Codex image-generation workflow only. Write and review the prompt
queue before generating, visually inspect every result, and do not wire an asset
into the app until it has passed identity, quality, uniqueness, and responsive
overlay checks.

See [Production Media Art Direction](./design-media-art-direction.md) for media
classes, six-template treatments, track-source requirements, and responsive
asset contracts.

## Current brand system

- Carbon black: `#07080B`
- Deep carbon: `#0D0F14`
- Metallic silver: `#C7CBD1`
- Warm racing gold: `#D7A52A`
- Highlight gold: `#F4C85A`
- IQ purple: `#7A3FF2`
- Purple highlight: `#A776FF`
- Off-white: `#F2F3F5`

Use restrained accents. The image must remain a premium Australian racing and
data product, not a neon gaming poster. Green and orange are not GreyhoundIQ
brand colours and must not be used as the default art direction.

## Universal generation rules

Every queue item must state:

- the exact route or component using the image;
- whether it is production, partner-supplied, member-original, or prototype-only;
- the reference assets and their provenance;
- the focal subject and template-safe zones;
- the required aspect ratio and final file path;
- concise visible text, if any;
- exact logo treatment;
- an item-specific negative prompt;
- alt text and post-generation checks.

### Visual baseline

```text
Premium Australian greyhound racing intelligence platform. Photorealistic,
cinematic but credible, carbon-black base, metallic silver structure, restrained
warm gold highlights, and controlled IQ-purple edge light. Realistic track
geometry, weather, rail, racing surface, grandstand, floodlights, animals, and
camera optics. Clear UI-safe negative space. No white or washed-out background,
no generic AI robot, no random logo, no invented sponsor sign, no watermark, no
tiny unreadable UI, no fake city skyline, no duplicated animal, no distorted
anatomy, and no generic stock-photo composition.
```

Use a verified local GreyhoundIQ logo asset as a post-generation overlay. Do not
ask the image model to redraw the logo or bake a close approximation into the
scene.

## Core production surfaces

### 1. Signed-in full header

- Use: signed-in desktop/tablet/mobile full header shown at page top and when the
  user scrolls upward.
- Composition: venue atmosphere with a protected logo zone, independent race-nav
  zone, and compact-header crop.
- Required set: one A1/A2 pair, one B1/B2 pair, and one C1/C2 pair. Within each
  pair, use a shared subject and distinct crop/density treatment.
- Output: desktop landscape and mobile portrait-safe crops.

### 2. Public marketing hero

- Use: signed-out landing experience only.
- Composition: elite greyhound athleticism and credible Australian venue detail.
- Constraint: do not inherit a member's selected signed-in template.
- Output: ultrawide desktop and mobile portrait-safe crops.

### 3. Track and race media

- Use: track directory, track detail, races, results, compact race headers, and
  race planner.
- Source: current official authority/club references for the real venue.
- Composition: recognisable venue architecture, surface, rail, course geometry,
  horizon, and lighting. Do not force a regional or straight track into a
  fictional metropolitan scene.
- Output: one logo-free, text-free 2400 x 1600 (3:2) master per canonical course
  media set. Deterministic HTML/CSS crops cover landscape, directory, compact,
  and mobile components; do not generate a second mobile or header raster.
- Identity rule: mutable sponsor names remain display data and are not baked into
  generated art unless an approved partner asset is supplied.

### 4. AI Predictions feature

- Use: Home and product explainer feature art.
- Composition: a greyhound form emerging from a physical field of probability
  points and racing-line curves, with silver filaments, purple depth, and one
  restrained gold confidence signal.
- Avoid: dashboards, flat charts, generic brains, humanoid robots, and readable
  invented metrics.

### 5. Breeding Analytics feature

- Use: Home and breeding product surfaces.
- Composition: modern pedigree intelligence, combining authentic paper/ledger
  texture with a clean generational connection structure.
- Colour: warm gold key light, silver detail, carbon background, controlled
  purple lineage accents.
- Avoid: fake readable kennel records, invented logos, and antique clutter that
  obscures the analytical purpose.

### 6. Advanced Statistics feature

- Use: Home and statistics surfaces.
- Composition: accurate aerial greyhound-course geometry with data-aware negative
  space; use a real confirmed venue only when the prompt identifies it.
- Colour: cool carbon and silver with gold light pools and purple analytical
  markers added in the UI layer.
- Avoid: horse-racing geometry, fake lane markings, and invented scoreboards.

### 7. Career Form feature

- Use: dog, form, and data-product surfaces.
- Composition: racing form depth over time, expressed through a real greyhound in
  motion and layered track-distance cues rather than a fake dashboard screenshot.
- Avoid: fabricated runner names, odds, or claims.

### 8. Pricing product scene

- Use: pricing and upgrade surfaces.
- Composition: premium device/product still life with an unreadable abstract
  GreyhoundIQ data glow. Exact app screenshots may be composited only from a
  verified current local capture.
- Avoid: betting slips, cash, unapproved operator branding, device manufacturer
  logos, and readable invented UI.

### 9. Replay fallback poster

- Use: race-replay player while provider video is unavailable or loading.
- Composition: calm race-ready state with room for native player controls.
- Constraint: never modify, regenerate, watermark, or copy provider replay or
  photo-finish media.

### 10. Open Graph card

- Use: global social sharing.
- Composition: exact GreyhoundIQ logo overlay on a carbon track-atmosphere
  background with subtle silver, gold, and purple depth.
- Output: `1200x630` WebP.
- Avoid: additional generated text and model-drawn logos.

### 11. Default cover library

- Use: optional defaults for personal, trainer, owner, business, punter, group,
  and managed-page covers.
- Composition: a varied, rights-cleared GreyhoundIQ library; never silently
  replaces a member's chosen image.
- Constraint: member avatars, covers, logos, galleries, Feed media, Marketplace
  media, and chat attachments remain immutable originals apart from safe media
  processing and owner-selected transforms.

### 12. Functional empty states

- Use: selected onboarding, empty, offline, and no-result states where illustration
  materially improves comprehension.
- Composition: simple, low-noise carbon/silver scenes with one semantic gold or
  purple focal cue.
- Avoid: decorative art in payments, safety, account recovery, admin security,
  Chat, and call controls.

## Prototype-only imagery

Generated Marketplace demo cards, sample seller content, speculative advertiser
billboards, and sample profiles remain behind the Design Lab gate. Real brands in
an internal concept must be labelled as an unofficial partnership concept. Live
advertising uses advertiser-supplied approved creative only.

## Final queue checklist

Before generation, confirm every item has:

1. A unique slug and output path.
2. Correct production/prototype classification.
3. Verified logo/reference assets or an explicit no-logo decision.
4. Current carbon, silver, gold, and purple direction.
5. A concrete focal subject and responsive safe zones.
6. No unsupported factual or partnership claim.
7. No random logos, wrong product identity, watermark, washed-out background,
   unreadable text, duplicate concept, or generic placeholder instruction.
8. A visual QA owner and a second quality/uniqueness reviewer.
