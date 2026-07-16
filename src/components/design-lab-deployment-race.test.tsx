import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DesignLabDeploymentRace } from "./design-lab-deployment-race";
import { DESIGN_LAB_SYNC_SNAPSHOT } from "./design-lab-sync";

const markup = renderToStaticMarkup(
  createElement(DesignLabDeploymentRace, { basePath: "/design-lab" }),
);
const remaining =
  DESIGN_LAB_SYNC_SNAPSHOT.release.openChecks;

assert.match(markup, /data-design-lab-deployment-race="true"/);
assert.match(markup, /role="progressbar"/);
assert.match(markup, /data-greyhound-progress-runner="true"/);
assert.match(markup, /greyhoundiq-progress-runner\.png/);
assert.match(markup, /<svg[^>]+viewBox="0 0 2172 724"/);
assert.match(markup, /greyhoundiq-progress-runner-mask-key/);
assert.match(markup, /greyhoundiq-progress-runner-mask/);
assert.match(
  markup,
  new RegExp(
    `${DESIGN_LAB_SYNC_SNAPSHOT.release.completedChecks.toLocaleString("en-AU")}`,
  ),
);
assert.match(markup, new RegExp(`${remaining.toLocaleString("en-AU")}`));
assert.match(
  markup,
  new RegExp(
    `Native post-MVP</dt><dd[^>]*>${DESIGN_LAB_SYNC_SNAPSHOT.preproduction.postMvpTotal}</dd>`,
  ),
);
assert.match(
  markup,
  new RegExp(
    `${DESIGN_LAB_SYNC_SNAPSHOT.deploymentTarget.window} · (?:${remaining.toLocaleString("en-AU")} checks remain|approval window open)`,
  ),
);
assert.match(markup, /Promotion stays locked|protected human approval/);
assert.equal((markup.match(/data-finish-line-task=/g) ?? []).length, 7);
assert.match(markup, /data-finish-line-task="ARCH-705"/);
assert.match(markup, /href="\/design-lab\?area=requirements"/);
assert.match(markup, /href="\/design-lab\?area=architecture"/);

console.log("Design Lab deployment-race dashboard tests passed");
