import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { serializeJsonLd } from "../src/components/json-ld";
import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  XSS_ALLOWLIST_SANITIZER_NOT_APPLICABLE,
  XSS_IMPLEMENTATION_CONTROL_MASTER_EVIDENCE,
  XSS_SURFACE_EVIDENCE_SCOPE,
  XSS_SURFACE_REVIEW_MASTER_EVIDENCE,
} from "./xss-surface-evidence";
import {
  XSS_IMPLEMENTATION_CONTROL_REQUIREMENT_IDS,
  XSS_SURFACE_REVIEW_RECORDS,
  XSS_SURFACE_REVIEW_REQUIREMENT_IDS,
  type XssSurfaceReviewRecord,
  validateXssSurfaceReview,
} from "./xss-surface-review";

const immutableXssRequirements = SECURITY_MASTER_REQUIREMENTS.filter(
  (requirement) => requirement.section === "xss-surface",
);
const immutableIds = immutableXssRequirements.map((requirement) => requirement.id);

assert.equal(
  XSS_SURFACE_EVIDENCE_SCOPE,
  "source-sink-inventory-and-runtime-render-regression",
);
assert.equal(XSS_SURFACE_REVIEW_REQUIREMENT_IDS.length, 15);
assert.equal(XSS_IMPLEMENTATION_CONTROL_REQUIREMENT_IDS.length, 4);
assert.equal(new Set(XSS_SURFACE_REVIEW_REQUIREMENT_IDS).size, 15);
assert.equal(new Set(XSS_IMPLEMENTATION_CONTROL_REQUIREMENT_IDS).size, 4);
assert.deepEqual(
  [
    ...XSS_SURFACE_REVIEW_REQUIREMENT_IDS,
    ...XSS_IMPLEMENTATION_CONTROL_REQUIREMENT_IDS,
  ].toSorted(),
  immutableIds.toSorted(),
  "the review and open-control partitions must cover exactly the immutable XSS section",
);
assert.deepEqual(
  Object.keys(XSS_SURFACE_REVIEW_MASTER_EVIDENCE).toSorted(),
  [...XSS_SURFACE_REVIEW_REQUIREMENT_IDS].toSorted(),
  "master evidence must close only the 15 named surface reviews",
);
assert.deepEqual(
  Object.keys(XSS_IMPLEMENTATION_CONTROL_MASTER_EVIDENCE).toSorted(),
  [...XSS_IMPLEMENTATION_CONTROL_REQUIREMENT_IDS].toSorted(),
  "implementation evidence must cover exactly the four independent controls",
);

for (const record of XSS_SURFACE_REVIEW_RECORDS) {
  const evidence = XSS_SURFACE_REVIEW_MASTER_EVIDENCE[record.requirementId];
  assert.equal(evidence.status, "verified");
  for (const path of evidence.evidence) {
    assert.ok(existsSync(path), `missing XSS evidence path ${path}`);
  }
}

for (const requirementId of XSS_IMPLEMENTATION_CONTROL_REQUIREMENT_IDS) {
  const evidence = XSS_IMPLEMENTATION_CONTROL_MASTER_EVIDENCE[requirementId];
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.equal(evidence.status, "verified");
  for (const path of evidence.evidence) {
    assert.ok(existsSync(path), `missing XSS implementation evidence path ${path}`);
  }
  assert.deepEqual(SECURITY_MASTER_EVIDENCE[requirementId], evidence);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

const sourceReader = (path: string) =>
  existsSync(path) ? readFileSync(path, "utf8") : undefined;
assert.deepEqual(validateXssSurfaceReview(XSS_SURFACE_REVIEW_RECORDS, sourceReader), []);

const withoutPosts = XSS_SURFACE_REVIEW_RECORDS.filter(
  (record) => record.requirementId !== "security.xss-surface.user-posts",
);
assert.ok(
  validateXssSurfaceReview(withoutPosts).includes(
    "REQUIREMENT_MISSING:security.xss-surface.user-posts",
  ),
  "removing a reviewed surface must fail closed",
);

const duplicatedPosts = [
  ...XSS_SURFACE_REVIEW_RECORDS,
  XSS_SURFACE_REVIEW_RECORDS[0],
];
assert.ok(
  validateXssSurfaceReview(duplicatedPosts).includes(
    "REQUIREMENT_DUPLICATE:security.xss-surface.user-posts",
  ),
  "duplicating a reviewed surface must fail closed",
);

const controlPromoted = [
  ...XSS_SURFACE_REVIEW_RECORDS.slice(1),
  {
    ...XSS_SURFACE_REVIEW_RECORDS[0],
    requirementId: "security.xss-surface.context-escaping",
  },
] as unknown as readonly XssSurfaceReviewRecord[];
assert.ok(
  validateXssSurfaceReview(controlPromoted).includes(
    "IMPLEMENTATION_CONTROL_INCLUDED:security.xss-surface.context-escaping",
  ),
  "a static surface review cannot promote a separate implementation control",
);

const missingSourceFile = mutateRecord("security.xss-surface.comments", (record) => ({
  ...record,
  sourceAnchors: [
    {
      ...record.sourceAnchors[0],
      path: "security/does-not-exist.ts",
    },
    ...record.sourceAnchors.slice(1),
  ],
}));
assert.ok(
  validateXssSurfaceReview(missingSourceFile, sourceReader).includes(
    "SOURCE_FILE_MISSING:security.xss-surface.comments:security/does-not-exist.ts",
  ),
  "a missing source file must fail closed",
);

const missingRenderNeedle = mutateRecord(
  "security.xss-surface.seller-descriptions",
  (record) => ({
    ...record,
    renderAnchors: [
      {
        ...record.renderAnchors[0],
        needle: "__missing_seller_description_renderer__",
      },
      ...record.renderAnchors.slice(1),
    ],
  }),
);
assert.ok(
  validateXssSurfaceReview(missingRenderNeedle, sourceReader).includes(
    "RENDER_NEEDLE_MISSING:security.xss-surface.seller-descriptions:src/app/listings/page.tsx",
  ),
  "a stale render anchor must fail closed",
);

const unsupportedControlStatus = mutateRecord(
  "security.xss-surface.error-messages",
  (record) => ({
    ...record,
    currentControlStatus: "xss-safe",
  }),
) as unknown as readonly XssSurfaceReviewRecord[];
assert.ok(
  validateXssSurfaceReview(unsupportedControlStatus).includes(
    "CONTROL_STATUS_UNSUPPORTED:security.xss-surface.error-messages",
  ),
  "an unreviewed status label must fail closed",
);

const falseStoredRenderClaim = mutateRecord(
  "security.xss-surface.user-posts",
  (record) => ({
    ...record,
    storedRenderValidation: {
      ...record.storedRenderValidation,
      status: "not-applicable-non-stored",
    },
  }),
) as unknown as readonly XssSurfaceReviewRecord[];
assert.ok(
  validateXssSurfaceReview(falseStoredRenderClaim).includes(
    "STORED_RENDER_VALIDATION_NOT_OPEN:security.xss-surface.user-posts",
  ),
  "a stored rendered surface must keep runtime validation open",
);

const falseAiRendererClaim = mutateRecord(
  "security.xss-surface.ai-generated-output",
  (record) => ({
    ...record,
    storedRenderValidation: {
      ...record.storedRenderValidation,
      status: "required-open",
    },
  }),
) as unknown as readonly XssSurfaceReviewRecord[];
assert.ok(
  validateXssSurfaceReview(falseAiRendererClaim).includes(
    "NOT_RENDERED_VALIDATION_MISMATCH:security.xss-surface.ai-generated-output",
  ),
  "stored output that is not rendered must require validation before enablement",
);

const packageManifest = JSON.parse(readFileSync("package.json", "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const installedPackages = new Set([
  ...Object.keys(packageManifest.dependencies ?? {}),
  ...Object.keys(packageManifest.devDependencies ?? {}),
]);
for (const renderer of [
  "marked",
  "markdown-it",
  "react-markdown",
  "remark",
  "remark-html",
  "rehype-raw",
  "@mdx-js/react",
  "@tiptap/react",
  "quill",
  "slate",
  "lexical",
]) {
  assert.equal(
    installedPackages.has(renderer),
    false,
    `Markdown/rich renderer ${renderer} requires a new XSS surface review`,
  );
}

assert.match(XSS_ALLOWLIST_SANITIZER_NOT_APPLICABLE, /No stored, imported, Markdown, or rich-text value is rendered as HTML/);
assert.match(XSS_ALLOWLIST_SANITIZER_NOT_APPLICABLE, /serialized JSON-LD/);

const productionSources = listProductionSources("src");
const rawHtmlSinkLocations = productionSources.flatMap((path) =>
  readFileSync(path, "utf8")
    .split(/\r?\n/)
    .flatMap((line) =>
      line.includes("dangerouslySetInnerHTML")
        ? [{ path: normalizePath(path), source: line.trim() }]
        : [],
    ),
);
assert.deepEqual(
  rawHtmlSinkLocations,
  [
    {
      path: "src/components/json-ld.tsx",
      source: "dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}",
    },
  ],
  "production source must contain only the reviewed JSON-LD raw sink",
);

for (const [label, pattern] of [
  ["innerHTML assignment", /\.innerHTML\s*=/],
  ["outerHTML assignment", /\.outerHTML\s*=/],
  ["insertAdjacentHTML", /\binsertAdjacentHTML\s*\(/],
  ["contextual fragment", /\bcreateContextualFragment\s*\(/],
  ["document.write", /\bdocument\.write(?:ln)?\s*\(/],
  ["iframe srcDoc", /\bsrcDoc\s*=/],
] as const) {
  const matches = productionSources.filter((path) =>
    pattern.test(readFileSync(path, "utf8")),
  );
  assert.deepEqual(matches, [], `${label} is not an approved production HTML sink`);
}

const hostileStoredValue =
  '</p><img src=x onerror="globalThis.__xss=1"><script>globalThis.__xss=2</script><svg onload="globalThis.__xss=3">';
const renderedStoredSurfaces = XSS_SURFACE_REVIEW_RECORDS.filter(
  (record) =>
    record.persistence !== "non-stored" && record.renderMode !== "not-rendered",
);
assert.equal(renderedStoredSurfaces.length, 12);

for (const record of renderedStoredSurfaces) {
  const tag = record.renderMode === "react-text-and-url-attribute" ? "a" : "p";
  const markup = renderToStaticMarkup(
    createElement(
      tag,
      tag === "a"
        ? {
            href: "https://example.invalid/preview",
            rel: "noopener noreferrer nofollow",
            title: hostileStoredValue,
          }
        : { title: hostileStoredValue },
      hostileStoredValue,
    ),
  );
  const renderedTags = [...markup.matchAll(/<\/?([a-z][\w-]*)\b[^>]*>/gi)].map(
    (match) => match[1].toLowerCase(),
  );
  assert.deepEqual(
    renderedTags,
    [tag, tag],
    `${record.requirementId}: hostile stored text created an executable element`,
  );
  assert.match(markup, /&lt;\/p&gt;/);
  assert.doesNotMatch(markup, /<(?:script|img|svg|iframe|object|embed)\b/i);
  assert.doesNotMatch(markup, /href="(?:javascript|data):/i);
}

const serializedJsonLd = serializeJsonLd({ name: hostileStoredValue });
assert.doesNotMatch(serializedJsonLd, /</);
assert.match(serializedJsonLd, /\\u003c\/script>/);
const jsonLdMarkup = renderToStaticMarkup(
  createElement("script", {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: serializedJsonLd },
  }),
);
assert.equal((jsonLdMarkup.match(/<script\b/gi) ?? []).length, 1);
assert.equal((jsonLdMarkup.match(/<\/script>/gi) ?? []).length, 1);
assert.doesNotMatch(jsonLdMarkup, /<\/script>\s*<(?:script|img|svg)\b/i);

for (const plainTextRenderer of [
  "src/components/feed-post-card.tsx",
  "src/app/forum/threads/[id]/page.tsx",
  "src/app/p/[handle]/page.tsx",
]) {
  assert.equal(
    readFileSync(plainTextRenderer, "utf8").includes("dangerouslySetInnerHTML"),
    false,
    `${plainTextRenderer} must be re-reviewed if it gains an HTML sink`,
  );
}

assert.equal(
  readFileSync("src/app/agents/page.tsx", "utf8").includes("outputJson"),
  false,
  "live AI output must not appear without a new renderer review and stored-render test",
);
assert.equal(
  readFileSync("src/app/admin/support/page.tsx", "utf8").includes("body: true"),
  false,
  "support message bodies must not be selected for display without a new review",
);

console.log(
  "XSS surface evidence passed: 15 surface reviews and 4 source/runtime implementation controls verified; browser hydration remains a separate release exercise",
);

function mutateRecord(
  requirementId: string,
  mutate: (record: XssSurfaceReviewRecord) => unknown,
) {
  return XSS_SURFACE_REVIEW_RECORDS.map((record) =>
    record.requirementId === requirementId ? mutate(record) : record,
  ) as unknown as readonly XssSurfaceReviewRecord[];
}

function listProductionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return listProductionSources(path);
      return /\.(?:c|m)?(?:j|t)sx?$/.test(entry.name) &&
        !/\.(?:test|spec)\.(?:c|m)?(?:j|t)sx?$/.test(entry.name)
        ? [path]
        : [];
    })
    .toSorted();
}

function normalizePath(path: string) {
  return path.replaceAll("\\", "/");
}
