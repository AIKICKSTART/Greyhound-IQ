import assert from "node:assert/strict";
import {
  createClientCallRoom,
  respondToClientCallInvite,
} from "./call-client-actions";

const originalFetch = globalThis.fetch;
const requests: Array<{ url: string; body: unknown }> = [];

async function main() {
  try {
    globalThis.fetch = async (input, init) => {
      requests.push({
        url: String(input),
        body: JSON.parse(String(init?.body ?? "null")),
      });
      return Response.json({ item: { id: "room-1", callType: "voice" } });
    };

    assert.deepEqual(await createClientCallRoom("conversation-1", "voice"), {
      id: "room-1",
      callType: "voice",
    });
    await respondToClientCallInvite("room-1", "accept");
    assert.deepEqual(requests, [
      {
        url: "/api/calls/rooms",
        body: { conversationId: "conversation-1", callType: "voice" },
      },
      {
        url: "/api/calls/room-1/invite",
        body: { action: "accept" },
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
