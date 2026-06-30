# GreyhoundIQ — Video Animation Prompt Pack v1

> For AI video generation tools: Sora, Runway Gen-4, Kling 2.1, Veo 3.
> Source image: `public/images/feature-breeding-analytics.webp`
> (the Breeding Analytics still-life used as the hero on /breeding)
>
> Style: heritage still-life, brass nameplate, dark walnut, racing green velvet,
> warm directional key, volumetric haze, dust motes in light shaft.
> Brand palette: racing green #0B5C1E, electric orange #F97316,
> near-black #040A04, antique brass gold.

---

## Prompt 1 — 5-second ambient loop
*Best for: page backgrounds, loading states, hero video backgrounds on /breeding*

A locked-off, almost-imperceptible dolly-in on a still-life editorial photograph of a polished brass nameplate engraved with a pedigree lineage title, resting on dark walnut wood beside a folded deep-green velvet cloth. The camera drifts forward only a few millimetres — a breath, not a move — while the only true motion in the frame is a slow, lazy drift of fine dust motes caught in a single warm shaft of light slicing in from upper-left. The brass catches a slow specular glide as the micro-dolly shifts the highlight across the engraved lettering. Volumetric haze sits in the air like a quiet room after hours; colour palette is deep racing green in the shadows, antique gold on the brass, near-black negative space. No people, no dramatic action — the mood is hushed, archival, museum-after-closing. Perfect 5-second seamless loop with no visible cut.

---

## Prompt 2 — 10-second reveal
*Best for: feature section reveals, scroll-triggered animations, "discovery" moments*

Begin on a soft, out-of-focus extreme close-up of the brass nameplate's edge — the engraving is illegible, just a warm amber bokeh of polished metal and engraved shadow. Over 10 seconds the camera performs a slow, deliberate push-in and a barely-there focus rack from macro foreground blur to tack-sharp mid-ground on the engraved lettering, as if the viewer's eye is finally settling on what matters. The only "event" is a single dust mote drifting diagonally through the key light as focus lands. Lighting evolves subtly: the warm key from upper-left strengthens by one stop over the duration, deepening the engraved shadows and revealing the patina texture of the brass. Background remains a soft wash of deep racing green and dark wood grain, completely out of focus. Atmosphere: contemplative, reverent, the moment of reading a name on a trophy. Mood: discovery, heritage, quiet pride. No music, no people, no text overlays — let the metal speak.

---

## Prompt 3 — 15-second cinematic sequence
*Best for: marketing hero, launch trailer, About-page background video, investor pitch*

A 15-second cinematic opening: the shot begins low and tight on the corner of a folded piece of deep-green racing velvet on dark walnut, then executes a slow, smooth dolly-back and gentle upward crane to reveal the full still life — the brass nameplate centred, flanked by the velvet, a leather-bound ledger edge entering frame-right, and the suggestion of a blurred oil painting of a greyhound in the deep background.

From 0–5s: low-angle dolly-back, parallax separation between foreground velvet texture and the brass.
From 5–10s: the camera continues back and rises slightly, allowing the engraved brass nameplate to read clearly as the focal subject while a soft specular highlight glides across its surface from a moving key light.
From 10–15s: a very slow pan-right reveals the edge of the ledger and a brass key resting on it, before the move settles into a composed three-quarter hero frame of the nameplate.

Atmosphere: warm directional key from upper-left, cool greenish fill from below, gentle volumetric haze catching a lazy stream of dust motes throughout. Mood: heritage library, after-hours club room, pedigree and provenance. Palette: antique brass gold, racing green #0B5C1E, near-black shadow, a single restrained glint of electric-orange #F97316 on the very edge of the key reflection — the brand's accent seen only as a whisper. Cinematic 24fps, shallow depth of field, anamorphic-style oval bokeh, no people, no hard cuts.

---

## How to use

1. Pick the prompt that matches the intended duration and use case.
2. Copy the prompt into Sora / Runway Gen-4 / Kling 2.1 / Veo 3.
3. Upload `public/images/feature-breeding-analytics.webp` as the **first-frame** reference (Runway Gen-4 and Kling both support image-to-video).
4. Render at 24fps, 1080p or higher.
5. Save outputs as `public/videos/breeding-{loop,reveal,cinematic}.mp4` and reference from `/breeding` page once rendered.

## Negative prompt (for all three)

people, faces, hands, text overlays, watermarks, UI chrome, cartoon, illustration,
fast motion, dramatic action, jump cuts, oversaturated neon, blown highlights,
compression artifacts, motion blur that hides the subject, generic stock footage.
