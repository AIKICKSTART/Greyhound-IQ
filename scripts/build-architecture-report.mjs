import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

const repositoryRoot = resolve(import.meta.dirname, "..");
const sourcePath = join(
  repositoryRoot,
  "docs/architecture/greyhoundiq-production-architecture-report.html",
);
const publicPath = join(
  repositoryRoot,
  "public/greyhoundiq-production-architecture.html",
);
const desktopPath = join(
  homedir(),
  "Desktop/GreyhoundIQ-Australia-Production-Architecture.html",
);

const source = await readFile(sourcePath, "utf8");
const sourceDigest = createHash("sha256").update(source).digest("hex");
const sourceWithManifest = source.replace(
  "</head>",
  `  <meta name="greyhoundiq-architecture-source-sha256" content="${sourceDigest}">\n</head>`,
);
const browserCandidates = [
  join(process.env.PROGRAMFILES ?? "", "Google/Chrome/Application/chrome.exe"),
  join(
    process.env["PROGRAMFILES(X86)"] ?? "",
    "Google/Chrome/Application/chrome.exe",
  ),
  join(
    process.env.LOCALAPPDATA ?? "",
    "Google/Chrome/Application/chrome.exe",
  ),
  join(process.env.PROGRAMFILES ?? "", "Microsoft/Edge/Application/msedge.exe"),
];

let browserExecutable;
for (const candidate of browserCandidates) {
  try {
    await access(candidate);
    browserExecutable = candidate;
    break;
  } catch {
    // Try the next installed Chromium browser.
  }
}

assert.ok(browserExecutable, "Chrome or Edge is required to compile Mermaid SVGs.");

const server = createServer((request, response) => {
  if (request.url !== "/report") {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(sourceWithManifest);
});
await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));

const responsiveViewportWidths = [390, 1024, 1440];
const responsiveDoms = [];
try {
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  for (const viewportWidth of responsiveViewportWidths) {
    const { stdout } = await execFile(
      browserExecutable,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--incognito",
        `--window-size=${viewportWidth},1200`,
        "--virtual-time-budget=15000",
        "--dump-dom",
        `http://127.0.0.1:${address.port}/report`,
      ],
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 90_000 },
    );
    responsiveDoms.push({ viewportWidth, dom: stdout });
  }
} finally {
  await new Promise((resolveClose, rejectClose) =>
    server.close((error) => (error ? rejectClose(error) : resolveClose())),
  );
}

for (const { viewportWidth, dom } of responsiveDoms) {
  assert.match(
    dom,
    /data-architecture-responsive-ready="true"/,
    `Architecture report overflow, overlap, or diagram-label containment failed at ${viewportWidth}px.`,
  );
  assert.doesNotMatch(
    dom,
    /data-architecture-responsive-failures=/,
    `Architecture report recorded responsive failures at ${viewportWidth}px.`,
  );
}
const dumpedDom = responsiveDoms.at(-1)?.dom ?? "";
const compiled = dumpedDom
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  .replace(/\r\n?/g, "\n")
  .replace(/[ \t]+$/gm, "");
assert.match(
  compiled,
  new RegExp(
    `<meta name="greyhoundiq-architecture-source-sha256" content="${sourceDigest}">`,
  ),
);
assert.equal([...compiled.matchAll(/<section[^>]+id="(s\d\d)"/g)].length, 30);
assert.equal((compiled.match(/class="task"/g) ?? []).length, 70);
const compiledDiagrams = [
  ...compiled.matchAll(/<article class="diagram"[\s\S]*?<\/article>/g),
].map((match) => match[0]);
assert.ok(compiledDiagrams.length >= 8);
const expectedMobileStepCounts = [
  17, 31, 10, 12, 10,
  11, 14, 15, 12, 12,
  9, 11, 10, 16, 15,
];
assert.equal(compiledDiagrams.length, expectedMobileStepCounts.length);
for (const [index, diagram] of compiledDiagrams.entries()) {
  assert.match(diagram, /<svg\b/);
  assert.match(
    diagram,
    /<h3 data-state="[^"]+">/,
    `Architecture diagram ${index + 1} is missing its visible evidence-state label.`,
  );
  assert.match(
    diagram,
    /class="diagram-viewport"[^>]+role="region"[^>]+aria-label="[^"]+ — full visual diagram"/,
    `Architecture diagram ${index + 1} is missing its contained responsive viewport.`,
  );
  assert.match(
    diagram,
    /class="diagram-mobile-flow"[^>]+aria-label="[^"]+ — responsive mobile flow"/,
    `Architecture diagram ${index + 1} is missing its responsive mobile flow.`,
  );
  assert.match(
    diagram,
    /class="diagram-mobile-step"/,
    `Architecture diagram ${index + 1} has no mobile flow steps.`,
  );
  assert.equal(
    (diagram.match(/class="diagram-mobile-step"/g) ?? []).length,
    expectedMobileStepCounts[index],
    `Architecture diagram ${index + 1} mobile flow is not semantically complete.`,
  );
  assert.match(
    diagram,
    /class="diagram-mobile-step-number" aria-hidden="true"/,
    `Architecture diagram ${index + 1} must not duplicate ordered-list numbering for assistive technology.`,
  );
  assert.match(
    diagram,
    /class="diagram-mobile-arrow" aria-label="to"/,
    `Architecture diagram ${index + 1} must expose a spoken endpoint relationship.`,
  );
  assert.doesNotMatch(
    diagram,
    /<g><\/g><\/svg>/,
    `Architecture diagram ${index + 1} compiled to an empty SVG.`,
  );
}
assert.equal(
  expectedMobileStepCounts.reduce((total, count) => total + count, 0),
  205,
);
assert.doesNotMatch(
  compiledDiagrams.map((diagram) => diagram.match(/<ol class="diagram-mobile-flow"[\s\S]*?<\/ol>/)?.[0] ?? "").join("\n"),
  /Cloud Cloud|admission \+ pool admission|Route Route|Versioned Versioned|-->|\.->|\s&amp;\s/,
  "Mobile architecture flows must not contain collapsed branches or re-expanded labels.",
);
assert.match(compiledDiagrams[1], /ESPv2 API gateway · australia-southeast1/);
assert.match(compiledDiagrams[1], /ESPv2 API gateway · australia-southeast2/);
assert.match(compiledDiagrams[8], /Verified new-account preflight · 16 July 2026/);
assert.match(compiledDiagrams[8], /No paid upgrade or billing mutation/);
assert.match(compiledDiagrams[9], /Design Lab · authenticated owner control layer/);
assert.match(compiledDiagrams[9], /pass plus independent approval/);
assert.match(compiledDiagrams[14], /Versioned CMS · pages blog news navigation SEO/);
assert.match(
  compiled,
  /<td data-label="[^"]+">/,
  "Responsive table cells must retain their visible mobile labels.",
);
const compiledTables = [...compiled.matchAll(/<table\b[\s\S]*?<\/table>/g)].map(
  (match) => match[0],
);
const compiledTableRows = compiledTables.reduce(
  (total, table) =>
    total +
    [...table.matchAll(/<tbody\b[\s\S]*?<\/tbody>/g)].reduce(
      (rows, body) => rows + (body[0].match(/<tr\b/g) ?? []).length,
      0,
    ),
  0,
);
assert.equal(
  (compiled.match(/class="mobile-table-cards"/g) ?? []).length,
  compiledTables.length,
  "Every report table must have one compact mobile record collection.",
);
assert.equal(
  (compiled.match(/class="mobile-table-record"/g) ?? []).length,
  compiledTableRows,
  "Every report table row must have one collapsed mobile record.",
);
assert.equal(
  (compiled.match(/class="table[^"]*"[^>]*aria-label="[^"]+"/g) ?? []).length,
  compiledTables.length,
  "Every architecture table must retain an accessible label.",
);
assert.doesNotMatch(compiled, /<script(?:\s|>)/i);
assert.equal(
  (compiled.match(/class="diagram-mobile-flow"/g) ?? []).length,
  compiledDiagrams.length,
  "Every architecture diagram must have one readable mobile flow.",
);
assert.doesNotMatch(
  compiled,
  /720px|760px|diagram-pan-|keyboard pan|scroll horizontally|Pan this full-resolution|diagram-scroll-hint/i,
  "Architecture diagrams must not retain a fixed canvas, pan control, or scroll instruction.",
);
for (const selectorPattern of [
  /\.diagram-mobile-step-number\{[^}]*font:900 12px\/1/,
  /\.diagram-mobile-route strong\{[^}]*font-size:12px/,
  /\.diagram-mobile-action\{[^}]*font-size:12px/,
  /\.mobile-table-key small,\.mobile-table-field dt\{[^}]*font:900 11px/,
  /\.mobile-table-toggle\{[^}]*font:900 11px/,
]) {
  assert.match(
    compiled,
    selectorPattern,
    "Mobile architecture flows and table labels must keep their minimum text floors.",
  );
}
for (const [index, diagram] of compiledDiagrams.entries()) {
  assert.match(
    diagram,
    /class="diagram-viewport"[^>]+tabindex="0"/,
    `Architecture diagram ${index + 1} must expose a keyboard-focusable bounded visual.`,
  );
  assert.match(
    diagram,
    /data-natural-width="([0-9]+)"/,
    `Architecture diagram ${index + 1} is missing its rendered natural width.`,
  );
  const naturalWidth = Number(diagram.match(/data-natural-width="([0-9]+)"/)?.[1]);
  assert.ok(
    naturalWidth > 0,
    `Architecture diagram ${index + 1} did not expose a valid rendered width.`,
  );
}
assert.match(
  compiled,
  /data-architecture-responsive-ready="true"/,
  "Architecture report failed its rendered no-overflow and bounded-label audit.",
);
assert.match(
  compiled,
  /\.table\{[^}]*overflow:hidden/,
  "Desktop architecture tables must be width-contained without scrolling.",
);
assert.match(
  compiled,
  /\.diagram-viewport\{[^}]*overflow:hidden/,
  "Architecture diagrams must fit their container without scrolling.",
);
assert.match(
  compiled,
  /\.table-wide table\{display:none\}\.table-wide \.mobile-table-cards\{display:grid/,
  "Overly wide tables must render as bounded records instead of cramped grids.",
);
assert.match(
  compiled,
  /\.mobile-table-cards,\.mobile-table-record,[^{]+\{min-width:0;max-width:100%\}/,
  "Mobile table records must be width-contained.",
);

await Promise.all([
  writeFile(publicPath, compiled, "utf8"),
  writeFile(desktopPath, compiled, "utf8"),
]);

console.log(
  `Architecture report compiled from ${sourceDigest}: 30 sections, 70 tasks, ${compiledDiagrams.length} complete inline SVG diagrams.`,
);
