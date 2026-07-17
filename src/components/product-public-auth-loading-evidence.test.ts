import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  PRODUCT_PUBLIC_AUTH_LOADING_EVIDENCE_FILE,
  PRODUCT_PUBLIC_AUTH_LOADING_EXPECTED_GAIN,
  PRODUCT_PUBLIC_AUTH_LOADING_MASTER_EVIDENCE,
  PRODUCT_PUBLIC_AUTH_LOADING_REQUIREMENT_IDS,
  PRODUCT_PUBLIC_AUTH_LOADING_SCOPE,
  PRODUCT_PUBLIC_AUTH_LOADING_TEST_FILE,
} from "./product-public-auth-loading-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-PUBLIC-AUTH-LOADING

const REQUIREMENT_ID = "ROUTE.PUBLIC.auth-loading" as const;
const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === REQUIREMENT_ID,
);
assert.ok(requirement, REQUIREMENT_ID);
assert.equal(
  requirement.requirement,
  "Represent authentication redirect loading.",
);
assert.deepEqual(PRODUCT_PUBLIC_AUTH_LOADING_REQUIREMENT_IDS, [REQUIREMENT_ID]);
assert.equal(PRODUCT_PUBLIC_AUTH_LOADING_EXPECTED_GAIN, 1);
assert.deepEqual(Object.keys(PRODUCT_PUBLIC_AUTH_LOADING_MASTER_EVIDENCE), [
  REQUIREMENT_ID,
]);

const evidence = PRODUCT_PUBLIC_AUTH_LOADING_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_PUBLIC_AUTH_LOADING_EVIDENCE_FILE,
  PRODUCT_PUBLIC_AUTH_LOADING_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));

for (const phrase of [
  "outbound public authentication-redirect feedback",
  "same-window, same-origin /sign-in anchor activation",
  "synchronously renders an accessible",
  "clears stale pending state",
  "does not prove hydrated paint timing",
  "SYSTEM.auth-callback-loading remains open",
]) {
  assert.match(PRODUCT_PUBLIC_AUTH_LOADING_SCOPE, new RegExp(phrase, "i"));
}

const component = source(
  "src/components/authentication-navigation-feedback.tsx",
);
for (const token of [
  '"use client"',
  "export function isSameWindowSignInNavigation(",
  "candidate.defaultPrevented",
  "candidate.button !== 0",
  "candidate.altKey",
  "candidate.ctrlKey",
  "candidate.metaKey",
  "candidate.shiftKey",
  "candidate.download",
  'candidate.target.toLowerCase() !== "_self"',
  "destination.origin === current.origin",
  'pathname === "/sign-in"',
  'source.closest<HTMLAnchorElement>("a[href]")',
  'document.addEventListener("click", handleClick, true)',
  "event.defaultPrevented",
  "flushSync(() => setPending(true))",
  'window.addEventListener("pageshow", resetPending)',
  'role="status"',
  'aria-live="polite"',
  'aria-atomic="true"',
  "Opening secure sign-in…",
]) {
  assert.ok(component.includes(token), `auth loading feedback: ${token}`);
}
assert.doesNotMatch(
  component,
  /preventDefault\s*\(/,
  "feedback must not replace or delay the sign-in navigation",
);

const layout = source("src/app/layout.tsx");
assert.match(
  layout,
  /import \{ AuthenticationNavigationFeedback \} from "@\/components\/authentication-navigation-feedback"/,
);
assert.equal(
  layout.match(/<AuthenticationNavigationFeedback \/>/g)?.length,
  1,
  "the delegated sign-in feedback must mount exactly once",
);

const classifierTest = source(
  "src/components/authentication-navigation-feedback.test.ts",
);
for (const token of [
  'href: "/sign-in"',
  '"/sign-in?returnTo=%2Faccount"',
  'href: "https://example.com/sign-in"',
  'href: "/sign-in/extra"',
  "{ defaultPrevented: true }",
  '{ target: "_blank" }',
  "{ download: true }",
]) {
  assert.ok(classifierTest.includes(token), `classifier boundary: ${token}`);
}

const evidenceSource = source(PRODUCT_PUBLIC_AUTH_LOADING_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Public authentication-loading evidence passed: delegated local sign-in activation renders immediate accessible feedback and rejects navigation that should remain browser-controlled; exact +1 central wiring is ready.",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}
