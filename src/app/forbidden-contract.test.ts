import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const forbiddenPage = readFileSync("src/app/forbidden.tsx", "utf8");
const adminLayout = readFileSync("src/app/admin/layout.tsx", "utf8");
const nextConfig = readFileSync("next.config.ts", "utf8");

assert.match(nextConfig, /authInterrupts:\s*true/);
assert.match(adminLayout, /err\.message === "auth\.forbidden"/);
assert.match(adminLayout, /forbidden\(\)/);

assert.match(forbiddenPage, /export default function Forbidden\(\)/);
assert.match(forbiddenPage, /403 · Permission required/);
assert.match(forbiddenPage, /Access denied\./);
assert.match(forbiddenPage, /does not have permission/);
assert.match(forbiddenPage, /aria-labelledby="forbidden-title"/);
assert.match(forbiddenPage, /href="\/account"/);
assert.match(forbiddenPage, /href="\/"/);
assert.doesNotMatch(forbiddenPage, /window\.|use client|searchParams/);

console.log("Root forbidden boundary contract passed");
