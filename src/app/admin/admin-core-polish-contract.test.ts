import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dashboardSource = readFileSync(join(__dirname, "page.tsx"), "utf8");
const usersSource = readFileSync(join(__dirname, "users", "page.tsx"), "utf8");
const reportsSource = readFileSync(join(__dirname, "reports", "page.tsx"), "utf8");
const safetySource = readFileSync(join(__dirname, "safety", "page.tsx"), "utf8");
const formControlsSource = readFileSync(
  join(__dirname, "form-controls.tsx"),
  "utf8"
);

for (const [name, source] of Object.entries({
  dashboard: dashboardSource,
  users: usersSource,
})) {
  assert.ok(
    source.includes("requireAdminProfile()"),
    `${name} must remain administrator protected`
  );
}

for (const [name, source] of Object.entries({
  reports: reportsSource,
  safety: safetySource,
})) {
  assert.ok(
    source.includes("requireModeratorProfile()"),
    `${name} must remain moderator protected`
  );
}

assert.ok(
  usersSource.includes('<AdminCreateUserForm path="/admin/users" />') &&
    usersSource.includes('<AdminUserAccessForm user={user} path="/admin/users" />') &&
    usersSource.includes("withDbSystemContext"),
  "User operations must retain audited controls and system-context reads"
);

for (const reportContract of [
  "action={action}",
  'name="action"',
  'name="notes"',
  "const action = resolveReport.bind(null, reportId)",
  "withDbSystemContext",
]) {
  assert.ok(
    reportsSource.includes(reportContract),
    `Report moderation must preserve: ${reportContract}`
  );
}

for (const safetyContract of [
  "action={createBannedPhrase}",
  'name="phrase"',
  'name="target"',
  'name="action"',
  'name="reason"',
  "setBannedPhraseActive.bind(",
  "resolveTrustSafetyFlag.bind(null, flag.id)",
]) {
  assert.ok(
    safetySource.includes(safetyContract),
    `Safety moderation must preserve: ${safetyContract}`
  );
}

for (const source of [usersSource, reportsSource, safetySource]) {
  assert.ok(
    source.includes('role="region"') &&
      source.includes("tabIndex={0}"),
    "Operational tables must remain keyboard-scrollable"
  );
}
assert.ok(
  reportsSource.includes("min-h-11") &&
    safetySource.includes("min-h-11") &&
    formControlsSource.includes("const SMALL_BUTTON") &&
    formControlsSource.includes("min-h-11"),
  "Audited admin controls must retain 44px targets"
);

assert.ok(
  dashboardSource.includes("focus-visible:ring-2") &&
    dashboardSource.includes("admin-attention-heading"),
  "Dashboard navigation must retain visible keyboard focus and queue hierarchy"
);

console.log("Core admin visual-polish contract tests passed");
