export type ClientCallType = "voice" | "video";

type CallApiPayload = {
  item?: { id?: unknown; callType?: unknown };
  error?: { message?: unknown };
};

export async function createClientCallRoom(
  conversationId: string,
  callType: ClientCallType
) {
  const response = await fetch("/api/calls/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ conversationId, callType }),
  });
  const payload = (await response.json().catch(() => null)) as
    | CallApiPayload
    | null;
  if (!response.ok || typeof payload?.item?.id !== "string") {
    throw new Error(
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : "Could not create call"
    );
  }
  return {
    id: payload.item.id,
    callType: payload.item.callType === "voice" ? "voice" : "video",
  } satisfies { id: string; callType: ClientCallType };
}

export async function respondToClientCallInvite(
  roomId: string,
  action: "accept" | "decline"
) {
  const response = await fetch(`/api/calls/${roomId}/invite`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const payload = (await response.json().catch(() => null)) as
    | CallApiPayload
    | null;
  if (!response.ok) {
    throw new Error(
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : "Could not respond to call invite"
    );
  }
  return payload?.item ?? null;
}
