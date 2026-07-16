import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { DesignLabDataFeedOperationsPanel } from "./design-lab-data-feed-operations-panel";
import {
  DESIGN_LAB_ALL_DATA_FEEDS,
  DESIGN_LAB_DATA_FEED_GATES,
} from "./design-lab-data-feed-registry";

const panelSource = readFileSync(
  join(__dirname, "design-lab-data-feed-operations-panel.tsx"),
  "utf8",
);
const html = renderToStaticMarkup(DesignLabDataFeedOperationsPanel());

assert.equal(DESIGN_LAB_ALL_DATA_FEEDS.length, 13);
assert.equal(DESIGN_LAB_DATA_FEED_GATES.length, 6);
assert.equal(count(html, "data-feed-id="), 13, "Every reviewed feed needs one card.");
assert.equal(
  count(html, 'data-runtime-status="unknown"'),
  13,
  "Missing server evidence must render UNKNOWN for every feed.",
);
assert.equal(count(html, 'data-runtime-snapshot="absent"'), 13);
assert.equal(count(html, 'data-freshness-threshold="unknown"'), 13);
assert.equal(count(html, "data-data-feed-gate="), 6);
assert.equal(count(html, 'data-release-blocking="true"'), 6);

for (const feed of DESIGN_LAB_ALL_DATA_FEEDS) {
  assert.ok(html.includes(`data-feed-id="${feed.id}"`), `missing card for ${feed.id}`);
  assert.ok(html.includes(feed.provider), `missing provider for ${feed.id}`);
  assert.ok(html.includes(feed.cadence.sourceDeclaredTrigger), `missing trigger for ${feed.id}`);
  for (const line of feed.lineage) assert.ok(html.includes(escapeHtml(line)));
  for (const journey of feed.downstreamJourneys) assert.ok(html.includes(escapeHtml(journey)));
  for (const fact of feed.verifiedCodeFacts) assert.ok(html.includes(escapeHtml(fact)));
  for (const label of feed.auth.secretReferenceLabels) {
    assert.ok(html.includes(label), `${feed.id} lost a safe secret-reference label.`);
  }
}

for (const gate of DESIGN_LAB_DATA_FEED_GATES) {
  assert.ok(html.includes(`data-data-feed-gate="${gate.id}"`));
  assert.ok(html.includes(gate.title));
  for (const criterion of gate.acceptanceCriteria) {
    assert.ok(html.includes(escapeHtml(criterion)));
  }
}

for (const requiredCopy of [
  "Read-only data operations registry",
  "Runtime status: UNKNOWN for all 13 feeds",
  "Refresh SLA",
  "Freshness thresholds",
  "Accountable owner",
  "Runbook",
  "Runtime evidence",
  "Licence",
  "Lineage, journeys, source facts and evidence gaps",
  "Nine cross-feed discovery gaps",
  "Six data-feed gates block production",
]) {
  assert.ok(html.includes(requiredCopy), `missing operational UI copy: ${requiredCopy}`);
}

assert.equal(/<table(?:\s|>)/i.test(html), false, "The responsive panel must not use a wide table.");
assert.ok(count(html, "<dl") >= 14, "Feed and summary facts should use definition lists.");
assert.ok(count(html, "<details") >= 14, "Each feed needs a native disclosure.");
assert.ok(count(html, "<summary") >= 14, "Every disclosure needs an accessible summary.");
assert.match(panelSource, /<summary className="[^"]*min-h-11/);
assert.equal(panelSource.includes('"use client"'), false, "The panel must remain server-renderable.");
const htmlWithoutSvgNamespace = html.replaceAll("http://www.w3.org/2000/svg", "");
assert.equal(
  /https?:\/\//i.test(htmlWithoutSvgNamespace),
  false,
  "No provider endpoint may be rendered.",
);
assert.equal(
  /(?:api[_-]?key|secret|token)\s*[:=]\s*[^\s,}<]+/i.test(html),
  false,
  "Credential values must never be rendered.",
);

console.log(
  "Design Lab data-feed operations panel passed: 13 responsive feed cards, 6 blocking gates and fail-closed runtime evidence.",
);

function count(value: string, needle: string) {
  return value.split(needle).length - 1;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
