import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(__dirname, path), "utf8");

const pages = [
  "feed/page.tsx",
  "page-rules/page.tsx",
  "site-content/page.tsx",
  "bespoke/page.tsx",
  "reports/page.tsx",
  "safety/page.tsx",
  "listings/page.tsx",
];

for (const page of pages) {
  const source = read(page);
  assert.match(source, /AdminSubmitButton/);
  assert.doesNotMatch(source, /<button\b/);
}

const submit = read("admin-submit-button.tsx");
assert.match(submit, /useFormStatus/);
assert.match(submit, /aria-busy=\{pending\}/);
assert.match(submit, /min-h-11/);

const mutations = read("mutations.ts");
for (const action of [
  "updatePageRulesAction",
  "updateBespokeRequestAction",
  "updatePricingContentAction",
]) {
  const start = mutations.indexOf(`export async function ${action}`);
  assert.notEqual(start, -1, `${action} is registered`);
  assert.match(mutations.slice(start, start + 1800), /revalidateAdmin\("\/admin\//);
}

const status = read("admin-operation-status.tsx");
assert.match(status, /adminResult/);
assert.match(status, /Admin change saved/);

console.log("admin control feedback contract passed");
