import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dockSource = readFileSync(
  join(__dirname, "hub-conversation-dock.tsx"),
  "utf8",
);
const panelSource = readFileSync(
  join(__dirname, "hub-messenger-panel.tsx"),
  "utf8",
);
const feedSource = readFileSync(
  join(__dirname, "..", "..", "app", "feed", "page.tsx"),
  "utf8",
);
const realtimeRefreshSource = readFileSync(
  join(__dirname, "..", "realtime-refresh.tsx"),
  "utf8",
);

assert.ok(
  feedSource.includes('conversation.participantAActor?.kind !== "page"') &&
    feedSource.includes('conversation.participantBActor?.kind !== "page"'),
  "Quick-chat calls must remain person-to-person",
);
assert.ok(
  panelSource.includes("canStartCall={canStartCall}"),
  "The server-derived call entitlement must reach quick chat",
);
assert.ok(
  dockSource.includes(
    "`/pulse/${encodeURIComponent(conversation.id)}?call=voice`",
  ) &&
    dockSource.includes(
      "`/pulse/${encodeURIComponent(conversation.id)}?call=video`",
    ) &&
    /canStartCall\s*\?/.test(dockSource),
  "Eligible voice and video actions must use the existing audited Pulse call intent",
);
assert.ok(
  /canStartCall\s*\?/.test(dockSource) && dockSource.includes(': "/pricing"'),
  "Ineligible members must not initiate calls",
);

assert.ok(
  dockSource.includes(
    "function sendOnEnter(event: KeyboardEvent<HTMLTextAreaElement>)",
  ) &&
    dockSource.includes('event.key !== "Enter"') &&
    dockSource.includes("event.shiftKey") &&
    dockSource.includes("event.ctrlKey") &&
    dockSource.includes("event.altKey") &&
    dockSource.includes("event.metaKey") &&
    dockSource.includes("event.currentTarget.form?.requestSubmit()") &&
    dockSource.includes("onKeyDown={sendOnEnter}"),
  "Enter must send a quick-chat message while Shift+Enter remains a newline",
);
assert.ok(
  /`Start voice call with \$\{conversation\.otherName\}`/.test(dockSource) &&
    /`Start video call with \$\{conversation\.otherName\}`/.test(dockSource) &&
    dockSource.includes('<Phone className="h-4 w-4" aria-hidden="true" />') &&
    dockSource.includes('<Video className="h-4 w-4" aria-hidden="true" />'),
  "Every quick-chat window must expose labelled voice and video controls",
);
assert.ok(
  dockSource.includes("const startFallbackRefresh") &&
    dockSource.includes('status === "SUBSCRIBED"') &&
    dockSource.includes('status === "TIMED_OUT"') &&
    dockSource.includes('status === "CHANNEL_ERROR"') &&
    dockSource.includes('status === "CLOSED"') &&
    dockSource.includes('document.visibilityState === "visible"') &&
    dockSource.includes("!sendingRef.current") &&
    dockSource.includes("stopFallbackRefresh()"),
  "Quick chat must retain a bounded refresh fallback when Realtime is unavailable",
);
assert.ok(
  dockSource.includes('{ event: "conversation_updated" }') &&
    dockSource.includes("hasPendingAttachments") &&
    dockSource.includes("pendingMediaRefreshTimer"),
  "Quick chat must refresh pending attachment verdicts until they become terminal",
);
assert.ok(
  realtimeRefreshSource.includes("pollIntervalMs?: number") &&
    realtimeRefreshSource.includes("document.visibilityState"),
  "Realtime refresh must support visibility-gated polling",
);
assert.ok(
  dockSource.includes('id="pulse-conversation-launcher"') &&
    dockSource.includes('aria-controls="pulse-conversation-launcher"') &&
    dockSource.includes('isDesktop && layout !== "compact"'),
  "Mobile chat must hide its launcher from the accessibility tree",
);
assert.ok(
  !dockSource.includes("createClientCallRoom"),
  "Quick chat must not duplicate the audited call client",
);

console.log("Quick-chat call control contract tests passed");
