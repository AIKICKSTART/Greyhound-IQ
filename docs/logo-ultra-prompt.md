# GreyhoundIQ — LogoUltra Prompt (3D polished)

> For **GPT Image 2** (Ideogram 4 fallback). One prompt, no chaining.
> Target: 1024×1024 transparent PNG (or 2048×2048 for hi-DPI).
> Aspect: 1:1 square.

---

## LogoUltra — Primary Mark

```
Luxury premium 3D logo mark for "GreyhoundIQ" — an Australian
greyhound racing data platform.

Concept: a stylised greyhound in mid-stride, rendered as a
sleek abstract speed-form, fused with an angular "IQ" letterform.
The greyhound is not realistic — it is a continuous, polished
chrome ribbon that traces the dog's silhouette from nose to
tail, narrowing at the chest (suggesting chest-deep aerodynamic
form), curving over the back (suggesting muscular haunches),
and tapering into a flowing tail. The rear leg of the greyhound
extends and merges into the letter "Q" — the "Q"'s tail becomes
the dog's tail. The "I" of IQ is rendered as a vertical blade
between the dog form and the "Q", with a tiny lightning-bolt
notch at the top (representing intelligence / speed).

Material and finish: polished chrome / liquid metal, primary
finish in the brand's signature racing-green
#1B7A3D (deep, saturated forest green) with a brighter
secondary highlight band in #2BAE5A running along the upper
edge of every curve. The base of the mark sits on a subtle
orange #F97316 accent disc (think a tyre / hub / track
section), rendered as a thin bevelled ring partially visible
behind the lower-right of the mark. The chrome has crisp
specular highlights (sharp white pinpricks), soft long
horizontal bloom reflections, and a faint inner glow of
green at the inner curves. NO matte surfaces, NO flat fills.

Background: pure white #FFFFFF (for transparent export).
Subtle ambient occlusion shadow directly under the mark,
soft radial gradient shadow extending ~30% beyond the mark,
fading to transparent. NO additional decoration, NO text in
the rendered output. Wordmark is generated separately.

Lighting: studio 3-point setup. Key light from upper-left at
30° elevation, casting the brightest specular highlights on
the dog's spine, head, and upper "I". Fill light from lower-
right at low intensity to lift the underside. Rim light from
behind-above in orange #F97316 (brand secondary), picking out
the top edge of the silhouette. Result: the mark reads as
sculpted metal, not flat vector art.

Composition: the mark sits dead-centre with ~12% margin on
all sides. The mark is large enough that the longest dimension
fills ~76% of the frame. The vertical centre of mass is at
true centre. The "Q" tail extends slightly to the lower right,
giving the composition a subtle forward-lean (motion).

Style references: Apple-style precision chrome, Porsche badge
3D realism, Stripe logo polish, Linear brand mark restraint.
NOT toy-like, NOT cartoony, NOT anime, NOT gradient-only
flat-design, NOT overly futuristic-cyber.

Render quality: hyper-realistic 3D render, ray-traced
reflections, ambient occlusion, micro-surface imperfections
(very subtle — a single almost-invisible fingerprint-scale
brush stroke on the chrome to defeat the AI "perfect plastic"
look), 8K-detail crispness, no compression artifacts, no noise,
no grain. Output at 1024×1024 minimum, 2048×2048 preferred.

Negative prompts (do NOT include):
realistic photo of a dog, cartoon, anime, hand-drawn, painted,
watercolour, sketch, calligraphy, serif typography, flat design
without 3D, gradient-only logo, generic "AI" brain icon,
generic lightning bolt alone, generic shield, generic globe,
generic racing flag, generic checkered flag, generic tyre,
generic paw print, generic letter "G" alone, generic letter
"I" alone, generic letter "Q" alone, full-body greyhound
silhouette without IQ fusion, multiple dogs, multiple logos,
text in the image, watermark, background scenery, gradient
background colour, drop shadow halo, motion blur, lens flare,
bokeh, depth-of-field blur on the mark itself, low-resolution,
JPEG artifacts, oversaturation, neon glow, rainbow colours,
pastel palette.
```

---

## LogoUltra — Compact Wordmark Variant (companion file)

```
Luxury premium 3D wordmark "GreyhoundIQ" — no icon, type only.

Concept: tightly tracked custom wordmark. "Greyhound" set in
a geometric sans-serif (Inter Display / Helvetica Neue Heavy
analogue), all-lowercase, weight 800. "IQ" set immediately
after with no space, uppercase, weight 900, slightly taller
cap-height than "Greyhound" lowercase x-height, in the brand
orange #F97316 — creating a clear visual hierarchy where
"greyhound" is the noun and "IQ" is the smart-bit qualifier.

Material: "greyhound" letters rendered in polished chrome with
the same green #1B7A3D base and #2BAE5A highlight band as the
mark. "IQ" letters rendered in solid orange #F97316 with a
single thin chrome bevel edge for unity.

Treatment: same 3-point lighting setup as the mark. Subtle
horizontal reflection band across the middle of every
character. Sharp specular pinpricks at the top of round
letters (g, r, o, Q). No matte. No flat fill.

Background: pure white #FFFFFF with a soft elliptical
ambient occlusion shadow directly under the wordmark.

Composition: centred, 76% horizontal fill, ~14% vertical
margin top and bottom. Kerning tight, letter-spacing -0.02em.

Negative prompts: same as mark, plus "letter spacing too wide",
"kerning gaps", "fake 3D extrusion", "drop shadow on letters",
"text outline", "stroke text".
```

---

## LogoUltra — Combined Mark + Wordmark (lockup)

```
Luxury premium 3D logo lockup — GreyhoundIQ mark + wordmark
side-by-side, intended for headers and the iOS app icon
centre plate.

Composition: mark on the left (1x height), wordmark on the
right (1x height), 8% gap between them, total lockup height
fills ~72% of the canvas, centred both axes.

Mark is identical to the primary mark above (3D chrome green,
orange ring detail). Wordmark is the compact wordmark above
(greyhound chrome + IQ orange).

Background: pure white #FFFFFF. Soft ambient occlusion shadow
under the entire lockup, single soft elliptical shape, fading
to transparent at the edges.

Lighting, materials, and negatives: identical to the primary
mark and wordmark prompts.

App-icon variant: same lockup on a rounded-square 1024×1024
dark navy background (#0F1011) with a subtle 1px inner highlight
along the top edge (chrome rim), lockup sits in the centre
filling ~64% of the icon, slightly forward-leaning.
```

---

## Generation parameters (for the user, not the model)

| Setting | Value |
|---|---|
| Model | GPT Image 2 (preferred) / Ideogram 4 (fallback) / DALL·E 3 (last resort) |
| Aspect | 1:1 (1024×1024 or 2048×2048) |
| Background | Transparent (post-process with `rembg` or Photoshop) or pure white |
| Output format | PNG (lossless), then export WebP for web |
| Variants to generate | 3 total (mark only, wordmark only, lockup) |
| Expected regenerations | 3–5 per variant before accepting — GPT Image 2 is non-deterministic on chrome 3D |
| Quality check | Specular highlights crisp, no compression artifacts, no fake "AI brain" iconography, IQ tail merges into Q tail cleanly |

## Post-generation checklist

- [ ] Mark sits centred with 12% margin (not too small, not cropped)
- [ ] Chrome has visible specular highlights AND subtle orange rim
- [ ] Green is `#1B7A3D`, not a generic green
- [ ] Orange is `#F97316`, not a generic orange
- [ ] No tail of "Q" floating disconnected from the dog silhouette
- [ ] No text in the mark-only output
- [ ] No realistic dog photo (must be abstract chrome form)
- [ ] No watermark, no signature, no "Made with AI" badge
- [ ] No gradient-only flat rendering (must be 3D chrome)
- [ ] No emoji, no cartoon eyes, no smile