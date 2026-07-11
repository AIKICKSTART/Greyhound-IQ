import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const accountSource = readFileSync(join(__dirname, "page.tsx"), "utf8");
const profileStudioSource = readFileSync(
  join(__dirname, "profile", "page.tsx"),
  "utf8"
);
const pagesSource = readFileSync(join(__dirname, "pages", "page.tsx"), "utf8");
const pageEditorSource = readFileSync(
  join(__dirname, "pages", "[id]", "page.tsx"),
  "utf8"
);
const profileSource = readFileSync(
  join(__dirname, "..", "p", "[handle]", "page.tsx"),
  "utf8"
);
const uploaderSource = readFileSync(
  join(__dirname, "..", "..", "components", "media-attachment-fields.tsx"),
  "utf8"
);
const billingSource = readFileSync(join(__dirname, "billing", "page.tsx"), "utf8");
const usageSource = readFileSync(join(__dirname, "usage", "page.tsx"), "utf8");
const supportSource = readFileSync(join(__dirname, "support", "page.tsx"), "utf8");
const teamSource = readFileSync(join(__dirname, "team", "page.tsx"), "utf8");
const savedListingsSource = readFileSync(
  join(__dirname, "saved-listings", "page.tsx"),
  "utf8"
);

assert.ok(
  accountSource.includes("user ? (") &&
    accountSource.includes("<AccountMemberHeader") &&
    accountSource.includes("<PageHero"),
  "Account must keep compact member and cinematic signed-out headers"
);
for (const signedOutContract of [
  'image="/images/wentworth-gate-hero.webp"',
  "Your GreyhoundIQ",
  "Profile, tier, privacy, messaging, and account controls in one place.",
]) {
  assert.ok(
    accountSource.includes(signedOutContract),
    `Signed-out account hero must preserve: ${signedOutContract}`
  );
}
for (const identityContract of [
  'id="cover-image-editor"',
  'id="profile-picture-editor"',
  "action={updatePersonalIdentityMedia}",
  'fieldName="avatarMediaIdNew"',
  'fieldName="coverMediaIdNew"',
  'zoomName="avatarZoom"',
  'rotationName="coverRotation"',
  "Publish profile",
]) {
  assert.ok(
    profileStudioSource.includes(identityContract),
    `Profile Studio must preserve: ${identityContract}`
  );
}
assert.ok(
  accountSource.includes('href="/account/profile"') &&
    accountSource.includes("Open Profile Studio"),
  "Account must link to the dedicated Profile Studio"
);

assert.ok(
  pagesSource.includes("resolvePageAvatarUrls") &&
    pagesSource.includes('unoptimized={avatarUrl.startsWith("/api/media/")}'),
  "Managed-page cards must deliver protected avatars with viewer auth"
);
for (const formContract of [
  "action={updateAction}",
  "action={publishAction}",
  "action={deleteAction}",
  'field="avatarMediaIdNew"',
  'field="bannerMediaIdNew"',
  'fieldName="galleryMediaIdsNew"',
  'mediaContext="custom-page"',
]) {
  assert.ok(
    pageEditorSource.includes(formContract),
    `Managed-page editor must preserve: ${formContract}`
  );
}
for (const field of [
  "title",
  "tagline",
  "about",
  "contactEmail",
  "contactPhone",
  "website",
  "contactVisibility",
  "accentColor",
]) {
  assert.ok(
    pageEditorSource.includes(`name="${field}"`),
    `Managed-page editor must retain ${field}`
  );
}
for (const field of [
  'xName: "avatarFocalX"',
  'yName: "avatarFocalY"',
  'xName: "coverFocalX"',
  'yName: "coverFocalY"',
]) {
  assert.ok(
    pageEditorSource.includes(field),
    `Managed-page editor must retain ${field}`
  );
}
for (const protectedMedia of [
  "media.bannerUrl",
  "media.avatarUrl",
  "media.logoUrl",
  "media.cardUrl",
  'unoptimized={url.startsWith("/api/media/")}',
]) {
  assert.ok(
    pageEditorSource.includes(protectedMedia),
    `Managed-page preview must retain protected media: ${protectedMedia}`
  );
}

assert.ok(
  profileSource.includes(
    'href={`/account/pages/${page.id}#page-banner-editor`}'
  ) &&
    profileSource.includes(
      'href={`/account/pages/${page.id}#page-avatar-editor`}'
    ),
  "Managed profiles must expose separate cover and avatar edit targets"
);
assert.ok(
  !profileSource.includes("style={{ background: accent }}") &&
    profileSource.includes("[overflow-wrap:anywhere]") &&
    profileSource.includes('className="flex min-h-11 items-center gap-2'),
  "Custom accents and long/contact content must remain readable and mobile-safe"
);
assert.ok(
  uploaderSource.includes(
    'mediaContext === "avatars" || mediaContext === "custom-page"'
  ),
  "Managed-page image slots must not accept unrenderable audio or documents"
);
assert.ok(
  profileStudioSource.includes("MediaAlignmentUpload") &&
    pageEditorSource.includes("MediaAlignmentUpload"),
  "Personal and managed-page uploads must support drag alignment before save"
);

for (const [source, header] of [
  [billingSource, "BillingMemberHeader"],
  [usageSource, "UsageMemberHeader"],
] as const) {
  assert.ok(
    source.includes("user ? (") &&
      source.includes(`<${header}`) &&
      source.includes("<PageHero"),
    `${header} must replace the cinematic hero only for signed-in members`
  );
}
assert.ok(
  billingSource.includes('action="/api/billing/portal"') &&
    billingSource.includes('method="post"') &&
    billingSource.includes("getEntitlementLimitsForCurrentUser"),
  "Billing polish must preserve the portal POST and entitlement resolution"
);
assert.ok(
  usageSource.includes('role="region"') &&
    usageSource.includes("getUsageEventsForUser(user)"),
  "Usage polish must preserve scoped events and accessible table overflow"
);

for (const [source, route] of [
  [supportSource, "support"],
  [teamSource, "team"],
  [savedListingsSource, "saved listings"],
] as const) {
  assert.ok(
    source.includes("requireCurrentUserProfile") &&
      source.includes('redirect("/sign-in")') &&
      !source.includes("<PageHero"),
    `Authenticated ${route} must retain its WorkOS guard and compact member header`
  );
}
assert.ok(
  teamSource.includes('role="region"') &&
    teamSource.includes("withDbRequestContext(current") &&
    teamSource.includes("Organizations are temporarily unavailable"),
  "Team polish must preserve RLS-scoped reads, failure states, and accessible table overflow"
);
assert.ok(
  savedListingsSource.includes("ListingCardMediaCarousel") &&
    savedListingsSource.includes("mediaDeliveryUrl(media)") &&
    savedListingsSource.includes("getSavedListingsForCurrentUser(current)") &&
    !savedListingsSource.includes(
      '.filter(({ media }) => media.mimeType.startsWith("image/"))'
    ),
  "Saved listings must keep protected delivery for every media type and viewer-scoped data"
);
assert.ok(
  supportSource.includes("Support history is temporarily unavailable") &&
    usageSource.includes("Usage history is temporarily unavailable"),
  "Account query failures must remain distinct from genuine empty states"
);

console.log("Account and managed-page polish contract tests passed");
