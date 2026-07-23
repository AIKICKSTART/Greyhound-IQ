import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const homePage = readFileSync("src/app/page.tsx", "utf8");
const homeHero = readFileSync("src/components/home-hero.tsx", "utf8");
const routeStart = homePage.indexOf("export default function HomePage");
const routeEnd = homePage.indexOf("\nasync function TodaysRacesSection");

assert.ok(routeStart >= 0 && routeEnd > routeStart);

const route = homePage.slice(routeStart, routeEnd);
const pricingPosition = route.indexOf("<PricingCtaSection />");
const racesPosition = route.indexOf("<TodaysRacesSection />");

assert.ok(
  pricingPosition >= 0 && pricingPosition < racesPosition,
  "the conversion offer must appear before the long race schedule",
);
assert.ok(
  homePage.includes("const { plans } = await getPricingContent();"),
  "home pricing must use the admin-managed pricing source",
);
assert.ok(
  homePage.includes(
    'const homePlans = plans.filter(({ id }) => id !== "pro_plus");',
  ),
  "the unavailable Pro+ tier must stay off the conversion-focused home offer",
);
assert.ok(homePage.includes("homePlans.map"));
assert.ok(homePage.includes('href="/sign-in?plan=free"'));
assert.ok(homePage.includes('href="/pricing"'));
assert.ok(!homePage.includes("$20"));
assert.ok(homeHero.includes('primaryHref = "/sign-in?plan=free"'));
assert.ok(homeHero.includes("Start Free"));
assert.ok(homeHero.includes('href="#pricing"'));

console.log("Home conversion contract tests passed");
