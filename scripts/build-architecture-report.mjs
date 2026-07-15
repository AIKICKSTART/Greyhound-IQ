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

let dumpedDom;
try {
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const { stdout } = await execFile(
    browserExecutable,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--incognito",
      "--virtual-time-budget=15000",
      "--dump-dom",
      `http://127.0.0.1:${address.port}/report`,
    ],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 90_000 },
  );
  dumpedDom = stdout;
} finally {
  await new Promise((resolveClose, rejectClose) =>
    server.close((error) => (error ? rejectClose(error) : resolveClose())),
  );
}

const compiled = dumpedDom.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
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
  17, 30, 10, 12, 10,
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
  204,
);
assert.doesNotMatch(
  compiledDiagrams.map((diagram) => diagram.match(/<ol class="diagram-mobile-flow"[\s\S]*?<\/ol>/)?.[0] ?? "").join("\n"),
  /Cloud Cloud|admission \+ pool admission|Route Route|Versioned Versioned|-->|\.->|\s&amp;\s/,
  "Mobile architecture flows must not contain collapsed branches or re-expanded labels.",
);
assert.match(compiledDiagrams[1], /ESPv2 API gateway · australia-southeast1/);
assert.match(compiledDiagrams[1], /ESPv2 API gateway · australia-southeast2/);
assert.match(compiledDiagrams[8], /Verified current inventory · 13 July 2026/);
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
  (compiled.match(/class="table"[^>]*tabindex="0"/g) ?? []).length,
  compiledTables.length,
  "Every desktop table scroll region must remain keyboard focusable.",
);
assert.doesNotMatch(compiled, /<script(?:\s|>)/i);
assert.equal(
  (compiled.match(/class="diagram-mobile-flow"/g) ?? []).length,
  compiledDiagrams.length,
  "Every architecture diagram must have one readable mobile flow.",
);
assert.doesNotMatch(
  compiled,
  /720px|760px|diagram-pan-|keyboard pan|scroll horizontally/i,
  "Architecture diagrams must not retain the obsolete fixed canvas or pan-control implementation.",
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
    /class="diagram-viewport"[^>]+tabindex="0"[^>]+aria-describedby="[^"]+"/,
    `Architecture diagram ${index + 1} must expose a keyboard-focusable full visual.`,
  );
  assert.match(
    diagram,
    /data-readable-width="([0-9]+)"/,
    `Architecture diagram ${index + 1} is missing its calculated readable width.`,
  );
  const readableWidth = Number(diagram.match(/data-readable-width="([0-9]+)"/)?.[1]);
  assert.ok(
    readableWidth >= 900,
    `Architecture diagram ${index + 1} readable width is below the 900px visual floor.`,
  );
  assert.match(
    diagram,
    /class="diagram-scroll-hint"/,
    `Architecture diagram ${index + 1} is missing its visual navigation hint.`,
  );
}
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
