import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dockSource = readFileSync(
  join(__dirname, "hub-conversation-dock.tsx"),
  "utf8"
);
const panelSource = readFileSync(
  join(__dirname, "hub-messenger-panel.tsx"),
  "utf8"
);
const feedSource = readFileSync(
  join(__dirname, "..", "..", "app", "feed", "page.tsx"),
  "utf8"
);

assert.ok(
  feedSource.includes('conversation.participantAActor?.kind !== "page"') &&
    feedSource.includes('conversation.participantBActor?.kind !== "page"'),
  "Quick-chat calls must remain person-to-person"
);
assert.ok(
  panelSource.includes("canStartCall={canStartCall}"),
  "The server-derived call entitlement must reach quick chat"
);
assert.ok(
  dockSource.includes(
    '`/pulse/${encodeURIComponent(conversation.id)}?call=voice`'
  ) && dockSource.includes('canStartCall\n                  ?'),
  "Eligible call actions must use the existing audited Pulse call intent"
);
assert.ok(
  dockSource.includes('canStartCall\n                  ?') &&
    dockSource.includes(': "/pricing"'),
  "Ineligible members must not initiate calls"
);

const callIcon = dockSource.indexOf('<Phone className="h-3.5 w-3.5"');
const attachControl = dockSource.indexOf(
  "<MediaAttachmentFields key={attachmentResetKey} compact />",
  callIcon
);
assert.ok(
  callIcon >= 0 && attachControl > callIcon,
  "The quick-chat call icon must sit immediately beside the attachment control"
);
assert.ok(
  !dockSource.includes("createClientCallRoom"),
  "Quick chat must not duplicate the audited call client"
);

console.log("Quick-chat call control contract tests passed");
