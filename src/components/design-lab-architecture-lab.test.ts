import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DesignLabArchitectureLab } from "./design-lab-architecture-lab";
import {
  ARCHITECTURE_COMPONENTS,
  ARCHITECTURE_EVIDENCE_SCOPE,
  ARCHITECTURE_INFRASTRUCTURE_SURFACES,
  ARCHITECTURE_TRUST_FLOWS,
} from "./design-lab-architecture-inventory";
import {
  GREYHOUNDIQ_ARCHITECTURE_TASK_SUMMARY,
  GREYHOUNDIQ_ARCHITECTURE_TASKS,
} from "./design-lab-architecture-plan";

const componentSource = readFileSync(
  join(__dirname, "design-lab-architecture-lab.tsx"),
  "utf8",
);
const reportPath = join(
  __dirname,
  "../../public/greyhoundiq-production-architecture.html",
);
const canonicalReportPath = join(
  __dirname,
  "../../docs/architecture/greyhoundiq-production-architecture-report.html",
);
const report = readFileSync(reportPath, "utf8");
const canonicalReport = readFileSync(canonicalReportPath, "utf8");
const canonicalReportDigest = createHash("sha256")
  .update(canonicalReport)
  .digest("hex");
const html = renderToStaticMarkup(createElement(DesignLabArchitectureLab));

assert.match(
  componentSource,
  /ARCHITECTURE_REPORT_HREF =\s*\n?\s*"\/greyhoundiq-production-architecture\.html"/,
);
assert.match(componentSource, /data-design-lab-architecture/);
assert.match(componentSource, new RegExp(canonicalReportDigest));
assert.match(componentSource, /Current candidate · evidence unverified/);
assert.match(
  componentSource,
  /title="GreyhoundIQ production architecture report"/,
);
assert.match(componentSource, /data-architecture-mobile-report/);
assert.match(componentSource, /data-architecture-report-frame/);
assert.match(componentSource, /loading="lazy"/);
assert.match(componentSource, /hidden h-\[78vh\][\s\S]*lg:block/);
assert.match(componentSource, /target="_blank"/);
assert.match(componentSource, /rel="noreferrer"/);
assert.match(html, /data-architecture-evidence-scope="source-static"/);
assert.match(html, new RegExp(ARCHITECTURE_EVIDENCE_SCOPE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.equal(
  (html.match(/data-architecture-surface=/g) ?? []).length,
  ARCHITECTURE_INFRASTRUCTURE_SURFACES.length,
);
assert.equal(
  (html.match(/data-architecture-component=/g) ?? []).length,
  ARCHITECTURE_COMPONENTS.length,
);
assert.equal(
  (html.match(/data-architecture-trust-flow=/g) ?? []).length,
  ARCHITECTURE_TRUST_FLOWS.length,
);
assert.match(html, /32\/32 source-mapped/);
assert.match(html, /16\/16 required flows/);
assert.deepEqual(
  [...report.matchAll(/<section[^>]+id="(s\d\d)"/g)].map((match) => match[1]),
  Array.from({ length: 30 }, (_, index) => `s${String(index + 1).padStart(2, "0")}`),
);
assert.equal(
  [...canonicalReport.matchAll(/<section[^>]+id="(s\d\d)"/g)].length,
  30,
  "The canonical source must retain all mandated sections.",
);
assert.equal(
  report.match(
    /<meta name="greyhoundiq-architecture-source-sha256" content="([a-f0-9]{64})">/,
  )?.[1],
  canonicalReportDigest,
  "The compiled architecture report must be built from the current canonical source.",
);
assert.equal((report.match(/class="task"/g) ?? []).length, 70);
assert.ok((report.match(/<svg/g) ?? []).length >= 7);
assert.equal(
  (report.match(/class="diagram-viewport"/g) ?? []).length,
  (report.match(/<article class="diagram"/g) ?? []).length,
  "Every diagram must retain one contained desktop visual viewport.",
);
assert.equal(
  (report.match(/class="diagram-mobile-flow"/g) ?? []).length,
  (report.match(/<article class="diagram"/g) ?? []).length,
  "Every diagram must have one readable semantic mobile flow.",
);
assert.equal((report.match(/class="diagram-mobile-step"/g) ?? []).length, 204);
assert.equal(
  (report.match(/class="diagram-mobile-step-number" aria-hidden="true"/g) ?? []).length,
  204,
);
assert.equal(
  (report.match(/class="diagram-mobile-arrow" aria-label="to"/g) ?? []).length,
  204,
);
assert.doesNotMatch(
  report,
  /Cloud Cloud|admission \+ pool admission|Route Route|Versioned Versioned/,
);
assert.doesNotMatch(report, /720px|760px|diagram-pan-|keyboard pan/i);
assert.match(report, /<td data-label="[^"]+">/);
assert.equal(
  (report.match(/class="mobile-table-cards"/g) ?? []).length,
  (report.match(/<table\b/g) ?? []).length,
);
assert.ok((report.match(/class="mobile-table-record"/g) ?? []).length > 400);
assert.equal(
  (report.match(/class="table"[^>]*tabindex="0"/g) ?? []).length,
  (report.match(/<table\b/g) ?? []).length,
);
assert.equal(
  (report.match(/class="diagram-scroll-hint"/g) ?? []).length,
  (report.match(/<article class="diagram"/g) ?? []).length,
);
assert.equal(
  (report.match(/data-readable-width="[0-9]+"/g) ?? []).length,
  (report.match(/<article class="diagram"/g) ?? []).length,
);
assert.match(canonicalReport, /\.mobile-table-cards\{display:grid;gap:8px\}/);
assert.match(canonicalReport, /@media\(max-width:480px\)\{\.mobile-table-field\{grid-template-columns:1fr/);
assert.match(canonicalReport, /\.diagram-mobile-flow\{display:grid;gap:8px\}/);
assert.match(canonicalReport, /\.diagram-viewport\{[^}]*overflow-x:auto/);
assert.match(canonicalReport, /--diagram-readable-width/);
assert.match(canonicalReport, /viewport\.tabIndex = 0/);
assert.match(canonicalReport, /@media\(max-width:820px\)[\s\S]*\.diagram-viewport\{display:none\}/);
assert.match(canonicalReport, /@media\(max-width:1200px\)[\s\S]*\.table table\{display:none\}/);
assert.match(canonicalReport, /th\{[^}]*font:900 10px/);
assert.match(canonicalReport, /td\{[^}]*font-size:11px/);
assert.match(canonicalReport, /\.diagram-mobile-route strong\{[^}]*font-size:12px/);
assert.match(canonicalReport, /\.mobile-table-key small,\.mobile-table-field dt\{[^}]*font:900 11px/);
assert.match(canonicalReport, /\.mobile-table-toggle\{[^}]*font:900 11px/);
assert.doesNotMatch(report, /<script(?:\s|>)/i);
assert.equal(GREYHOUNDIQ_ARCHITECTURE_TASKS.length, 70);
assert.equal(
  new Set(GREYHOUNDIQ_ARCHITECTURE_TASKS.map((task) => task.id)).size,
  GREYHOUNDIQ_ARCHITECTURE_TASKS.length,
);
assert.equal(GREYHOUNDIQ_ARCHITECTURE_TASK_SUMMARY.total, 70);
assert.equal(GREYHOUNDIQ_ARCHITECTURE_TASK_SUMMARY.releaseReady, false);

const reportTaskStatus = new Map(
  [...canonicalReport.matchAll(/\["(ARCH-\d{3})","[^"]+","([vapb])","/g)].map(
    (match) => [match[1], match[2]],
  ),
);
const reportStatusCode = {
  verified: "v",
  "in-progress": "a",
  planned: "p",
  blocked: "b",
} as const;
assert.equal(reportTaskStatus.size, GREYHOUNDIQ_ARCHITECTURE_TASKS.length);
for (const task of GREYHOUNDIQ_ARCHITECTURE_TASKS) {
  assert.equal(
    reportTaskStatus.get(task.id),
    reportStatusCode[task.status],
    `${task.id} status drifted between the canonical report and task registry.`,
  );
}

const phaseOneStatuses = Object.fromEntries(
  GREYHOUNDIQ_ARCHITECTURE_TASKS.filter(({ id }) =>
    /^ARCH-10\d$/.test(id),
  ).map(({ id, status }) => [id, status]),
);
assert.deepEqual(phaseOneStatuses, {
  "ARCH-101": "in-progress",
  "ARCH-102": "in-progress",
  "ARCH-103": "in-progress",
  "ARCH-104": "in-progress",
  "ARCH-105": "in-progress",
  "ARCH-106": "planned",
  "ARCH-107": "in-progress",
  "ARCH-108": "planned",
});

console.log("design lab architecture lab tests passed");
