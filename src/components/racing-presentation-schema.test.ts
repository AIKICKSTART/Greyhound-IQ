import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import {
  getRacingPresentationSchema,
  RACING_PRESENTATION_ROUTES,
  RACING_PRESENTATION_SCHEMA_VERSION,
  RACING_ROUTE_PRESENTATION_SCHEMAS,
  RACING_SHARED_PRESENTATION_SCHEMA,
} from "./racing-presentation-schema";

assert.equal(RACING_PRESENTATION_SCHEMA_VERSION, 1);
assert.deepEqual(
  RACING_ROUTE_PRESENTATION_SCHEMAS.map(({ route }) => route),
  [...RACING_PRESENTATION_ROUTES],
);
assert.deepEqual(
  RACING_SHARED_PRESENTATION_SCHEMA.appliesTo,
  RACING_PRESENTATION_ROUTES,
);
assert.equal(RACING_ROUTE_PRESENTATION_SCHEMAS.length, 10);

const allPresentations = RACING_ROUTE_PRESENTATION_SCHEMAS.flatMap(
  ({ route, presentations }) =>
    presentations.map((presentation) => ({ route, ...presentation })),
);
assert.equal(allPresentations.length, 25);
assert.ok(
  allPresentations.reduce((total, presentation) => total + presentation.columns.length, 0) >=
    120,
);

const validColumnTypes = new Set([
  "boolean",
  "currency",
  "date",
  "decimal",
  "identifier",
  "integer",
  "percentage",
  "status",
  "text",
  "time",
  "url",
]);

for (const routeSchema of RACING_ROUTE_PRESENTATION_SCHEMAS) {
  assert.ok(routeSchema.presentations.length > 0, routeSchema.route);
  assert.equal(getRacingPresentationSchema(routeSchema.route), routeSchema);
  assert.equal(
    new Set(routeSchema.presentations.map(({ id }) => id)).size,
    routeSchema.presentations.length,
    `${routeSchema.route}: presentation IDs must be unique`,
  );

  for (const presentation of routeSchema.presentations) {
    assert.match(presentation.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(presentation.title.length >= 8, presentation.id);
    assert.ok(presentation.missingBehavior.length >= 30, presentation.id);
    assert.ok(presentation.columns.length > 0, presentation.id);
    assert.equal(existsSync(presentation.sourceFile), true, presentation.sourceFile);
    const source = readFileSync(presentation.sourceFile, "utf8");
    for (const marker of presentation.sourceMarkers) {
      assert.ok(
        source.includes(marker),
        `${routeSchema.route}/${presentation.id}: missing source marker ${marker}`,
      );
    }
    assert.equal(
      new Set(presentation.columns.map(({ key }) => key)).size,
      presentation.columns.length,
      `${routeSchema.route}/${presentation.id}: column keys must be unique`,
    );
    for (const column of presentation.columns) {
      assert.match(column.key, /^[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)*$/);
      assert.ok(column.label.length > 0, `${presentation.id}/${column.key}`);
      assert.equal(validColumnTypes.has(column.type), true, column.type);
      assert.equal(typeof column.nullable, "boolean");
    }
  }
}

assert.equal(existsSync(RACING_SHARED_PRESENTATION_SCHEMA.sourceFile), true);
const sharedSource = readFileSync(
  RACING_SHARED_PRESENTATION_SCHEMA.sourceFile,
  "utf8",
);
for (const marker of RACING_SHARED_PRESENTATION_SCHEMA.sourceMarkers) {
  assert.ok(sharedSource.includes(marker), marker);
}
assert.deepEqual(
  RACING_SHARED_PRESENTATION_SCHEMA.columns.map(({ key }) => key),
  ["providers", "latestResultAt", "checkedAt", "freshnessState"],
);

const expectedTableColumns = {
  "/races/[id]/runner-table": ["Box", "Runner", "Trainer", "Wgt", "Form", "Result"],
  "/dogs/[id]/recent-form": [
    "Date",
    "Track",
    "Dist",
    "Box",
    "Finish",
    "Time",
    "Grade",
    "Wgt",
    "1st Sec",
    "Mgn",
    "Winner / 2nd",
    "Video",
  ],
  "/results/result-runner-table": ["Box", "Dog", "Trainer", "Wgt", "Form", "Result"],
  "/statistics/trainer-leaderboard": [
    "Rank",
    "Trainer",
    "Wins",
    "Starts",
    "Places",
    "Win rate",
    "Prize money",
  ],
  "/breeding/sire-leaderboard": ["Sire", "Progeny", "Winners", "Strike %", "Earnings"],
} as const;

for (const [key, expectedLabels] of Object.entries(expectedTableColumns)) {
  const separator = key.lastIndexOf("/");
  const route = key.slice(0, separator);
  const presentationId = key.slice(separator + 1);
  const schema = RACING_ROUTE_PRESENTATION_SCHEMAS.find(
    (candidate) => candidate.route === route,
  );
  const presentation = schema?.presentations.find(
    (candidate) => candidate.id === presentationId,
  );
  assert.ok(presentation, key);
  assert.deepEqual(
    presentation.columns.map(({ label }) => label),
    [...expectedLabels],
    key,
  );
}

const schemaSource = readFileSync(
  "src/components/racing-presentation-schema.ts",
  "utf8",
);
assert.doesNotMatch(schemaSource, /from ["']node:/);
assert.doesNotMatch(schemaSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Racing presentation schema passed: 10 routes, 25 presentations, shared provenance, and every column/missing-data contract is source-bound.",
);
