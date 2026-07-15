import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(__dirname, "feed-system-prototype.tsx"),
  "utf8",
);
const identityBannerSource = readFileSync(
  join(__dirname, "hub", "hub-identity-banner.tsx"),
  "utf8",
);

const additionalPosts = source.match(
  /const ADDITIONAL_MEMBER_POSTS = \[([\s\S]*?)\] as const;/,
)?.[1];

assert.ok(additionalPosts, "The standalone feed must define additional member stories");
assert.equal(
  additionalPosts.match(/postId:/g)?.length,
  6,
  "The demo feed must include six additional member posts",
);

for (const story of [
  "Trainer update",
  "Owner milestone",
  "Form analysis",
  "Trackside report",
  "Breeding discussion",
  "Seller story",
]) {
  assert.ok(additionalPosts.includes(`kind: "${story}"`), `Missing ${story} member story`);
}

const uniquePostAssets = [
  "sarah-trackside-note.webp",
  "mark-sectional-comparison.webp",
  "trainer-recovery-update.webp",
  "owner-fiftieth-start.webp",
  "evidence-sectional-review.webp",
  "trackside-weather-report.webp",
  "breeding-family-discussion.webp",
  "marketplace-seller-handover.webp",
  "lisa-community-night.webp",
] as const;

for (const asset of uniquePostAssets) {
  assert.ok(
    existsSync(join(__dirname, `../../public/images/feed/posts/${asset}`)),
    `Missing local feed asset ${asset}`,
  );
  assert.equal(
    source.match(new RegExp(`/images/feed/posts/${asset.replace(".", "\\.")}`, "g"))?.length,
    1,
    `Feed post artwork must be used exactly once: ${asset}`,
  );
}
assert.ok(
  existsSync(join(__dirname, "../../public/images/feed/founder-race-night-cover.webp")),
  "Missing local founder cover artwork",
);

for (const contract of [
  'data-feed-content="member"',
  "ADDITIONAL_MEMBER_POSTS.slice(0, 2)",
  "ADDITIONAL_MEMBER_POSTS.slice(2, 4)",
  "ADDITIONAL_MEMBER_POSTS.slice(4)",
  "const [liked, setLiked] = useState(false);",
  "const [saved, setSaved] = useState(false);",
  "const [shared, setShared] = useState(false);",
  "setCommentTotal((total) => total + 1);",
  "Demo controls are local. No live account or post data is changed.",
  "<InteractiveHelp firstName={firstName} />",
  'data-feed-media-kind={mediaKind}',
  'mediaKind === "portrait-card" ? "object-contain object-center p-3 sm:p-5" : "object-cover object-center"',
  '"aspect-[5/7] max-h-[680px] sm:aspect-[16/10] sm:max-h-[520px]"',
  '"aspect-[4/3] sm:aspect-[16/9]"',
  "relative w-full min-w-0 overflow-hidden",
]) {
  assert.ok(source.includes(contract), `Feed demo must preserve: ${contract}`);
}

const buttons = source.match(/<button\b[\s\S]*?>/g) ?? [];
assert.ok(buttons.length >= 20, "Expected the feed demo's interactive control set");
for (const button of buttons) {
  assert.ok(
    button.includes("onClick=") || button.includes('type="submit"'),
    `Every feed demo button must have a local action or form submit handler: ${button}`,
  );
}
assert.equal(
  identityBannerSource.match(/<h1\b/g)?.length ?? 0,
  0,
  "The feed identity banner must not introduce a second page-level heading",
);
assert.equal(
  identityBannerSource.match(/<h2\b/g)?.length,
  1,
  "The feed identity banner must retain its section heading",
);

console.log("Feed demo experience contract tests passed");
