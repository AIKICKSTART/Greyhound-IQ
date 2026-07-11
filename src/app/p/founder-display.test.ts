import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const profilePage = readFileSync("src/app/p/[handle]/page.tsx", "utf8");
const authRoles = readFileSync("src/lib/auth-roles.ts", "utf8");

assert.match(profilePage, /personal\.isFounder \? "Founder" : "Member"/);
assert.match(profilePage, /Founder, GreyhoundIQ/);
assert.match(profilePage, /New South Wales, Australia/);
assert.doesNotMatch(authRoles, /isFounder/);

console.log("founder display contract tests passed");
