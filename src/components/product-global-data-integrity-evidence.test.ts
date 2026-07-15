import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import {
  PRODUCT_GLOBAL_DATA_INTEGRITY_EVIDENCE_FILE,
  PRODUCT_GLOBAL_DATA_INTEGRITY_MASTER_EVIDENCE,
  PRODUCT_GLOBAL_DATA_INTEGRITY_REQUIREMENT_IDS,
  PRODUCT_GLOBAL_DATA_INTEGRITY_SCOPE,
  PRODUCT_GLOBAL_DATA_INTEGRITY_TEST_FILE,
} from "./product-global-data-integrity-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  RACING_PRODUCTION_FIXTURES,
} from "./product-racing-fixture-evidence";
import { RACING_ROUTE_PRESENTATION_SCHEMAS } from "./racing-presentation-schema";
import { RACING_STATISTIC_LINEAGE } from "./racing-statistic-lineage";

// screen-evidence-test-id: PRODUCT-GLOBAL-DATA-INTEGRITY-EVIDENCE

assert.deepEqual(PRODUCT_GLOBAL_DATA_INTEGRITY_REQUIREMENT_IDS, [
  "GLOBAL.DATA.missing-zero",
  "GLOBAL.DATA.delayed",
  "GLOBAL.DATA.conflicts",
  "GLOBAL.DATA.statistics",
  "GLOBAL.DATA.currency",
  "GLOBAL.DATA.time",
  "GLOBAL.DATA.refresh-race",
  "GLOBAL.DATA.optimistic",
]);

for (const requirementId of PRODUCT_GLOBAL_DATA_INTEGRITY_REQUIREMENT_IDS) {
  assert.equal(
    PRODUCT_MASTER_REQUIREMENTS.some(({ id }) => id === requirementId),
    true,
    requirementId,
  );
  const evidence = PRODUCT_GLOBAL_DATA_INTEGRITY_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested", requirementId);
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_GLOBAL_DATA_INTEGRITY_EVIDENCE_FILE,
    PRODUCT_GLOBAL_DATA_INTEGRITY_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));
}

assert.equal(RACING_ROUTE_PRESENTATION_SCHEMAS.length, 10);
const numericColumns = RACING_ROUTE_PRESENTATION_SCHEMAS.flatMap(({ presentations }) =>
  presentations.flatMap(({ columns }) =>
    columns.filter(({ type }) =>
      ["currency", "decimal", "integer", "percentage"].includes(type),
    ),
  ),
);
assert.ok(numericColumns.length > 0);
assert.equal(
  RACING_STATISTIC_LINEAGE.length,
  new Set(
    RACING_STATISTIC_LINEAGE.map(({ route, presentationId }) =>
      `${route}:${presentationId}`,
    ),
  ).size,
);
assert.ok(
  RACING_PRODUCTION_FIXTURES.some(
    ({ requirementId }) => requirementId === "RACING.FIX.delayed",
  ),
);
assert.ok(
  RACING_PRODUCTION_FIXTURES.some(
    ({ requirementId }) => requirementId === "RACING.FIX.source-conflict",
  ),
);
const sourceFiles = sourceFilesUnder("src");
const currencyFormatterFiles = sourceFiles.filter((file) =>
  readFileSync(file, "utf8").includes('style: "currency"'),
);
assert.deepEqual(currencyFormatterFiles, [
  "src/app/account/billing/page.tsx",
  "src/app/account/listings/seller-listings-page.tsx",
  "src/app/account/saved-listings/page.tsx",
  "src/app/admin/bespoke/page.tsx",
  "src/app/admin/page.tsx",
  "src/app/listings/[id]/page.tsx",
  "src/app/listings/page.tsx",
  "src/app/p/[handle]/page.tsx",
  "src/components/advertising-product-contract.ts",
  "src/components/meeting-detail-race-card.tsx",
  "src/lib/dog-statistic-presentation.ts",
]);
for (const sourceFile of currencyFormatterFiles) {
  const source = readFileSync(sourceFile, "utf8");
  assert.match(source, /(?:new Intl\.NumberFormat|\.toLocaleString)\("en-AU"/);
  assert.match(source, /\bcurrency\b/);
}

const dateTimeFormatterBlocks = sourceFiles.flatMap((sourceFile) =>
  formatterBlocks(readFileSync(sourceFile, "utf8"), "new Intl.DateTimeFormat").map(
    (source) => ({ sourceFile, source }),
  ),
);
assert.equal(dateTimeFormatterBlocks.length, 53);
for (const { sourceFile, source } of dateTimeFormatterBlocks) {
  assert.match(source, /timeZone\s*:/, sourceFile);
}

const feedSource = readFileSync("src/components/feed-infinite-list.tsx", "utf8");
assert.match(feedSource, /const paginationAbortRef = useRef<AbortController \| null>\(null\)/);
assert.match(feedSource, /const feedSessionEpochRef = useRef\(0\)/);
assert.match(
  feedSource,
  /controller\.signal\.aborted\s*\|\|\s*paginationAbortRef\.current !== controller\s*\|\|\s*feedSessionEpochRef\.current !== sessionEpoch/,
);
assert.match(
  feedSource,
  /!securityResetPending && !clientAuthoritative/,
);

const quickChatSource = readFileSync(
  "src/components/hub/hub-conversation-dock.tsx",
  "utf8",
);
assert.match(quickChatSource, /const optimisticId = `pending-\$\{crypto\.randomUUID\(\)\}`/);
assert.match(quickChatSource, /await loadMessages\(\)/);
assert.match(
  quickChatSource,
  /current\.filter\(\(message\) => message\.id !== optimisticId\)/,
);

const messageComposerSource = readFileSync(
  "src/components/instant-message-composer.tsx",
  "utf8",
);
assert.match(messageComposerSource, /setPendingBody\(body\)/);
assert.match(messageComposerSource, /startTransition\(\(\) => router\.refresh\(\)\)/);
assert.match(messageComposerSource, /catch \(err\) \{\s*setPendingBody\(null\)/);
assert.match(
  messageComposerSource,
  /useEffect\(\(\) => \{[\s\S]*?if \(refreshing\) return;/,
);

assert.match(PRODUCT_GLOBAL_DATA_INTEGRITY_SCOPE, /every current currency formatter/i);
assert.match(PRODUCT_GLOBAL_DATA_INTEGRITY_SCOPE, /every current date-time formatter/i);
assert.match(PRODUCT_GLOBAL_DATA_INTEGRITY_SCOPE, /feed rejects stale or superseded response writes/i);
assert.match(PRODUCT_GLOBAL_DATA_INTEGRITY_SCOPE, /optimistic message paths/i);

console.log(
  "Global data-integrity evidence passed: eight local data contracts are source-bound, including currency, timezone, stale-refresh and optimistic-message controls.",
);

function sourceFilesUnder(root: string) {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) {
        visit(path);
      } else if (/\.[cm]?[jt]sx?$/.test(entry) && !/\.test\.[cm]?[jt]sx?$/.test(entry)) {
        files.push(relative(".", path).replace(/\\/g, "/"));
      }
    }
  };
  visit(root);
  return files.toSorted();
}

function formatterBlocks(source: string, marker: string) {
  const blocks: string[] = [];
  let start = 0;
  while ((start = source.indexOf(marker, start)) >= 0) {
    const optionsStart = source.indexOf("{", start);
    assert.notEqual(optionsStart, -1, `Missing ${marker} options`);
    let depth = 0;
    let end = -1;
    for (let index = optionsStart; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1;
      if (source[index] === "}") depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
    assert.notEqual(end, -1, `Unclosed ${marker} formatter`);
    blocks.push(source.slice(start, end + 1));
    start = end + 1;
  }
  return blocks;
}
