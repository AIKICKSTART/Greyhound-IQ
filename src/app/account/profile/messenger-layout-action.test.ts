import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

const authIndex = source.indexOf("requireCurrentUserProfile()");
const parseIndex = source.indexOf("messengerLayoutSchema.safeParse");
const updateIndex = source.indexOf("tx.profile.updateMany");

assert.ok(authIndex >= 0, "the action must authenticate the current profile");
assert.ok(parseIndex > authIndex, "authentication must happen before input parsing");
assert.ok(updateIndex > parseIndex, "validation must happen before the database write");
assert.match(source, /id:\s*current\.profileId/);
assert.match(source, /userId:\s*current\.dbUserId/);
assert.doesNotMatch(source, /formData\.get\(["'](?:userId|profileId)["']\)/);
assert.match(source, /isFullAccessDemo\(\)[\s\S]*demo\.read_only/);
assert.match(source, /revalidatePath\("\/",\s*"layout"\)/);

console.log("messenger layout action access-control tests passed");
