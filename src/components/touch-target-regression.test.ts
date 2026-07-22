import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dockSource = readFileSync(
  "src/components/hub/hub-conversation-dock.tsx",
  "utf8",
);
const headerSource = readFileSync("src/components/header-nav.tsx", "utf8");
const contactSource = readFileSync("src/app/contact/page.tsx", "utf8");
const inputSource = readFileSync("src/components/ui/input.tsx", "utf8");

const minimizedChat = dockSource.slice(
  dockSource.indexOf("function MinimizedChatBubble"),
  dockSource.indexOf("function MessageAttachments"),
);

assert.match(minimizedChat, /onClick=\{onClose\}[\s\S]*?className="[^"]*size-11/);
assert.doesNotMatch(minimizedChat, /opacity-0|group-hover/);
assert.match(headerSource, /<summary[\s\S]*?min-h-11/);
assert.match(headerSource, /flex min-h-11 items-center rounded-lg/);
assert.match(contactSource, /<summary className="flex min-h-11/);
assert.match(inputSource, /"h-11 w-full min-w-0/);

console.log("Live-app 44px touch-target regressions passed");
