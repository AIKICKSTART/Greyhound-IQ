import assert from "node:assert/strict";

import { inspectRouteHtml, resolveAuditConcurrency } from "./audit-demo-routes";

assert.equal(resolveAuditConcurrency(), 1);
assert.equal(resolveAuditConcurrency("4"), 4);
for (const value of ["0", "5", "invalid"]) {
  assert.throws(() => resolveAuditConcurrency(value));
}

const complete = inspectRouteHtml(
  "<main><h1>Route heading</h1></main><script>$RX=function(){}</script>",
);
assert.equal(complete.hasMain, true);
assert.equal(complete.hasH1, true);
assert.equal(complete.hasReactStreamError, false);
assert.deepEqual(complete.errorMarkers, []);

const failedStream = inspectRouteHtml(
  '<main><h1>Shell heading</h1></main><script>$RX("B:0")</script>',
);
assert.equal(failedStream.hasReactStreamError, true);

console.log("demo route audit tests passed");
