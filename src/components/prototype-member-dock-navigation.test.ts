import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildPrototypeDemoHref,
  prototypeDockDestination,
} from "./prototype-dock-navigation";

const current = "?variant=B2&demo=1&dock=D2&sponsored=off";

assert.equal(
  buildPrototypeDemoHref(current, { variant: "C1" }),
  "/feed?variant=C1&demo=1&dock=D2&sponsored=off"
);
assert.equal(
  buildPrototypeDemoHref(current, { dock: "D6" }),
  "/feed?variant=B2&demo=1&dock=D6&sponsored=off"
);
assert.equal(prototypeDockDestination("home", current), "/");
assert.equal(
  prototypeDockDestination("feed", current),
  "/feed?variant=B2&demo=1&dock=D2&sponsored=off"
);
assert.equal(prototypeDockDestination("chat", current), "/pulse");
assert.equal(prototypeDockDestination("post", current), null);
assert.equal(prototypeDockDestination("menu", current), null);
assert.equal(
  buildPrototypeDemoHref(
    "?token=secret&variant=../../etc&demo=admin&dock=D99&sponsored=secret",
  ),
  "/feed?demo=1&sponsored=on",
);

const source = readFileSync(join(__dirname, "prototype-member-chrome.tsx"), "utf8");
assert.match(source, /useState<DockActionKey>\("feed"\)/);
assert.match(source, /window\.dispatchEvent\(new Event\("giq:open-feed-composer"\)\)/);
assert.match(source, /setMenuOpen\(true\)/);
assert.match(source, /Feed \{variant\}/);
assert.match(source, /Dock \{dock\}/);
assert.doesNotMatch(source, /`\/feed\$\{currentSearch\}`/);

console.log("prototype member dock navigation contract passed");
