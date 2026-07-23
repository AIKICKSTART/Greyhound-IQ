import assert from "node:assert/strict";

import {
  dockReducer,
  minimizedWindowIds,
  openWindowIds,
  MAX_OPEN_WINDOWS,
  type DockWindow,
} from "./hub-chat-window-state";

function reduce(actions: Parameters<typeof dockReducer>[1][]): DockWindow[] {
  return actions.reduce((state, action) => dockReducer(state, action), [] as DockWindow[]);
}

// Opening keeps windows expanded up to the cap, newest last.
const twoOpen = reduce([
  { type: "open", id: "a" },
  { type: "open", id: "b" },
]);
assert.deepEqual(openWindowIds(twoOpen), ["a", "b"]);
assert.deepEqual(minimizedWindowIds(twoOpen), []);

// Opening past the cap minimizes the oldest open window (Messenger behaviour).
const threeOpened = dockReducer(twoOpen, { type: "open", id: "c" });
assert.deepEqual(openWindowIds(threeOpened), ["b", "c"]);
assert.deepEqual(minimizedWindowIds(threeOpened), ["a"]);
assert.equal(openWindowIds(threeOpened).length, MAX_OPEN_WINDOWS);

// Re-opening an already-open window is idempotent (no duplicate, still open).
const reopened = dockReducer(twoOpen, { type: "open", id: "a" });
assert.deepEqual(openWindowIds(reopened), ["b", "a"]);
assert.equal(reopened.length, 2);

// Minimize collapses a window to a bubble without removing it.
const minimized = dockReducer(twoOpen, { type: "minimize", id: "a" });
assert.deepEqual(openWindowIds(minimized), ["b"]);
assert.deepEqual(minimizedWindowIds(minimized), ["a"]);

// Restoring a minimized window re-opens it, minimizing the oldest if over cap.
const restored = dockReducer(threeOpened, { type: "open", id: "a" });
assert.deepEqual(openWindowIds(restored), ["c", "a"]);
assert.deepEqual(minimizedWindowIds(restored), ["b"]);

// Close removes the window entirely from either state.
const closed = dockReducer(minimized, { type: "close", id: "a" });
assert.deepEqual(minimizedWindowIds(closed), []);
assert.deepEqual(openWindowIds(closed), ["b"]);

// Unknown ids are no-ops rather than throwing.
assert.deepEqual(dockReducer(twoOpen, { type: "close", id: "zzz" }), twoOpen);

console.log("hub chat window state tests passed");
