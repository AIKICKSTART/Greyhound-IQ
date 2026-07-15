import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MasterAuditGroup } from "./master-audit-checklist";
import type { MasterAuditRequirement } from "./master-audit-requirements";

const complete: MasterAuditRequirement = {
  id: "test.complete",
  prompt: "product",
  promptId: "test",
  section: "test",
  requirement: "Evidence-backed requirement",
  status: "verified",
  evidence: ["test:evidence"],
  owner: "Test owner",
  releaseBlocking: true,
};
const incomplete: MasterAuditRequirement = {
  ...complete,
  id: "test.incomplete",
  evidence: [],
};
const html = renderToStaticMarkup(
  createElement(MasterAuditGroup, { items: [complete, incomplete] }),
);

assert.match(html, /<details/);
assert.match(html, /1\/2 complete/);
assert.doesNotMatch(
  html,
  /data-requirement-id=/,
  "collapsed audit groups must not render requirement rows",
);
assert.doesNotMatch(html, /role="checkbox"/);

const outputOnlyHtml = renderToStaticMarkup(
  createElement(MasterAuditGroup, {
    items: [
      {
        ...complete,
        id: "test.output",
        section: "outputs",
        verificationScope: "output-existence-only",
      },
    ],
  }),
);
assert.match(outputOnlyHtml, /output existence only/);

const finalReportOnlyHtml = renderToStaticMarkup(
  createElement(MasterAuditGroup, {
    items: [
      {
        ...complete,
        id: "test.final-report",
        prompt: "security",
        section: "final-summary-metric",
        verificationScope: "final-report-structure-only",
      },
    ],
  }),
);
assert.match(finalReportOnlyHtml, /final report structure only/);

console.log("Master audit checklist lazy group tests passed");
