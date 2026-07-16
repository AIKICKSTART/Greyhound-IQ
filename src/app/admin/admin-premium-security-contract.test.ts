import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(__dirname, path), "utf8");

const layout = read("layout.tsx");
const nav = read("admin-nav.tsx");
const mutations = read("mutations.ts");
const forms = read("form-controls.tsx");
const submit = read("admin-submit-button.tsx");
const error = read("error.tsx");
const loading = read("loading.tsx");
const adminService = read("../../lib/admin-service.ts");

assert.match(layout, /data-admin-role=\{current\.profileRole\}/);
assert.match(layout, /GreyhoundIQ operator console/);
assert.match(
  layout,
  /text-\[11px\][^\n]*[\s\S]*?GreyhoundIQ operator console/
);
assert.match(layout, /Moderation mode · Admin mutations hidden/);
assert.match(layout, /if \(isFullAccessDemo\(\)\) return "Read-only demo"/);
assert.match(nav, /adminNavForRole\(operatorRole\)/);
assert.match(forms, /data-admin-min-role="admin"/);
assert.match(mutations, /assertAdminResourceMutation/);
assert.match(mutations, /redirect\(`\$\{target\}\?adminResult=success`\)/);
assert.match(adminService, /assertAdminSelfAccessChange/);
assert.match(submit, /useFormStatus/);
assert.match(submit, /window\.confirm/);
assert.match(error, /unstable_retry/);
assert.match(loading, /Loading admin control centre/);

console.log("admin premium security contract passed");
