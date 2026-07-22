import assert from "node:assert/strict";

import { resolveVetWorkspaceHeight } from "./VetFinder";

assert.equal(
  resolveVetWorkspaceHeight({
    viewportTop: 0,
    viewportHeight: 956,
    workspaceTop: 420,
    dockTop: 860,
  }),
  428,
);

assert.equal(
  resolveVetWorkspaceHeight({
    viewportTop: 120,
    viewportHeight: 320,
    workspaceTop: 40,
    dockTop: 440,
  }),
  308,
);

assert.equal(
  resolveVetWorkspaceHeight({
    viewportTop: 0,
    viewportHeight: 280,
    workspaceTop: 230,
    dockTop: 280,
  }),
  160,
);

assert.equal(
  resolveVetWorkspaceHeight({
    viewportTop: 0,
    viewportHeight: 1440,
    workspaceTop: 100,
    dockTop: 1440,
  }),
  800,
);

console.log("Vet workspace layout tests passed.");
