import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const accountSource = readFileSync(join(__dirname, "page.tsx"), "utf8");
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
  'href="#cover-image-editor"',
  'href="#profile-picture-editor"',
  "action={updatePersonalIdentityMedia}",
  'fieldName="avatarMediaIdNew"',
  'fieldName="coverMediaIdNew"',
  'unoptimized={profileCoverUrl.startsWith("/api/media/")}',
  'unoptimized={profileAvatarUrl.startsWith("/api/media/")}',
]) {
  assert.ok(
    accountSource.includes(identityContract),
    `Personal identity editor must preserve: ${identityContract}`
  );
}

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
  "coverFocalX",
  "coverFocalY",
]) {
  assert.ok(
    pageEditorSource.includes(`name="${field}"`),
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

console.log("Account and managed-page polish contract tests passed");
