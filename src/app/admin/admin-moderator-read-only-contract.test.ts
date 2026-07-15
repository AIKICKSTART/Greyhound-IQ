import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(__dirname, path), "utf8");

const dashboard = read("page.tsx");
const navigation = read("admin-nav.tsx");

assert.match(dashboard, /requireModeratorProfile\(\)/);
assert.match(
  dashboard,
  /operator\.profileRole !== "admin"\) redirect\("\/admin\/reports"\)/
);
assert.match(navigation, /adminHomeForRole\(operatorRole\)/);

for (const path of [
  "support/page.tsx",
  "bug-reports/page.tsx",
  "feedback/page.tsx",
]) {
  const source = read(path);
  assert.match(source, /current\.profileRole === "admin"/);
  assert.match(source, /Moderator access is read-only/);
  assert.match(source, /Administrator required/);
}

console.log("moderator landing and read-only control tests passed");
