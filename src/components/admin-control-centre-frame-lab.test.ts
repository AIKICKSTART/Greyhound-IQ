import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ADMIN_DEVICE_FRAMES } from "./admin-control-centre-frame-lab";

// screen-evidence-test-id: DL-ADMIN-FRAME

assert.deepEqual(
  ADMIN_DEVICE_FRAMES.map(({ key, width, height }) => ({ key, width, height })),
  [
    { key: "desktop", width: 1440, height: 1000 },
    { key: "tablet", width: 834, height: 1112 },
    { key: "mobile", width: 390, height: 844 },
  ]
);

const source = readFileSync(
  join(__dirname, "admin-control-centre-frame-lab.tsx"),
  "utf8"
);
assert.equal(source.match(/<iframe/g)?.length, 1);
assert.match(source, /role="tablist"/);
assert.match(source, /aria-selected=/);
assert.match(source, /aria-controls="admin-control-centre-frame-panel"/);
assert.match(source, /role="tabpanel"/);
assert.match(source, /tabIndex=\{candidate\.key === frame\.key \? 0 : -1\}/);
assert.match(source, /event\.key === "ArrowRight"/);
assert.match(source, /event\.key === "ArrowLeft"/);
assert.match(source, /event\.key === "Home"/);
assert.match(source, /event\.key === "End"/);
assert.match(source, /aria-busy=/);
assert.match(source, /onLoad=\{\(\) => setLoadingKey\(null\)\}/);
assert.match(source, /Loading \{frame\.label\} Control Centre/);

console.log("admin Control Centre frame lab contract passed");
