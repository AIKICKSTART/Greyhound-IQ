import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { ENDPOINTS } from "../../../../../../security/endpoints";
import { RATE_LIMITS } from "../../../../../../security/rate-limits";

const deliveryRoute = readFileSync(
  "src/app/api/conversations/[id]/delivered/route.ts",
  "utf8",
);
const messagesRoute = readFileSync(
  "src/app/api/conversations/[id]/messages/route.ts",
  "utf8",
);
const threadPage = readFileSync("src/app/messages/[id]/page.tsx", "utf8");
const acknowledger = readFileSync(
  "src/components/conversation-delivery-acknowledger.tsx",
  "utf8",
);
const service = readFileSync("src/lib/conversation-service.ts", "utf8");
const messagesGet = messagesRoute.slice(
  messagesRoute.indexOf("export async function GET"),
  messagesRoute.indexOf("export async function POST"),
);

assert.match(deliveryRoute, /export async function POST\(/);
assert.doesNotMatch(deliveryRoute, /export async function GET\(/);
assert.match(deliveryRoute, /markConversationDelivered\(current, id\)/);
assert.match(deliveryRoute, /\{ failClosed: true \}/);
assert.doesNotMatch(messagesGet, /markConversationDelivered/);
assert.doesNotMatch(threadPage, /markConversationDelivered/);
assert.match(
  threadPage,
  /<ConversationDeliveryAcknowledger conversationId=\{conversation\.id\} \/>/,
);
assert.match(acknowledger, /method: "POST"/);
assert.match(acknowledger, /credentials: "same-origin"/);
assert.match(acknowledger, /if \(sent\.current\) return/);
assert.match(
  service,
  /deliveryReceipts: \{ none:[\s\S]*orderBy: \{ createdAt: "asc" \},[\s\S]*take: 200/,
);

assert.ok(
  ENDPOINTS.some(
    (entry) =>
      entry.endpointId === "HTTP.POST.API_CONVERSATIONS_PARAM_ID_DELIVERED",
  ),
);
const rateLimit = RATE_LIMITS.find(
  (entry) =>
    entry.route === "/api/conversations/[id]/delivered" &&
    entry.method === "POST",
);
assert.equal(rateLimit?.operationId, "postConversationsByIdDelivered");
assert.equal(rateLimit?.maximum, 20);
assert.equal(rateLimit?.failMode, "closed");

console.log("conversation delivery acknowledgement contract tests passed");
