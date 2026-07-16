import assert from "node:assert/strict";
import {
  createClientCallRoom,
  respondToClientCallInvite,
} from "./call-client-actions";

const originalFetch = globalThis.fetch;
const requests: Array<{
  url: string;
  method: string | undefined;
  body: unknown;
}> = [];

async function main() {
  try {
    globalThis.fetch = async (input, init) => {
      requests.push({
        url: String(input),
        method: init?.method,
        body: JSON.parse(String(init?.body ?? "null")),
      });
      return Response.json({ item: { id: "room-1", callType: "voice" } });
    };

    assert.deepEqual(await createClientCallRoom("conversation-1", "voice"), {
      id: "room-1",
      callType: "voice",
    });
    await respondToClientCallInvite("room-1", "accept");
    await respondToClientCallInvite("room-2", "decline");
    assert.deepEqual(requests, [
      {
        url: "/api/calls/rooms",
        method: "POST",
        body: { conversationId: "conversation-1", callType: "voice" },
      },
      {
        url: "/api/calls/room-1/invite",
        method: "POST",
        body: { action: "accept" },
      },
      {
        url: "/api/calls/room-2/invite",
        method: "POST",
        body: { action: "decline" },
      },
    ]);

    globalThis.fetch = async () =>
      Response.json(
        { error: { message: "Calls require Pro" } },
        { status: 403 }
      );
    await assert.rejects(
      () => createClientCallRoom("conversation-1", "video"),
      /Calls require Pro/
    );
    await assert.rejects(
      () => respondToClientCallInvite("room-1", "accept"),
      /Calls require Pro/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main()
  .then(() => console.log("call client action tests passed"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
