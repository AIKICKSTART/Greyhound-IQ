import assert from "node:assert/strict";
import {
  canReshareWithoutWidening,
  canViewAudience,
  defaultActorVisibility,
  defaultPostVisibility,
  isSocialAudience,
} from "./social-privacy";

assert.equal(defaultActorVisibility("personal"), "members");
assert.equal(defaultActorVisibility("page"), "public");
assert.equal(defaultPostVisibility("personal"), "connections");
assert.equal(defaultPostVisibility("page"), "public");

assert.equal(
  canViewAudience("public", {
    authenticated: false,
    owner: false,
    connected: false,
  }),
  true
);
assert.equal(
  canViewAudience("members", {
    authenticated: false,
    owner: false,
    connected: false,
  }),
  false
);
assert.equal(
  canViewAudience("connections", {
    authenticated: true,
    owner: false,
    connected: true,
  }),
  true
);
assert.equal(
  canViewAudience("only_me", {
    authenticated: true,
    owner: false,
    connected: true,
  }),
  false
);
assert.equal(
  canViewAudience("only_me", {
    authenticated: true,
    owner: true,
    connected: false,
  }),
  true
);

assert.equal(canReshareWithoutWidening("members", "connections"), true);
assert.equal(canReshareWithoutWidening("connections", "members"), false);
assert.equal(canReshareWithoutWidening("only_me", "public"), false);
assert.equal(isSocialAudience("connections"), true);
assert.equal(isSocialAudience("friends"), false);

console.log("social privacy tests passed");
