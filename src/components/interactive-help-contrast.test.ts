import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type Rgb = readonly [red: number, green: number, blue: number];

const globalsSource = readFileSync("src/app/globals.css", "utf8");
const helpSource = readFileSync("src/components/interactive-help.tsx", "utf8");
const moduleSource = readFileSync(
  "src/components/interactive-help.module.css",
  "utf8",
);

const surface1 = readHslToken("surface-1");
const surface2 = readHslToken("surface-2");
const surface3 = readHslToken("surface-3");
const foreground = readHslToken("foreground");
const mutedForeground = readHslToken("muted-foreground");
const primaryLight = readHslToken("primary-light");
const secondaryLight = readHslToken("secondary-light");
const white: Rgb = [1, 1, 1];

const sheetOverWhite = blend(surface1, white, 0.98);
const raisedPanelOverSheet = blend(white, sheetOverWhite, 0.035);
const textBackgrounds = [
  ["surface 1", surface1],
  ["surface 2", surface2],
  ["surface 3", surface3],
  ["98% sheet over white", sheetOverWhite],
  ["raised panel over sheet", raisedPanelOverSheet],
] as const;
const textColours = [
  ["foreground", foreground],
  ["muted foreground", mutedForeground],
  ["primary light", primaryLight],
  ["secondary light", secondaryLight],
] as const;

let lowestTextRatio = Number.POSITIVE_INFINITY;
for (const [colourName, colour] of textColours) {
  for (const [backgroundName, background] of textBackgrounds) {
    const ratio = contrastRatio(colour, background);
    lowestTextRatio = Math.min(lowestTextRatio, ratio);
    assert.ok(
      ratio >= 4.5,
      `${colourName} on ${backgroundName} is ${ratio.toFixed(2)}:1`,
    );
  }
}

const primaryControlLightestBackground = hslToRgb(281, 66, 34);
const primaryControlRatio = contrastRatio(white, primaryControlLightestBackground);
assert.ok(
  primaryControlRatio >= 4.5,
  `primary control is ${primaryControlRatio.toFixed(2)}:1`,
);
assert.ok(
  contrastRatio(primaryLight, surface3) >= 3,
  "focus and target indicators must retain at least 3:1 non-text contrast",
);

assert.doesNotMatch(
  helpSource,
  /text-\[hsl\(var\(--subtle-foreground\)\)\]/,
  "small onboarding copy must not use the lower-contrast subtle token",
);
assert.equal(
  helpSource.match(/styles\.secondaryControl/g)?.length,
  helpSource.match(/giq-button-(?:glass|carbon)/g)?.length,
  "every secondary onboarding button must use the opaque contrast-safe state",
);
assert.equal(helpSource.match(/styles\.primaryControl/g)?.length, 1);
assert.equal(helpSource.match(/giq-button-primary/g)?.length, 1);
assert.match(
  moduleSource,
  /\.secondaryControl[\s\S]*color: hsl\(var\(--foreground\)\) !important;/,
);
assert.match(
  moduleSource,
  /\.secondaryControl:hover,[\s\S]*background-color: hsl\(var\(--surface-2\)\) !important;/,
);
assert.match(
  moduleSource,
  /\.primaryControl,[\s\S]*background-image: linear-gradient\([\s\S]*hsl\(281 66% 34%\),[\s\S]*hsl\(281 66% 22%\)/,
);

console.log(
  `Interactive help contrast passed: lowest text pair ${lowestTextRatio.toFixed(2)}:1; primary control ${primaryControlRatio.toFixed(2)}:1.`,
);

function readHslToken(name: string): Rgb {
  const match = new RegExp(
    `--${name}:\\s*(-?\\d+(?:\\.\\d+)?)\\s+(-?\\d+(?:\\.\\d+)?)%\\s+(-?\\d+(?:\\.\\d+)?)%`,
  ).exec(globalsSource);
  assert.ok(match, `missing --${name} HSL token`);
  return hslToRgb(Number(match[1]), Number(match[2]), Number(match[3]));
}

function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const normalizedSaturation = saturation / 100;
  const normalizedLightness = lightness / 100;
  const chroma =
    (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const segment = normalizedHue / 60;
  const intermediate = chroma * (1 - Math.abs((segment % 2) - 1));
  const offset = normalizedLightness - chroma / 2;
  const rgbWithoutOffset: Rgb =
    segment < 1
      ? [chroma, intermediate, 0]
      : segment < 2
        ? [intermediate, chroma, 0]
        : segment < 3
          ? [0, chroma, intermediate]
          : segment < 4
            ? [0, intermediate, chroma]
            : segment < 5
              ? [intermediate, 0, chroma]
              : [chroma, 0, intermediate];
  return rgbWithoutOffset.map(
    (channel) => channel + offset,
  ) as unknown as Rgb;
}

function blend(foregroundColour: Rgb, background: Rgb, alpha: number): Rgb {
  return foregroundColour.map(
    (channel, index) =>
      channel * alpha + background[index]! * (1 - alpha),
  ) as unknown as Rgb;
}

function contrastRatio(left: Rgb, right: Rgb) {
  const lighter = Math.max(relativeLuminance(left), relativeLuminance(right));
  const darker = Math.min(relativeLuminance(left), relativeLuminance(right));
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(colour: Rgb) {
  const [red, green, blue] = colour.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return red! * 0.2126 + green! * 0.7152 + blue! * 0.0722;
}
