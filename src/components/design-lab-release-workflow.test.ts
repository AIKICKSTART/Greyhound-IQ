import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(
  ".github/workflows/cloud-run-deploy.yml",
  "utf8"
);

assert.match(workflow, /actions: read/);
assert.match(workflow, /github\.event\.workflow_run\.event == 'push'/);
assert.match(
  workflow,
  /github\.event\.workflow_run\.head_branch == github\.event\.repository\.default_branch/
);
assert.match(workflow, /approved_sha:/);
assert.match(workflow, /evidence_sha256:/);
assert.match(workflow, /\^\[0-9a-fA-F\]\{40\}\$/);
assert.match(workflow, /\^\[0-9a-fA-F\]\{64\}\$/);
assert.match(workflow, /git merge-base --is-ancestor/);
assert.match(workflow, /actions\/workflows\/ci\.yml\/runs\?head_sha=/);
assert.match(
  workflow,
  /npm run check:design-lab-release --[\s\\]*--require-ready[\s\S]*--expected-evidence-sha256=/
);
assert.match(
  workflow,
  /gcloud artifacts docker images describe[\s\S]*image_summary\.digest/
);
assert.match(workflow, /immutable_image=/);
assert.match(workflow, /Deploy Cloud Run candidates[\s\S]*--no-traffic/);
assert.match(
  workflow,
  /SMOKE_BASE_URL="\$\{\{ steps\.deploy\.outputs\.candidate_url \}\}"/
);

const deployIndex = workflow.indexOf("- name: Deploy Cloud Run candidates");
const smokeIndex = workflow.indexOf("- name: Post-deploy smoke test");
const promoteIndex = workflow.indexOf("- name: Promote tested revisions");
assert.ok(deployIndex >= 0 && deployIndex < smokeIndex);
assert.ok(smokeIndex < promoteIndex);
assert.doesNotMatch(
  workflow.slice(deployIndex, smokeIndex),
  /run services update-traffic/
);
assert.match(
  workflow.slice(promoteIndex),
  /run services update-traffic[\s\S]*--to-revisions/
);

console.log("Design Lab production workflow gate tests passed");
