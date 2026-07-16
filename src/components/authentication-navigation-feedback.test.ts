import assert from "node:assert/strict";

import {
  isSameWindowSignInNavigation,
  type SignInNavigationCandidate,
} from "./authentication-navigation-feedback";

const currentUrl = "https://greyhoundsiq.com.au/pricing";
const baseCandidate: SignInNavigationCandidate = {
  href: "/sign-in",
  button: 0,
  defaultPrevented: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  target: "",
  download: false,
};

for (const href of [
  "/sign-in",
  "/sign-in/",
  "/sign-in?returnTo=%2Faccount",
  "https://greyhoundsiq.com.au/sign-in?plan=pro",
]) {
  assert.equal(
    isSameWindowSignInNavigation({ ...baseCandidate, href }, currentUrl),
    true,
    href,
  );
}

for (const candidate of [
  { href: "https://example.com/sign-in" },
  { href: "//example.com/sign-in" },
  { href: "/sign-in/extra" },
  { href: "/pricing" },
  { href: "javascript:void(0)" },
  { button: 1 },
  { defaultPrevented: true },
  { altKey: true },
  { ctrlKey: true },
  { metaKey: true },
  { shiftKey: true },
  { target: "_blank" },
  { download: true },
] as const) {
  assert.equal(
    isSameWindowSignInNavigation(
      { ...baseCandidate, ...candidate },
      currentUrl,
    ),
    false,
    JSON.stringify(candidate),
  );
}

assert.equal(
  isSameWindowSignInNavigation(
    { ...baseCandidate, href: "http://[invalid" },
    currentUrl,
  ),
  false,
);

console.log(
  "Authentication navigation feedback classifier passed: same-window local sign-in activation is accepted and modified, external, download, prevented, invalid, and unrelated navigation is rejected.",
);
