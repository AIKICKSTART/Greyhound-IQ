# GreyhoundIQ — Cinematic Image Prompt Pack v1

> For GPT Image 2 (gpt-image-2) and Nano Banana 2 (gemini-3-pro-image).
> Upload the logo images as reference, then run the prompt.
> All prompts follow the AI Kick Start structure: ROLE → TARGET MODELS →
> SOURCE INTENT → INPUTS → TASK → OUTPUT FORMAT → CONSTRAINTS.
>
> Brand colors (from logo): Deep racing green #0B5C1E, mid green #145A2D,
> bright accent green #2BAE5A, electric orange #F97316, warm amber #F89838,
> near-black background #040A04, off-white text #F0F0F0.

---

## Universal Style Stack (reference for all prompts)

```text
Mood: premium sports-data platform meets cinema. Dark, atmospheric,
controlled. Think Formula-1 broadcast meets Linear's dark UI.
Never bright, never cheerful, never stock-photo flat.

Lighting: low-key cinematic. Single hard key light (warm 3200K or cool
5600K) with deep shadows. Rim light on the subject edges. Volumetric
haze/atmosphere in the background. Light sources motivated by the
environment (floodlights, LED boards, stadium lights, phone screens).

Color: desaturated base with the brand palette as the only saturated
accents — deep racing green #0B5C1E and electric orange #F97316.
Teal-to-green shadows, warm amber highlights. Never rainbow, never
muddy. Skin and fur must read photorealistic, not illustrative.

Camera: shot on Sony FX6 / ARRI Alexa Mini LF. Cinematic glass:
Sigma 18-35mm f/1.8 for wide environmental, Canon 70-200mm f/2.8 for
compressed telephoto, Laowa 24mm f/14 Probe for ground-level macro.
Shallow depth of field, subject isolated from background bokeh.

Negative (describe as positive): a clean, uncluttered frame free of
text overlays, UI elements, watermarks, logos, and visible branding.
No humans visible unless explicitly described. No cartoon or
illustrated style. No oversaturated neon.
```

---

## 1. Hero — Greyhound Breaking from the Boxes

```text
ROLE
You are a senior AI art director who writes copy-ready prompts for
2026's frontier image models. You translate a creative idea into one
precise, vivid scene description that renders cleanly on the first try.

TARGET MODELS
Tuned for GPT Image 2 (gpt-image-2) and Nano Banana 2 / Nano Banana Pro
(gemini-3-pro-image). Both reward rich natural-language scene
description over keyword soup. Both render fur, motion blur, and
stadium lighting photorealistically; lean on natural language to
describe the speed and atmosphere.

SOURCE INTENT TO PRESERVE
A cinematic, photorealistic wide shot of a greyhound mid-stride
exploding from the starting boxes at night under floodlights. The
image should convey elite athletic power, controlled chaos, and the
moment of release. Dark, atmospheric, premium.

INPUTS TO COLLECT
- subject: A single lean athletic greyhound (blue/fawn/black brindle)
  in full sprint, muscles taut, mouth open, eyes focused forward.
- style_reference: Cinematic wide-angle low-to-ground shot, night
  floodlit track, shallow depth of field, motion blur on the
  background but the dog sharp, green-orange brand color accents.
- negative_prompt: Keep the frame free of text, logos, numbers,
  jockeys, humans, or visible starting-box mechanism detail.

TASK
1. Restate the creative objective in one sentence: a premium hero
   image that makes greyhound racing feel as elite as Formula 1.
2. Write ONE flowing natural-language image prompt, ordered:
   scene/background → main subject → supporting details →
   camera/composition → lighting → medium/style → color palette → mood.
3. Specify the dog's coat, muscle definition, stride phase (mid-
   extension), and the flying dirt/sand kicked up by the paws.
4. Specify the camera position: ground-level, 15-degree upward angle,
   wide enough to show the track curving into darkness behind the dog.
5. Lighting: overhead floodlights creating a pool of warm light on
   the track, cool blue-green shadows in the periphery, rim light
   along the dog's back and tail.
6. Color: desaturated track surface, deep green grass infield, the
   only saturated colors are the orange floodlight glow and a hint
   of green on the dog's collar or the track rail.
7. Recommend 21:9 ultrawide aspect ratio for hero banner use.
   GPT Image 2: size 1536x1024. Nano Banana 2: name "21:9 ultrawide"
   in the prompt. Resolution target: 4K.
8. Provide one refinement instruction: "Change only the dog's coat
   color to [X], keep everything else identical."

OUTPUT FORMAT
- Final Image Prompt (one natural-language paragraph, copy-ready)
- Aspect Ratio & Size (21:9 + exact API size + 4K target)
- Model Notes (one line each for GPT Image 2 and Nano Banana 2)
- Follow-up Edit (one iterative refinement line)
- Quick Self-Check (confirm subject, composition, lighting, palette
  covered, and frame is clean of text/logos)

CONSTRAINTS
- Describe exclusions positively; no separate negative-prompt block.
- Do not imitate any real brand logo or living person's likeness.
- The word "photorealistic" must be present in the final prompt.
- Favor concrete nouns (floodlights, sand, stride) over adjectives
  like "cinematic" or "epic."
```

---

## 2. Feature Card — AI Predictions (Data Visualization Energy)

```text
ROLE
You are a senior AI art director who writes copy-ready prompts for
2026's frontier image models.

TARGET MODELS
GPT Image 2 and Nano Banana 2. Both excel at abstract data-visualization
aesthetics when described as physical objects in a real space rather
than UI screenshots.

SOURCE INTENT TO PRESERVE
An abstract, photorealistic image conveying "AI race prediction" —
not a screenshot of a dashboard, but a physical-feeling visualization
of data streams, probability curves, and a greyhound silhouette
emerging from a field of light. Dark, green-accented, cinematic.

INPUTS TO COLLECT
- subject: A greyhound silhouette or wireframe model rendered in
  glowing green light particles, half-emerging from a field of
  floating data points and probability curves.
- style_reference: Volumetric light, particle systems rendered as
  physical objects (not flat UI), shallow depth of field, dark
  background, brand green #0B5C1E and orange #F97316 as the only
  glowing colors.
- negative_prompt: No flat 2D charts, no UI chrome, no text labels,
  no screenshots, no generic "AI brain" icons.

TASK
1. Restate: an image that makes "AI predictions" feel tangible and
   premium, like a physical sculpture of data.
2. Write the prompt describing the scene as a real three-dimensional
   environment: floating particles of light arranged in a curve, a
   greyhound form made of green light filaments breaking through them,
   orange highlight particles trailing behind it.
3. Camera: medium shot, eye-level, shallow depth of field so the
   foreground particles are sharp and the background dissolves to bokeh.
4. Lighting: the particles themselves are the light source. Green
   core glow, orange rim highlights on the dog silhouette. Dark void
   background with faint green atmospheric haze.
5. Color: monochromatic green-dominant (#0B5C1E to #2BAE5A range) with
   orange #F97316 as the single accent on trailing particles only.
6. Recommend 16:9 landscape. GPT Image 2: 1536x1024. Nano Banana 2:
   name "16:9 landscape" in the prompt. Resolution: 2K.
7. Follow-up edit: "Change the dog silhouette to a [different pose],
   keep the particle field identical."

OUTPUT FORMAT
- Final Image Prompt (one paragraph)
- Aspect Ratio & Size
- Model Notes
- Follow-up Edit
- Quick Self-Check

CONSTRAINTS
- Must read as photorealistic, not a flat illustration.
- No text, no labels, no UI elements described.
- The word "photorealistic" must be present.
- Do not use generic terms like "AI" or "machine learning" in the
  visual description — describe the physical light and form only.
```

---

## 3. Feature Card — Breeding Analytics (Pedigree Elegance)

```text
ROLE
You are a senior AI art director who writes copy-ready prompts for
2026's frontier image models.

TARGET MODELS
GPT Image 2 and Nano Banana 2. Both render fine detail in fur, leather,
and paper textures photorealistically.

SOURCE INTENT TO PRESERVE
A cinematic still-life of a weathered pedigree certificate, a leather-
bound breeding ledger, and a greyhound collar on a dark desk. Warm
amber lamp light. The image conveys heritage, data depth, and the
craft of breeding. Museum-quality product photography.

INPUTS TO COLLECT
- subject: An old pedigree certificate (handwritten or typewritten
  with visible family tree lines), a dark leather breeding ledger
  book, a frayed greyhound racing collar with a brass nameplate.
- style_reference: Museum still-life photography, warm low-key
  lighting, shallow depth of field, dark wood desk surface, brand
  green and amber tones, photorealistic.
- negative_prompt: No modern technology, no screens, no logos, no
  humans, no text that reads as a real brand.

TASK
1. Restate: a heritage-rich still life that makes breeding analytics
   feel like an craft with generational depth.
2. Write the prompt describing the objects arranged on a dark stained
   wood desk, certificate slightly curled at the edges, ledger open
   to a page with visible handwritten entries, collar draped across
   the foreground.
3. Camera: overhead 45-degree angle, medium shot, Canon 50mm f/1.4
   equivalence, shallow depth of field focused on the collar's brass
   nameplate.
4. Lighting: single warm amber desk lamp (3200K) from the upper right,
   creating a pool of light on the objects with deep shadows falling
   off to the left. Faint green ambient from a window out of frame.
5. Color: warm amber dominant (#F89838 range), deep brown wood, cream
   paper, dark green ambient shadow tint. The brass nameplate catches
   the only bright highlight.
6. Recommend 4:5 portrait. GPT Image 2: 1024x1536. Nano Banana 2:
   name "4:5 portrait" in the prompt. Resolution: 2K.
7. Follow-up edit: "Change the collar color to [X], keep the lighting
   and arrangement identical."

OUTPUT FORMAT
- Final Image Prompt (one paragraph)
- Aspect Ratio & Size
- Model Notes
- Follow-up Edit
- Quick Self-Check

CONSTRAINTS
- Photorealistic — the word must appear in the final prompt.
- No visible text that could read as a real brand or trademark.
- Describe textures concretely (worn leather, foxed paper, tarnished
  brass) rather than with adjectives like "vintage" or "rustic."
```

---

## 4. Feature Card — Advanced Stats (Track Geometry)

```text
ROLE
You are a senior AI art director who writes copy-ready prompts for
2026's frontier image models.

TARGET MODELS
GPT Image 2 and Nano Banana 2. Both render aerial and drone-perspective
shots with strong geometric composition.

SOURCE INTENT TO PRESERVE
A cinematic overhead drone shot of a greyhound track at dawn, the
curved track surface forming a perfect geometric ellipse against the
dark surrounding landscape. Floodlights still on but dimming in the
early light. The image conveys precision, data, and the geometry of
the sport. Cold, premium, analytical.

INPUTS TO COLLECT
- subject: An empty greyhound racing track viewed from directly
  overhead (top-down or 85-degree drone angle), the sand surface
  groomed with visible lane markings, floodlight towers at the
  perimeter casting long shadows.
- style_reference: Drone/cinematic aerial, cold dawn light, desaturated
  palette with green and orange brand accents in the infrastructure,
  shallow depth of field on the track edge, photorealistic.
- negative_prompt: No dogs, no people, no text, no UI overlays, no
  visible scoreboard content.

TASK
1. Restate: an image that makes the track itself feel like a data
   diagram — a perfect ellipse of engineered purpose.
2. Write the prompt describing the top-down view: the track's
   circumference, the sand surface texture, the inner grass field
   (dark green), the perimeter fencing, the floodlight towers and
   their long diagonal shadows across the track.
3. Camera: DJI Inspire 3 drone, 90-degree top-down or 75-degree
   oblique, 24mm equivalent wide lens, entire track filling the frame.
4. Lighting: pre-dawn blue hour, the floodlights still on and casting
   warm orange pools on the sand, the sky a deep blue-green gradient.
   Long shadows from the towers. Cool overall with warm light pools.
5. Color: desaturated cool blue-green base (#040A04 to #0A1A0A range),
   warm orange #F97316 light pools on the track, deep green #0B5C1E
   grass infield. No other saturated colors.
6. Recommend 1:1 square for feature-card use. GPT Image 2: 1024x1024.
   Nano Banana 2: name "1:1 square" in the prompt. Resolution: 2K.
7. Follow-up edit: "Add a single greyhound on the track at [position],
   keep the lighting and angle identical."

OUTPUT FORMAT
- Final Image Prompt (one paragraph)
- Aspect Ratio & Size
- Model Notes
- Follow-up Edit
- Quick Self-Check

CONSTRAINTS
- Photorealistic — must appear in the final prompt.
- No visible text, branding, or scoreboard content.
- Describe the geometry concretely (ellipse, circumference, tangent)
  rather than with adjectives like "beautiful" or "stunning."
```

---

## 5. Pricing Page — Premium Product Feel

```text
ROLE
You are a senior AI art director who writes copy-ready prompts for
2026's frontier image models.

TARGET MODELS
GPT Image 2 and Nano Banana 2. Both excel at product photography with
controlled studio lighting and shallow depth of field.

SOURCE INTENT TO PRESERVE
A cinematic close-up of a smartphone lying on a dark surface, screen
showing a blurred (unrecognizable) racing data interface, the phone's
edge catching a green-orange gradient light. Beside it, a pair of
betting glasses and a worn racing form book. The image says "premium
digital tool for the serious punter." Dark, aspirational, not flashy.

INPUTS TO COLLECT
- subject: A modern smartphone (generic, no visible brand logo) lying
  face-up on a dark slate surface, screen glowing with an abstract
  green data interface (blurred so no text is readable). A pair of
  reading glasses folded beside it. A small notebook with a pen.
- style_reference: Premium product photography, dark moody studio
  lighting, shallow depth of field, brand green and orange accent
  lighting, photorealistic.
- negative_prompt: No visible brand logos (Apple, Samsung), no readable
  text on the screen, no UI that could be mistaken for a real app,
  no humans.

TASK
1. Restate: an image that makes a digital racing tool feel like a
   premium physical object worth paying for.
2. Write the prompt describing the arrangement: phone angled slightly
  toward camera, screen glow as the primary light source on the
  surface, glasses and notebook in the midground, dark surface
  extending to black at the edges.
3. Camera: Sony A7IV, 90mm macro f/2.8, 30-degree angle from the
   surface, shallow depth of field focused on the phone's screen edge.
4. Lighting: the phone screen provides a green-cast glow (#2BAE5A
   range) on the surface. A separate orange #F97316 accent light
   grazes the phone's edge from the right. Background falls to black.
5. Color: green-dominant screen glow, orange edge accent, dark slate
   surface, warm amber reflection in the glasses lenses.
6. Recommend 16:9 landscape. GPT Image 2: 1536x1024. Nano Banana 2:
   name "16:9 landscape" in the prompt. Resolution: 2K.
7. Follow-up edit: "Change the screen glow color to [X], keep the
   arrangement and lighting identical."

OUTPUT FORMAT
- Final Image Prompt (one paragraph)
- Aspect Ratio & Size
- Model Notes
- Follow-up Edit
- Quick Self-Check

CONSTRAINTS
- Photorealistic — must appear in the final prompt.
- No visible brand logos or readable text.
- Describe the materials concretely (slate, aluminum edge, folded
  acetate frames) rather than with adjectives like "sleek."
```

---

## 6. OG Image — Social Share Card

```text
ROLE
You are a senior AI art director who writes copy-ready prompts for
2026's frontier image models.

TARGET MODELS
GPT Image 2 and Nano Banana 2. Both handle brand-composition shots
with logos when given a reference image.

SOURCE INTENT TO PRESERVE
A social-share card: the GreyhoundIQ logo centered on a dark
atmospheric background with a subtle greyhound silhouette and track
curve. Clean, branded, instantly recognizable at 1200x630.

INPUTS TO COLLECT
- subject: The GreyhoundIQ logo (uploaded as reference image) placed
  center, large, on a dark gradient background with a faint greyhound
  silhouette running along the bottom third and a subtle track curve.
- style_reference: Branded social card, dark background, green-orange
  brand gradient, minimalist, photorealistic quality on the
  background texture.
- negative_prompt: No additional text, no clutter, no stock photos of
  people, no generic racing imagery.

TASK
1. Restate: a clean, branded share card where the logo is the hero.
2. Upload the GreyhoundIQ logo as a reference image. Write the prompt
   to place it center-frame on a dark background with atmospheric
   depth: a radial gradient from deep green #0B5C1E center to near-
   black #040A04 edges, a faint orange #F97316 light bloom from the
   lower right, and a low-opacity greyhound silhouette (side profile,
   mid-stride) running left-to-right across the bottom third.
3. Camera/composition: flat front-on composition, logo centered, rule
   of thirds with the silhouette anchoring the bottom third.
4. Lighting: the background has a single soft source from the lower
   right (warm orange bloom) and a cool green ambient fill. The logo
   is evenly lit, no shadows on it.
5. Color: green-to-black radial gradient, orange accent bloom, the
   logo in its original colors. No other colors.
6. Recommend 1200x630 (standard OG image). GPT Image 2: 1536x1024
   (then crop to 1200x630). Nano Banana 2: name "1200x630" or
   "approximately 1.91:1 landscape." Resolution: 2K.
7. Follow-up edit: "Move the silhouette to the top third, keep the
   gradient and logo identical."

OUTPUT FORMAT
- Final Image Prompt (one paragraph, referencing the uploaded logo)
- Aspect Ratio & Size
- Model Notes
- Follow-up Edit
- Quick Self-Check

CONSTRAINTS
- The logo must be reproduced from the reference image, not
  reinterpreted. State: "use the provided logo image exactly."
- No additional text beyond the logo itself.
- Photorealistic background texture (subtle grain, light bloom) — the
  word "photorealistic" must be present.
```

---

## How to Use These Prompts

1. Upload the GreyhoundIQ logo files as reference images:
   - `logo-main.webp` or `logo-wordmark.webp` (full logo with wordmark)
   - `logo-mark-new.png` (square icon only)
   - `logo-mark-new.webp` (optimized square icon)

2. Copy the prompt text into GPT Image 2 or Nano Banana 2.

3. For prompts 1–5, no logo upload is needed — they are photographic.

4. For prompt 6 (OG image), upload the logo and reference it in the prompt.

5. All images should be saved to `public/images/` with names matching
   the feature cards:
   - `hero-breaking-from-boxes.webp`
   - `feature-ai-predictions.webp`
    - `feature-breeding-analytics.webp`
    - `feature-advanced-stats.webp`
    - `feature-pricing-product.webp`
    - `og-image.webp`
