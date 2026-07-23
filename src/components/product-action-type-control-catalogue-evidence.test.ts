import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  buildProductionActionTypeControlCatalogue,
  classifyActionTypeSource,
  collectProductionReachableSourcePaths,
} from "../../scripts/action-type-source-catalogue";
import {
  PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE,
  PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_EVIDENCE_FILE,
  PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_MASTER_EVIDENCE,
  PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_OPEN_REQUIREMENT_IDS,
  PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_REQUIREMENT_IDS,
  PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_SCANNER_FILE,
  PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_SCOPE,
  PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_TEST_FILE,
  PRODUCT_ACTION_TYPE_REQUIREMENT_IDS,
} from "./product-action-type-control-catalogue-evidence";
import { SCREEN_CONTRACT_BY_ROUTE } from "./demo-experience-registry";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

const repositoryRoot = path.resolve(__dirname, "../..");

assert.equal(PRODUCT_ACTION_TYPE_REQUIREMENT_IDS.length, 29);
assert.equal(PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_REQUIREMENT_IDS.length, 29);
assert.equal(PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_OPEN_REQUIREMENT_IDS.length, 0);
assert.equal(
  new Set(PRODUCT_ACTION_TYPE_REQUIREMENT_IDS).size,
  PRODUCT_ACTION_TYPE_REQUIREMENT_IDS.length,
);
assert.deepEqual(
  [
    ...PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_REQUIREMENT_IDS,
    ...PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_OPEN_REQUIREMENT_IDS,
  ].toSorted(),
  [...PRODUCT_ACTION_TYPE_REQUIREMENT_IDS].toSorted(),
  "the closed and open partitions must cover all 29 ACTION.TYPE requirements",
);
assert.deepEqual(
  Object.keys(PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_MASTER_EVIDENCE),
  [...PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_REQUIREMENT_IDS],
);
assert.deepEqual(
  Object.keys(PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE),
  [...PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_REQUIREMENT_IDS],
);

const productRequirementIds = new Set(
  PRODUCT_MASTER_REQUIREMENTS.map(({ id }) => id),
);
for (const requirementId of PRODUCT_ACTION_TYPE_REQUIREMENT_IDS) {
  assert.equal(productRequirementIds.has(requirementId), true, requirementId);
}
for (const requirementId of PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_REQUIREMENT_IDS) {
  const evidence =
    PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "tested");
  assert.deepEqual(evidence.evidence, [
    PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_EVIDENCE_FILE,
    PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_SCANNER_FILE,
    PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_TEST_FILE,
  ]);
  for (const evidencePath of evidence.evidence) {
    assert.equal(existsSync(path.join(repositoryRoot, evidencePath)), true);
  }
}
for (const requirementId of PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_OPEN_REQUIREMENT_IDS) {
  assert.equal(
    requirementId in PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_MASTER_EVIDENCE,
    false,
    `${requirementId} must remain explicitly open`,
  );
}

assert.match(PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_SCOPE, /source-static/i);
assert.match(PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_SCOPE, /does not establish/i);
assert.match(PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_SCOPE, /hydration/i);
assert.match(PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_SCOPE, /accessible naming/i);
assert.match(PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_SCOPE, /SHA-256/i);
assert.doesNotMatch(
  readFileSync(
    path.join(repositoryRoot, PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_EVIDENCE_FILE),
    "utf8",
  ),
  /(?:from\s+["']node:|require\(["']node:)/,
  "the client-safe master-evidence export must not import Node built-ins",
);

assertSyntheticMatcherCoverage();

const reachableSourcePaths = collectProductionReachableSourcePaths(repositoryRoot);
assert.ok(reachableSourcePaths.length >= 390);
for (const requiredSource of [
  "src/app/feed/page.tsx",
  "src/app/races/page.tsx",
  "src/app/results/page.tsx",
  "src/app/admin/form-controls.tsx",
  "src/components/media-attachment-fields.tsx",
  "src/components/media-focal-point-editor.tsx",
  "src/components/processed-video.tsx",
]) {
  assert.ok(reachableSourcePaths.includes(requiredSource), requiredSource);
}
for (const excludedPrefix of [
  "src/app/account/appearance/",
  "src/app/design-lab/",
  "src/app/feed/device-preview/",
  "src/app/marketplace/design-lab/",
]) {
  assert.equal(
    reachableSourcePaths.some((sourcePath) =>
      sourcePath.startsWith(excludedPrefix),
    ),
    false,
    `${excludedPrefix} is not production reachable`,
  );
}
for (const excludedRoute of [
  "/account/appearance",
  "/design-lab",
  "/design-lab/demo-experience",
  "/design-lab/dock-skins",
  "/design-lab/role-blueprints",
  "/feed/device-preview",
  "/marketplace/design-lab",
]) {
  const contract = SCREEN_CONTRACT_BY_ROUTE.get(excludedRoute);
  assert.ok(contract, `${excludedRoute} must remain in the screen registry`);
  assert.equal(
    contract.productionEnabled,
    false,
    `${excludedRoute} must not be excluded from source-static evidence after becoming production enabled`,
  );
}
assert.match(
  readFileSync(
    path.join(repositoryRoot, "src/app/account/appearance/page.tsx"),
    "utf8",
  ),
  /type="radio"/,
  "the verified radio absence depends on excluding the production-disabled appearance preview",
);

const actualCatalogue =
  buildProductionActionTypeControlCatalogue(repositoryRoot);
assert.deepEqual(
  PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_REQUIREMENT_IDS.filter(
    (requirementId) =>
      PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE[requirementId].controlIds ===
      undefined,
  ),
  [
    "ACTION.TYPE.buttons",
    "ACTION.TYPE.links",
    "ACTION.TYPE.messages",
    "ACTION.TYPE.billing",
    "ACTION.TYPE.admin",
    "ACTION.TYPE.media",
  ],
  "only the reviewed high-cardinality catalogues may use count-and-digest snapshots",
);
for (const requirementId of PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_REQUIREMENT_IDS) {
  const actualControlIds = actualCatalogue[requirementId].map(
    ({ controlId }) => controlId,
  );
  const snapshot = PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE[requirementId];
  if (snapshot.controlIds !== undefined) {
    if (JSON.stringify(actualControlIds) !== JSON.stringify(snapshot.controlIds)) {
      console.error(
        `Actual ${requirementId} controlIds:\n${JSON.stringify(actualControlIds, null, 2)}`,
      );
    }
    assert.deepEqual(
      actualControlIds,
      snapshot.controlIds,
      `${requirementId} source-control identities changed`,
    );
    assert.equal(snapshot.controlCount, undefined);
    assert.equal(snapshot.controlDigest, undefined);
  } else {
    const actualDigest = controlIdDigest(actualControlIds);
    if (
      actualControlIds.length !== snapshot.controlCount ||
      actualDigest !== snapshot.controlDigest
    ) {
      console.error(
        `${requirementId} snapshot: count=${actualControlIds.length} digest=${actualDigest}`,
      );
    }
    assert.ok((snapshot.controlCount ?? 0) > 0, requirementId);
    assert.match(snapshot.controlDigest ?? "", /^[a-f0-9]{64}$/);
    assert.equal(actualControlIds.length, snapshot.controlCount, requirementId);
    assert.equal(
      actualDigest,
      snapshot.controlDigest,
      `${requirementId} source-control digest changed`,
    );
  }
}

const allControlIds = new Set<string>();
let controlCount = 0;
for (const requirementId of PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_REQUIREMENT_IDS) {
  const controls = actualCatalogue[requirementId];
  const snapshot = PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE[requirementId];
  assert.equal(
    snapshot.state,
    controls.length === 0 ? "absent" : "present",
    `${requirementId} must explicitly record presence or verified absence`,
  );
  for (const control of controls) {
    assert.equal(control.category, requirementId);
    assert.ok(control.controlId.startsWith(`${control.sourcePath}::`));
    assert.ok(control.controlId.includes(`::${control.symbol}::`));
    assert.ok(control.controlId.includes(`::${control.category}::`));
    assert.ok(control.controlId.includes(`::${control.primitive}::`));
    assert.equal(allControlIds.has(control.controlId), false, control.controlId);
    assert.doesNotMatch(control.controlId, /::line-\d+/);
    assert.ok(control.signature.length > 0);
    assert.ok(control.line > 0);
    assert.equal(
      existsSync(path.join(repositoryRoot, control.sourcePath)),
      true,
      control.sourcePath,
    );
    allControlIds.add(control.controlId);
  }
  controlCount += controls.length;
}
const expectedControlCount =
  PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_REQUIREMENT_IDS.reduce(
    (total, requirementId) => {
      const snapshot = PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE[requirementId];
      return total + (snapshot.controlIds?.length ?? snapshot.controlCount ?? 0);
    },
    0,
  );
assert.equal(controlCount, expectedControlCount);
assert.equal(allControlIds.size, expectedControlCount);
assert.deepEqual(
  PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_REQUIREMENT_IDS.filter(
    (requirementId) =>
      PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE[requirementId].state === "absent",
  ),
  ["ACTION.TYPE.radios"],
);

console.log(
  `Action-type source catalogue passed: ${reachableSourcePaths.length} production-reachable files, ${controlCount} stable controls, 28 present categories, 1 verified-absent category, 29 ACTION.TYPE closures, 0 explicitly open`,
);

function assertSyntheticMatcherCoverage() {
  const positive = classifyActionTypeSource(
    "src/fixtures/action-type-positive.tsx",
    `
      import { X } from "lucide-react";
      function PositiveControls() {
        return <>
          <button aria-label="Close"><X aria-hidden="true" /></button>
          <a href="/card" className="giq-panel">Open card</a>
          <nav className="product-tabs"><Link aria-current="page">Latest</Link></nav>
          <details><summary>More</summary></details>
          <select name="sort"><option>Newest</option></select>
          <button aria-pressed={true}>Mute</button>
          <nav aria-label="Results pages"><Link>Next</Link></nav>
          <button>{hasMore ? "Load more comments" : "Done"}</button>
          <button aria-haspopup="menu">More actions</button>
          <form><input name="state" /><button>Filter</button></form>
          <FilterChip />
          <button>Save changes</button>
          <button aria-label="Add like reaction">Like</button>
          <button>Share post</button>
          <button>Voice call</button>
          <button>Send message</button>
          <button>Add comment</button>
          <button>Open notifications</button>
          <button>Manage billing</button>
          <button>Open admin dashboard</button>
          <button>Upload media</button>
          <input name="date" type="date" />
          <Input role="combobox" placeholder="Search profiles" />
          <input name="enabled" type="checkbox" />
          <input name="choice" type="radio" />
          <AutoSubmitSelect name="state" />
          <input name="zoom" type="range" />
          <input type="file" accept="image/*" />
          <ProcessedVideo />
        </>;
      }
    `,
  );
  for (const requirementId of PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_REQUIREMENT_IDS) {
    assert.ok(
      positive[requirementId].length > 0,
      `positive fixture missing ${requirementId}`,
    );
  }

  const negative = classifyActionTypeSource(
    "src/fixtures/action-type-negative.tsx",
    `
      function NegativeControls() {
        return <>
          <Radio />
          <Search />
          <SlidersHorizontal />
          <input type="hidden" name="date" />
          <input type="hidden" name="sort" />
          <video autoPlay />
          <div className="tabs">Prose only</div>
          <section className="sort copy"><button>Read more</button></section>
          <button data-pressed="true">Not a toggle</button>
          <button>Next race</button>
          <section className="filter copy"><button>Read more</button></section>
          <p>Save money with annual billing.</p>
          <p>Reaction documentation.</p>
          <p>Share ownership listing.</p>
          <p>Call support documentation.</p>
          <p>Message retention documentation.</p>
          <p>Comment moderation documentation.</p>
          <p>Notification retention documentation.</p>
          <p>Billing policy documentation.</p>
          <p>Admin policy documentation.</p>
          <p>Media policy documentation.</p>
        </>;
      }
    `,
  );
  for (const requirementId of PRODUCT_ACTION_TYPE_CONTROL_CATALOGUE_REQUIREMENT_IDS) {
    if (requirementId === "ACTION.TYPE.buttons") {
      assert.ok(negative[requirementId].length > 0);
      continue;
    }
    assert.equal(
      negative[requirementId].length,
      0,
      `negative fixture falsely matched ${requirementId}`,
    );
  }
}

function controlIdDigest(controlIds: readonly string[]) {
  return createHash("sha256").update(JSON.stringify(controlIds)).digest("hex");
}
