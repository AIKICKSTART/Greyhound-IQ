# Marketplace Card Art Contract

## Status

This contract separates the curated, versioned player-card artwork from the live Marketplace listing UI. The Row Beau production card is the collection anatomy anchor; dog-specific materials and colour systems may vary, but the canvas, information density and alignment may not.

## Two authoritative layers

| Layer | Owns | Must not own |
| --- | --- | --- |
| Curated card art | Premium frame and material treatment, dog portrait, dog identity, and verified historical racing facts frozen to an artwork version | Price, listing state, seller identity, seller verification, contact details, calls to action, saved state, or any other listing-variable value |
| HTML listing layer | Current Marketplace data, navigation and interaction | Irremovable text baked into the image or a replacement for the full card artwork |

The HTML data is authoritative for the current listing. A fact baked into art is an editorial snapshot, not live Marketplace state. If the two layers conflict, replace or withdraw the artwork; do not conceal the conflict with an overlay.

## Curated artwork contract

Each production asset must:

- be a unique WebP at exactly `1060 x 1484` pixels (`5:7`);
- retain a complete outer frame, safe margins and the verified GHIQ mark;
- keep the whole face, both eyes, muzzle and chest unobstructed;
- preserve a dog-specific premium material and colour identity;
- reserve the upper `60-64%` for the hero and the lower `36-40%` for structured facts;
- use the Row Beau landmarks for header scale, hero-to-data transition, record-tier start and bottom baseline;
- include a substantial career-record tier and dog-specific pedigree, connections and verified-highlight context when those facts are available;
- use only verified facts and explicitly record the source and snapshot date in its manifest;
- use a source-gap treatment instead of inventing a missing pedigree, connection, split, prize value or highlight; and
- remain readable at the `318px` contact-sheet review width.

Allowed baked facts are the dog name, colour/sex, whelped date, immutable pedigree, a dated career snapshot, best time, dated form or last-start result, dated connections, and verified historical highlights. Trainer and owner names must carry an as-of date because connections can change.

The artwork must not contain:

- asking price, `POA`, seller or member details, listing type/status, location, response time, links, contact details or CTAs;
- `demo`, `concept`, `sample`, `preview`, `placeholder`, `fictional`, `mockup`, `marketplace concept` or watermark wording;
- an edition count unless a real issued-edition system exists;
- generic filler such as `PUBLIC RACING PROFILE` where the shared anatomy requires a dog-specific connection or verified highlight; or
- an undated claim that a baked career record is current.

## HTML listing contract

`MarketplaceDogPlayerCard` owns the current listing-facing values: listing and dog IDs, price, listing label, current public stats, pedigree display, description, seller context, links, save/dismiss state and CTAs.

The clean artwork is the default front. The optional HTML information layer must be independently showable and hideable; hiding it must restore the complete `5:7` art with `contain` sizing rather than crop or cover the dog. The flip side may render current career, pedigree, seller and CTA data in HTML. No demo label may be added to either face.

## Strict ten-point release gate

A collection release passes only when all ten checks pass:

1. Six unique final files exist at the declared public paths.
2. Every final is WebP, `1060 x 1484`, exact `5:7`, with zero width variance.
3. Every outer frame and safe margin is complete.
4. Every portrait keeps the face, eyes, muzzle and chest unobstructed.
5. Every card uses the verified GHIQ mark and contains no prohibited wording.
6. Every dog identity is correct and prominent.
7. Every card has substantial, readable verified racing data and a distinct premium treatment.
8. Every hero-to-data transition follows the Row Beau normalized landmarks.
9. Every lower anatomy has dog-specific record, pedigree/source-gap, connections/source-gap and verified-highlight content; generic filler does not count.
10. Every lower grid terminates on the common Row Beau-aligned bottom baseline.

A technical or general visual pass does not override a failed strict point.

## Sequential production rule

Write and approve the prompt/edit queue first. Process one card at a time in declared order: generate or edit, inspect at full resolution, verify facts and the ten points, promote the final, then advance. Do not mass-generate the collection. After the last accepted card, refresh the manifest, hashes, dimensions, strict report and contact sheet.
