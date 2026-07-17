import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const contactSource = readFileSync("src/app/contact/page.tsx", "utf8");
const supportHistorySource = readFileSync(
  "src/app/account/support/page.tsx",
  "utf8",
);
const supportHelpSource = readFileSync(
  "src/components/account-support-help-centre.tsx",
  "utf8",
);

assert.match(contactSource, /htmlFor="support-category"/);
assert.match(contactSource, /id="support-category"/);
assert.match(contactSource, /aria-describedby="support-category-help"/);
assert.match(contactSource, /Choose Billing for payments or plans/);

assert.match(contactSource, /htmlFor="support-message"/);
assert.match(contactSource, /id="support-message"/);
assert.match(contactSource, /aria-describedby="support-message-help"/);
assert.match(contactSource, /Include the page, what you expected, what happened/);
assert.match(contactSource, /Never include passwords, access tokens/);
assert.match(contactSource, /Show a safe example/);
assert.match(contactSource, /On Account &gt; Billing at about 7:30 pm AEST/);

assert.match(supportHistorySource, /No support tickets yet/);
assert.match(supportHistorySource, /Tickets you create from the contact page will appear here/);
assert.match(supportHistorySource, /href="\/contact"/);
assert.match(supportHistorySource, /Create ticket/);
assert.match(supportHistorySource, /profileScope=\{current\.profileId\}/);
assert.match(supportHelpSource, /Onboarding preferences/);
assert.match(supportHelpSource, /Guided help controls/);
assert.match(
  supportHelpSource,
  /<InteractiveHelpMenuControls profileScope=\{profileScope\} \/>/,
);

console.log(
  "Support onboarding surface passed: labelled field guidance, intentional onboarding controls, a safe inline example and actionable empty history.",
);
